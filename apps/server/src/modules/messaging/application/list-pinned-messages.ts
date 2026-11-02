import { err, ok, type Result } from '@teamtown/kernel';
import type { Message } from '../domain/message.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';

/** Use case: a channel's pinned messages, newest first (P-24). */
export class ListPinnedMessages {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
  ) {}

  async execute(input: { personId: string; channelId: string }): Promise<Result<Message[], 'not-found'>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    if (!channel) return err('not-found');
    return ok(await this.messages.findPinned(input.channelId));
  }
}
