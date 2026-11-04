import type { Message } from '../../domain/message.ts';

export interface MessageSearchQuery {
  /** From `searchTerms`, never empty. */
  readonly terms: readonly string[];
  /** Only these conversations; the caller has checked that the person may read them. */
  readonly channelIds: readonly string[];
  readonly limit: number;
  readonly offset: number;
}

export interface MessageSearchHit {
  readonly message: Message;
  /** Plain text around the match. */
  readonly snippet: string;
}

export interface MessageSearchPage {
  readonly hits: readonly MessageSearchHit[];
  readonly hasMore: boolean;
}

/** Full-text search over messages (ADR-0024); a dedicated engine could replace the adapter. */
export interface MessageSearch {
  search(query: MessageSearchQuery): Promise<MessageSearchPage>;
}

export const MESSAGE_SEARCH = Symbol('MESSAGE_SEARCH');
