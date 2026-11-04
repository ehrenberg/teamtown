import { z } from 'zod';
import { ChannelId, ChannelKind, MessageSchema } from './channels.ts';
import { PersonId } from '../people/me.ts';

/** Message search (M3e, ADR-0024, docs/features/messaging-search.md). */

export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 200;
export const SEARCH_PAGE_SIZE = 20;

/** `GET /api/search/messages`: best matches first (P-32); `channelId` narrows to one conversation. */
export const SearchMessagesQuery = z.object({
  q: z.string().trim().min(MIN_SEARCH_LENGTH).max(MAX_SEARCH_LENGTH),
  channelId: ChannelId.optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(SEARCH_PAGE_SIZE),
});
export type SearchMessagesQuery = z.infer<typeof SearchMessagesQuery>;

export const SearchResultSchema = z.object({
  message: MessageSchema,
  /** Plain text around the match; empty for a message without text. */
  snippet: z.string(),
  /** Where it is: enough to name it, also for a public channel the person hasn't joined. */
  channel: z.object({
    channelId: ChannelId,
    kind: ChannelKind,
    name: z.string().nullable(),
    members: z.array(PersonId),
  }),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchMessagesResponse = z.object({
  results: z.array(SearchResultSchema),
  hasMore: z.boolean(),
});
export type SearchMessagesResponse = z.infer<typeof SearchMessagesResponse>;
