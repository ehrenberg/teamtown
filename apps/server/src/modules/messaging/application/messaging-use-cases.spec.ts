import { FixedClock, ok, unwrap, type IdGenerator, type Result } from '@teamtown/kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import { Channel, GENERAL_CHANNEL_ID, RANDOM_CHANNEL_ID } from '../domain/channel.ts';
import type { MessagingEvent } from '../domain/events.ts';
import type { Message } from '../domain/message.ts';
import { Thread } from '../domain/thread.ts';
import { AddChannelMembers } from './add-channel-members.ts';
import { CreateChannel } from './create-channel.ts';
import { DeleteMessage } from './delete-message.ts';
import { EditMessage } from './edit-message.ts';
import { LeaveChannel } from './leave-channel.ts';
import { ListMessages } from './list-messages.ts';
import { ListMyChannels } from './list-my-channels.ts';
import { ListReplies } from './list-replies.ts';
import { ListThreads } from './list-threads.ts';
import { MoveReadMarker } from './move-read-marker.ts';
import { OpenDirectMessage } from './open-direct-message.ts';
import type { ChannelOverview, ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessagePage, MessageRepository, ThreadSummary } from './ports/message-repository.port.ts';
import type { PeopleDirectory } from './ports/people-directory.port.ts';
import type { FollowedThread, ThreadRepository } from './ports/thread-repository.port.ts';
import { PostMessage } from './post-message.ts';
import { ReactToMessage } from './react-to-message.ts';
import { MoveThreadReadMarker, SetThreadFollowing } from './thread-follows.ts';
import { UpdateChannel } from './update-channel.ts';

/** The outbox of the fakes: every event that a save would have written. */
const outbox: MessagingEvent[] = [];

class InMemoryMessages implements MessageRepository {
  readonly messages = new Map<string, Message>();

  findById(messageId: string): Promise<Message | null> {
    return Promise.resolve(this.messages.get(messageId) ?? null);
  }
  async page(channelId: string, before: Message | null, limit: number): Promise<MessagePage> {
    return this.#page((m) => m.props.channelId === channelId && m.inChannel, before, limit);
  }
  replies(rootMessageId: string, before: Message | null, limit: number): Promise<MessagePage> {
    return this.#page((m) => m.props.threadRootId === rootMessageId, before, limit);
  }
  threadSummaries(rootMessageIds: readonly string[]): Promise<ReadonlyMap<string, ThreadSummary>> {
    const summaries = new Map<string, ThreadSummary>();
    for (const rootId of rootMessageIds) {
      const replies = [...this.messages.values()]
        .filter((m) => m.props.threadRootId === rootId)
        .sort((a, b) => b.props.postedAt.getTime() - a.props.postedAt.getTime());
      const [newest] = replies;
      if (!newest) continue;
      summaries.set(rootId, {
        replyCount: replies.length,
        lastReplyAt: newest.props.postedAt,
        replierIds: [...new Set(replies.map((m) => m.props.authorId))].slice(0, 3),
      });
    }
    return Promise.resolve(summaries);
  }
  save(message: Message): Promise<void> {
    message.pullReactionChanges();
    this.messages.set(message.props.messageId, message);
    outbox.push(...message.pullEvents());
    return Promise.resolve();
  }
  async #page(filter: (m: Message) => boolean, before: Message | null, limit: number): Promise<MessagePage> {
    const all = [...this.messages.values()]
      .filter((m) => filter(m) && (!before || m.props.postedAt < before.props.postedAt))
      .sort((a, b) => b.props.postedAt.getTime() - a.props.postedAt.getTime());
    const messages = all.slice(0, limit);
    const threads = await this.threadSummaries(messages.map((m) => m.props.messageId));
    return { messages, hasMore: all.length > limit, threads };
  }
}

class InMemoryChannels implements ChannelRepository {
  readonly channels = new Map<string, Channel>();
  readonly seeded = new Set<string>();

