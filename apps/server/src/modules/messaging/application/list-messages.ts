import { err, ok, type Result } from '@teamtown/kernel';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessagePage, MessageRepository } from './ports/message-repository.port.ts';

/** Use case: a page of a channel's history, newest first. */
export class ListMessages {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    before?: string | undefined;
    limit: number;
  }): Promise<Result<MessagePage, 'not-found'>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    if (!channel) return err('not-found');
    let before = null;
    if (input.before !== undefined) {
      before = await this.messages.findById(input.before);
      if (before?.props.channelId !== input.channelId) return err('not-found');
    }
    return ok(await this.messages.page(input.channelId, before, input.limit));
  }
}
