/** More words than this add nothing but cost. */
const MAX_TERMS = 16;

/**
 * The words to look for in what someone typed: lower-case letters and digits, in any script. Everything else only
 * separates words, so nobody can write search syntax (P-30), and a term is always safe to quote in a query.
 */
export function searchTerms(typed: string): string[] {
  return [...typed.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)].map((match) => match[0]).slice(0, MAX_TERMS);
}
