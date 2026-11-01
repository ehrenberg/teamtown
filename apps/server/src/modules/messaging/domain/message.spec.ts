import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { Message } from './message.ts';

const NOW = new Date('2026-11-01T10:00:00Z');
const LATER = new Date('2026-11-01T10:05:00Z');
const MEMBERS = ['anna', 'ben'];

const post = (body: string) =>
  Message.create({ messageId: 'm1', channelId: 'c1', authorId: 'anna', body, now: NOW }, MEMBERS);

describe('Message', () => {
  it('keeps indentation but drops blank lines around the text', () => {
    const message = unwrap(post('\n\n    const a = 1;\n  \n'));
    expect(message.props.body).toBe('    const a = 1;');
  });

  it('rejects empty and overlong bodies', () => {
    expect(post('  \n ')).toEqual({ ok: false, error: 'invalid-message' });
    expect(post('x'.repeat(4001))).toEqual({ ok: false, error: 'invalid-message' });
    expect(post('x'.repeat(4000)).ok).toBe(true);
  });

  it('tells the members that it was posted', () => {
    const message = unwrap(post('Hallo'));
    expect(message.pullEvents()).toMatchObject([
      { type: 'MessagePosted', message: { body: 'Hallo', deleted: false }, recipients: MEMBERS },
    ]);
    expect(message.pullEvents()).toEqual([]);
  });

  it('lets only the author edit it and marks it edited', () => {
    const message = unwrap(post('Hallo'));
    message.pullEvents();

    expect(message.edit('ben', 'Hi', LATER, MEMBERS)).toEqual({ ok: false, error: 'not-message-author' });
    expect(message.edit('anna', 'Hi', LATER, MEMBERS).ok).toBe(true);
    expect(message.props).toMatchObject({ body: 'Hi', editedAt: LATER });
    expect(message.pullEvents()).toMatchObject([
      { type: 'MessageEdited', message: { body: 'Hi' }, recipients: MEMBERS },
    ]);
  });

  it('lets only the author delete it and removes the body', () => {
    const message = unwrap(post('Geheim'));
    message.pullEvents();

    expect(message.delete('ben', LATER, MEMBERS)).toEqual({ ok: false, error: 'not-message-author' });
    expect(message.delete('anna', LATER, MEMBERS).ok).toBe(true);
    expect(message.props).toMatchObject({ body: '', deletedAt: LATER });
    expect(message.snapshot.deleted).toBe(true);
    expect(message.pullEvents()).toEqual([
      { type: 'MessageDeleted', channelId: 'c1', messageId: 'm1', recipients: MEMBERS },
    ]);
    expect(message.edit('anna', 'Wieder da', LATER, MEMBERS)).toEqual({ ok: false, error: 'invalid-message' });
  });
});
