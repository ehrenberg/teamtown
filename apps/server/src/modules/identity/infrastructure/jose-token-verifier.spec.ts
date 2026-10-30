import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JoseTokenVerifier } from './jose-token-verifier.ts';

/** A tiny local OIDC issuer: discovery document + JWKS, so the verifier is tested against real HTTP. */
describe('JoseTokenVerifier', () => {
  let server: Server;
  let issuer: string;
  let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
  let publicJwk: JWK;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256' };
    server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      if (request.url?.endsWith('/.well-known/openid-configuration')) {
        response.end(JSON.stringify({ jwks_uri: `${issuer}/certs` }));
      } else {
        response.end(JSON.stringify({ keys: [publicJwk] }));
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}/realms/test`;
  });

  afterAll(() => {
    server.close();
  });

  const token = (claims: Record<string, unknown>, options: { audience?: string; expiresIn?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience(options.audience ?? 'teamtown-api')
      .setSubject('subject-123')
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '5m')
      .sign(privateKey);

  it('accepts a valid token and maps the claims', async () => {
    const result = await new JoseTokenVerifier(issuer, 'teamtown-api').verify(
      await token({ name: 'Lena Hoffmann', email: 'lena@example.org' }),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { subject: 'subject-123', displayName: 'Lena Hoffmann', email: 'lena@example.org' },
    });
  });

  it('falls back to the username when no name claim exists', async () => {
    const result = await new JoseTokenVerifier(issuer, 'teamtown-api').verify(
      await token({ preferred_username: 'lena' }),
    );

    expect(result).toMatchObject({ ok: true, value: { displayName: 'lena', email: null } });
  });

  it('rejects tokens for another audience', async () => {
    const result = await new JoseTokenVerifier(issuer, 'teamtown-api').verify(
      await token({}, { audience: 'other-app' }),
    );

    expect(result).toEqual({ ok: false, error: 'invalid-token' });
  });

  it('rejects expired and malformed tokens', async () => {
    const verifier = new JoseTokenVerifier(issuer, 'teamtown-api');

    expect(await verifier.verify(await token({}, { expiresIn: '-1m' }))).toEqual({ ok: false, error: 'invalid-token' });
    expect(await verifier.verify('not-a-jwt')).toEqual({ ok: false, error: 'invalid-token' });
  });
});
