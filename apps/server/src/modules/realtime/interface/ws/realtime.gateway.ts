import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { encodeMessage, REALTIME_PATH, REALTIME_SUBPROTOCOL } from '@teamtown/contracts';
import type { Clock } from '@teamtown/kernel';
import type { IncomingMessage, Server } from 'node:http';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import { CLOCK } from '../../../../platform/config/config.module.ts';
import { Authenticate } from '../../../identity/public-api.ts';
import { ResolvePerson } from '../../../people/public-api.ts';
import {
  AnswerCall,
  AnswerKnock,
  AnswerMeetingLog,
  EndMeetingLog,
  StartMeetingLog,
  CancelKnock,
  ConversationQueries,
  InviteToCall,
  KnockOnRoom,
  LeaveCall,
  MeetingsEventStream,
  RequestConversationToken,
  RequestDirectCallToken,
  RequestRoomCallToken,
  SetCamera,
  SetConversationLock,
  StartCall,
  StartScreenShare,
  StopScreenShare,
  type MeetingsEvent,
} from '../../../meetings/public-api.ts';
import { MessagingEventStream, type MessagingEvent } from '../../../messaging/public-api.ts';
import {
  JoinFloor,
  LeavePresence,
  MoveTo,
  PresenceEventStream,
  PresenceQueries,
  SetDoorMode,
} from '../../../presence/public-api.ts';
import {
  toCallContract,
  toConversationServerEvent,
  toKnockServerEvent,
  toRoomCallContract,
  toServerEvent,
} from './contract-mapping.ts';
import { RealtimeSession } from './realtime-session.ts';
import { RealtimeTelemetry } from './realtime-telemetry.ts';

const AUTH_TIMEOUT_MS = 10_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
/** Grace period after token expiry, giving the client time to send a refreshed token. */
const EXPIRY_GRACE_MS = 60_000;
const MAX_MESSAGE_BYTES = 16 * 1024;

/** WebSocket close codes in the private range (4000–4999). */
const CLOSE_AUTH_TIMEOUT = 4401;
const CLOSE_TOKEN_EXPIRED = 4403;

