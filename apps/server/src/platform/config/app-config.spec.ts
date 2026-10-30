import { describe, expect, it } from 'vitest';
import { loadAppConfig } from './app-config.ts';

const REQUIRED = {
  DATABASE_URL: 'postgres://teamtown:secret@localhost:5432/teamtown',
  OIDC_ISSUER: 'http://localhost:8080/realms/teamtown',
};

describe('loadAppConfig', () => {
  it('applies defaults when only the required variables are set', () => {
    expect(loadAppConfig(REQUIRED)).toEqual({
      ok: true,
      value: {
        ...REQUIRED,
        NODE_ENV: 'development',
        HOST: '0.0.0.0',
        PORT: 3000,
        DATABASE_MIGRATE_ON_START: true,
        OIDC_AUDIENCE: 'teamtown-api',
      },
    });
  });

  it('requires a database and an OIDC issuer', () => {
    const result = loadAppConfig({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.join()).toMatch(/DATABASE_URL.*OIDC_ISSUER/);
    }
  });

  it('reports every invalid variable at once', () => {
    const result = loadAppConfig({ ...REQUIRED, PORT: 'eighty', NODE_ENV: 'staging', DATABASE_URL: 'mysql://x' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toHaveLength(3);
    }
  });
});
