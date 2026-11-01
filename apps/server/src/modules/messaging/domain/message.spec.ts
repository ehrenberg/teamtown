import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { Message } from './message.ts';

const NOW = new Date('2026-11-01T10:00:00Z');
const LATER = new Date('2026-11-01T10:05:00Z');
const MEMBERS = ['anna', 'ben'];

const BEN = '0b0b0b0b-0000-4000-8000-000000000002';
const CARL = '0c0c0c0c-0000-4000-8000-000000000003';

const post = (body: string) =>
  Message.create(
    { messageId: 'm1', channelId: 'c1', authorId: 'anna', body, threadRootId: null, alsoInChannel: false, now: NOW },
    MEMBERS,
  );

const react = (message: Message, personId: string, emoji: string, add = true) =>
  message.react({ personId, emoji, add, inOffice: true, recipients: MEMBERS });

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

  it('knows the people mentioned by ID, also after an edit', () => {
    const message = unwrap(post(`Hi <@${BEN}> and <@${BEN.toUpperCase()}>, see <@not-an-id>`));
    expect(message.props.mentions).toEqual([BEN]);

    message.edit('anna', `Only <@${CARL}> now`, LATER, MEMBERS);
    expect(message.props.mentions).toEqual([CARL]);
    expect(message.snapshot.mentions).toEqual([CARL]);
  });

  it('only shows a reply in the channel when it was also sent there', () => {
    const reply = unwrap(
      Message.create(
        {
          messageId: 'm2',
          channelId: 'c1',
          authorId: 'anna',
          body: 'Re',
          threadRootId: 'm1',
          alsoInChannel: false,
          now: NOW,
        },
        MEMBERS,
      ),
    );
    expect(reply.inChannel).toBe(false);
    expect(reply.threadId).toBe('m1');
    expect(unwrap(post('Root')).threadId).toBe('m1');
  });

  it('adds one reaction per person and emoji, and removes it again', () => {
    const message = unwrap(post('Hallo'));
    message.pullEvents();

    expect(react(message, 'anna', '👍').ok).toBe(true);
    expect(react(message, 'anna', '👍').ok).toBe(true);
    expect(react(message, 'ben', '👍').ok).toBe(true);
    expect(react(message, 'ben', '🎉').ok).toBe(true);
    expect(message.props.reactions).toEqual([
      { emoji: '👍', personIds: ['anna', 'ben'] },
      { emoji: '🎉', personIds: ['ben'] },
    ]);
    expect(message.pullEvents()).toHaveLength(3);

    react(message, 'ben', '🎉', false);
    expect(message.props.reactions).toEqual([{ emoji: '👍', personIds: ['anna', 'ben'] }]);
    expect(message.pullEvents()).toMatchObject([
      { type: 'ReactionChanged', personId: 'ben', emoji: '🎉', added: false, inOffice: false },
    ]);
    expect(message.pullReactionChanges()).toEqual([
      { emoji: '👍', personId: 'anna', added: true },
      { emoji: '👍', personId: 'ben', added: true },
      { emoji: '🎉', personId: 'ben', added: true },
      { emoji: '🎉', personId: 'ben', added: false },
    ]);
  });

  it('takes single emoji only, including skin tones and sequences', () => {
    const message = unwrap(post('Hallo'));
    expect(react(message, 'anna', '👍🏽').ok).toBe(true);
    expect(react(message, 'anna', '👩‍💻').ok).toBe(true);
    expect(react(message, 'anna', 'a')).toEqual({ ok: false, error: 'invalid-emoji' });
    expect(react(message, 'anna', '👍👍')).toEqual({ ok: false, error: 'invalid-emoji' });
  });

  it('takes at most 20 different emoji', () => {
    const message = unwrap(post('Hallo'));
    const emoji = '😀 😁 😂 🤣 😃 😄 😅 😆 😉 😊 😋 😎 😍 😘 🥰 😗 😙 🥲 😚 🙂'.split(' ');
    for (const e of emoji) expect(react(message, 'anna', e).ok).toBe(true);
    expect(react(message, 'anna', '🤗')).toEqual({ ok: false, error: 'too-many-reactions' });
    expect(react(message, 'ben', '🙂').ok).toBe(true);
  });

  it('drops mentions and reactions when deleted', () => {
    const message = unwrap(post(`<@${BEN}> look`));
    react(message, 'ben', '👀');
    message.pullReactionChanges();
    message.delete('anna', LATER, MEMBERS);

    expect(message.props).toMatchObject({ mentions: [], reactions: [] });
    expect(message.pullReactionChanges()).toEqual([{ emoji: '👀', personId: 'ben', added: false }]);
    expect(react(message, 'ben', '👍')).toEqual({ ok: false, error: 'invalid-message' });
  });
});
