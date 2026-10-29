import { describe, expect, it } from 'vitest';
import { getPlatformBridge } from './platform-bridge.ts';

describe('getPlatformBridge', () => {
  it('falls back to the web implementation in a browser', () => {
    expect(getPlatformBridge({}).kind).toBe('web');
  });

  it('uses the bridge injected by the desktop preload', () => {
    const desktop = { kind: 'desktop', appVersion: '1.0.0' } as const;

    expect(getPlatformBridge({ teamtown: desktop })).toBe(desktop);
  });
});
