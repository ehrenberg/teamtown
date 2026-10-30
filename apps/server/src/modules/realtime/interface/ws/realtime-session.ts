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
import type { JoinFloor, MoveTo, Occupant } from '../../../presence/public-api.ts';
import { toAvatarContract } from './contract-mapping.ts';

export interface SessionDependencies {
  readonly authenticate: Authenticate;
  readonly resolvePerson: ResolvePerson;
  readonly joinFloor: JoinFloor;
  readonly moveTo: MoveTo;
  readonly clock: Clock;
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
      this.#nack(null, 'invalid-message');
      return;
    }
    const command = decoded.value;
    const correlationId = command.id ?? null;
    try {
      if (command.t !== 'Authenticate' && command.t !== 'Ping' && !this.isAuthenticated) {
        this.#nack(correlationId, 'not-authenticated');
        return;
      }
      const failure = await this.#dispatch(command);
      if (failure) {
        this.#nack(correlationId, failure);
      } else if (correlationId) {
        this.send({ t: 'Ack', p: { id: correlationId } });
      }
    } catch (error) {
      logger.error(`Command ${command.t} failed`, error instanceof Error ? error.stack : undefined);
      this.#nack(correlationId, 'internal-error');
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
          p: { floorId: command.p.floorId, avatars: snapshot.value.map(toAvatarContract) },
        });
        return undefined;
      }
      case 'MoveTo': {
        if (!this.occupant) return 'not-authenticated';
        const moved = this.deps.moveTo.execute({ personId: this.occupant.personId, target: command.p.target });
        return moved.ok ? undefined : moved.error;
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
