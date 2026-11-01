/**
 * Mentions in the composer (ADR-0034): people see `@Display Name` while typing; the stored body carries `<@personId>`,
 * so a later name change shows everywhere.
 */

const TOKENS = /<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>/gi;
/** `@` at the start or after whitespace, followed by what is typed so far (no spaces). */
const QUERY = /(?:^|\s)@([^\s@]{0,30})$/;

export interface MentionPick {
  readonly personId: string;
  readonly displayName: string;
}

/** The people mentioned in a stored body. */
export function mentionedIds(body: string): string[] {
  return [...new Set([...body.matchAll(TOKENS)].map((match) => (match[1] ?? '').toLowerCase()))];
}

/** A stored body as the composer shows it, with the picks that turn it back into tokens. */
export function toDisplay(
  body: string,
  nameOf: (personId: string) => string | undefined,
): { readonly text: string; readonly picks: MentionPick[] } {
  const picks = new Map<string, MentionPick>();
  const text = body.replace(TOKENS, (token, id: string) => {
    const personId = id.toLowerCase();
    const displayName = nameOf(personId);
    if (!displayName) return token;
    picks.set(personId, { personId, displayName });
    return `@${displayName}`;
  });
  return { text, picks: [...picks.values()] };
}

/** Turns `@Display Name` of picked people back into tokens; longer names first, so "Ann Lee" wins over "Ann". */
export function toTokens(text: string, picks: readonly MentionPick[]): string {
  const sorted = [...picks].sort((a, b) => b.displayName.length - a.displayName.length);
  let result = text;
  for (const pick of sorted) result = result.split(`@${pick.displayName}`).join(`<@${pick.personId}>`);
  return result;
}

/** The mention being typed right before the caret: where its `@` is and what follows it. */
export function mentionQueryAt(text: string, caret: number): { readonly start: number; readonly query: string } | null {
  const match = QUERY.exec(text.slice(0, caret));
  if (!match) return null;
  const query = match[1] ?? '';
  return { start: caret - query.length - 1, query };
}

/** Replaces the typed `@query` with `@Display Name ` and returns the new text and caret. */
export function insertMention(
  text: string,
  caret: number,
  start: number,
  displayName: string,
): { readonly text: string; readonly caret: number } {
  const inserted = `@${displayName} `;
  return { text: text.slice(0, start) + inserted + text.slice(caret), caret: start + inserted.length };
}
