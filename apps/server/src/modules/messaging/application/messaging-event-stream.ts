import type { MessagingEvent } from '../domain/events.ts';

export type MessagingEventListener = (event: MessagingEvent) => void;

/** In-process delivery of Messaging events after the outbox relay picked them up (ADR-0018). */
export class MessagingEventStream {
  readonly #listeners = new Set<MessagingEventListener>();

  subscribe(listener: MessagingEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  publish(events: readonly MessagingEvent[]): void {
    for (const event of events) {
      for (const listener of this.#listeners) listener(event);
    }
  }
}
