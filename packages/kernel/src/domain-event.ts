/**
 * Base shape of all domain events. Names are past tense (e.g. "RoomCreated"),
 * payloads carry IDs plus the minimum data consumers need (docs/architecture/domain-model.md §5).
 */
export interface DomainEvent<Type extends string = string, Payload = unknown> {
  readonly eventId: string;
  readonly type: Type;
  readonly occurredAt: Date;
  readonly payload: Payload;
}

/** Aggregates record events; the application layer publishes them after a successful commit. */
export abstract class AggregateRoot<Event extends DomainEvent = DomainEvent> {
  #pendingEvents: Event[] = [];

  protected record(event: Event): void {
    this.#pendingEvents.push(event);
  }

  /** Returns and clears the recorded events. */
  pullEvents(): readonly Event[] {
    const events = this.#pendingEvents;
    this.#pendingEvents = [];
    return events;
  }
}
