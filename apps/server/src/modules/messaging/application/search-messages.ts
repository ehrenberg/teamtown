import { err, ok, type Result } from '@teamtown/kernel';
import type { Channel } from '../domain/channel.ts';
import type { Message } from '../domain/message.ts';
import { searchTerms } from '../domain/search-terms.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageSearch } from './ports/message-search.port.ts';

export interface SearchResultPage {
  readonly results: readonly { message: Message; snippet: string; channel: Channel }[];
  readonly hasMore: boolean;
}

/**
 * Use case: finds messages in everything the person may read (P-31), or in one such conversation (P-32). Which
 * conversations those are is decided here, before the search runs, so nothing unreadable ever reaches a result.
 * Stores nothing about the search (docs/features/messaging-search.md).
 */
export class SearchMessages {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly search: MessageSearch,
  ) {}

  async execute(input: {
    personId: string;
    query: string;
    channelId?: string | undefined;
    limit: number;
    offset: number;
  }): Promise<Result<SearchResultPage, 'not-found'>> {
    let channelIds: readonly string[];
    if (input.channelId === undefined) {
      channelIds = await this.channels.listReadableIds(input.personId);
    } else {
      const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
      if (!channel) return err('not-found');
      channelIds = [input.channelId];
    }

    const terms = searchTerms(input.query);
    if (terms.length === 0 || channelIds.length === 0) return ok({ results: [], hasMore: false });
    const { hits, hasMore } = await this.search.search({
      terms,
      channelIds,
      limit: input.limit,
      offset: input.offset,
    });

    const found = await Promise.all(
      [...new Set(hits.map((hit) => hit.message.props.channelId))].map((id) => this.channels.findById(id)),
    );
    const byId = new Map(found.flatMap((channel) => (channel ? [[channel.props.channelId, channel]] : [])));
    const results = hits.flatMap(({ message, snippet }) => {
      const channel = byId.get(message.props.channelId);
      return channel ? [{ message, snippet, channel }] : [];
    });
    return ok({ results, hasMore });
  }
}
