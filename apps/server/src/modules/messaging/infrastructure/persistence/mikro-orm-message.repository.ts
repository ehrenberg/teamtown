import type { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { appendToOutbox } from '../../../../platform/outbox/outbox.ts';
import type { MessagePage, MessageRepository, ThreadSummary } from '../../application/ports/message-repository.port.ts';
import { Message, type Reaction } from '../../domain/message.ts';
import { MessageRecord, ReactionRecord } from './messaging.entities.ts';

/** Repliers a root shows (spec: up to three avatars). */
const REPLIERS_SHOWN = 3;

export class MikroOrmMessageRepository implements MessageRepository {
  constructor(
    private readonly orm: MikroORM,
    /** Tells the outbox relay that new events wait (ADR-0018). */
    private readonly eventsRecorded: () => void,
  ) {}

  async findById(messageId: string): Promise<Message | null> {
    const em = this.orm.em.fork();
    const record = await em.findOne(MessageRecord, { messageId });
    return record ? ((await toDomain(em, [record]))[0] ?? null) : null;
  }

  async page(channelId: string, before: Message | null, limit: number): Promise<MessagePage> {
    // Thread replies stay in their thread unless they were also sent to the channel (ADR-0034).
    const inChannel = { $or: [{ threadRootId: null }, { alsoInChannel: true }] };
    const page = await this.#page({ channelId, $and: [inChannel] }, before, limit);
    const threads = await this.threadSummaries(page.messages.map((message) => message.props.messageId));
    return { ...page, threads };
  }

  replies(rootMessageId: string, before: Message | null, limit: number): Promise<MessagePage> {
    return this.#page({ threadRootId: rootMessageId }, before, limit);
  }

  async threadSummaries(rootMessageIds: readonly string[]): Promise<ReadonlyMap<string, ThreadSummary>> {
    if (rootMessageIds.length === 0) return new Map();
    // Per root and replier their newest reply, so the newest three different repliers can be picked.
    // MikroORM expands an array parameter into a list, so `in (?)` (not `any(?)`).
    const rows = await this.orm.em
      .fork()
      .execute<{ thread_root_id: string; author_id: string; replies: string; last_reply_at: Date }[]>(
        `select "thread_root_id", "author_id", count(*) as "replies", max("posted_at") as "last_reply_at"
         from "messaging"."message"
        where "thread_root_id" in (?)
        group by "thread_root_id", "author_id"
        order by "last_reply_at" desc`,
        [[...rootMessageIds]],
      );
    const summaries = new Map<string, { replyCount: number; lastReplyAt: Date; replierIds: string[] }>();
    for (const row of rows) {
      const lastReplyAt = new Date(row.last_reply_at);
      const summary = summaries.get(row.thread_root_id);
      if (!summary) {
        summaries.set(row.thread_root_id, {
          replyCount: Number(row.replies),
          lastReplyAt,
          replierIds: [row.author_id],
        });
        continue;
      }
      summary.replyCount += Number(row.replies);
      if (summary.replierIds.length < REPLIERS_SHOWN) summary.replierIds.push(row.author_id);
    }
    return summaries;
  }

  async save(message: Message): Promise<void> {
    const events = message.pullEvents();
    const reactionChanges = message.pullReactionChanges();
    const { props } = message;
    await this.orm.em.fork().transactional(async (em) => {
      await em.upsert(MessageRecord, {
        messageId: props.messageId,
        channelId: props.channelId,
        authorId: props.authorId,
        body: props.body,
        threadRootId: props.threadRootId,
        alsoInChannel: props.alsoInChannel,
        mentions: [...props.mentions],
        postedAt: props.postedAt,
        editedAt: props.editedAt,
        deletedAt: props.deletedAt,
      });
      // Only the changes, so that people reacting at the same time don't overwrite each other.
      for (const change of reactionChanges) {
        const key = { messageId: props.messageId, emoji: change.emoji, personId: change.personId };
        if (change.added) {
          await em.execute(
            `insert into "messaging"."reaction" ("message_id", "emoji", "person_id", "reacted_at")
             values (?, ?, ?, now()) on conflict do nothing`,
            [key.messageId, key.emoji, key.personId],
          );
        } else {
          await em.nativeDelete(ReactionRecord, key);
        }
      }
      await appendToOutbox(em, 'messaging', events);
    });
    if (events.length > 0) this.eventsRecorded();
  }

  async #page(where: Record<string, unknown>, before: Message | null, limit: number): Promise<MessagePage> {
    const older = before
      ? {
          $or: [
            { postedAt: { $lt: before.props.postedAt } },
            { postedAt: before.props.postedAt, messageId: { $lt: before.props.messageId } },
          ],
        }
      : {};
    const em = this.orm.em.fork();
    const records = await em.find(
      MessageRecord,
      { ...where, ...older },
      { orderBy: { postedAt: 'desc', messageId: 'desc' }, limit: limit + 1 },
    );
    return {
      messages: await toDomain(em, records.slice(0, limit)),
      hasMore: records.length > limit,
      threads: new Map(),
    };
  }
}

async function toDomain(em: EntityManager, records: readonly MessageRecord[]): Promise<Message[]> {
  const reactions = await reactionsOf(
    em,
    records.map((record) => record.messageId),
  );
  return records.map((record) =>
    Message.restore({
      messageId: record.messageId,
      channelId: record.channelId,
      authorId: record.authorId,
      body: record.body,
      threadRootId: record.threadRootId ?? null,
      alsoInChannel: record.alsoInChannel,
      mentions: record.mentions,
      reactions: reactions.get(record.messageId) ?? [],
      postedAt: record.postedAt,
      editedAt: record.editedAt ?? null,
      deletedAt: record.deletedAt ?? null,
    }),
  );
}

/** Reactions per message: emoji in the order of their first reaction, people in the order they reacted. */
async function reactionsOf(em: EntityManager, messageIds: readonly string[]): Promise<Map<string, Reaction[]>> {
  const byMessage = new Map<string, { emoji: string; personIds: string[] }[]>();
  if (messageIds.length === 0) return byMessage;
  const records = await em.find(
    ReactionRecord,
    { messageId: { $in: [...messageIds] } },
    { orderBy: { reactedAt: 'asc', personId: 'asc' } },
  );
  for (const record of records) {
    const reactions = byMessage.get(record.messageId) ?? [];
    const reaction = reactions.find((existing) => existing.emoji === record.emoji);
    if (reaction) reaction.personIds.push(record.personId);
    else reactions.push({ emoji: record.emoji, personIds: [record.personId] });
    byMessage.set(record.messageId, reactions);
  }
  return byMessage;
}
