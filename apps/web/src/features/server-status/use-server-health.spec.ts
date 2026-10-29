import { describe, expect, it } from 'vitest';
import { fetchServerHealth } from './use-server-health.ts';

const respondWith =
  (status: number, body: unknown): typeof fetch =>
  () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('fetchServerHealth', () => {
  it('returns a health response that matches the contract', async () => {
    const body = { status: 'ok', version: '1.2.3', uptimeSeconds: 42 };

    await expect(fetchServerHealth(respondWith(200, body))).resolves.toEqual(body);
  });

  it('rejects responses that violate the contract', async () => {
    await expect(fetchServerHealth(respondWith(200, { status: 'maybe' }))).rejects.toThrow();
  });

  it('rejects HTTP errors', async () => {
    await expect(fetchServerHealth(respondWith(503, {}))).rejects.toThrow(/503/);
  });
});
