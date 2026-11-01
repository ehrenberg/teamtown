import { err, ok, type Clock, type IdGenerator, type Result } from '@teamtown/kernel';
import type { Message } from '../domain/message.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';
import type { ThreadRepository } from './ports/thread-repository.port.ts';

export type PostMessageError =
  'not-found' | 'not-channel-member' | 'channel-archived' | 'invalid-message' | 'invalid-thread-root';

/**
 * Use case: a member posts a message or a thread reply; the members hear of it through the outbox (overview §6.3).
 * A reply to a reply goes to the same root, so threads stay one level deep (decided 2026-11-01).
 */
export class PostMessage {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
    private readonly threads: ThreadRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    body: string;
    threadRootId?: string | undefined;
    alsoInChannel?: boolean | undefined;
  }): Promise<Result<Message, PostMessageError>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    if (!channel) return err('not-found');
    let root: Message | null = null;
    if (input.threadRootId !== undefined) {
      const target = await this.messages.findById(input.threadRootId);
      root = target?.isReply ? await this.messages.findById(target.threadId) : target;
      if (!root) return err('invalid-thread-root');
    }
    const posted = channel.post({
      messageId: this.ids.next(),
      authorId: input.personId,
      body: input.body,
      threadRoot: root,
      alsoInChannel: input.alsoInChannel,
      now: this.clock.now(),
    });
    if (!posted.ok) return posted;
    const message = posted.value;
    await this.messages.save(message);

    const marker = { messageId: message.props.messageId, postedAt: message.props.postedAt };
    if (message.inChannel) {
      // The own message counts as read, also in the author's other clients.
      channel.markRead(input.personId, marker);
      await this.channels.save(channel);
    }
    if (root) {
      const thread = await this.threads.find(channel.props.channelId, root.props.messageId);
      thread.recordReply(message, root.props.authorId, channel.membersAmong(message.props.mentions));
      await this.threads.save(thread);
    }
    return ok(message);
  }
}
