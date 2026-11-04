import { UniqueConstraintViolationException, type MikroORM } from '@mikro-orm/postgresql';
import { err, ok, type Result } from '@teamtown/kernel';
import { appendToOutbox } from '../../../../platform/outbox/outbox.ts';
import type { ChannelOverview, ChannelRepository } from '../../application/ports/channel-repository.port.ts';
import { Channel, type ChannelKind } from '../../domain/channel.ts';
import { ChannelRecord, MembershipRecord } from './messaging.entities.ts';

/** A message by someone else after the member's read marker, not deleted. */
const UNREAD = `msg."author_id" <> mem."person_id" and msg."deleted_at" is null
  and (mem."read_posted_at" is null
       or (msg."posted_at", msg."message_id") > (mem."read_posted_at", mem."read_message_id"))`;

/** A reply the follower has not read in its thread (P-15). */
const UNREAD_THREAD_REPLY = `msg."thread_root_id" is not null and follow."following"
  and msg."author_id" <> mem."person_id" and msg."deleted_at" is null
  and (follow."read_posted_at" is null
       or (msg."posted_at", msg."message_id") > (follow."read_posted_at", follow."read_message_id"))`;

export class MikroOrmChannelRepository implements ChannelRepository {
  constructor(
    private readonly orm: MikroORM,
    /** Tells the outbox relay that new events wait (ADR-0018). */
    private readonly eventsRecorded: () => void,
  ) {}

  async findById(channelId: string): Promise<Channel | null> {
    const [channel] = await this.#load({ channelId });
    return channel ?? null;
  }

  async findByName(name: string): Promise<Channel | null> {
    const [channel] = await this.#load({ name, kind: { $in: ['public', 'private'] } });
    return channel ?? null;
  }

  async findRoomWall(floorId: string, roomId: string): Promise<Channel | null> {
    const [channel] = await this.#load({ kind: 'room', floorId, roomId });
    return channel ?? null;
  }

  async findPair(pairKey: string): Promise<Channel | null> {
    const [channel] = await this.#load({ pairKey });
    return channel ?? null;
  }

  async findGroupWithMembers(memberIds: readonly string[]): Promise<Channel | null> {
    // MikroORM expands an array parameter into a list, so `in (?)` (not `any(?)`).
    const rows = await this.orm.em.fork().execute<{ channel_id: string }[]>(
      `select m."channel_id" from "messaging"."membership" m
         join "messaging"."channel" c on c."channel_id" = m."channel_id"
        where c."kind" = 'group'
        group by m."channel_id"
       having count(*) = ? and bool_and(m."person_id" in (?))
        limit 1`,
      [memberIds.length, [...memberIds]],
    );
    const channelId = rows[0]?.channel_id;
    return channelId ? this.findById(channelId) : null;
  }

