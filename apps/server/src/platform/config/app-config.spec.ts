import { describe, expect, it } from 'vitest';
import { loadAppConfig } from './app-config.ts';

describe('loadAppConfig', () => {
  it('applies defaults for an empty environment', () => {
    expect(loadAppConfig({})).toEqual({
      ok: true,
      value: { NODE_ENV: 'development', HOST: '0.0.0.0', PORT: 3000 },
    });
  });

  it('reports every invalid variable at once', () => {
    const result = loadAppConfig({ PORT: 'eighty', NODE_ENV: 'staging' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toHaveLength(2);
    }
  });
});
