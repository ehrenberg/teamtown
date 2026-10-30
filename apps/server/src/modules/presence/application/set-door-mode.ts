import { err, type Clock, type Result } from '@teamtown/kernel';
import type { DoorMode, DoorModeError } from '../domain/room-doors.ts';
import type { FloorRegistry } from './floor-registry.ts';
import type { PresenceEventStream } from './presence-event-stream.ts';

export type SetDoorModeError = DoorModeError | 'not-on-floor';

/** Use case: an occupant opens or closes the door of the room they are in (until M4: any occupant, ADR-0031). */
export class SetDoorMode {
  constructor(
    private readonly registry: FloorRegistry,
    private readonly events: PresenceEventStream,
    private readonly clock: Clock,
  ) {}

  execute(input: { personId: string; roomId: string; doorMode: DoorMode }): Result<void, SetDoorModeError> {
    const floor = this.registry.floorOf(input.personId);
    if (!floor) return err('not-on-floor');
    const result = floor.setDoorMode(input.personId, input.roomId, input.doorMode, this.clock.now().getTime());
    this.events.publish(floor.pullEvents());
    return result;
  }
}
