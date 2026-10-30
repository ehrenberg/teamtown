import { describe, expect, it, vi } from 'vitest';
import { DesktopAuthSession, REFRESH_MARGIN_MS, RETRY_DELAY_MS, type DesktopSession } from './desktop-auth-session.ts';
import { OidcRequestError, type TokenSet } from './native-oidc-client.ts';
import type { SecretStore } from './secret-store.ts';

const NOW = 1_800_000_000_000;
const tokens = (n: number): TokenSet => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  expiresAt: NOW + 300_000,
});

function setup({ stored = null as string | null } = {}) {
  let secret = stored;
  const store: SecretStore = {
    load: () => Promise.resolve(secret),
    save: (value) => {
      secret = value;
      return Promise.resolve();
    },
    clear: () => {
      secret = null;
      return Promise.resolve();
    },
  };
  const scheduled: { callback: () => void; delayMs: number }[] = [];
  const oidc = {
    authorizationUrl: vi.fn(({ state }: { state: string }) => Promise.resolve(`https://idp/auth?state=${state}`)),
    exchangeCode: vi.fn(() => Promise.resolve(tokens(1))),
    refresh: vi.fn(() => Promise.resolve(tokens(2))),
    endSession: vi.fn(() => Promise.resolve()),
  };
  const openExternal = vi.fn((_url: string) => Promise.resolve());
  const changes: (DesktopSession | null)[] = [];
  const session = new DesktopAuthSession({
    oidc,
    store,
    openExternal,
    onSessionChanged: (value) => changes.push(value),
    now: () => NOW,
    timers: {
      set: (callback, delayMs) => scheduled.push({ callback, delayMs }),
      clear: () => undefined,
    },
  });
  const openedState = () => new URL(String(openExternal.mock.calls.at(-1)?.[0])).searchParams.get('state');
  const runNextTimer = async () => {
    scheduled.shift()?.callback();
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the async task settle
  };
  return { session, oidc, openExternal, changes, scheduled, openedState, runNextTimer, secret: () => secret };
}

describe('DesktopAuthSession', () => {
  it('opens the login in the system browser and completes it from the deep link', async () => {
    const { session, oidc, changes, openedState, secret } = setup();
    await session.signIn();
    const state = openedState();

    await expect(session.handleCallback(`teamtown://auth/callback?code=c1&state=${state}`)).resolves.toBe(true);

    expect(oidc.exchangeCode).toHaveBeenCalledWith('c1', expect.stringMatching(/^[\w-]{43}$/));
    expect(changes).toEqual([{ accessToken: 'access-1', expiresAt: NOW + 300_000 }]);
    await expect(session.getSession()).resolves.toEqual({ accessToken: 'access-1', expiresAt: NOW + 300_000 });
    expect(secret()).toBe('refresh-1');
  });

  it('never hands the refresh token to the web client', async () => {
    const { session, changes, openedState } = setup();
    await session.signIn();
    await session.handleCallback(`teamtown://auth/callback?code=c1&state=${openedState()}`);
    expect(JSON.stringify(changes)).not.toContain('refresh');
  });

  it('ignores callbacks it did not start and callbacks with a wrong state', async () => {
    const { session, oidc } = setup();
    await session.handleCallback('teamtown://auth/callback?code=c1&state=forged');
    await session.signIn();
    await session.handleCallback('teamtown://auth/callback?code=c1&state=forged');
    expect(oidc.exchangeCode).not.toHaveBeenCalled();
  });

  it('accepts a callback only once', async () => {
    const { session, oidc, openedState } = setup();
    await session.signIn();
    const link = `teamtown://auth/callback?code=c1&state=${openedState()}`;
    await session.handleCallback(link);
    await session.handleCallback(link);
    expect(oidc.exchangeCode).toHaveBeenCalledTimes(1);
  });

  it('returns false for deep links that are not auth callbacks', async () => {
    const { session } = setup();
    await expect(session.handleCallback('teamtown://invite/abc')).resolves.toBe(false);
  });

  it('restores the last login from the stored refresh token', async () => {
    const { session, oidc } = setup({ stored: 'refresh-0' });
    await expect(session.getSession()).resolves.toEqual({ accessToken: 'access-2', expiresAt: NOW + 300_000 });
    expect(oidc.refresh).toHaveBeenCalledWith('refresh-0');
  });

  it('forgets a stored refresh token the identity provider rejects', async () => {
    const { session, oidc, secret } = setup({ stored: 'refresh-0' });
    oidc.refresh.mockRejectedValueOnce(new OidcRequestError('invalid_grant', 400));
    await expect(session.getSession()).resolves.toBeNull();
    expect(secret()).toBeNull();
  });

  it('keeps the stored token and retries when offline at start', async () => {
    const { session, oidc, scheduled, runNextTimer, secret } = setup({ stored: 'refresh-0' });
    oidc.refresh.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(session.getSession()).resolves.toBeNull();
    expect(secret()).toBe('refresh-0');
    expect(scheduled[0]?.delayMs).toBe(RETRY_DELAY_MS);

    await runNextTimer();
    await expect(session.getSession()).resolves.toMatchObject({ accessToken: 'access-2' });
  });

  it('refreshes the access token shortly before it expires', async () => {
    const { session, changes, scheduled, openedState, runNextTimer } = setup();
    await session.signIn();
    await session.handleCallback(`teamtown://auth/callback?code=c1&state=${openedState()}`);
    expect(scheduled[0]?.delayMs).toBe(300_000 - REFRESH_MARGIN_MS);

    await runNextTimer();
    expect(changes.at(-1)).toEqual({ accessToken: 'access-2', expiresAt: NOW + 300_000 });
  });

  it('signs out when the refresh is rejected', async () => {
    const { session, oidc, changes, openedState, runNextTimer, secret } = setup();
    await session.signIn();
    await session.handleCallback(`teamtown://auth/callback?code=c1&state=${openedState()}`);
    oidc.refresh.mockRejectedValueOnce(new OidcRequestError('invalid_grant', 400));

    await runNextTimer();
    expect(changes.at(-1)).toBeNull();
    expect(secret()).toBeNull();
  });

  it('signs out locally and ends the session at the identity provider', async () => {
    const { session, oidc, changes, openedState, secret } = setup();
    await session.signIn();
    await session.handleCallback(`teamtown://auth/callback?code=c1&state=${openedState()}`);

    await session.signOut();
    expect(changes.at(-1)).toBeNull();
    expect(secret()).toBeNull();
    expect(oidc.endSession).toHaveBeenCalledWith('refresh-1');
    await expect(session.getSession()).resolves.toBeNull();
  });

  it('signs out locally even when the identity provider is unreachable', async () => {
    const { session, oidc, openedState } = setup();
    await session.signIn();
    await session.handleCallback(`teamtown://auth/callback?code=c1&state=${openedState()}`);
    oidc.endSession.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(session.signOut()).resolves.toBeUndefined();
    await expect(session.getSession()).resolves.toBeNull();
  });
});
