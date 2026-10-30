import { ok, type Result } from '@teamtown/kernel';
import type { ScreenShareChange, ScreenShares } from '../domain/screen-shares.ts';
import type { CallMembership } from './call-membership.ts';
import type { MeetingsEvent, MeetingsEventStream } from './meetings-event-stream.ts';

/** A change goes to everyone in the call, and to the previous sharer so their app stops sharing. */
function toEvent(change: ScreenShareChange, membership: CallMembership): MeetingsEvent {
  const recipients = new Set(membership.participantsOf(change.callKey));
  if (change.previous) recipients.add(change.previous);
  return { type: 'ScreenShareChanged', sharer: change.sharer, recipients: [...recipients] };
}

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
    if (change.value) this.events.publish([toEvent(change.value, this.membership)]);
    return ok(undefined);
  }
}

/** Use case: stop sharing one's screen. */
export class StopScreenShare {
  constructor(
    private readonly shares: ScreenShares,
    private readonly membership: CallMembership,
    private readonly events: MeetingsEventStream,
  ) {}

  execute(input: { personId: string }): void {
    const change = this.shares.stop(input.personId);
    if (change) this.events.publish([toEvent(change, this.membership)]);
  }
}

/** Runs on a short tick: a share ends when its sharer leaves the call. */
export class SyncScreenShares {
  constructor(
    private readonly shares: ScreenShares,
    private readonly membership: CallMembership,
    private readonly events: MeetingsEventStream,
  ) {}

  execute(): void {
    const ended = this.shares.sync((personId) => this.membership.callKeyOf(personId));
    this.events.publish(ended.map((change) => toEvent(change, this.membership)));
  }
}
