import { describe, expect, it } from 'vitest';
import { searchTerms } from './search-terms.ts';

describe('searchTerms', () => {
  it('lower-cases words and keeps umlauts and digits', () => {
    expect(searchTerms('Grüße Q3-Plan')).toEqual(['grüße', 'q3', 'plan']);
  });

  it('has no syntax: operators and quotes only separate words', () => {
    expect(searchTerms(`'a':* & !b | "c d" <-> (e)`)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('finds nothing to look for in punctuation', () => {
    expect(searchTerms(' -- !! ')).toEqual([]);
  });

  it('caps the number of words', () => {
    expect(searchTerms(Array.from({ length: 40 }, (_, index) => `w${String(index)}`).join(' '))).toHaveLength(16);
  });
});
