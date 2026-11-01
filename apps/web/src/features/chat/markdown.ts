/**
 * The Markdown subset of messages (ADR-0033): bold, italic, inline code, code blocks, links and lists, plus
 * mentions written as `<@personId>` (ADR-0034).
 * It parses into plain data that the renderer turns into React elements, so raw HTML is never interpreted.
 */

export type Inline =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'bold'; readonly children: readonly Inline[] }
  | { readonly type: 'italic'; readonly children: readonly Inline[] }
  | { readonly type: 'code'; readonly text: string }
  | { readonly type: 'link'; readonly href: string; readonly children: readonly Inline[] }
  | { readonly type: 'mention'; readonly personId: string };

export type Block =
  | { readonly type: 'paragraph'; readonly lines: readonly (readonly Inline[])[] }
  | { readonly type: 'code'; readonly text: string }
  | { readonly type: 'list'; readonly ordered: boolean; readonly items: readonly (readonly Inline[])[] };

const FENCE = '```';
/** A mention in a stored body; the composer shows it as `@Name` (mentions.ts). */
export const MENTION_TOKEN = /<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>/i;
const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

/** Only these link targets are rendered as links; anything else stays text. */
export function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: Inline[][] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', lines: paragraph });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.startsWith(FENCE)) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith(FENCE)) code.push(lines[i++] ?? '');
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    const listMatch = BULLET.exec(line) ?? NUMBERED.exec(line);
    if (listMatch) {
      flush();
      const ordered = !BULLET.test(line);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const match = (ordered ? NUMBERED : BULLET).exec(lines[i] ?? '');
        if (!match) break;
        items.push(parseInline(match[1] ?? ''));
        i++;
      }
      i--;
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    if (line.trim() === '') flush();
    else paragraph.push(parseInline(line));
  }
  flush();
  return blocks;
}

/** Earliest match wins; on a tie the earlier rule in this list. */
const RULES: readonly { readonly pattern: RegExp; readonly build: (match: RegExpExecArray) => Inline | null }[] = [
  { pattern: /`([^`]+)`/, build: (m) => ({ type: 'code', text: m[1] ?? '' }) },
  { pattern: MENTION_TOKEN, build: (m) => ({ type: 'mention', personId: (m[1] ?? '').toLowerCase() }) },
  {
    pattern: /\[([^\]]+)\]\(([^)\s]+)\)/,
    build: (m) => {
      const href = safeHref(m[2] ?? '');
      return href ? { type: 'link', href, children: parseInline(m[1] ?? '') } : null;
    },
  },
  { pattern: /\*\*(?=\S)(.+?)\*\*/, build: (m) => ({ type: 'bold', children: parseInline(m[1] ?? '') }) },
  {
    pattern: /(?<![\w*])[*_](?=\S)(.+?)(?<=\S)[*_](?![\w*])/,
    build: (m) => ({ type: 'italic', children: parseInline(m[1] ?? '') }),
  },
  {
    pattern: /\bhttps?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/,
    build: (m) => {
      const href = safeHref(m[0]);
      return href ? { type: 'link', href, children: [{ type: 'text', text: m[0] }] } : null;
    },
  },
];

export function parseInline(text: string): Inline[] {
  const result: Inline[] = [];
  let rest = text;
  while (rest.length > 0) {
    let best: { readonly match: RegExpExecArray; readonly node: Inline } | null = null;
    for (const rule of RULES) {
      const match = rule.pattern.exec(rest);
      if (!match || (best && match.index >= best.match.index)) continue;
      const node = rule.build(match);
      if (node) best = { match, node };
    }
    if (!best) {
      pushText(result, rest);
      break;
    }
    if (best.match.index > 0) pushText(result, rest.slice(0, best.match.index));
    result.push(best.node);
    rest = rest.slice(best.match.index + best.match[0].length);
  }
  return result;
}

function pushText(result: Inline[], text: string): void {
  const last = result.at(-1);
  if (last?.type === 'text') result[result.length - 1] = { type: 'text', text: last.text + text };
  else result.push({ type: 'text', text });
}
