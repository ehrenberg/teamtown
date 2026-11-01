import type { MikroORM } from '@mikro-orm/postgresql';
import { appendToOutbox } from '../../../../platform/outbox/outbox.ts';
import type { FollowedThread, ThreadRepository } from '../../application/ports/thread-repository.port.ts';
import { Thread } from '../../domain/thread.ts';
import { ThreadFollowRecord } from './messaging.entities.ts';

export class MikroOrmThreadRepository implements ThreadRepository {
  constructor(
    private readonly orm: MikroORM,
    /** Tells the outbox relay that new events wait (ADR-0018). */
    private readonly eventsRecorded: () => void,
  ) {}

  async find(channelId: string, rootMessageId: string): Promise<Thread> {
    const records = await this.orm.em
      .fork()
      .find(ThreadFollowRecord, { rootMessageId }, { orderBy: { personId: 'asc' } });
    return Thread.restore({
      rootMessageId,
      channelId,
      follows: records.map((record) => ({
        personId: record.personId,
        following: record.following,
        readMarker:
          record.readMessageId && record.readPostedAt
            ? { messageId: record.readMessageId, postedAt: record.readPostedAt }
            : null,
      })),
    });
  }

  async listFollowed(personId: string, limit: number): Promise<FollowedThread[]> {
    // Replies by others after the follower's marker; deleted ones don't count.
    const rows = await this.orm.em
      .fork()
      .execute<{ channel_id: string; root_message_id: string; unread: string; last_reply_at: Date }[]>(
        `select f."channel_id", f."root_message_id",
              count(r."message_id") filter (
                where r."author_id" <> f."person_id" and r."deleted_at" is null
                  and (f."read_posted_at" is null
                       or (r."posted_at", r."message_id") > (f."read_posted_at", f."read_message_id"))
              ) as "unread",
              max(r."posted_at") as "last_reply_at"
         from "messaging"."thread_follow" f
         join "messaging"."message" r on r."thread_root_id" = f."root_message_id"
        where f."person_id" = ? and f."following"
        group by f."channel_id", f."root_message_id"
        order by "last_reply_at" desc
        limit ?`,
        [personId, limit],
      );
    return rows.map((row) => ({
      channelId: row.channel_id,
      rootMessageId: row.root_message_id,
      unreadCount: Number(row.unread),
      lastReplyAt: new Date(row.last_reply_at),
    }));
  }

  async save(thread: Thread): Promise<void> {
    const follows = thread.pullChanges();
    const events = thread.pullEvents();
    const { props } = thread;
    await this.orm.em.fork().transactional(async (em) => {
      for (const follow of follows) {
        await em.upsert(ThreadFollowRecord, {
          rootMessageId: props.rootMessageId,
          personId: follow.personId,
          channelId: props.channelId,
          following: follow.following,
          readMessageId: follow.readMarker?.messageId ?? null,
          readPostedAt: follow.readMarker?.postedAt ?? null,
        });
      }
      await appendToOutbox(em, 'messaging', events);
    });
    if (events.length > 0) this.eventsRecorded();
  }
}
