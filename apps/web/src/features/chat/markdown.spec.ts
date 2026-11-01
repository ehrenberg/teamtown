import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, safeHref } from './markdown.ts';

describe('parseInline', () => {
  it('finds bold, italic and inline code', () => {
    expect(parseInline('a **b** _c_ `d*e*`')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', children: [{ type: 'text', text: 'b' }] },
      { type: 'text', text: ' ' },
      { type: 'italic', children: [{ type: 'text', text: 'c' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'd*e*' },
    ]);
  });

  it('keeps HTML as text', () => {
    expect(parseInline('<script>alert(1)</script>')).toEqual([{ type: 'text', text: '<script>alert(1)</script>' }]);
  });

  it('links only to http, https and mailto', () => {
    expect(parseInline('[Docs](https://example.org/a)')).toEqual([
      { type: 'link', href: 'https://example.org/a', children: [{ type: 'text', text: 'Docs' }] },
    ]);
    expect(parseInline('[x](javascript:alert(1))')).toEqual([{ type: 'text', text: '[x](javascript:alert(1))' }]);
  });

  it('links bare URLs without trailing punctuation', () => {
    expect(parseInline('See https://example.org/x.')).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', href: 'https://example.org/x', children: [{ type: 'text', text: 'https://example.org/x' }] },
      { type: 'text', text: '.' },
    ]);
  });

  it('leaves snake_case and lone stars alone', () => {
    expect(parseInline('my_var_name and 2 * 3 * 4')).toEqual([{ type: 'text', text: 'my_var_name and 2 * 3 * 4' }]);
  });
});

describe('parseMarkdown', () => {
  it('splits paragraphs, lists and code blocks', () => {
    expect(parseMarkdown('Hi\nthere\n\n- one\n- **two**\n1. first\n```\n<b>raw</b>\n  indented\n```')).toEqual([
      { type: 'paragraph', lines: [[{ type: 'text', text: 'Hi' }], [{ type: 'text', text: 'there' }]] },
      {
        type: 'list',
        ordered: false,
        items: [[{ type: 'text', text: 'one' }], [{ type: 'bold', children: [{ type: 'text', text: 'two' }] }]],
      },
      { type: 'list', ordered: true, items: [[{ type: 'text', text: 'first' }]] },
      { type: 'code', text: '<b>raw</b>\n  indented' },
    ]);
  });

  it('runs an unclosed code block to the end', () => {
    expect(parseMarkdown('```\ncode')).toEqual([{ type: 'code', text: 'code' }]);
  });
});

describe('safeHref', () => {
  it('rejects anything but web and mail links', () => {
    expect(safeHref('mailto:a@b.de')).toBe('mailto:a@b.de');
    expect(safeHref('data:text/html,hi')).toBeNull();
    expect(safeHref('not a url')).toBeNull();
  });
});
