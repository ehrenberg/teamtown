import { describe, expect, it } from 'vitest';
import { challengeFor, createPkcePair, createState } from './pkce.ts';

describe('PKCE', () => {
  it('derives the S256 challenge as in RFC 7636 appendix B', () => {
    expect(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('creates a fresh, URL-safe verifier of valid length every time', () => {
    const first = createPkcePair();
    const second = createPkcePair();
    expect(first.verifier).not.toBe(second.verifier);
    expect(first.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(first.challenge).toBe(challengeFor(first.verifier));
  });

  it('creates unpredictable state values', () => {
    expect(createState()).not.toBe(createState());
  });
});
