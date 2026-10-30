import type { DirectCallEvent } from '../domain/direct-calls.ts';
import type { ConversationEvent } from '../domain/floor-conversations.ts';
import type { KnockOutcome, KnockRequest } from '../domain/knocks.ts';
import type { RoomCallChanged } from '../domain/room-calls.ts';

export interface ConversationAccessGranted {
  readonly type: 'ConversationAccessGranted';
  readonly personId: string;
  readonly conversationId: string;
  readonly url: string;
  readonly token: string;
}

export interface DirectCallAccessGranted {
  readonly type: 'DirectCallAccessGranted';
  readonly personId: string;
  readonly callId: string;
  readonly url: string;
  readonly token: string;
}

export interface RoomCallAccessGranted {
  readonly type: 'RoomCallAccessGranted';
  readonly personId: string;
  readonly roomId: string;
  readonly url: string;
  readonly token: string;
}

/** Knock events go only to `recipients`: the occupants of the room and the requester. */
export interface KnockRequested {
  readonly type: 'KnockRequested';
  readonly knock: KnockRequest;
  readonly recipients: readonly string[];
}

export interface KnockAnswered {
  readonly type: 'KnockAnswered';
  readonly knock: KnockRequest;
  readonly outcome: KnockOutcome;
  readonly recipients: readonly string[];
}

export type MeetingsEvent =
  | ConversationEvent
  | ConversationAccessGranted
  | RoomCallChanged
  | RoomCallAccessGranted
  | KnockRequested
  | KnockAnswered
  | DirectCallEvent
  | DirectCallAccessGranted;
export type MeetingsEventListener = (event: MeetingsEvent) => void;

export class MeetingsEventStream {
  readonly #listeners = new Set<MeetingsEventListener>();

  subscribe(listener: MeetingsEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  publish(events: readonly MeetingsEvent[]): void {
    for (const event of events) {
      for (const listener of this.#listeners) listener(event);
    }
  }
}
