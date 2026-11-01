import type { MessageContract } from '@teamtown/contracts';
import { describe, expect, it } from 'vitest';
import { flatten, withDeleted, withPosted, withReplaced, type MessagePages } from './message-cache.ts';

const message = (messageId: string, body = messageId): MessageContract => ({
  messageId,
  channelId: 'c1',
  authorId: '00000000-0000-4000-8000-000000000001',
  body,
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
});
