import type { CameraChanged } from '../domain/cameras.ts';
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

/** Goes to the people in the call and to the previous sharer. */
export interface ScreenShareChanged {
  readonly type: 'ScreenShareChanged';
  readonly sharer: string | null;
  readonly recipients: readonly string[];
}

/** To everyone on the floor: whether a room's meeting is logged (never its title or participants). */
export interface MeetingLogChanged {
  readonly type: 'MeetingLogChanged';
  readonly floorId: string;
  readonly roomId: string;
  readonly active: boolean;
}

/** To the people concerned: the logged meeting they are in, or `null` once it ended. */
export interface MeetingLogDetails {
  readonly type: 'MeetingLogDetails';
  readonly roomId: string;
  readonly details: { readonly meetingId: string; readonly title: string; readonly hostId: string } | null;
  readonly recipients: readonly string[];
}

/** To people inside a logged room who haven't consented yet (ADR-0027). */
export interface MeetingLogConsentRequested {
  readonly type: 'MeetingLogConsentRequested';
  readonly roomId: string;
  readonly title: string;
  readonly recipients: readonly string[];
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
  | DirectCallAccessGranted
  | CameraChanged
  | ScreenShareChanged
  | MeetingLogChanged
  | MeetingLogDetails
  | MeetingLogConsentRequested;
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
