import {
  decodeServerEvent,
  encodeMessage,
  REALTIME_PATH,
  REALTIME_SUBPROTOCOL,
  type ClientCommand,
  type NackCode,
  type ServerEvent,
} from '@teamtown/contracts';
import type { TileCoord } from '@teamtown/world-core';
import { useCallStore } from '../stores/call-store.ts';
import { useConversationStore } from '../stores/conversation-store.ts';
import { usePresenceStore } from '../stores/presence-store.ts';
import { useRoomStore, type DoorMode } from '../stores/room-store.ts';
import type { ServerClock } from '../shared/server-clock.ts';

export type CommandResult = { readonly ok: true } | { readonly ok: false; readonly code: NackCode | 'timeout' };

const COMMAND_TIMEOUT_MS = 10_000;
const PING_INTERVAL_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

type PendingCommand = (result: CommandResult) => void;

/** A call is a proximity conversation, a room call or a direct call; a person is in at most one at a time. */
export type CallId = `conversation:${string}` | `room:${string}` | `direct:${string}`;
export const conversationCallId = (conversationId: string): CallId => `conversation:${conversationId}`;
export const roomCallId = (roomId: string): CallId => `room:${roomId}`;
export const directCallId = (callId: string): CallId => `direct:${callId}`;

export interface CallAccess {
  readonly callId: CallId;
  readonly url: string;
  readonly token: string;
}
export type CallAccessListener = (access: CallAccess) => void;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * WebSocket client for the realtime protocol (ADR-0007). Authenticates first, re-joins the current
 * floor after reconnects and feeds all events into the presence store.
 */
export class RealtimeClient {
  #socket: WebSocket | null = null;
  #pending = new Map<string, PendingCommand>();
  #counter = 0;
  #reconnectAttempt = 0;
  #pingTimer: ReturnType<typeof setInterval> | undefined;
  #stopped = false;
  #desiredFloorId: string | null = null;
  readonly #pingSentAt = new Map<number, number>();
  readonly #accessListeners = new Set<CallAccessListener>();

  constructor(
    private readonly options: {
      readonly url: string;
      readonly getAccessToken: () => string | null;
      readonly clock: ServerClock;
    },
  ) {}

