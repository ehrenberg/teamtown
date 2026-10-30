import { Logger } from '@nestjs/common';
import {
  decodeClientCommand,
  encodeMessage,
  type ClientCommand,
  type NackCode,
  type ServerEvent,
} from '@teamtown/contracts';
import type { Clock } from '@teamtown/kernel';
import type { WebSocket } from 'ws';
import type { Authenticate } from '../../../identity/public-api.ts';
import type { ResolvePerson } from '../../../people/public-api.ts';
import type {
  AnswerCall,
  AnswerKnock,
  CancelKnock,
  ConversationQueries,
  InviteToCall,
  KnockOnRoom,
  LeaveCall,
  RequestConversationToken,
  RequestDirectCallToken,
  RequestRoomCallToken,
  SetConversationLock,
  StartCall,
} from '../../../meetings/public-api.ts';
import type { JoinFloor, MoveTo, Occupant, PresenceQueries, SetDoorMode } from '../../../presence/public-api.ts';
import { toAvatarContract, toConversationContract, toRoomCallContract } from './contract-mapping.ts';
import type { CommandOutcome, RealtimeTelemetry } from './realtime-telemetry.ts';

export interface SessionDependencies {
  readonly authenticate: Authenticate;
  readonly resolvePerson: ResolvePerson;
  readonly joinFloor: JoinFloor;
  readonly moveTo: MoveTo;
  readonly clock: Clock;
  readonly telemetry: RealtimeTelemetry;
  readonly conversations: ConversationQueries;
  readonly setConversationLock: SetConversationLock;
  readonly requestConversationToken: RequestConversationToken;
  readonly presence: PresenceQueries;
  readonly setDoorMode: SetDoorMode;
  readonly knockOnRoom: KnockOnRoom;
  readonly answerKnock: AnswerKnock;
  readonly cancelKnock: CancelKnock;
  readonly requestRoomCallToken: RequestRoomCallToken;
  readonly startCall: StartCall;
  readonly inviteToCall: InviteToCall;
  readonly answerCall: AnswerCall;
  readonly leaveCall: LeaveCall;
  readonly requestDirectCallToken: RequestDirectCallToken;
}

/** Disconnect if the socket's send buffer grows beyond this (slow or stuck client). */
const MAX_BUFFERED_BYTES = 1024 * 1024;
const logger = new Logger('Realtime');

/**
 * One WebSocket connection. Commands are handled strictly in order. Nothing about positions or
 * paths is logged (ADR-0012).
 */
export class RealtimeSession {
  occupant: Occupant | null = null;
  floorId: string | null = null;
  /** Token expiry (ms since the epoch); the client must re-authenticate before it. */
  expiresAt = 0;
  #subject: string | null = null;
  #queue: Promise<void> = Promise.resolve();
  #answeredLastPing = true;

  constructor(
    readonly socket: WebSocket,
    private readonly deps: SessionDependencies,
  ) {}

  get isAuthenticated(): boolean {
    return this.occupant !== null;
  }

  /** Heartbeat: returns false if the previous ping went unanswered; otherwise sends a new ping. */
  ping(): boolean {
    if (!this.#answeredLastPing) return false;
    this.#answeredLastPing = false;
    this.socket.ping();
    return true;
  }

  pongReceived(): void {
    this.#answeredLastPing = true;
  }

  receive(bytes: Uint8Array): void {
    this.#queue = this.#queue.then(() => this.#handle(bytes));
  }

  send(event: ServerEvent): void {
    this.sendEncoded(encodeMessage(event));
  }

  /** Sends an already encoded event (broadcasts encode once for all receivers). */
  sendEncoded(bytes: Uint8Array): void {
    if (this.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      this.socket.terminate();
      return;
    }
    this.socket.send(bytes);
  }

  async #handle(bytes: Uint8Array): Promise<void> {
    const decoded = decodeClientCommand(bytes);
    if (!decoded.ok) {
      await this.deps.telemetry.observeCommand('invalid', () => {
        this.#nack(null, 'invalid-message');
        return Promise.resolve('invalid-message');
      });
      return;
    }
    const command = decoded.value;
    await this.deps.telemetry.observeCommand(command.t, () => this.#execute(command));
  }

  /** Runs a command and answers with Ack or Nack; returns the outcome for telemetry. */
  async #execute(command: ClientCommand): Promise<CommandOutcome> {
    const correlationId = command.id ?? null;
    try {
      if (command.t !== 'Authenticate' && command.t !== 'Ping' && !this.isAuthenticated) {
        this.#nack(correlationId, 'not-authenticated');
        return 'not-authenticated';
      }
      const failure = await this.#dispatch(command);
      if (failure) {
        this.#nack(correlationId, failure);
        return failure;
      }
      if (correlationId) this.send({ t: 'Ack', p: { id: correlationId } });
      return 'ok';
    } catch (error) {
      logger.error(`Command ${command.t} failed`, error instanceof Error ? error.stack : undefined);
      this.#nack(correlationId, 'internal-error');
      return 'internal-error';
    }
  }