  constructor(private readonly messages: InMemoryMessages) {}

  findById(channelId: string): Promise<Channel | null> {
    return Promise.resolve(this.channels.get(channelId) ?? null);
  }
  findByName(name: string): Promise<Channel | null> {
    return Promise.resolve([...this.channels.values()].find((c) => c.props.name === name) ?? null);
  }
  findPair(pairKey: string): Promise<Channel | null> {
    return Promise.resolve([...this.channels.values()].find((c) => c.pairKey === pairKey) ?? null);
  }
  findGroupWithMembers(memberIds: readonly string[]): Promise<Channel | null> {
    const key = [...memberIds].sort().join(':');
    return Promise.resolve(
      [...this.channels.values()].find((c) => c.props.kind === 'group' && [...c.memberIds].sort().join(':') === key) ??
        null,
    );
  }
  listForMember(personId: string, channelId?: string): Promise<ChannelOverview[]> {
    return Promise.resolve(
      [...this.channels.values()]
        .filter((channel) => channel.isMember(personId) && (!channelId || channel.props.channelId === channelId))
        .map((channel) => {
          const marker = channel.membershipOf(personId)?.readMarker;
          const unread = [...this.messages.messages.values()].filter(
            (m) =>
              m.props.channelId === channel.props.channelId &&
              m.inChannel &&
              m.props.authorId !== personId &&
              !m.isDeleted &&
              (!marker || m.props.postedAt > marker.postedAt),
          );
          const mentionCount = unread.filter((m) => m.props.mentions.includes(personId)).length;
          return { channel, unreadCount: unread.length, mentionCount, lastMessageAt: null };
        }),
    );
  }
  listPublic(): Promise<Channel[]> {
    return Promise.resolve([...this.channels.values()].filter((c) => c.props.kind === 'public'));
  }
  save(channel: Channel): Promise<Result<void, 'conflict'>> {
    channel.pullChanges();
    this.channels.set(channel.props.channelId, channel);
    outbox.push(...channel.pullEvents());
    return Promise.resolve(ok(undefined));
  }
  isSeeded(personId: string): Promise<boolean> {
    return Promise.resolve(this.seeded.has(personId));
  }
  markSeeded(personId: string): Promise<void> {
    this.seeded.add(personId);
    return Promise.resolve();
  }
}

class InMemoryThreads implements ThreadRepository {
  readonly threads = new Map<string, Thread>();

  constructor(private readonly messages: InMemoryMessages) {}

  find(channelId: string, rootMessageId: string): Promise<Thread> {
    return Promise.resolve(
      this.threads.get(rootMessageId) ?? Thread.restore({ rootMessageId, channelId, follows: [] }),
    );
  }
  listFollowed(personId: string): Promise<FollowedThread[]> {
    return Promise.resolve(
      [...this.threads.values()].flatMap((thread) => {
        const follow = thread.followOf(personId);
        if (!follow?.following) return [];
        const replies = [...this.messages.messages.values()].filter(
          (m) => m.props.threadRootId === thread.props.rootMessageId,
        );
        const marker = follow.readMarker;
        const unread = replies.filter(
          (m) => m.props.authorId !== personId && !m.isDeleted && (!marker || m.props.postedAt > marker.postedAt),
        );
        const lastReplyAt = new Date(Math.max(...replies.map((m) => m.props.postedAt.getTime())));
        return [{ ...thread.props, unreadCount: unread.length, lastReplyAt }];
      }),
    );
  }
  save(thread: Thread): Promise<void> {
    thread.pullChanges();
    this.threads.set(thread.props.rootMessageId, thread);
    outbox.push(...thread.pullEvents());
    return Promise.resolve();
  }
}

const people: PeopleDirectory = {
  existing: (ids) => Promise.resolve(new Set(ids.filter((id) => !id.startsWith('ghost')))),
};

