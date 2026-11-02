import { err, type Result } from '@teamtown/kernel';
import type { ChannelError } from '../domain/channel.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';

export type PinMessageError = 'not-found' | ChannelError;

/**
 * Use case: pins or unpins a message (P-24). Until M4, a channel's creator pins/unpins; a DM or room wall has
 * no creator, so any member may (P-25, P-26).
 */
export class PinMessage {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    messageId: string;
    pinned: boolean;
  }): Promise<Result<void, PinMessageError>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    const message = channel ? await this.messages.findById(input.messageId) : null;
    if (!channel || message?.props.channelId !== input.channelId) return err('not-found');
    const pinned = channel.pin(input.personId, message, input.pinned);
    if (!pinned.ok) return pinned;
    await this.messages.save(message);
    return pinned;
  }
}
