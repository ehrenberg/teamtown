import type { Clock } from '@teamtown/kernel';
import type { FloorRegistry } from './floor-registry.ts';
import type { PresenceEventStream } from './presence-event-stream.ts';

/** Runs on a short tick: grace periods start and empty rooms return to their door mode without any command. */
export class UpdateRooms {
  constructor(
    private readonly registry: FloorRegistry,
    private readonly events: PresenceEventStream,
    private readonly clock: Clock,
  ) {}

  execute(): void {
    const now = this.clock.now().getTime();
    for (const floorId of this.registry.runningFloorIds()) {
      const floor = this.registry.running(floorId);
      if (!floor) continue;
      floor.updateRooms(now);
      this.events.publish(floor.pullEvents());
    }
  }
}