function setup() {
  outbox.length = 0;
  const clock = new FixedClock(new Date('2026-11-01T10:00:00Z'));
  let counter = 0;
  const ids: IdGenerator = { next: () => `id-${String(++counter)}` };
  const messages = new InMemoryMessages();
  const channels = new InMemoryChannels(messages);
  const threads = new InMemoryThreads(messages);
  for (const channelId of [GENERAL_CHANNEL_ID, RANDOM_CHANNEL_ID]) {
    channels.channels.set(
      channelId,
      Channel.restore({
        channelId,
        kind: 'public',
        name: channelId,
        creatorId: null,
        memberships: [],
        archivedAt: null,
        createdAt: clock.now(),
      }),
    );
  }
  const tick = () => {
    clock.advanceBy(1000);
  };
  return {
    clock,
    tick,
    channels,
    messages,
    list: new ListMyChannels(channels, clock),
    create: new CreateChannel(channels, clock, ids),
    update: new UpdateChannel(channels, clock),
    add: new AddChannelMembers(channels, people, clock),
    leave: new LeaveChannel(channels),
    openDm: new OpenDirectMessage(channels, people, clock, ids),
    history: new ListMessages(channels, messages),
    post: new PostMessage(channels, messages, threads, clock, ids),
    edit: new EditMessage(channels, messages, threads, clock),
    remove: new DeleteMessage(channels, messages, clock),
    read: new MoveReadMarker(channels, messages),
    replies: new ListReplies(channels, messages),
    react: new ReactToMessage(channels, messages),
    threads: new ListThreads(channels, messages, threads),
    follow: new SetThreadFollowing(channels, messages, threads),
    readThread: new MoveThreadReadMarker(channels, messages, threads),
  };
}

