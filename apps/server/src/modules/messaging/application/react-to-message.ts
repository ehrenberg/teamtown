import { err, ok, type Result } from '@teamtown/kernel';
import type { Message, ReactionError } from '../domain/message.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';

export type ReactError = ReactionError | 'not-found' | 'not-channel-member' | 'channel-archived';

/** Use case: a member adds or removes their reaction; both are idempotent (ADR-0034). */
export class ReactToMessage {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    messageId: string;
    emoji: string;
    add: boolean;
  }): Promise<Result<Message, ReactError>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    const message = channel ? await this.messages.findById(input.messageId) : null;
    if (!channel || message?.props.channelId !== input.channelId) return err('not-found');
    const reacted = channel.react(message, { personId: input.personId, emoji: input.emoji, add: input.add });
    if (!reacted.ok) return reacted;
    await this.messages.save(message);
    return ok(message);
  }
}
