import type { PresenceEvent } from '../domain/floor-instance.ts';

export type PresenceEventListener = (event: PresenceEvent) => void;

/**
 * In-process stream of presence events. Presence events are never persisted or put into an outbox
 * (ADR-0012, ADR-0018); listeners such as the realtime gateway receive them synchronously.
 */
export class PresenceEventStream {
  readonly #listeners = new Set<PresenceEventListener>();

  subscribe(listener: PresenceEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  publish(events: readonly PresenceEvent[]): void {
    for (const event of events) {
      for (const listener of this.#listeners) {
        listener(event);
      }
    }
  }
}
