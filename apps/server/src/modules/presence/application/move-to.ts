import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { TileCoord } from '@teamtown/world-core';
import type { MoveError } from '../domain/floor-instance.ts';
import type { FloorRegistry } from './floor-registry.ts';
import type { PresenceEventStream } from './presence-event-stream.ts';

/** Use case: walk to a tile on the current floor. */
export class MoveTo {
  constructor(
    private readonly registry: FloorRegistry,
    private readonly events: PresenceEventStream,
    private readonly clock: Clock,
  ) {}

  execute(input: { personId: string; target: TileCoord }): Result<void, MoveError> {
    const floor = this.registry.floorOf(input.personId);
    if (!floor) return err('not-on-floor');

    const result = floor.moveTo(input.personId, input.target, this.clock.now().getTime());
    if (!result.ok) return result;
    this.events.publish(floor.pullEvents());
    return ok(undefined);
  }
}
