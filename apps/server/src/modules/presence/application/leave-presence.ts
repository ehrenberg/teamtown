import type { FloorRegistry } from './floor-registry.ts';
import type { PresenceEventStream } from './presence-event-stream.ts';

/** Use case: a person went offline; remove their avatar from the floor. */
export class LeavePresence {
  constructor(
    private readonly registry: FloorRegistry,
    private readonly events: PresenceEventStream,
  ) {}

  execute(personId: string): void {
    const floor = this.registry.floorOf(personId);
    if (!floor) return;
    floor.leave(personId);
    this.registry.unassign(personId);
    this.events.publish(floor.pullEvents());
    this.registry.closeIfEmpty(floor);
  }
}
