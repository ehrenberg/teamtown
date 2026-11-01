import { describe, expect, it } from 'vitest';
import { channelName } from './channel-name.ts';

describe('channelName', () => {
  it('normalises what people type', () => {
    expect(channelName('  #Team Nord ')).toEqual({ ok: true, value: 'team-nord' });
    expect(channelName('release_2026')).toEqual({ ok: true, value: 'release_2026' });
  });

  it('rejects empty, overlong and foreign characters', () => {
    expect(channelName(' # ')).toEqual({ ok: false, error: 'invalid-channel-name' });
    expect(channelName('x'.repeat(41))).toEqual({ ok: false, error: 'invalid-channel-name' });
    expect(channelName('käse')).toEqual({ ok: false, error: 'invalid-channel-name' });
    expect(channelName('a.b')).toEqual({ ok: false, error: 'invalid-channel-name' });
  });
});
