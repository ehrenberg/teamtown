import { describe, expect, it } from 'vitest';
import { findDeepLink, parseAuthCallback } from './deep-link.ts';

describe('findDeepLink', () => {
  it('finds the teamtown link among the arguments of a second instance', () => {
    const argv = ['C:\\TeamTown\\TeamTown.exe', '--allow-file-access', 'teamtown://auth/callback?code=c&state=s'];
    expect(findDeepLink(argv)).toBe('teamtown://auth/callback?code=c&state=s');
  });

  it('returns null without a deep link', () => {
    expect(findDeepLink(['electron', '.'])).toBeNull();
  });
});

describe('parseAuthCallback', () => {
  it('reads code and state', () => {
    expect(parseAuthCallback('teamtown://auth/callback?code=abc&state=xyz&session_state=1')).toEqual({
      kind: 'code',
      code: 'abc',
      state: 'xyz',
    });
  });

  it('accepts a trailing slash, as Windows sometimes adds one', () => {
    expect(parseAuthCallback('teamtown://auth/callback/?code=abc&state=xyz')).toMatchObject({ kind: 'code' });
  });

  it('reports errors from the identity provider', () => {
    expect(parseAuthCallback('teamtown://auth/callback?error=access_denied&state=xyz')).toEqual({
      kind: 'error',
      error: 'access_denied',
      state: 'xyz',
    });
  });

  it('treats a callback without code or state as invalid', () => {
    expect(parseAuthCallback('teamtown://auth/callback?code=abc')).toEqual({
      kind: 'error',
      error: 'invalid_callback',
      state: null,
    });
  });

  it('ignores other deep links and other schemes', () => {
    expect(parseAuthCallback('teamtown://invite/abc')).toBeNull();
    expect(parseAuthCallback('https://auth/callback?code=a&state=b')).toBeNull();
    expect(parseAuthCallback('not a url')).toBeNull();
  });
});
