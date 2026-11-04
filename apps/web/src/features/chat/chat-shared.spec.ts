import { describe, expect, it } from 'vitest';
import { messageExcerpt } from './chat-shared.ts';

describe('messageExcerpt', () => {
  it('drops Markdown marks and mention tokens, and shortens long text', () => {
    expect(messageExcerpt('**Hi** <@abc>, see `this`')).toBe('Hi @…, see this');
    expect(messageExcerpt('x'.repeat(70))).toBe(`${'x'.repeat(60)}…`);
  });
});
