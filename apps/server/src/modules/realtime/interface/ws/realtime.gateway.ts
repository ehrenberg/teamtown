import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { encodeMessage, REALTIME_PATH, REALTIME_SUBPROTOCOL } from '@teamtown/contracts';
import type { Clock } from '@teamtown/kernel';
import type { IncomingMessage, Server } from 'node:http';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import { CLOCK } from '../../../../platform/config/config.module.ts';
import { Authenticate } from '../../../identity/public-api.ts';
import { ResolvePerson } from '../../../people/public-api.ts';
import { JoinFloor, LeavePresence, MoveTo, PresenceEventStream } from '../../../presence/public-api.ts';
import { toServerEvent } from './contract-mapping.ts';
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
  #unsubscribe: (() => void) | undefined;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Inject(Authenticate) private readonly authenticate: Authenticate,
    @Inject(ResolvePerson) private readonly resolvePerson: ResolvePerson,
    @Inject(JoinFloor) private readonly joinFloor: JoinFloor,
    @Inject(MoveTo) private readonly moveTo: MoveTo,
    @Inject(LeavePresence) private readonly leavePresence: LeavePresence,
    @Inject(PresenceEventStream) private readonly presenceEvents: PresenceEventStream,
    @Inject(CLOCK) private readonly clock: Clock,
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
    this.#unsubscribe = this.presenceEvents.subscribe((event) => {
      const bytes = encodeMessage(toServerEvent(event));
      for (const session of this.#sessions) {
        if (session.floorId === event.floorId) session.sendEncoded(bytes);
      }
    });
    this.#maintenance = setInterval(() => {
      this.#maintain();
    }, HEARTBEAT_INTERVAL_MS);
    this.logger.log(`Listening for WebSocket connections on ${REALTIME_PATH}`);
  }

  onApplicationShutdown(): void {
    clearInterval(this.#maintenance);
    this.#unsubscribe?.();
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