describe('Messaging use cases', () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it('adds people to the seed channels on their first visit only', async () => {
    const names = async () => (await app.list.execute('anna')).map((o) => o.channel.props.name);
    expect(await names()).toEqual(['general', 'random']);

    unwrap(await app.leave.execute({ personId: 'anna', channelId: RANDOM_CHANNEL_ID }));
    expect(await names()).toEqual(['general']);
    expect(await app.leave.execute({ personId: 'anna', channelId: GENERAL_CHANNEL_ID })).toEqual({
      ok: false,
      error: 'cannot-leave-channel',
    });
  });

  it('refuses a name that is taken', async () => {
    unwrap(await app.create.execute({ personId: 'anna', kind: 'public', name: 'team' }));
    expect(await app.create.execute({ personId: 'ben', kind: 'private', name: '#Team' })).toEqual({
      ok: false,
      error: 'channel-name-taken',
    });
  });

  it('hides a private channel from everyone but its members', async () => {
    const secret = unwrap(await app.create.execute({ personId: 'anna', kind: 'private', name: 'secret' }));
    const channelId = secret.props.channelId;
    unwrap(await app.post.execute({ personId: 'anna', channelId, body: 'psst' }));

    expect(await app.history.execute({ personId: 'ben', channelId, limit: 50 })).toEqual({
      ok: false,
      error: 'not-found',
    });
    expect(await app.post.execute({ personId: 'ben', channelId, body: 'hi' })).toEqual({
      ok: false,
      error: 'not-found',
    });
    expect(await app.add.execute({ personId: 'ben', channelId, personIds: ['ben'] })).toEqual({
      ok: false,
      error: 'not-found',
    });

    unwrap(await app.add.execute({ personId: 'anna', channelId, personIds: ['ben'] }));
    const page = unwrap(await app.history.execute({ personId: 'ben', channelId, limit: 50 }));
    expect(page.messages.map((m) => m.props.body)).toEqual(['psst']);
  });

  it('tells the members about a new message and counts it as unread for others', async () => {
    const team = unwrap(await app.create.execute({ personId: 'anna', kind: 'public', name: 'team' }));
    const channelId = team.props.channelId;
    unwrap(await app.add.execute({ personId: 'ben', channelId, personIds: ['ben'] }));
    outbox.length = 0;

    const message = unwrap(await app.post.execute({ personId: 'anna', channelId, body: 'Moin' }));

    expect(outbox.find((event) => event.type === 'MessagePosted')).toMatchObject({
      message: { body: 'Moin' },
      recipients: ['anna', 'ben'],
    });
    const unreadOf = async (personId: string) =>
      (await app.list.execute(personId)).find((o) => o.channel.props.channelId === channelId)?.unreadCount;
    expect(await unreadOf('anna')).toBe(0);
    expect(await unreadOf('ben')).toBe(1);

    unwrap(await app.read.execute({ personId: 'ben', channelId, messageId: message.props.messageId }));
    expect(await unreadOf('ben')).toBe(0);
    expect(outbox).toContainEqual({
      type: 'ReadMarkerMoved',
      channelId,
      personId: 'ben',
      messageId: message.props.messageId,
    });
  });

  it('lets only the author edit or delete a message', async () => {
    const team = unwrap(await app.create.execute({ personId: 'anna', kind: 'public', name: 'team' }));
    const channelId = team.props.channelId;
    unwrap(await app.add.execute({ personId: 'ben', channelId, personIds: ['ben'] }));
    const { messageId } = unwrap(await app.post.execute({ personId: 'anna', channelId, body: 'Moin' })).props;

    expect(await app.edit.execute({ personId: 'ben', channelId, messageId, body: 'x' })).toEqual({
      ok: false,
      error: 'not-message-author',
    });
    expect(await app.remove.execute({ personId: 'ben', channelId, messageId })).toEqual({
      ok: false,
      error: 'not-message-author',
    });
    unwrap(await app.edit.execute({ personId: 'anna', channelId, messageId, body: 'Moin moin' }));
    unwrap(await app.remove.execute({ personId: 'anna', channelId, messageId }));
    expect(app.messages.messages.get(messageId)?.props.body).toBe('');
  });

  it('refuses a message id from another channel', async () => {
    const one = unwrap(await app.create.execute({ personId: 'anna', kind: 'public', name: 'one' }));
    const two = unwrap(await app.create.execute({ personId: 'anna', kind: 'public', name: 'two' }));
    const { messageId } = unwrap(
      await app.post.execute({ personId: 'anna', channelId: one.props.channelId, body: 'hi' }),
    ).props;

    expect(await app.edit.execute({ personId: 'anna', channelId: two.props.channelId, messageId, body: 'x' })).toEqual({
      ok: false,
      error: 'not-found',
    });
  });

  describe('direct messages', () => {
    it('finds the existing 1:1 DM from either side', async () => {
      const first = unwrap(await app.openDm.execute({ personId: 'anna', personIds: ['ben'] }));
      const second = unwrap(await app.openDm.execute({ personId: 'ben', personIds: ['anna'] }));
      expect(second.props.channelId).toBe(first.props.channelId);
      expect(first.props.kind).toBe('pair');
    });

    it('finds a group DM by its current members', async () => {
      const group = unwrap(await app.openDm.execute({ personId: 'anna', personIds: ['ben', 'carl'] }));
      unwrap(await app.add.execute({ personId: 'ben', channelId: group.props.channelId, personIds: ['dora'] }));

      const again = unwrap(await app.openDm.execute({ personId: 'carl', personIds: ['anna', 'ben', 'dora'] }));
      expect(again.props.channelId).toBe(group.props.channelId);
      const smaller = unwrap(await app.openDm.execute({ personId: 'carl', personIds: ['anna', 'ben'] }));
      expect(smaller.props.channelId).not.toBe(group.props.channelId);
    });

    it('refuses unknown people and more than eight', async () => {
      expect(await app.openDm.execute({ personId: 'anna', personIds: ['ghost-1'] })).toEqual({
        ok: false,
        error: 'unknown-person',
      });
      const many = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
      expect(await app.openDm.execute({ personId: 'anna', personIds: many })).toEqual({
        ok: false,
        error: 'direct-message-too-large',
      });
      expect(await app.openDm.execute({ personId: 'anna', personIds: ['anna'] })).toEqual({
        ok: false,
        error: 'invalid-request',
      });
    });
  });

  it('lets the creator archive a channel, which then takes no posts', async () => {
    const team = unwrap(await app.create.execute({ personId: 'anna', kind: 'public', name: 'team' }));
    const channelId = team.props.channelId;
    expect(await app.update.execute({ personId: 'ben', channelId, archived: true })).toEqual({
      ok: false,
      error: 'not-channel-creator',
    });
    unwrap(await app.update.execute({ personId: 'anna', channelId, archived: true }));
    expect(await app.post.execute({ personId: 'anna', channelId, body: 'hi' })).toEqual({
      ok: false,
      error: 'channel-archived',
    });
    unwrap(await app.update.execute({ personId: 'anna', channelId, archived: false, name: 'team-2' }));
    expect(app.channels.channels.get(channelId)?.props).toMatchObject({ name: 'team-2', archivedAt: null });
  });

  it('pages through the history', async () => {
    const team = unwrap(await app.create.execute({ personId: 'anna', kind: 'public', name: 'team' }));
    const channelId = team.props.channelId;
    for (const body of ['1', '2', '3']) {
      app.tick();
      unwrap(await app.post.execute({ personId: 'anna', channelId, body }));
    }
    const newest = unwrap(await app.history.execute({ personId: 'anna', channelId, limit: 2 }));
    expect(newest.messages.map((m) => m.props.body)).toEqual(['3', '2']);
    expect(newest.hasMore).toBe(true);

    const before = newest.messages[1]?.props.messageId;
    const older = unwrap(await app.history.execute({ personId: 'anna', channelId, before, limit: 2 }));
    expect(older.messages.map((m) => m.props.body)).toEqual(['1']);
    expect(older.hasMore).toBe(false);
  });

  describe('threads, mentions and reactions (M3b)', () => {
    const BEN = '0b0b0b0b-0000-4000-8000-000000000002';

    async function aTeam() {
      const team = unwrap(await app.create.execute({ personId: 'anna', kind: 'public', name: 'team' }));
      const channelId = team.props.channelId;
      unwrap(await app.add.execute({ personId: 'anna', channelId, personIds: [BEN, 'carl'] }));
      const root = unwrap(await app.post.execute({ personId: 'anna', channelId, body: 'Wer kommt mit?' }));
      app.tick();
      return { channelId, rootId: root.props.messageId };
    }

    it('keeps replies in their thread and out of the channel and its unread count', async () => {
      const { channelId, rootId } = await aTeam();
      const reply = unwrap(await app.post.execute({ personId: BEN, channelId, body: 'Ich!', threadRootId: rootId }));
      app.tick();
      // Answering a reply answers its root.
      unwrap(await app.post.execute({ personId: 'carl', channelId, body: '+1', threadRootId: reply.props.messageId }));

      const page = unwrap(await app.history.execute({ personId: 'anna', channelId, limit: 50 }));
      expect(page.messages.map((m) => m.props.body)).toEqual(['Wer kommt mit?']);
      expect(page.threads.get(rootId)).toMatchObject({ replyCount: 2, replierIds: ['carl', BEN] });
      const replies = unwrap(
        await app.replies.execute({ personId: 'anna', channelId, rootMessageId: rootId, limit: 50 }),
      );
      expect(replies.messages.map((m) => m.props.body)).toEqual(['+1', 'Ich!']);
      const [overview] = await app.channels.listForMember('anna', channelId);
      expect(overview?.unreadCount).toBe(0);
    });

    it('shows a reply also sent to the channel there, as unread', async () => {
      const { channelId, rootId } = await aTeam();
      unwrap(
        await app.post.execute({
          personId: BEN,
          channelId,
          body: 'Für alle',
          threadRootId: rootId,
          alsoInChannel: true,
        }),
      );
      const page = unwrap(await app.history.execute({ personId: 'anna', channelId, limit: 50 }));
      expect(page.messages.map((m) => m.props.body)).toEqual(['Für alle', 'Wer kommt mit?']);
      const [overview] = await app.channels.listForMember('anna', channelId);
      expect(overview?.unreadCount).toBe(1);
    });

    it('counts unread replies in followed threads until read, and not after unfollowing', async () => {
      const { channelId, rootId } = await aTeam();
      const reply = unwrap(await app.post.execute({ personId: BEN, channelId, body: 'Ich!', threadRootId: rootId }));
      expect(outbox.at(-1)).toMatchObject({ type: 'ThreadActivity', recipients: ['anna', BEN] });

      const [thread] = await app.threads.execute('anna');
      expect(thread).toMatchObject({ channelId, unreadCount: 1, summary: { replyCount: 1 } });
      expect(thread?.root.props.messageId).toBe(rootId);
      expect(await app.threads.execute('carl')).toEqual([]);

      unwrap(
        await app.readThread.execute({
          personId: 'anna',
          channelId,
          rootMessageId: rootId,
          messageId: reply.props.messageId,
        }),
      );
      expect((await app.threads.execute('anna'))[0]?.unreadCount).toBe(0);

      unwrap(await app.follow.execute({ personId: 'anna', channelId, rootMessageId: rootId, following: false }));
      app.tick();
      unwrap(await app.post.execute({ personId: BEN, channelId, body: 'Noch was', threadRootId: rootId }));
      expect(await app.threads.execute('anna')).toEqual([]);
    });

    it('counts mentions of members and lets mentioned members follow the thread', async () => {
      const { channelId, rootId } = await aTeam();
      unwrap(await app.post.execute({ personId: 'carl', channelId, body: `Hey <@${BEN}>` }));
      const [overview] = await app.channels.listForMember(BEN, channelId);
      expect(overview).toMatchObject({ unreadCount: 2, mentionCount: 1 });

      unwrap(await app.post.execute({ personId: 'carl', channelId, body: `<@${BEN}> hier`, threadRootId: rootId }));
      expect((await app.threads.execute(BEN)).map((t) => t.root.props.messageId)).toEqual([rootId]);
    });

    it('lets members react, and refuses anything but one emoji', async () => {
      const { channelId, rootId } = await aTeam();
      const react = (personId: string, emoji: string, add = true) =>
        app.react.execute({ personId, channelId, messageId: rootId, emoji, add });

      unwrap(await react(BEN, '👍'));
      const message = unwrap(await react('carl', '👍'));
      expect(message.props.reactions).toEqual([{ emoji: '👍', personIds: [BEN, 'carl'] }]);
      expect(outbox.at(-1)).toMatchObject({ type: 'ReactionChanged', emoji: '👍', added: true, inOffice: true });
      expect(await react('dora', '👍')).toEqual({ ok: false, error: 'not-channel-member' });
      expect(await react(BEN, 'nope')).toEqual({ ok: false, error: 'invalid-emoji' });
      expect((await react(BEN, '👍', false)).ok).toBe(true);
    });

    it('hides threads of private channels from non-members', async () => {
      const secret = unwrap(await app.create.execute({ personId: 'anna', kind: 'private', name: 'secret' }));
      const channelId = secret.props.channelId;
      const root = unwrap(await app.post.execute({ personId: 'anna', channelId, body: 'psst' }));
      const rootMessageId = root.props.messageId;

      expect(await app.replies.execute({ personId: BEN, channelId, rootMessageId, limit: 50 })).toEqual({
        ok: false,
        error: 'not-found',
      });
      expect(await app.follow.execute({ personId: BEN, channelId, rootMessageId, following: true })).toEqual({
        ok: false,
        error: 'not-found',
      });
      expect(
        await app.react.execute({ personId: BEN, channelId, messageId: rootMessageId, emoji: '👍', add: true }),
      ).toEqual({ ok: false, error: 'not-found' });
    });
  });
});
