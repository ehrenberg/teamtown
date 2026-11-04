import { err, type Clock, type Result } from '@teamtown/kernel';
import type { AccessPolicy } from '../../access/public-api.ts';
import type { DoorMode, DoorModeError } from '../domain/room-doors.ts';
import type { FloorRegistry } from './floor-registry.ts';
import type { PresenceEventStream } from './presence-event-stream.ts';

export type SetDoorModeError = DoorModeError | 'not-on-floor' | 'not-allowed';

/** Use case: someone holding `room.lock`, which Member does (ADR-0036), switches the door of the room they are in. */
export class SetDoorMode {
  constructor(
    private readonly registry: FloorRegistry,
    private readonly events: PresenceEventStream,
    private readonly clock: Clock,
    private readonly access: AccessPolicy,
  ) {}

  async execute(input: {
    personId: string;
    roomId: string;
    doorMode: DoorMode;
  }): Promise<Result<void, SetDoorModeError>> {
    const floor = this.registry.floorOf(input.personId);
    if (!floor) return err('not-on-floor');
    const room = { kind: 'room', floorId: floor.floorId, roomId: input.roomId } as const;
    if (!(await this.access.can(input.personId, 'room.lock', room))) return err('not-allowed');
    const result = floor.setDoorMode(input.personId, input.roomId, input.doorMode, this.clock.now().getTime());
    this.events.publish(floor.pullEvents());
    return result;
  }
}
