import { describe, expect, it } from 'vitest';
import { AggregateRoot, type DomainEvent } from './domain-event.ts';

type DoorOpened = DomainEvent<'DoorOpened', { doorId: string }>;

class Door extends AggregateRoot<DoorOpened> {
  open(): void {
    this.record({
      eventId: 'evt-1',
      type: 'DoorOpened',
      occurredAt: new Date('2026-10-29T10:00:00Z'),
      payload: { doorId: 'door-1' },
    });
  }
}

describe('AggregateRoot', () => {
  it('hands out recorded events exactly once', () => {
    const door = new Door();
    door.open();

    expect(door.pullEvents()).toHaveLength(1);
    expect(door.pullEvents()).toHaveLength(0);
  });
});
