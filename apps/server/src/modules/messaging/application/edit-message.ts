import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { Message, MessageError } from '../domain/message.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';
import type { ThreadRepository } from './ports/thread-repository.port.ts';

/** Use case: the author edits their message; mentions follow the new body (decided 2026-11-01). */
export class EditMessage {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
    private readonly threads: ThreadRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    messageId: string;
    body: string;
  }): Promise<Result<Message, MessageError | 'not-found' | 'channel-archived'>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    const message = channel ? await this.messages.findById(input.messageId) : null;
    if (!channel || message?.props.channelId !== input.channelId) return err('not-found');
    const open = channel.checkOpen();
    if (!open.ok) return open;
    const edited = message.edit(input.personId, input.body, this.clock.now(), channel.memberIds);
    if (!edited.ok) return edited;
    await this.messages.save(message);
    if (message.isReply) {
      // Members newly mentioned in a reply follow its thread, as if mentioned when it was posted.
      const thread = await this.threads.find(channel.props.channelId, message.threadId);
      thread.recordMentions(channel.membersAmong(message.props.mentions));
      await this.threads.save(thread);
    }
    return ok(message);
  }
}
