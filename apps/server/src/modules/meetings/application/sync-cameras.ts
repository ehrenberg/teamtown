import type { Cameras } from '../domain/cameras.ts';
import type { CallMembership } from './call-membership.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';

/** Runs on a short tick: whoever left the conversation or call they switched the camera on in has it off again. */
export class SyncCameras {
  constructor(
    private readonly cameras: Cameras,
    private readonly membership: CallMembership,
    private readonly events: MeetingsEventStream,
  ) {}

  execute(): void {
    this.events.publish(this.cameras.sync((personId) => this.membership.callKeyOf(personId)));
  }
}
