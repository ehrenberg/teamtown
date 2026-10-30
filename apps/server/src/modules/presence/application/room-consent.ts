import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { AdmitError } from '../domain/floor-instance.ts';
import type { FloorRegistry } from './floor-registry.ts';
import type { PresenceEventStream } from './presence-event-stream.ts';

/** Use case (for Meetings): while a meeting in the room is logged, nobody walks in without consenting. */
export class SetRoomConsentRequired {
  constructor(
    private readonly registry: FloorRegistry,
    private readonly events: PresenceEventStream,
    private readonly clock: Clock,
  ) {}

  execute(input: { floorId: string; roomId: string; required: boolean }): void {
    const floor = this.registry.running(input.floorId);
    if (!floor) return;
    floor.setConsentRequired(input.roomId, input.required, this.clock.now().getTime());
    this.events.publish(floor.pullEvents());
  }
}

/** Use case (for Meetings): someone declined a logged meeting; they walk out of the room. */
export class WalkOutOfRoom {
  constructor(
    private readonly registry: FloorRegistry,
    private readonly events: PresenceEventStream,
    private readonly clock: Clock,
  ) {}

  execute(input: { personId: string; floorId: string; roomId: string }): Result<void, AdmitError> {
    const floor = this.registry.floorOf(input.personId);
    if (floor?.floorId !== input.floorId) return err('not-on-floor');
    const result = floor.walkOut(input.personId, input.roomId, this.clock.now().getTime());
    this.events.publish(floor.pullEvents());
    return result.ok ? ok(undefined) : result;
  }
}
