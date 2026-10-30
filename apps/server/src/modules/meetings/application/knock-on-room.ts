import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { KnockRequest, Knocks } from '../domain/knocks.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';

export type KnockOnRoomError = 'not-on-floor' | 'room-not-found' | 'knock-not-needed' | 'door-closed' | 'knock-pending';

/** Use case: ask to enter an occupied `knock` room. Everyone inside sees the request (ADR-0031). */
export class KnockOnRoom {
  constructor(
    private readonly presence: LivePresence,
    private readonly knocks: Knocks,
    private readonly events: MeetingsEventStream,
    private readonly clock: Clock,
  ) {}

  execute(input: { personId: string; roomId: string }): Result<KnockRequest, KnockOnRoomError> {
    const floorId = this.presence.floorOf(input.personId);
    if (!floorId) return err('not-on-floor');
    const doorMode = this.presence.doorModeOf(floorId, input.roomId);
    if (!doorMode) return err('room-not-found');
    const occupants = this.presence.occupantsOf(floorId, input.roomId);
    if (doorMode === 'open' || occupants.length === 0 || occupants.includes(input.personId)) {
      return err('knock-not-needed');
    }
    if (doorMode === 'locked') return err('door-closed');

    const knock = this.knocks.request(
      { floorId, roomId: input.roomId, requester: input.personId },
      this.clock.now().getTime(),
    );
    if (!knock.ok) return knock;
    this.events.publish([{ type: 'KnockRequested', knock: knock.value, recipients: [...occupants, input.personId] }]);
    return ok(knock.value);
  }
}
