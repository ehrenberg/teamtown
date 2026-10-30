import type { ScreenShares } from '../domain/screen-shares.ts';
import type { CallMembership } from './call-membership.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import { screenShareEvent } from './screen-share-events.ts';

/** Use case: stop sharing one's screen. */
export class StopScreenShare {
  constructor(
    private readonly shares: ScreenShares,
    private readonly membership: CallMembership,
    private readonly events: MeetingsEventStream,
  ) {}

  execute(input: { personId: string }): void {
    const change = this.shares.stop(input.personId);
    if (change) this.events.publish([screenShareEvent(change, this.membership)]);
  }
}
