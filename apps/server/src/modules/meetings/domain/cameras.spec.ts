import { describe, expect, it } from 'vitest';
import { Cameras } from './cameras.ts';

describe('Cameras', () => {
  it('switches on only inside a call', () => {
    const cameras = new Cameras();

    expect(cameras.set('anna', true, null)).toEqual({ ok: false, error: 'not-in-call' });
    expect(cameras.set('anna', true, 'conversation:c1')).toEqual({
      ok: true,
      value: { type: 'CameraChanged', personId: 'anna', on: true },
    });
    expect(cameras.set('anna', true, 'conversation:c1')).toEqual({ ok: true, value: null });
    expect(cameras.isOn('anna')).toBe(true);
  });

  it('switches off on request, also outside a call', () => {
    const cameras = new Cameras();
    cameras.set('anna', true, 'direct:x');

    expect(cameras.set('anna', false, null)).toEqual({
      ok: true,
      value: { type: 'CameraChanged', personId: 'anna', on: false },
    });
    expect(cameras.set('anna', false, null)).toEqual({ ok: true, value: null });
  });

  it('goes off when the call changes or ends', () => {
    const cameras = new Cameras();
    cameras.set('anna', true, 'conversation:c1');
    cameras.set('ben', true, 'room:ground:elbe');
    cameras.set('carl', true, 'direct:x');
    const calls: Record<string, string | null> = { anna: 'conversation:c2', ben: null, carl: 'direct:x' };

    expect(cameras.sync((personId) => calls[personId] ?? null)).toEqual([
      { type: 'CameraChanged', personId: 'anna', on: false },
      { type: 'CameraChanged', personId: 'ben', on: false },
    ]);
    expect(cameras.isOn('carl')).toBe(true);
  });
});
