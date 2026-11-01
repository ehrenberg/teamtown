import { err, ok, type Clock, type IdGenerator, type Result } from '@teamtown/kernel';
import type { Message } from '../domain/message.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';

export type PostMessageError = 'not-found' | 'not-channel-member' | 'channel-archived' | 'invalid-message';

/** Use case: a member posts a message; the members hear of it through the outbox (overview §6.3). */
export class PostMessage {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    body: string;
  }): Promise<Result<Message, PostMessageError>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    if (!channel) return err('not-found');
    const posted = channel.post({
      messageId: this.ids.next(),
      authorId: input.personId,
      body: input.body,
      now: this.clock.now(),
    });
    if (!posted.ok) return posted;
    await this.messages.save(posted.value);
    // The own message counts as read, also in the author's other clients.
    channel.markRead(input.personId, {
      messageId: posted.value.props.messageId,
      postedAt: posted.value.props.postedAt,
    });
    await this.channels.save(channel);
    return ok(posted.value);
  }
}
