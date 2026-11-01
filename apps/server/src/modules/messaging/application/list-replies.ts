import { err, ok, type Result } from '@teamtown/kernel';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessagePage, MessageRepository } from './ports/message-repository.port.ts';

/** Use case: a page of a thread's replies, newest first (ADR-0034). */
export class ListReplies {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    rootMessageId: string;
    before?: string | undefined;
    limit: number;
  }): Promise<Result<MessagePage, 'not-found'>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    const root = channel ? await this.messages.findById(input.rootMessageId) : null;
    if (root?.props.channelId !== input.channelId || root.isReply) return err('not-found');
    let before = null;
    if (input.before !== undefined) {
      before = await this.messages.findById(input.before);
      if (before?.props.threadRootId !== input.rootMessageId) return err('not-found');
    }
    return ok(await this.messages.replies(input.rootMessageId, before, input.limit));
  }
}
