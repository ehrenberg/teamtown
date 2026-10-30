import { err, ok, type Result } from '@teamtown/kernel';
import type { Knocks } from '../domain/knocks.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';

/** Use case: the requester withdraws their knock. */
export class CancelKnock {
  constructor(
    private readonly presence: LivePresence,
    private readonly knocks: Knocks,
    private readonly events: MeetingsEventStream,
  ) {}

  execute(input: { personId: string; knockId: string }): Result<void, 'knock-not-found'> {
    const knock = this.knocks.get(input.knockId);
    if (knock?.requester !== input.personId) return err('knock-not-found');
    this.knocks.close(knock.knockId);
    const recipients = [...this.presence.occupantsOf(knock.floorId, knock.roomId), knock.requester];
    this.events.publish([{ type: 'KnockAnswered', knock, outcome: 'cancelled', recipients }]);
    return ok(undefined);
  }
}