  /** Executes a command; returns a failure code or nothing on success. */
  async #dispatch(command: ClientCommand): Promise<NackCode | undefined> {
    switch (command.t) {
      case 'Ping':
        this.send({ t: 'Pong', p: { clientTime: command.p.clientTime, serverTime: this.deps.clock.now().getTime() } });
        return undefined;
      case 'Authenticate':
        return this.#authenticate(command.p.accessToken);
      case 'JoinFloor': {
        if (!this.occupant) return 'not-authenticated';
        const snapshot = await this.deps.joinFloor.execute({ occupant: this.occupant, floorId: command.p.floorId });
        if (!snapshot.ok) return snapshot.error;
        this.floorId = command.p.floorId;
        this.send({
          t: 'FloorSnapshot',
          p: {
            floorId: command.p.floorId,
            avatars: snapshot.value.map(toAvatarContract),
            conversations: this.deps.conversations.onFloor(command.p.floorId).map(toConversationContract),
            doorModes: this.deps.presence.doorModesOn(command.p.floorId),
            roomCalls: this.deps.conversations.roomCallsOn(command.p.floorId).map(toRoomCallContract),
            onCall: snapshot.value
              .map((avatar) => avatar.occupant.personId)
              .filter((personId) => this.deps.conversations.isInCall(personId)),
          },
        });
        return undefined;
      }
      case 'MoveTo': {
        if (!this.occupant) return 'not-authenticated';
        const moved = this.deps.moveTo.execute({ personId: this.occupant.personId, target: command.p.target });
        return moved.ok ? undefined : moved.error;
      }
      case 'LockConversation':
      case 'UnlockConversation': {
        if (!this.occupant) return 'not-authenticated';
        const result = this.deps.setConversationLock.execute({
          personId: this.occupant.personId,
          conversationId: command.p.conversationId,
          locked: command.t === 'LockConversation',
        });
        return result.ok ? undefined : result.error;
      }
      case 'RequestConversationToken': {
        if (!this.occupant) return 'not-authenticated';
        const access = await this.deps.requestConversationToken.execute({
          personId: this.occupant.personId,
          conversationId: command.p.conversationId,
        });
        if (!access.ok) return access.error;
        this.send({ t: 'ConversationAccessGranted', p: { conversationId: command.p.conversationId, ...access.value } });
        return undefined;
      }
      case 'SetDoorMode': {
        if (!this.occupant) return 'not-authenticated';
        const result = this.deps.setDoorMode.execute({ personId: this.occupant.personId, ...command.p });
        return result.ok ? undefined : result.error;
      }
      case 'KnockOnRoom': {
        if (!this.occupant) return 'not-authenticated';
        const result = this.deps.knockOnRoom.execute({ personId: this.occupant.personId, roomId: command.p.roomId });
        return result.ok ? undefined : result.error;
      }
      case 'CancelKnock': {
        if (!this.occupant) return 'not-authenticated';
        const result = this.deps.cancelKnock.execute({ personId: this.occupant.personId, knockId: command.p.knockId });
        return result.ok ? undefined : result.error;
      }
      case 'AnswerKnock': {
        if (!this.occupant) return 'not-authenticated';
        const result = this.deps.answerKnock.execute({ personId: this.occupant.personId, ...command.p });
        return result.ok ? undefined : result.error;
      }
      case 'RequestRoomCallToken': {
        if (!this.occupant) return 'not-authenticated';
        const access = await this.deps.requestRoomCallToken.execute({
          personId: this.occupant.personId,
          roomId: command.p.roomId,
        });
        if (!access.ok) return access.error;
        this.send({ t: 'RoomCallAccessGranted', p: { roomId: command.p.roomId, ...access.value } });
        return undefined;
      }
      case 'StartCall': {
        if (!this.occupant) return 'not-authenticated';
        const result = await this.deps.startCall.execute({
          personId: this.occupant.personId,
          callee: command.p.personId,
        });
        return result.ok ? undefined : result.error;
      }
      case 'InviteToCall': {
        if (!this.occupant) return 'not-authenticated';
        const result = await this.deps.inviteToCall.execute({
          personId: this.occupant.personId,
          callId: command.p.callId,
          invitee: command.p.personId,
        });
        return result.ok ? undefined : result.error;
      }
      case 'AnswerCall': {
        if (!this.occupant) return 'not-authenticated';
        const result = await this.deps.answerCall.execute({ personId: this.occupant.personId, ...command.p });
        return result.ok ? undefined : result.error;
      }
      case 'LeaveCall': {
        if (!this.occupant) return 'not-authenticated';
        const result = await this.deps.leaveCall.execute({ personId: this.occupant.personId, ...command.p });
        return result.ok ? undefined : result.error;
      }
      case 'RequestDirectCallToken': {
        if (!this.occupant) return 'not-authenticated';
        const access = await this.deps.requestDirectCallToken.execute({
          personId: this.occupant.personId,
          callId: command.p.callId,
        });
        if (!access.ok) return access.error;
        this.send({ t: 'DirectCallAccessGranted', p: { callId: command.p.callId, ...access.value } });
        return undefined;
      }
      case 'ListOnlinePeople': {
        if (!this.occupant) return 'not-authenticated';
        const people = this.deps.presence
          .onlinePeople()
          .map(({ personId, displayName, avatarColor, floorId }) => ({ personId, displayName, avatarColor, floorId }));
        this.send({ t: 'OnlinePeople', p: { people } });
        return undefined;
      }
    }
  }

  async #authenticate(accessToken: string): Promise<NackCode | undefined> {
    const principal = await this.deps.authenticate.execute(accessToken);
    if (!principal.ok) return 'invalid-token';
    // A connection belongs to one identity; refreshing the token must not switch people.
    if (this.#subject && this.#subject !== principal.value.subject) return 'invalid-token';

    const person = await this.deps.resolvePerson.execute(principal.value);
    if (!person.ok) return 'invalid-token';

    this.#subject = principal.value.subject;
    this.expiresAt = principal.value.expiresAt;
    this.occupant = person.value;
    this.send({
      t: 'Authenticated',
      p: { personId: person.value.personId, serverTime: this.deps.clock.now().getTime() },
    });
    return undefined;
  }

  #nack(id: string | null, code: NackCode): void {
    this.send({ t: 'Nack', p: { id, code } });
  }
}
