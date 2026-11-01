import type { Message } from '../../domain/message.ts';

/** What a root shows about its thread; derived from the replies when read. */
export interface ThreadSummary {
  /** Deleted replies count too: they keep their place as "Message deleted". */
  readonly replyCount: number;
  readonly lastReplyAt: Date;
  /** The newest three different repliers, newest first. */
  readonly replierIds: readonly string[];
}

export interface MessagePage {
  /** Newest first. */
  readonly messages: Message[];
  readonly hasMore: boolean;
  /** Thread summaries of the roots on this page that have replies. */
  readonly threads: ReadonlyMap<string, ThreadSummary>;
}

export interface MessageRepository {
  findById(messageId: string): Promise<Message | null>;
  /**
   * The newest `limit` messages shown in the channel, or those before `before` (a message of the channel).
   * Thread replies are left out unless they were also sent to the channel (ADR-0034).
   */
  page(channelId: string, before: Message | null, limit: number): Promise<MessagePage>;
  /** The newest `limit` replies of a thread, or those before `before`. */
  replies(rootMessageId: string, before: Message | null, limit: number): Promise<MessagePage>;
  threadSummaries(rootMessageIds: readonly string[]): Promise<ReadonlyMap<string, ThreadSummary>>;
  /** Writes the message, its reaction changes and its recorded events into the outbox in one transaction (ADR-0018). */
  save(message: Message): Promise<void>;
}

export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');
