import type { Message } from '../../domain/message.ts';

export interface MessagePage {
  /** Newest first. */
  readonly messages: Message[];
  readonly hasMore: boolean;
}

export interface MessageRepository {
  findById(messageId: string): Promise<Message | null>;
  /** The newest `limit` messages of the channel, or those before `before` (a message of the channel). */
  page(channelId: string, before: Message | null, limit: number): Promise<MessagePage>;
  /** Writes the message and its recorded events into the outbox in one transaction (ADR-0018). */
  save(message: Message): Promise<void>;
}

export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');
