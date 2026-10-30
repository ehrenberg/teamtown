import { describe, expect, it, vi } from 'vitest';
import { NativeOidcClient, OidcRequestError } from './native-oidc-client.ts';

const ISSUER = 'http://localhost:8080/realms/teamtown';
const NOW = 1_800_000_000_000;

const discovery = {
  authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
  token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
  end_session_endpoint: `${ISSUER}/protocol/openid-connect/logout`,
};

const urlOf = (input: string | URL | Request): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function setup(tokenResponse: () => Response = () => json({ access_token: 'a', refresh_token: 'r', expires_in: 300 })) {
  const fetchFn = vi.fn<typeof fetch>((input) => {
    const url = urlOf(input);
    if (url.endsWith('/.well-known/openid-configuration')) return Promise.resolve(json(discovery));
    if (url === discovery.token_endpoint) return Promise.resolve(tokenResponse());
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  const client = new NativeOidcClient(
    { issuer: ISSUER, clientId: 'teamtown-desktop', redirectUri: 'teamtown://auth/callback', scope: 'openid' },
    fetchFn,
    () => NOW,
  );
  const formOf = (call: number) => new URLSearchParams(fetchFn.mock.calls[call]?.[1]?.body as string);
  return { client, fetchFn, formOf };
}

describe('NativeOidcClient', () => {
  it('builds the authorization URL with PKCE from the discovery document', async () => {
    const { client } = setup();
    const url = new URL(await client.authorizationUrl({ state: 'st', codeChallenge: 'ch' }));
    expect(url.origin + url.pathname).toBe(discovery.authorization_endpoint);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'teamtown-desktop',
      redirect_uri: 'teamtown://auth/callback',
      scope: 'openid',
      state: 'st',
      code_challenge: 'ch',
      code_challenge_method: 'S256',
    });
  });

  it('exchanges the code with the verifier and computes the expiry', async () => {
    const { client, formOf } = setup();
    await expect(client.exchangeCode('code-1', 'verifier-1')).resolves.toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: NOW + 300_000,
    });
    expect(Object.fromEntries(formOf(1))).toEqual({
      client_id: 'teamtown-desktop',
      grant_type: 'authorization_code',
      code: 'code-1',
      code_verifier: 'verifier-1',
      redirect_uri: 'teamtown://auth/callback',
    });
  });

  it('loads the discovery document only once', async () => {
    const { client, fetchFn } = setup();
    await client.refresh('r');
    await client.refresh('r');
    expect(fetchFn.mock.calls.filter(([input]) => urlOf(input).includes('well-known'))).toHaveLength(1);
  });

  it('reports rejected token requests with their status', async () => {
    const { client } = setup(() => json({ error: 'invalid_grant' }, 400));
    await expect(client.refresh('old')).rejects.toEqual(expect.objectContaining({ status: 400 }));
    await expect(client.refresh('old')).rejects.toBeInstanceOf(OidcRequestError);
  });

  it('rejects incomplete token responses', async () => {
    const { client } = setup(() => json({ access_token: 'a' }));
    await expect(client.refresh('r')).rejects.toThrow('Token response is incomplete');
  });

  it('ends the session at the identity provider with the refresh token', async () => {
    const { client, fetchFn, formOf } = setup();
    await client.endSession('r');
    expect(fetchFn.mock.calls[1]?.[0]).toBe(discovery.end_session_endpoint);
    expect(Object.fromEntries(formOf(1))).toEqual({ client_id: 'teamtown-desktop', refresh_token: 'r' });
  });

  it('retries discovery after a network failure', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(client.refresh('r')).rejects.toThrow('fetch failed');
    await expect(client.refresh('r')).resolves.toMatchObject({ accessToken: 'a' });
  });
});
