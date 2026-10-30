import type { Clock } from '@teamtown/kernel';
import type { KnockOutcome, KnockRequest, Knocks } from '../domain/knocks.ts';
import type { MeetingsEvent, MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';

/**
 * Runs on a short tick: unanswered knocks expire after a minute. Knocks that became pointless are cancelled:
 * the requester left the floor, or the room is open or empty now and they can just walk in.
 */
export class ExpireKnocks {
  constructor(
    private readonly presence: LivePresence,
    private readonly knocks: Knocks,
    private readonly events: MeetingsEventStream,
    private readonly clock: Clock,
  ) {}

  execute(): void {
    const closed: { knock: KnockRequest; outcome: KnockOutcome }[] = this.knocks
      .expire(this.clock.now().getTime())
      .map((knock) => ({ knock, outcome: 'expired' }));

    for (const knock of this.knocks.all()) {
      const stillWaiting =
        this.presence.floorOf(knock.requester) === knock.floorId &&
        this.presence.doorModeOf(knock.floorId, knock.roomId) === 'knock' &&
        this.presence.occupantsOf(knock.floorId, knock.roomId).length > 0;
      if (stillWaiting) continue;
      this.knocks.close(knock.knockId);
      closed.push({ knock, outcome: 'cancelled' });
    }

    this.events.publish(
      closed.map(({ knock, outcome }): MeetingsEvent => ({
        type: 'KnockAnswered',
        knock,
        outcome,
        recipients: [...this.presence.occupantsOf(knock.floorId, knock.roomId), knock.requester],
      })),
    );
  }
}
