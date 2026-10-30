import { describe, expect, it } from 'vitest';
import { ScreenShares } from './screen-shares.ts';

describe('ScreenShares', () => {
  it('shares in room calls and direct calls only', () => {
    const shares = new ScreenShares();

    expect(shares.start('anna', null)).toEqual({ ok: false, error: 'screen-share-not-here' });
    expect(shares.start('anna', 'conversation:c1')).toEqual({ ok: false, error: 'screen-share-not-here' });
    expect(shares.start('anna', 'room:ground:elbe')).toEqual({
      ok: true,
      value: { callKey: 'room:ground:elbe', sharer: 'anna', previous: null },
    });
    expect(shares.start('anna', 'room:ground:elbe')).toEqual({ ok: true, value: null });
  });

  it('lets a new sharer take over', () => {
    const shares = new ScreenShares();
    shares.start('anna', 'direct:x');

    expect(shares.start('ben', 'direct:x')).toEqual({
      ok: true,
      value: { callKey: 'direct:x', sharer: 'ben', previous: 'anna' },
    });
    expect(shares.sharerOf('direct:x')).toBe('ben');
    expect(shares.stop('anna')).toBeNull();
  });

  it('stops on request and when the sharer leaves the call', () => {
    const shares = new ScreenShares();
    shares.start('anna', 'room:ground:elbe');
    shares.start('ben', 'direct:x');

    expect(shares.stop('anna')).toEqual({ callKey: 'room:ground:elbe', sharer: null, previous: 'anna' });
    expect(shares.sync(() => null)).toEqual([{ callKey: 'direct:x', sharer: null, previous: 'ben' }]);
    expect(shares.sharerOf('direct:x')).toBeNull();
  });
});
