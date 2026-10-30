import type { Clock } from '@teamtown/kernel';
import type { DirectCalls } from '../domain/direct-calls.ts';
import type { DirectCallMedia } from './direct-call-media.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';

/** Runs on a short tick: unanswered rings time out, and people who went offline leave their call. */
export class UpdateDirectCalls {
  constructor(
    private readonly presence: LivePresence,
    private readonly calls: DirectCalls,
    private readonly media: DirectCallMedia,
    private readonly events: MeetingsEventStream,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<void> {
    for (const call of this.calls.all()) {
      const everyone = [...call.participants, ...call.invitations.map((i) => i.personId)];
      for (const personId of everyone) if (!this.presence.floorOf(personId)) this.calls.personGone(personId);
    }
    this.calls.expire(this.clock.now().getTime());
    const events = this.calls.pullEvents();
    this.events.publish(events);
    await this.media.apply(events);
  }
}
