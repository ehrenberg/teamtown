import { err, ok, type Result } from '@teamtown/kernel';
import type { DirectCalls } from '../domain/direct-calls.ts';
import type { DirectCallMedia } from './direct-call-media.ts';

export type DirectCallTokenError = 'not-in-call' | 'media-unavailable';

/** Use case: a fresh token for a participant of a direct call, e.g. after a reconnect. */
export class RequestDirectCallToken {
  constructor(
    private readonly calls: DirectCalls,
    private readonly media: DirectCallMedia,
  ) {}

  async execute(input: {
    personId: string;
    callId: string;
  }): Promise<Result<{ url: string; token: string }, DirectCallTokenError>> {
    if (!this.calls.get(input.callId)?.participants.includes(input.personId)) return err('not-in-call');
    const access = await this.media.tokenFor(input.callId, input.personId);
    return access ? ok(access) : err('media-unavailable');
  }
}
