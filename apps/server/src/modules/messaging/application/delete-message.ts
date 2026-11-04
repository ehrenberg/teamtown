import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { ChannelAbilities } from './channel-abilities.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { FileAttachments } from './ports/file-attachments.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';

/**
 * Use case: the author, or whoever holds `message.delete.any` there (P-34), deletes a message; its body, attachments
 * and pin state are removed (P-21, P-24).
 */
export class DeleteMessage {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
    private readonly fileAttachments: FileAttachments,
    private readonly abilities: ChannelAbilities,
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
    const mayDeleteAny = await this.abilities.mayDeleteAny(input.personId, channel);
    const deleted = message.delete(input.personId, this.clock.now(), channel.memberIds, mayDeleteAny);
    if (!deleted.ok) return deleted;
    await this.messages.save(message);
    await this.fileAttachments.deleteForMessage(input.messageId);
    return ok(undefined);
  }
}
