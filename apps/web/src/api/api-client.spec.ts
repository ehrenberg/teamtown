import { HealthResponse } from '@teamtown/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '../stores/session-store.ts';
import { ApiError, apiGet } from './api-client.ts';

const respondWith =
  (status: number, body: unknown, seen: Headers[] = []): typeof fetch =>
  (_, init) => {
    seen.push(new Headers(init?.headers));
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };

describe('apiGet', () => {
  afterEach(() => {
    useSessionStore.getState().setSession(null);
  });

  it('validates the response against the contract', async () => {
    const body = { status: 'ok', version: '1.2.3', uptimeSeconds: 42 };

    await expect(apiGet('/health', HealthResponse, respondWith(200, body))).resolves.toEqual(body);
    await expect(apiGet('/health', HealthResponse, respondWith(200, { status: 'maybe' }))).rejects.toThrow();
  });

  it('sends the access token of the current session', async () => {
    useSessionStore.getState().setSession({ accessToken: 'token-123', expiresAt: Date.now() + 60_000 });
    const seen: Headers[] = [];

    await apiGet('/health', HealthResponse, respondWith(200, { status: 'ok', version: '1', uptimeSeconds: 1 }, seen));

    expect(seen[0]?.get('authorization')).toBe('Bearer token-123');
  });

  it('reports HTTP errors with their status', async () => {
    await expect(apiGet('/health', HealthResponse, respondWith(401, {}))).rejects.toEqual(new ApiError(401));
  });
});