  async listForMember(personId: string, channelId?: string): Promise<ChannelOverview[]> {
    // Channel unread excludes replies that stay in their thread. A mention in any unread reply also counts on
    // the channel, using that thread's marker; `distinct` avoids double-counting replies also sent to the channel.
    const rows = await this.orm.em
      .fork()
      .execute<{ channel_id: string; unread: string; mentions: string; last_message_at: Date | null }[]>(
        `select mem."channel_id",
              count(msg."message_id") filter (
                where (msg."thread_root_id" is null or msg."also_in_channel") and ${UNREAD}
              ) as "unread",
              count(distinct msg."message_id") filter (
                where mem."person_id" = any(msg."mentions")
                  and (((msg."thread_root_id" is null or msg."also_in_channel") and ${UNREAD})
                       or (${UNREAD_THREAD_REPLY}))
              ) as "mentions",
              max(msg."posted_at") filter (
                where msg."thread_root_id" is null or msg."also_in_channel"
              ) as "last_message_at"
         from "messaging"."membership" mem
         left join "messaging"."message" msg
           on msg."channel_id" = mem."channel_id"
         left join "messaging"."thread_follow" follow
           on follow."root_message_id" = msg."thread_root_id" and follow."person_id" = mem."person_id"
        where mem."person_id" = ? ${channelId === undefined ? '' : 'and mem."channel_id" = ?'}
        group by mem."channel_id"`,
        channelId === undefined ? [personId] : [personId, channelId],
      );
    if (rows.length === 0) return [];
    const channels = new Map(
      (await this.#load({ channelId: { $in: rows.map((row) => row.channel_id) } })).map((channel) => [
        channel.props.channelId,
        channel,
      ]),
    );
    return rows.flatMap((row) => {
      const channel = channels.get(row.channel_id);
      return channel
        ? [
            {
              channel,
              unreadCount: Number(row.unread),
              mentionCount: Number(row.mentions),
              lastMessageAt: row.last_message_at ? new Date(row.last_message_at) : null,
            },
          ]
        : [];
    });
  }

  listPublic(): Promise<Channel[]> {
    return this.#load({ kind: 'public' });
  }

  async listReadableIds(personId: string): Promise<string[]> {
    // The same rule as `Channel.canRead`, in SQL.
    const rows = await this.orm.em.fork().execute<{ channel_id: string }[]>(
      `select c."channel_id" from "messaging"."channel" c
        where c."kind" in ('public', 'room')
           or exists (select 1 from "messaging"."membership" m
                       where m."channel_id" = c."channel_id" and m."person_id" = ?)`,
      [personId],
    );
    return rows.map((row) => row.channel_id);
  }

  async listCreatorsWithoutRole(): Promise<{ channelId: string; creatorId: string }[]> {
    const rows = await this.orm.em.fork().execute<{ channel_id: string; creator_id: string }[]>(
      `select "channel_id", "creator_id" from "messaging"."channel"
        where "creator_id" is not null and not "creator_role_assigned"`,
    );
    return rows.map((row) => ({ channelId: row.channel_id, creatorId: row.creator_id }));
  }

  async markCreatorRoleAssigned(channelId: string): Promise<void> {
    await this.orm.em
      .fork()
      .execute('update "messaging"."channel" set "creator_role_assigned" = true where "channel_id" = ?', [channelId]);
  }

  listRoomWalls(): Promise<Channel[]> {
    return this.#load({ kind: 'room' });
  }

  async save(channel: Channel): Promise<Result<void, 'conflict'>> {
    const changes = channel.pullChanges();
    const events = channel.pullEvents();
    const { props } = channel;
    try {
      await this.orm.em.fork().transactional(async (em) => {
        if (changes.channel) {
          await em.upsert(ChannelRecord, {
            channelId: props.channelId,
            kind: props.kind,
            name: props.name,
            creatorId: props.creatorId,
            floorId: channel.roomLink?.floorId ?? null,
            roomId: channel.roomLink?.roomId ?? null,
            pairKey: channel.pairKey,
            archivedAt: props.archivedAt,
            createdAt: props.createdAt,
          });
        }
        for (const membership of changes.upserted) {
          await em.upsert(MembershipRecord, {
            channelId: props.channelId,
            personId: membership.personId,
            joinedAt: membership.joinedAt,
            readMessageId: membership.readMarker?.messageId ?? null,
            readPostedAt: membership.readMarker?.postedAt ?? null,
          });
        }
        if (changes.removed.length > 0) {
          await em.nativeDelete(MembershipRecord, {
            channelId: props.channelId,
            personId: { $in: [...changes.removed] },
          });
        }
        await appendToOutbox(em, 'messaging', events);
      });
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) return err('conflict');
      throw error;
    }
    if (events.length > 0) this.eventsRecorded();
    return ok(undefined);
  }

  async isSeeded(personId: string): Promise<boolean> {
    const rows = await this.orm.em
      .fork()
      .execute<{ found: number }[]>('select 1 as "found" from "messaging"."seeded_person" where "person_id" = ?', [
        personId,
      ]);
    return rows.length > 0;
  }

  async markSeeded(personId: string): Promise<void> {
    await this.orm.em
      .fork()
      .execute('insert into "messaging"."seeded_person" ("person_id") values (?) on conflict do nothing', [personId]);
  }

  async #load(where: Record<string, unknown>): Promise<Channel[]> {
    const em = this.orm.em.fork();
    const records = await em.find(ChannelRecord, where);
    if (records.length === 0) return [];
    const memberships = await em.find(
      MembershipRecord,
      { channelId: { $in: records.map((record) => record.channelId) } },
      { orderBy: { joinedAt: 'asc', personId: 'asc' } },
    );
    return records.map((record) =>
      Channel.restore({
        channelId: record.channelId,
        kind: record.kind as ChannelKind,
        name: record.name ?? null,
        creatorId: record.creatorId ?? null,
        room: record.floorId && record.roomId ? { floorId: record.floorId, roomId: record.roomId } : null,
        memberships: memberships
          .filter((membership) => membership.channelId === record.channelId)
          .map((membership) => ({
            personId: membership.personId,
            joinedAt: membership.joinedAt,
            readMarker:
              membership.readMessageId && membership.readPostedAt
                ? { messageId: membership.readMessageId, postedAt: membership.readPostedAt }
                : null,
          })),
        archivedAt: record.archivedAt ?? null,
        createdAt: record.createdAt,
      }),
    );
  }
}
