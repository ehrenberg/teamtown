import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { Message, MessageError } from '../domain/message.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';

/** Use case: the author edits their message. */
export class EditMessage {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
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
    return ok(message);
  }
}
