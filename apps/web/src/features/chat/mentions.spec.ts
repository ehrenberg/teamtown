import { describe, expect, it } from 'vitest';
import { insertMention, mentionedIds, mentionQueryAt, toDisplay, toTokens } from './mentions.ts';

const ANN = '0a0a0a0a-0000-4000-8000-000000000001';
const ANN_LEE = '0a0a0a0a-0000-4000-8000-000000000002';
const names = new Map([
  [ANN, 'Ann'],
  [ANN_LEE, 'Ann Lee'],
]);

describe('mentions', () => {
  it('shows tokens as names and turns them back, longest name first', () => {
    const body = `Hi <@${ANN_LEE}> and <@${ANN}>, and <@${'f'.repeat(8)}-0000-4000-8000-000000000000>`;
    const { text, picks } = toDisplay(body, (id) => names.get(id));
    expect(text).toBe(`Hi @Ann Lee and @Ann, and <@${'f'.repeat(8)}-0000-4000-8000-000000000000>`);
    expect(toTokens(text, picks)).toBe(body);
  });

  it('finds the mention being typed only after a space or at the start', () => {
    expect(mentionQueryAt('Hi @An', 6)).toEqual({ start: 3, query: 'An' });
    expect(mentionQueryAt('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionQueryAt('mail@an', 7)).toBeNull();
    expect(mentionQueryAt('@Ann Lee ', 9)).toBeNull();
  });

  it('inserts the picked name and moves the caret behind it', () => {
    expect(insertMention('Hi @An!', 6, 3, 'Ann Lee')).toEqual({ text: 'Hi @Ann Lee !', caret: 12 });
  });

  it('lists the mentioned people once', () => {
    expect(mentionedIds(`<@${ANN}> <@${ANN.toUpperCase()}>`)).toEqual([ANN]);
  });
});
