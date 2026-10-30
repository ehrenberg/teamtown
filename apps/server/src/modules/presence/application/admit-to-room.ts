import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { AdmitError } from '../domain/floor-instance.ts';
import type { FloorRegistry } from './floor-registry.ts';
import type { PresenceEventStream } from './presence-event-stream.ts';

/**
 * Use case: someone inside admitted a person who knocked (Meetings decides that). The person gets an entry pass
 * and walks in.
 */
export class AdmitToRoom {
  constructor(
    private readonly registry: FloorRegistry,
    private readonly events: PresenceEventStream,
    private readonly clock: Clock,
  ) {}

  execute(input: { personId: string; floorId: string; roomId: string }): Result<void, AdmitError> {
    const floor = this.registry.floorOf(input.personId);
    if (floor?.floorId !== input.floorId) return err('not-on-floor');
    const result = floor.admit(input.personId, input.roomId, this.clock.now().getTime());
    this.events.publish(floor.pullEvents());
    return result.ok ? ok(undefined) : result;
  }
}
