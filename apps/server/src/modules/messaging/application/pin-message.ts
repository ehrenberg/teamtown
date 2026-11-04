import { err, type Result } from '@teamtown/kernel';
import type { ChannelError } from '../domain/channel.ts';
import type { ChannelAbilities } from './channel-abilities.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';

export type PinMessageError = 'not-found' | ChannelError;

/**
 * Use case: pins or unpins a message (P-24): `message.pin` in a channel, any member in a DM or on a room wall
 * (P-25, P-26).
 */
export class PinMessage {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
    private readonly abilities: ChannelAbilities,
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
    const mayPin = await this.abilities.mayPin(input.personId, channel);
    const pinned = channel.pin(mayPin, message, input.pinned);
    if (!pinned.ok) return pinned;
    await this.messages.save(message);
    return pinned;
  }
}
