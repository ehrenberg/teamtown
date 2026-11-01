import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { Channel, GENERAL_CHANNEL_ID } from './channel.ts';

const NOW = new Date('2026-11-01T10:00:00Z');
const LATER = new Date('2026-11-01T11:00:00Z');

const aChannel = (kind: 'public' | 'private' = 'public') =>
  unwrap(Channel.create({ channelId: 'c1', kind, name: '#Team Nord', creatorId: 'anna', now: NOW }));

const aDirect = (memberIds: string[]) => unwrap(Channel.openDirect({ channelId: 'd1', memberIds, now: NOW }));

describe('Channel', () => {
  it('starts with its creator as the only member and a normalised name', () => {
    const channel = aChannel();
    expect(channel.props).toMatchObject({ name: 'team-nord', creatorId: 'anna', archivedAt: null });
    expect(channel.memberIds).toEqual(['anna']);
    expect(channel.pullEvents()).toEqual([{ type: 'ChannelChanged', channelId: 'c1', recipients: ['anna'] }]);
    expect(channel.pullChanges()).toMatchObject({ channel: true, removed: [] });
  });

  it('is readable by everyone when public, only by members when private', () => {
    expect(aChannel('public').canRead('ben')).toBe(true);
    expect(aChannel('private').canRead('ben')).toBe(false);
    expect(aChannel('private').canRead('anna')).toBe(true);
  });

  it('lets people join public channels themselves, but not private ones', () => {
    const open = aChannel('public');
    expect(open.join('ben', LATER).ok).toBe(true);
    expect(open.memberIds).toEqual(['anna', 'ben']);

    expect(aChannel('private').join('ben', LATER)).toEqual({ ok: false, error: 'cannot-invite' });
  });

  it('lets only the creator invite into a private channel', () => {
    const channel = aChannel('private');
    expect(channel.invite('ben', ['carl'], LATER)).toEqual({ ok: false, error: 'not-channel-creator' });
    expect(channel.invite('anna', ['ben', 'carl', 'ben'], LATER).ok).toBe(true);
    expect(channel.memberIds).toEqual(['anna', 'ben', 'carl']);
  });

  it('lets members add people to a public channel (ADR-0034)', () => {
    const channel = aChannel('public');
    expect(channel.invite('ben', ['carl'], LATER)).toEqual({ ok: false, error: 'not-channel-member' });
    expect(channel.invite('anna', ['carl'], LATER).ok).toBe(true);
    expect(channel.memberIds).toEqual(['anna', 'carl']);
  });

  it('takes replies to its own root messages only, one level deep', () => {
    const channel = aChannel();
    const root = unwrap(channel.post({ messageId: 'm1', authorId: 'anna', body: 'Root', now: LATER }));
    const reply = unwrap(
      channel.post({
        messageId: 'm2',
        authorId: 'anna',
        body: 'Reply',
        threadRoot: root,
        alsoInChannel: true,
        now: LATER,
      }),
    );
    expect(reply.props).toMatchObject({ threadRootId: 'm1', alsoInChannel: true });
    expect(reply.inChannel).toBe(true);

    expect(channel.post({ messageId: 'm3', authorId: 'anna', body: 'x', threadRoot: reply, now: LATER })).toEqual({
      ok: false,
      error: 'invalid-thread-root',
    });
    const elsewhere = Channel.restore({ ...channel.props, channelId: 'c2' });
    expect(elsewhere.post({ messageId: 'm4', authorId: 'anna', body: 'x', threadRoot: root, now: LATER })).toEqual({
      ok: false,
      error: 'invalid-thread-root',
    });
  });

  it('lets members react and shows reactions in the office for public channels only', () => {
    const open = aChannel('public');
    const message = unwrap(open.post({ messageId: 'm1', authorId: 'anna', body: 'Hi', now: LATER }));
    message.pullEvents();
    expect(open.react(message, { personId: 'ben', emoji: '👍', add: true })).toEqual({
      ok: false,
      error: 'not-channel-member',
    });
    expect(open.react(message, { personId: 'anna', emoji: '👍', add: true }).ok).toBe(true);
    expect(message.pullEvents()).toMatchObject([{ type: 'ReactionChanged', inOffice: true }]);

    const closed = aChannel('private');
    const secret = unwrap(closed.post({ messageId: 'm2', authorId: 'anna', body: 'Hi', now: LATER }));
    secret.pullEvents();
    closed.react(secret, { personId: 'anna', emoji: '👍', add: true });
    expect(secret.pullEvents()).toMatchObject([{ type: 'ReactionChanged', inOffice: false }]);
  });

  it('lets only the creator rename and archive it', () => {
    const channel = aChannel();
    expect(channel.rename('ben', 'other')).toEqual({ ok: false, error: 'not-channel-creator' });
    expect(channel.rename('anna', 'bad name!')).toEqual({ ok: false, error: 'invalid-channel-name' });
    expect(channel.rename('anna', 'Team Sud').ok).toBe(true);
    expect(channel.props.name).toBe('team-sud');

    expect(channel.setArchived('ben', true, LATER)).toEqual({ ok: false, error: 'not-channel-creator' });
    expect(channel.setArchived('anna', true, LATER).ok).toBe(true);
    expect(channel.isArchived).toBe(true);
  });

  it('takes no new messages, members or names once archived, and can be unarchived', () => {
    const channel = aChannel();
    channel.setArchived('anna', true, LATER);

    expect(channel.post({ messageId: 'm1', authorId: 'anna', body: 'Hi', now: LATER })).toEqual({
      ok: false,
      error: 'channel-archived',
    });
    expect(channel.join('ben', LATER)).toEqual({ ok: false, error: 'channel-archived' });
    expect(channel.rename('anna', 'new')).toEqual({ ok: false, error: 'channel-archived' });

    channel.setArchived('anna', false, LATER);
    expect(channel.post({ messageId: 'm1', authorId: 'anna', body: 'Hi', now: LATER }).ok).toBe(true);
  });

  it('lets only members post', () => {
    const channel = aChannel();
    expect(channel.post({ messageId: 'm1', authorId: 'ben', body: 'Hi', now: LATER })).toEqual({
      ok: false,
      error: 'not-channel-member',
    });
    const message = unwrap(channel.post({ messageId: 'm1', authorId: 'anna', body: 'Hi', now: LATER }));
    expect(message.props).toMatchObject({ channelId: 'c1', authorId: 'anna', postedAt: LATER });
  });

  it('never lets anyone leave #general', () => {
    const general = Channel.restore({ ...aChannel().props, channelId: GENERAL_CHANNEL_ID, creatorId: null });
    expect(general.leave('anna')).toEqual({ ok: false, error: 'cannot-leave-channel' });
  });

  it('tells the person who left and the remaining members', () => {
    const channel = aChannel();
    channel.join('ben', LATER);
    channel.pullEvents();
    channel.pullChanges();

    expect(channel.leave('ben').ok).toBe(true);
    expect(channel.memberIds).toEqual(['anna']);
    expect(channel.pullEvents()).toEqual([
      { type: 'ChannelLeft', channelId: 'c1', personId: 'ben' },
      { type: 'ChannelChanged', channelId: 'c1', recipients: ['anna'] },
    ]);
    expect(channel.pullChanges()).toEqual({ channel: false, upserted: [], removed: ['ben'] });
  });

  describe('read marker', () => {
    it('only moves forward', () => {
      const channel = aChannel();
      channel.pullEvents();
      channel.markRead('anna', { messageId: 'm2', postedAt: LATER });
      channel.markRead('anna', { messageId: 'm1', postedAt: NOW });

      expect(channel.membershipOf('anna')?.readMarker).toEqual({ messageId: 'm2', postedAt: LATER });
      expect(channel.pullEvents()).toEqual([
        { type: 'ReadMarkerMoved', channelId: 'c1', personId: 'anna', messageId: 'm2' },
      ]);
    });

    it('writes only the reader’s membership', () => {
      const channel = aChannel();
      channel.join('ben', NOW);
      channel.pullChanges();

      channel.markRead('ben', { messageId: 'm1', postedAt: LATER });
      expect(channel.pullChanges()).toEqual({
        channel: false,
        upserted: [{ personId: 'ben', joinedAt: NOW, readMarker: { messageId: 'm1', postedAt: LATER } }],
        removed: [],
      });
    });
  });

  describe('direct messages', () => {
    it('is a pair for two people and a group for up to eight', () => {
      expect(aDirect(['anna', 'ben']).props.kind).toBe('pair');
      expect(aDirect(['anna', 'ben', 'carl']).props.kind).toBe('group');
      expect(Channel.openDirect({ channelId: 'd', memberIds: ['anna', 'anna'], now: NOW })).toEqual({
        ok: false,
        error: 'invalid-request',
      });
      const nine = Array.from({ length: 9 }, (_, i) => `p${i}`);
      expect(Channel.openDirect({ channelId: 'd', memberIds: nine, now: NOW })).toEqual({
        ok: false,
        error: 'direct-message-too-large',
      });
    });

    it('is a pair that stays between its two people', () => {
      const pair = aDirect(['ben', 'anna']);
      expect(pair.pairKey).toBe('anna:ben');
      expect(pair.leave('anna')).toEqual({ ok: false, error: 'cannot-leave-channel' });
      expect(pair.invite('anna', ['carl'], LATER)).toEqual({ ok: false, error: 'cannot-invite' });
      expect(pair.rename('anna', 'x')).toEqual({ ok: false, error: 'not-channel-creator' });
    });

    it('lets members of a group add people up to eight and leave', () => {
      const group = aDirect(['anna', 'ben', 'carl']);
      expect(group.invite('dora', ['emil'], LATER)).toEqual({ ok: false, error: 'not-channel-member' });
      expect(group.invite('ben', ['dora', 'emil', 'finn', 'gina', 'hans'], LATER).ok).toBe(true);
      expect(group.memberIds).toHaveLength(8);
      expect(group.invite('anna', ['ida'], LATER)).toEqual({ ok: false, error: 'direct-message-too-large' });

      expect(group.leave('carl').ok).toBe(true);
      expect(group.canRead('carl')).toBe(false);
    });
  });
});
