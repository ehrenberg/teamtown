import type { ScreenShares } from '../domain/screen-shares.ts';
import type { CallMembership } from './call-membership.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import { screenShareEvent } from './screen-share-events.ts';

/** Runs on a short tick: a share ends when its sharer leaves the call. */
export class SyncScreenShares {
  constructor(
    private readonly shares: ScreenShares,
    private readonly membership: CallMembership,
    private readonly events: MeetingsEventStream,
  ) {}

  execute(): void {
    const ended = this.shares.sync((personId) => this.membership.callKeyOf(personId));
    this.events.publish(ended.map((change) => screenShareEvent(change, this.membership)));
  }
}
