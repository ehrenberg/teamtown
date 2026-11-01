import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { Message } from './message.ts';
import { Thread } from './thread.ts';

const NOW = new Date('2026-11-01T10:00:00Z');
const LATER = new Date('2026-11-01T10:05:00Z');

const reply = (messageId: string, authorId: string, postedAt = NOW) =>
  unwrap(
    Message.create(
      { messageId, channelId: 'c1', authorId, body: 'Re', threadRootId: 'root', alsoInChannel: false, now: postedAt },
      [],
    ),
  );

const aThread = () => Thread.restore({ rootMessageId: 'root', channelId: 'c1', follows: [] });

describe('Thread', () => {
  it('makes the root author, the replier and mentioned members follow; the replier has read their reply', () => {
    const thread = aThread();
    thread.recordReply(reply('r1', 'ben'), 'anna', ['carl']);

    expect(thread.followerIds.sort()).toEqual(['anna', 'ben', 'carl']);
    expect(thread.followOf('ben')?.readMarker).toEqual({ messageId: 'r1', postedAt: NOW });
    expect(thread.followOf('anna')?.readMarker).toBeNull();
    expect(thread.pullEvents()).toEqual([
      { type: 'ThreadActivity', channelId: 'c1', rootMessageId: 'root', recipients: ['anna', 'ben', 'carl'] },
    ]);
    expect(thread.pullChanges()).toHaveLength(3);
  });

  it("doesn't follow again someone who stopped following", () => {
    const thread = aThread();
    thread.recordReply(reply('r1', 'ben'), 'anna', []);
    thread.unfollow('anna');
    thread.pullEvents();

    thread.recordReply(reply('r2', 'ben', LATER), 'anna', ['anna']);
    expect(thread.followerIds).toEqual(['ben']);
    expect(thread.pullEvents()).toMatchObject([{ recipients: ['ben'] }]);

    thread.follow('anna');
    expect(thread.followerIds.sort()).toEqual(['anna', 'ben']);
  });

  it('moves read markers forward only, and only for people with a follow', () => {
    const thread = aThread();
    thread.recordReply(reply('r1', 'ben'), 'anna', []);
    thread.pullEvents();
    thread.pullChanges();

    thread.markRead('anna', { messageId: 'r2', postedAt: LATER });
    thread.markRead('anna', { messageId: 'r1', postedAt: NOW });
    expect(thread.followOf('anna')?.readMarker).toEqual({ messageId: 'r2', postedAt: LATER });
    expect(thread.pullEvents()).toMatchObject([{ type: 'ThreadActivity', recipients: ['anna'] }]);

    thread.markRead('dora', { messageId: 'r2', postedAt: LATER });
    expect(thread.followOf('dora')).toBeNull();
    expect(thread.pullChanges().map((follow) => follow.personId)).toEqual(['anna']);
  });

  it('lets members mentioned in an edit follow', () => {
    const thread = aThread();
    thread.recordReply(reply('r1', 'ben'), 'anna', []);
    thread.pullEvents();

    thread.recordMentions(['carl', 'anna']);
    expect(thread.followerIds).toContain('carl');
    expect(thread.pullEvents()).toMatchObject([{ recipients: ['carl'] }]);
  });
});
