import type { MikroORM } from '@mikro-orm/postgresql';
import type {
  MessageSearch,
  MessageSearchPage,
  MessageSearchQuery,
} from '../../application/ports/message-search.port.ts';
import { MessageRecord } from './messaging.entities.ts';
import { toDomain } from './mikro-orm-message.repository.ts';

/** Below any real text match, so a message that says it outranks one that only carries the file. */
const FILE_NAME_RANK = 0.01;

// `ShortWord=0`: by default the text around a match loses short words at its edges ("Die", "da").
const HEADLINE = 'MaxWords=24, MinWords=12, ShortWord=0, StartSel="", StopSel=""';

/** PostgreSQL full-text search (ADR-0024). Terms come from `searchTerms`, so they are safe to quote in a `tsquery`. */
export class PostgresMessageSearch implements MessageSearch {
  constructor(private readonly orm: MikroORM) {}

  async search({ terms, channelIds, limit, offset }: MessageSearchQuery): Promise<MessageSearchPage> {
    const words = terms.join(' ');
    const prefixes = terms.map((term) => `'${term}':*`).join(' & ');
    const em = this.orm.em.fork();
    const rows = await em.execute<{ message_id: string; snippet: string }[]>(
      `with query as (
         select plainto_tsquery('german', ?) || plainto_tsquery('english', ?) || to_tsquery('simple', ?) as text_query,
                to_tsquery('simple', ?) as name_query
       ), hits as (
         select m."message_id", ts_rank(m."search_vector", query.text_query) as rank
           from "messaging"."message" m, query
          where m."channel_id" in (?) and m."deleted_at" is null and m."search_vector" @@ query.text_query
         union all
         select m."message_id", ? as rank
           from "messaging"."attachment" a
           join "messaging"."message" m on m."message_id" = a."message_id", query
          where m."channel_id" in (?) and m."deleted_at" is null
            and to_tsvector('simple', translate(a."file_name", '._-', '   ')) @@ query.name_query
       ), best as (
         select "message_id", max(rank) as rank from hits group by "message_id"
       )
       select m."message_id", ts_headline('german', m."body", query.text_query, ?) as snippet
         from best
         join "messaging"."message" m on m."message_id" = best."message_id", query
        order by best.rank desc, m."posted_at" desc, m."message_id" desc
        limit ? offset ?`,
      [words, words, prefixes, prefixes, [...channelIds], FILE_NAME_RANK, [...channelIds], HEADLINE, limit + 1, offset],
    );

    const page = rows.slice(0, limit);
    const records = await em.find(MessageRecord, { messageId: { $in: page.map((row) => row.message_id) } });
    const messages = new Map((await toDomain(em, records)).map((message) => [message.props.messageId, message]));
    return {
      hits: page.flatMap((row) => {
        const message = messages.get(row.message_id);
        return message ? [{ message, snippet: row.snippet }] : [];
      }),
      hasMore: rows.length > limit,
    };
  }
}
