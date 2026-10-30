import { ok, type Result } from '@teamtown/kernel';
import type { DirectCallError, DirectCalls } from '../domain/direct-calls.ts';
import type { DirectCallMedia } from './direct-call-media.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';

/** Use case: the person being rung accepts or declines. */
export class AnswerCall {
  constructor(
    private readonly calls: DirectCalls,
    private readonly media: DirectCallMedia,
    private readonly events: MeetingsEventStream,
  ) {}

  async execute(input: { personId: string; callId: string; accept: boolean }): Promise<Result<void, DirectCallError>> {
    const result = this.calls.answer(input.callId, input.personId, input.accept);
    const events = this.calls.pullEvents();
    this.events.publish(events);
    await this.media.apply(events);
    return result.ok ? ok(undefined) : result;
  }
}
