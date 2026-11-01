import { err, ok, type Result } from '@teamtown/kernel';
import type { ChannelError } from '../domain/channel.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';

/** Use case: a member leaves a channel or group DM; `#general` and 1:1 DMs can't be left (ADR-0033). */
export class LeaveChannel {
  constructor(private readonly channels: ChannelRepository) {}

  async execute(input: { personId: string; channelId: string }): Promise<Result<void, ChannelError | 'not-found'>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    if (!channel) return err('not-found');
    const left = channel.leave(input.personId);
    if (!left.ok) return left;
    await this.channels.save(channel);
    return ok(undefined);
  }
}
