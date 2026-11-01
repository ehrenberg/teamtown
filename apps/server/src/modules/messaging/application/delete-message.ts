import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';

/** Use case: the author deletes their message; its body is removed from the database. */
export class DeleteMessage {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    messageId: string;
  }): Promise<Result<void, 'not-found' | 'not-message-author' | 'channel-archived'>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    const message = channel ? await this.messages.findById(input.messageId) : null;
    if (!channel || message?.props.channelId !== input.channelId) return err('not-found');
    const open = channel.checkOpen();
    if (!open.ok) return open;
    const deleted = message.delete(input.personId, this.clock.now(), channel.memberIds);
    if (!deleted.ok) return deleted;
    await this.messages.save(message);
    return ok(undefined);
  }
}