const toBytes = (data: RawData): Uint8Array =>
  Array.isArray(data) ? Buffer.concat(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : data;

/**
 * Realtime gateway (ADR-0007, ADR-0022): one WebSocket per client on the server's HTTP port.
 * Presence events are fanned out to every connection on the affected floor.
 */
@Injectable()
export class RealtimeGateway implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Realtime');
  readonly #sessions = new Set<RealtimeSession>();
  readonly #telemetry = new RealtimeTelemetry();
  #server: WebSocketServer | undefined;
  #maintenance: NodeJS.Timeout | undefined;
  #unsubscribe: (() => void)[] = [];

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(Authenticate) private readonly authenticate: Authenticate,
    @Inject(ResolvePerson) private readonly resolvePerson: ResolvePerson,
    @Inject(JoinFloor) private readonly joinFloor: JoinFloor,
    @Inject(MoveTo) private readonly moveTo: MoveTo,
    @Inject(LeavePresence) private readonly leavePresence: LeavePresence,
    @Inject(PresenceEventStream) private readonly presenceEvents: PresenceEventStream,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(MeetingsEventStream) private readonly meetingsEvents: MeetingsEventStream,
    @Inject(ConversationQueries) private readonly conversations: ConversationQueries,
    @Inject(SetConversationLock) private readonly setConversationLock: SetConversationLock,
    @Inject(RequestConversationToken) private readonly requestConversationToken: RequestConversationToken,
    @Inject(PresenceQueries) private readonly presence: PresenceQueries,
    @Inject(SetDoorMode) private readonly setDoorMode: SetDoorMode,
    @Inject(KnockOnRoom) private readonly knockOnRoom: KnockOnRoom,
    @Inject(AnswerKnock) private readonly answerKnock: AnswerKnock,
    @Inject(CancelKnock) private readonly cancelKnock: CancelKnock,
    @Inject(RequestRoomCallToken) private readonly requestRoomCallToken: RequestRoomCallToken,
    @Inject(StartCall) private readonly startCall: StartCall,
    @Inject(InviteToCall) private readonly inviteToCall: InviteToCall,
    @Inject(AnswerCall) private readonly answerCall: AnswerCall,
    @Inject(LeaveCall) private readonly leaveCall: LeaveCall,
    @Inject(RequestDirectCallToken) private readonly requestDirectCallToken: RequestDirectCallToken,
    @Inject(SetCamera) private readonly setCamera: SetCamera,
    @Inject(StartScreenShare) private readonly startScreenShare: StartScreenShare,
    @Inject(StopScreenShare) private readonly stopScreenShare: StopScreenShare,
    @Inject(StartMeetingLog) private readonly startMeetingLog: StartMeetingLog,
    @Inject(EndMeetingLog) private readonly endMeetingLog: EndMeetingLog,
    @Inject(AnswerMeetingLog) private readonly answerMeetingLog: AnswerMeetingLog,
    @Inject(MessagingEventStream) private readonly messagingEvents: MessagingEventStream,
  ) {}

  onApplicationBootstrap(): void {
    const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer() as Server;
    this.#server = new WebSocketServer({
      server: httpServer,
      path: REALTIME_PATH,
      maxPayload: MAX_MESSAGE_BYTES,
      // Reject the handshake unless the client speaks our protocol version (also when it sends none).
      verifyClient: ({ req }: { req: IncomingMessage }) =>
        (req.headers['sec-websocket-protocol'] ?? '')
          .split(',')
          .map((protocol) => protocol.trim())
          .includes(REALTIME_SUBPROTOCOL),
      handleProtocols: () => REALTIME_SUBPROTOCOL,
    });
    this.#server.on('connection', (socket) => {
      this.#accept(socket);
    });
    this.#unsubscribe = [
      this.presenceEvents.subscribe((event) => {
        this.#sendToFloor(event.floorId, encodeMessage(toServerEvent(event)));
        // Someone in a call walks onto another floor: people there learn that they are in a call.
        if (event.type === 'AvatarJoined' && this.conversations.isInCall(event.avatar.occupant.personId)) {
          this.#announceOnCall([event.avatar.occupant.personId], true);
        }
        if (event.type === 'AvatarJoined' && this.conversations.isCameraOn(event.avatar.occupant.personId)) {
          this.#announceCamera(event.avatar.occupant.personId, true);
        }
      }),
      this.meetingsEvents.subscribe((event) => {
        this.#deliverMeetingsEvent(event);
      }),
      this.messagingEvents.subscribe((event) => {
        this.#deliverMessagingEvent(event);
      }),
    ];
    this.#maintenance = setInterval(() => {
      this.#maintain();
    }, HEARTBEAT_INTERVAL_MS);
    this.logger.log(`Listening for WebSocket connections on ${REALTIME_PATH}`);
  }

  onApplicationShutdown(): void {
    clearInterval(this.#maintenance);
    for (const unsubscribe of this.#unsubscribe) unsubscribe();
    for (const session of this.#sessions) session.socket.terminate();
    this.#server?.close();
  }

  #accept(socket: WebSocket): void {
    const session = new RealtimeSession(socket, {
      authenticate: this.authenticate,
      resolvePerson: this.resolvePerson,
      joinFloor: this.joinFloor,
      moveTo: this.moveTo,
      clock: this.clock,
      telemetry: this.#telemetry,
      conversations: this.conversations,
      setConversationLock: this.setConversationLock,
      requestConversationToken: this.requestConversationToken,
      presence: this.presence,
      setDoorMode: this.setDoorMode,
      knockOnRoom: this.knockOnRoom,
      answerKnock: this.answerKnock,
      cancelKnock: this.cancelKnock,
      requestRoomCallToken: this.requestRoomCallToken,
      startCall: this.startCall,
      inviteToCall: this.inviteToCall,
      answerCall: this.answerCall,
      leaveCall: this.leaveCall,
      requestDirectCallToken: this.requestDirectCallToken,
      setCamera: this.setCamera,
      startScreenShare: this.startScreenShare,
      stopScreenShare: this.stopScreenShare,
      startMeetingLog: this.startMeetingLog,
      endMeetingLog: this.endMeetingLog,
      answerMeetingLog: this.answerMeetingLog,
    });
    this.#sessions.add(session);
    this.#telemetry.connectionOpened();

    const authTimeout = setTimeout(() => {
      if (!session.isAuthenticated) socket.close(CLOSE_AUTH_TIMEOUT, 'authentication timeout');
    }, AUTH_TIMEOUT_MS);

    socket.on('pong', () => {
      session.pongReceived();
    });
    socket.on('message', (data, isBinary) => {
      if (isBinary) session.receive(toBytes(data));
    });
    socket.on('close', () => {
      clearTimeout(authTimeout);
      this.#sessions.delete(session);
      this.#telemetry.connectionClosed();
      this.#leaveIfLastConnection(session);
    });
    socket.on('error', () => {
      socket.terminate();
    });
  }

  #sendToFloor(floorId: string, bytes: Uint8Array): void {
    for (const session of this.#sessions) {
      if (session.floorId === floorId) session.sendEncoded(bytes);
    }
  }

  /**
   * Conversations and room calls are visible to the whole floor; a media token goes only to the person it is for;
   * knocks go only to the occupants of the room and the requester.
   */
  #deliverMeetingsEvent(event: MeetingsEvent): void {
    switch (event.type) {
      case 'ConversationAccessGranted':
        this.#sendToPeople(
          [event.personId],
          encodeMessage({
            t: 'ConversationAccessGranted',
            p: { conversationId: event.conversationId, url: event.url, token: event.token },
          }),
        );
        return;
      case 'RoomCallAccessGranted':
        this.#sendToPeople(
          [event.personId],
          encodeMessage({
            t: 'RoomCallAccessGranted',
            p: { roomId: event.roomId, url: event.url, token: event.token },
          }),
        );
        return;
      case 'KnockRequested':
      case 'KnockAnswered':
        this.#sendToPeople(event.recipients, encodeMessage(toKnockServerEvent(event)));
        return;
      case 'RoomCallChanged':
        this.#sendToFloor(
          event.floorId,
          encodeMessage({
            t: 'RoomCallChanged',
            p: { floorId: event.floorId, roomCall: toRoomCallContract(event.roomCall) },
          }),
        );
        return;
      case 'DirectCallAccessGranted':
        this.#sendToPeople(
          [event.personId],
          encodeMessage({
            t: 'DirectCallAccessGranted',
            p: { callId: event.callId, url: event.url, token: event.token },
          }),
        );
        return;
      case 'DirectCallChanged':
        this.#sendToPeople(
          event.recipients,
          encodeMessage({ t: 'DirectCallChanged', p: { call: toCallContract(event.call) } }),
        );
        this.#announceOnCall(event.joined, true);
        this.#announceOnCall(event.left, false);
        return;
      case 'DirectCallEnded':
        this.#sendToPeople(event.recipients, encodeMessage({ t: 'DirectCallEnded', p: { callId: event.callId } }));
        this.#announceOnCall(event.left, false);
        return;
      case 'CallInvitationAnswered':
        this.#sendToPeople(
          event.recipients,
          encodeMessage({
            t: 'CallInvitationAnswered',
            p: { callId: event.callId, personId: event.personId, outcome: event.outcome },
          }),
        );
        return;
      case 'MeetingLogChanged':
        this.#sendToFloor(
          event.floorId,
          encodeMessage({
            t: 'MeetingLogChanged',
            p: { floorId: event.floorId, roomId: event.roomId, active: event.active },
          }),
        );
        return;
      case 'MeetingLogDetails':
        this.#sendToPeople(
          event.recipients,
          encodeMessage({ t: 'MeetingLogDetails', p: { roomId: event.roomId, details: event.details } }),
        );
        return;
      case 'MeetingLogConsentRequested':
        this.#sendToPeople(
          event.recipients,
          encodeMessage({ t: 'MeetingLogConsentRequested', p: { roomId: event.roomId, title: event.title } }),
        );
        return;
      case 'ScreenShareChanged':
        this.#sendToPeople(event.recipients, encodeMessage({ t: 'ScreenShareChanged', p: { sharer: event.sharer } }));
        return;
      case 'CameraChanged':
        this.#announceCamera(event.personId, event.on);
        return;
      default:
        this.#sendToFloor(event.floorId, encodeMessage(toConversationServerEvent(event)));
    }
  }

  /**
   * Messages, reactions and channel changes go to the channel's members, thread activity to the followers, read
   * markers and leaving to the person only.
   */
  #deliverMessagingEvent(event: MessagingEvent): void {
    switch (event.type) {
      case 'MessagePosted':
      case 'MessageEdited':
        // Live messages carry no thread summary; clients count replies themselves.
        this.#sendToPeople(
          event.recipients,
          encodeMessage({ t: event.type, p: { message: { ...event.message, thread: null } } }),
        );
        return;
      case 'MessageDeleted':
        this.#sendToPeople(
          event.recipients,
          encodeMessage({ t: 'MessageDeleted', p: { channelId: event.channelId, messageId: event.messageId } }),
        );
        return;
      case 'ChannelChanged':
        this.#sendToPeople(event.recipients, encodeMessage({ t: 'ChannelChanged', p: { channelId: event.channelId } }));
        return;
      case 'ChannelLeft':
        this.#sendToPeople([event.personId], encodeMessage({ t: 'ChannelLeft', p: { channelId: event.channelId } }));
        return;
      case 'ReadMarkerMoved':
        this.#sendToPeople(
          [event.personId],
          encodeMessage({ t: 'ReadMarkerMoved', p: { channelId: event.channelId, messageId: event.messageId } }),
        );
        return;
      case 'ReactionChanged': {
        const { channelId, messageId, personId, emoji, added } = event;
        this.#sendToPeople(
          event.recipients,
          encodeMessage({ t: 'ReactionChanged', p: { channelId, messageId, personId, emoji, added } }),
        );
        // Public reactions float above the avatar for the floor (ADR-0034); nothing about it is stored or logged.
        const floorId = event.inOffice ? this.presence.floorOf(personId) : null;
        if (floorId) this.#sendToFloor(floorId, encodeMessage({ t: 'AvatarEmoted', p: { floorId, personId, emoji } }));
        return;
      }
      case 'ThreadActivity':
        this.#sendToPeople(
          event.recipients,
          encodeMessage({
            t: 'ThreadActivity',
            p: { channelId: event.channelId, rootMessageId: event.rootMessageId },
          }),
        );
    }
  }

  #announceCamera(personId: string, on: boolean): void {
    const floorId = this.presence.floorOf(personId);
    if (floorId) this.#sendToFloor(floorId, encodeMessage({ t: 'CameraChanged', p: { floorId, personId, on } }));
  }

  /** Tells each person's floor that they are (or no longer are) in a call, never with whom. */
  #announceOnCall(personIds: readonly string[], onCall: boolean): void {
    for (const personId of personIds) {
      const floorId = this.presence.floorOf(personId);
      if (floorId) this.#sendToFloor(floorId, encodeMessage({ t: 'OnCallChanged', p: { floorId, personId, onCall } }));
    }
  }

  #sendToPeople(personIds: readonly string[], bytes: Uint8Array): void {
    for (const session of this.#sessions) {
      if (session.occupant && personIds.includes(session.occupant.personId)) session.sendEncoded(bytes);
    }
  }

  /** Heartbeat and token expiry: drop dead connections and connections without a fresh token. */
  #maintain(): void {
    const now = this.clock.now().getTime();
    for (const session of this.#sessions) {
      if (session.isAuthenticated && session.expiresAt + EXPIRY_GRACE_MS < now) {
        session.socket.close(CLOSE_TOKEN_EXPIRED, 'token expired');
      } else if (!session.ping()) {
        session.socket.terminate();
      }
    }
  }

  /** A person can be connected from several tabs or devices; the avatar leaves with the last one. */
  #leaveIfLastConnection(closed: RealtimeSession): void {
    const personId = closed.occupant?.personId;
    if (!personId) return;
    const stillConnected = [...this.#sessions].some((session) => session.occupant?.personId === personId);
    if (!stillConnected) this.leavePresence.execute(personId);
  }
}
