import { err, type Clock, type Result } from '@teamtown/kernel';
import type { DirectCall, DirectCalls } from '../domain/direct-calls.ts';
import type { DirectCallMedia } from './direct-call-media.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';
import type { StartCallError } from './start-call.ts';

/** Use case: any participant rings one more person into the call (until M4, at most 8 people). */
export class InviteToCall {
  constructor(
    private readonly presence: LivePresence,
    private readonly calls: DirectCalls,
    private readonly media: DirectCallMedia,
    private readonly events: MeetingsEventStream,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    personId: string;
    callId: string;
    invitee: string;
  }): Promise<Result<DirectCall, StartCallError>> {
    if (!this.presence.floorOf(input.invitee)) return err('person-not-online');
    const call = this.calls.invite(input.callId, input.personId, input.invitee, this.clock.now().getTime());
    const events = this.calls.pullEvents();
    this.events.publish(events);
    await this.media.apply(events);
    return call;
  }
}
