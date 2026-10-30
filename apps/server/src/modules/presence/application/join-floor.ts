import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { AvatarState, Occupant } from '../domain/floor-instance.ts';
import type { FloorRegistry } from './floor-registry.ts';
import type { PresenceEventStream } from './presence-event-stream.ts';

export type JoinFloorError = 'unknown-floor';

/** Use case: enter a floor (or switch floors). Returns the floor's current avatars for the joiner. */
export class JoinFloor {
  constructor(
    private readonly registry: FloorRegistry,
    private readonly events: PresenceEventStream,
    private readonly clock: Clock,
  ) {}

  async execute(input: { occupant: Occupant; floorId: string }): Promise<Result<AvatarState[], JoinFloorError>> {
    const target = await this.registry.open(input.floorId);
    if (!target) return err('unknown-floor');

    const now = this.clock.now().getTime();
    const current = this.registry.floorOf(input.occupant.personId);
    if (current && current !== target) {
      current.leave(input.occupant.personId);
      this.events.publish(current.pullEvents());
      this.registry.closeIfEmpty(current);
    }

    target.join(input.occupant, now);
    this.registry.assign(input.occupant.personId, target);
    this.events.publish(target.pullEvents());
    return ok(target.snapshot(now));
  }
}
