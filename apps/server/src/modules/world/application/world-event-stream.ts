import type { WorldEvent } from '../domain/events.ts';

export type WorldEventListener = (event: WorldEvent) => void;

/** In-process delivery after the persistent World outbox commits (ADR-0018). */
export class WorldEventStream {
  readonly #listeners = new Set<WorldEventListener>();

  subscribe(listener: WorldEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  publish(events: readonly WorldEvent[]): void {
    for (const event of events) {
      for (const listener of this.#listeners) listener(event);
    }
  }
}
