import { err, ok, type Result } from '@teamtown/kernel';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';

/** Use case: a member read up to a message; the marker only moves forward. */
export class MoveReadMarker {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    messageId: string;
  }): Promise<Result<void, 'not-found' | 'not-channel-member'>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    const message = channel ? await this.messages.findById(input.messageId) : null;
    if (!channel || message?.props.channelId !== input.channelId) return err('not-found');
    if (!channel.isMember(input.personId)) return err('not-channel-member');
    channel.markRead(input.personId, { messageId: message.props.messageId, postedAt: message.props.postedAt });
    await this.channels.save(channel);
    return ok(undefined);
  }
}
