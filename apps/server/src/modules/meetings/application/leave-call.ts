import type { Result } from '@teamtown/kernel';
import type { DirectCallError, DirectCalls } from '../domain/direct-calls.ts';
import type { DirectCallMedia } from './direct-call-media.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';

/** Use case: hang up. The call ends when fewer than two participants are left. */
export class LeaveCall {
  constructor(
    private readonly calls: DirectCalls,
    private readonly media: DirectCallMedia,
    private readonly events: MeetingsEventStream,
  ) {}

  async execute(input: { personId: string; callId: string }): Promise<Result<void, DirectCallError>> {
    const result = this.calls.leave(input.callId, input.personId);
    const events = this.calls.pullEvents();
    this.events.publish(events);
    await this.media.apply(events);
    return result;
  }
}
