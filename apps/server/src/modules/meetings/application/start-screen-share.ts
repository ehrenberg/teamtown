import { ok, type Result } from '@teamtown/kernel';
import type { ScreenShares } from '../domain/screen-shares.ts';
import type { CallMembership } from './call-membership.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import { screenShareEvent } from './screen-share-events.ts';

/** Use case: share one's screen in a room call or direct call; a new sharer takes over. */
export class StartScreenShare {
  constructor(
    private readonly shares: ScreenShares,
    private readonly membership: CallMembership,
    private readonly events: MeetingsEventStream,
  ) {}

  execute(input: { personId: string }): Result<void, 'screen-share-not-here'> {
    const change = this.shares.start(input.personId, this.membership.callKeyOf(input.personId));
    if (!change.ok) return change;
    if (change.value) this.events.publish([screenShareEvent(change.value, this.membership)]);
    return ok(undefined);
  }
}
