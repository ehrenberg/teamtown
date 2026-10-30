import type { ConversationEvent } from '../domain/floor-conversations.ts';

export interface ConversationAccessGranted {
  readonly type: 'ConversationAccessGranted';
  readonly personId: string;
  readonly conversationId: string;
  readonly url: string;
  readonly token: string;
}

export type MeetingsEvent = ConversationEvent | ConversationAccessGranted;
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
