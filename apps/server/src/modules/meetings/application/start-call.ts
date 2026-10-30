import { err, type Clock, type Result } from '@teamtown/kernel';
import type { DirectCall, DirectCallError, DirectCalls } from '../domain/direct-calls.ts';
import type { DirectCallMedia } from './direct-call-media.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';

export type StartCallError = DirectCallError | 'person-not-online';

/** Use case: ring someone who is online, on any floor (C8). */
export class StartCall {
  constructor(
    private readonly presence: LivePresence,
    private readonly calls: DirectCalls,
    private readonly media: DirectCallMedia,
    private readonly events: MeetingsEventStream,
    private readonly clock: Clock,
  ) {}

  async execute(input: { personId: string; callee: string }): Promise<Result<DirectCall, StartCallError>> {
    if (!this.presence.floorOf(input.personId) || !this.presence.floorOf(input.callee)) {
      return err('person-not-online');
    }
    const call = this.calls.start(input.personId, input.callee, this.clock.now().getTime());
    const events = this.calls.pullEvents();
    this.events.publish(events);
    await this.media.apply(events);
    return call;
  }
}
