import { ok, type Result } from '@teamtown/kernel';
import type { Cameras } from '../domain/cameras.ts';
import type { CallMembership } from './call-membership.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';

/** Use case: switch one's camera on (only inside a conversation or call) or off. */
export class SetCamera {
  constructor(
    private readonly cameras: Cameras,
    private readonly membership: CallMembership,
    private readonly events: MeetingsEventStream,
  ) {}

  execute(input: { personId: string; on: boolean }): Result<void, 'not-in-call'> {
    const changed = this.cameras.set(input.personId, input.on, this.membership.callKeyOf(input.personId));
    if (!changed.ok) return changed;
    if (changed.value) this.events.publish([changed.value]);
    return ok(undefined);
  }
}