  start(): void {
    this.#stopped = false;
    this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    clearInterval(this.#pingTimer);
    const socket = this.#socket;
    this.#socket = null;
    socket?.close();
    usePresenceStore.getState().setConnection('offline');
  }

  joinFloor(floorId: string): Promise<CommandResult> {
    this.#desiredFloorId = floorId;
    return this.#command({ t: 'JoinFloor', p: { floorId } });
  }

  moveTo(target: TileCoord): Promise<CommandResult> {
    return this.#command({ t: 'MoveTo', p: { target } });
  }

  lockConversation(conversationId: string, locked: boolean): Promise<CommandResult> {
    return this.#command({ t: locked ? 'LockConversation' : 'UnlockConversation', p: { conversationId } });
  }

  /** Asks for a fresh media token for a conversation or room call, e.g. after a reconnect. */
  requestCallToken(callId: CallId): Promise<CommandResult> {
    if (callId.startsWith('room:')) {
      return this.#command({ t: 'RequestRoomCallToken', p: { roomId: callId.slice('room:'.length) } });
    }
    if (callId.startsWith('direct:')) {
      return this.#command({ t: 'RequestDirectCallToken', p: { callId: callId.slice('direct:'.length) } });
    }
    return this.#command({
      t: 'RequestConversationToken',
      p: { conversationId: callId.slice('conversation:'.length) },
    });
  }

  setDoorMode(roomId: string, doorMode: DoorMode): Promise<CommandResult> {
    return this.#command({ t: 'SetDoorMode', p: { roomId, doorMode } });
  }

  knockOnRoom(roomId: string): Promise<CommandResult> {
    return this.#command({ t: 'KnockOnRoom', p: { roomId } });
  }

  cancelKnock(knockId: string): Promise<CommandResult> {
    return this.#command({ t: 'CancelKnock', p: { knockId } });
  }

  answerKnock(knockId: string, admit: boolean): Promise<CommandResult> {
    return this.#command({ t: 'AnswerKnock', p: { knockId, admit } });
  }

  startCall(personId: string): Promise<CommandResult> {
    return this.#command({ t: 'StartCall', p: { personId } });
  }

  inviteToCall(callId: string, personId: string): Promise<CommandResult> {
    return this.#command({ t: 'InviteToCall', p: { callId, personId } });
  }

  answerCall(callId: string, accept: boolean): Promise<CommandResult> {
    return this.#command({ t: 'AnswerCall', p: { callId, accept } });
  }

  leaveCall(callId: string): Promise<CommandResult> {
    return this.#command({ t: 'LeaveCall', p: { callId } });
  }

  /** The answer arrives as `OnlinePeople` in the call store. */
  listOnlinePeople(): Promise<CommandResult> {
    return this.#command({ t: 'ListOnlinePeople', p: {} });
  }

  onCallAccess(listener: CallAccessListener): () => void {
    this.#accessListeners.add(listener);
    return () => this.#accessListeners.delete(listener);
  }

  /** Sends a refreshed access token on the open connection (the server checks token expiry). */
  reauthenticate(): void {
    const token = this.options.getAccessToken();
    if (token && this.#socket?.readyState === WebSocket.OPEN) {
      void this.#command({ t: 'Authenticate', p: { accessToken: token } });
    }
  }

  #connect(): void {
    usePresenceStore.getState().setConnection('connecting');
    const socket = new WebSocket(this.options.url, REALTIME_SUBPROTOCOL);
    socket.binaryType = 'arraybuffer';
    this.#socket = socket;

    socket.addEventListener('open', () => void this.#onOpen());
    socket.addEventListener('message', (message: MessageEvent<ArrayBuffer>) => {
      const event = decodeServerEvent(new Uint8Array(message.data));
      if (event.ok) this.#onEvent(event.value);
    });
    socket.addEventListener('close', () => {
      // A socket replaced by a newer connection must not trigger another reconnect.
      if (socket === this.#socket) this.#onClose();
    });
  }

  async #onOpen(): Promise<void> {
    const token = this.options.getAccessToken();
    if (!token) {
      this.#socket?.close();
      return;
    }
    const authenticated = await this.#command({ t: 'Authenticate', p: { accessToken: token } });
    if (!authenticated.ok) {
      this.#socket?.close();
      return;
    }
    this.#reconnectAttempt = 0;
    this.options.clock.reset();
    this.#ping();
    this.#pingTimer = setInterval(() => {
      this.#ping();
    }, PING_INTERVAL_MS);
    usePresenceStore.getState().setConnection('online');
    if (this.#desiredFloorId) {
      await this.joinFloor(this.#desiredFloorId);
    }
  }

  #onEvent(event: ServerEvent): void {
    const store = usePresenceStore.getState();
    switch (event.t) {
      case 'Ack':
        this.#settle(event.p.id, { ok: true });
        return;
      case 'Nack':
        if (event.p.id) this.#settle(event.p.id, { ok: false, code: event.p.code });
        return;
      case 'Authenticated':
        store.setMyPersonId(event.p.personId);
        return;
      case 'Pong': {
        const sentAt = this.#pingSentAt.get(event.p.clientTime);
        this.#pingSentAt.delete(event.p.clientTime);
        if (sentAt !== undefined) this.options.clock.addSample(sentAt, event.p.serverTime, Date.now());
        return;
      }
      case 'FloorSnapshot':
        store.applySnapshot(event.p.floorId, event.p.avatars);
        useConversationStore.getState().applySnapshot(event.p.floorId, event.p.conversations);
        useRoomStore.getState().applySnapshot(event.p.floorId, event.p.doorModes, event.p.roomCalls);
        useCallStore.getState().applySnapshot(event.p.floorId, event.p.onCall);
        return;
      case 'ConversationFormed':
      case 'ConversationChanged':
      case 'ConversationDissolved':
        useConversationStore.getState().applyEvent(event);
        return;
      case 'DoorModeChanged':
      case 'RoomCallChanged':
      case 'KnockRequested':
      case 'KnockAnswered':
        useRoomStore.getState().applyEvent(event);
        return;
      case 'ConversationAccessGranted':
        this.#grantAccess({ callId: conversationCallId(event.p.conversationId), ...event.p });
        return;
      case 'DirectCallChanged':
      case 'DirectCallEnded':
      case 'CallInvitationAnswered':
      case 'OnCallChanged':
      case 'OnlinePeople':
        useCallStore.getState().applyEvent(event);
        return;
      case 'DirectCallAccessGranted':
        this.#grantAccess({ ...event.p, callId: directCallId(event.p.callId) });
        return;
      case 'RoomCallAccessGranted':
        this.#grantAccess({ callId: roomCallId(event.p.roomId), ...event.p });
        return;
      default:
        store.applyEvent(event);
    }
  }

  #grantAccess({ callId, url, token }: CallAccess): void {
    for (const listener of this.#accessListeners) listener({ callId, url, token });
  }

  #onClose(): void {
    clearInterval(this.#pingTimer);
    for (const resolve of this.#pending.values()) resolve({ ok: false, code: 'timeout' });
    this.#pending.clear();
    usePresenceStore.getState().setConnection('offline');
    if (this.#stopped) return;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 500 * 2 ** this.#reconnectAttempt);
    this.#reconnectAttempt++;
    setTimeout(() => {
      if (!this.#stopped) this.#connect();
    }, delay);
  }

  #ping(): void {
    const sentAt = Date.now();
    this.#pingSentAt.set(sentAt, sentAt);
    this.#send({ t: 'Ping', p: { clientTime: sentAt } });
  }

  #command(command: DistributiveOmit<ClientCommand, 'id'>): Promise<CommandResult> {
    if (this.#socket?.readyState !== WebSocket.OPEN) {
      return Promise.resolve({ ok: false, code: 'timeout' });
    }
    const id = `c${++this.#counter}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.#settle(id, { ok: false, code: 'timeout' });
      }, COMMAND_TIMEOUT_MS);
      this.#pending.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
      this.#send({ ...command, id });
    });
  }

  #settle(id: string, result: CommandResult): void {
    this.#pending.get(id)?.(result);
    this.#pending.delete(id);
  }

  #send(command: ClientCommand): void {
    this.#socket?.send(encodeMessage(command));
  }
}

export const realtimeUrl = (location: Location): string =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${REALTIME_PATH}`;
