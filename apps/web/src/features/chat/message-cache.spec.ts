import type { MessageContract } from '@teamtown/contracts';
import { describe, expect, it } from 'vitest';
import {
  flatten,
  withDeleted,
  withPosted,
  withReaction,
  withReplaced,
  withReply,
  type MessagePages,
} from './message-cache.ts';

const message = (messageId: string, body = messageId): MessageContract => ({
  messageId,
  channelId: 'c1',
  authorId: '00000000-0000-4000-8000-000000000001',
  body,
  threadRootId: null,
  alsoInChannel: false,
  mentions: [],
  reactions: [],
  thread: null,
  postedAt: '2026-11-01T10:00:00.000Z',
  editedAt: null,
  deleted: false,
});

const pages: MessagePages = {
  pages: [
    { messages: [message('m3'), message('m4')], hasMore: true },
    { messages: [message('m1'), message('m2')], hasMore: false },
  ],
  pageParams: ['', 'm3'],
};

const onePage = (messages: MessageContract[]): MessagePages => ({
  pages: [{ messages, hasMore: false }],
  pageParams: [''],
});

describe('message cache', () => {
  it('lists the loaded messages oldest first', () => {
    expect(flatten(pages).map((m) => m.messageId)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('appends a pushed message once', () => {
    const once = withPosted(pages, message('m5'));
    expect(flatten(withPosted(once, message('m5'))).map((m) => m.messageId)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
  });

  it('replaces edited and deleted messages in older pages too', () => {
    const edited = withReplaced(pages, { ...message('m1', 'new'), editedAt: '2026-11-01T11:00:00.000Z' });
    expect(flatten(edited)[0]?.body).toBe('new');
    expect(flatten(withDeleted(pages, 'm2'))[1]).toMatchObject({ body: '', deleted: true });
  });

  it('leaves channels that are not loaded alone', () => {
    expect(withPosted(undefined, message('m1'))).toBeUndefined();
  });

  it('applies reaction changes once per person and emoji', () => {
    const anna = '00000000-0000-4000-8000-00000000000a';
    let data: MessagePages | undefined = onePage([message('a')]);
    const change = { messageId: 'a', personId: anna, emoji: '👍', added: true };
    data = withReaction(withReaction(data, change), change);
    expect(flatten(data)[0]?.reactions).toEqual([{ emoji: '👍', personIds: [anna] }]);
    data = withReaction(data, { ...change, added: false });
    expect(flatten(data)[0]?.reactions).toEqual([]);
  });

  it('counts a reply on its root and keeps the summary when the root is edited', () => {
    const ben = '00000000-0000-4000-8000-00000000000b';
    const reply = { ...message('r', 'Re'), threadRootId: 'a', authorId: ben, postedAt: '2026-11-01T11:00:00.000Z' };
    let data = withReply(onePage([message('a')]), reply);
    expect(flatten(data)[0]?.thread).toEqual({ replyCount: 1, lastReplyAt: reply.postedAt, replierIds: [ben] });
    data = withReplaced(data, { ...message('a', 'edited'), thread: null });
    expect(flatten(data)[0]).toMatchObject({ body: 'edited', thread: { replyCount: 1 } });
  });
});
