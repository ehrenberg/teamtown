import { describe, expect, it } from 'vitest';
import { voiceMix } from './voice-mix.ts';

describe('voiceMix', () => {
  it('plays a nearby speaker in front of the listener at full volume and centred', () => {
    expect(voiceMix({ x: 5, y: 5 }, { x: 6, y: 6 })).toEqual({ volume: 1, pan: 0 });
  });

  it('fades with distance and is silent from 6 tiles', () => {
    expect(voiceMix({ x: 0, y: 0 }, { x: 4, y: 0 }).volume).toBeCloseTo(0.5, 5);
    expect(voiceMix({ x: 0, y: 0 }, { x: 6, y: 0 }).volume).toBe(0);
  });

  it('pans a speaker to the side they appear on screen', () => {
    // Grid east appears to the right in the iso view, grid south to the left.
    expect(voiceMix({ x: 5, y: 5 }, { x: 8, y: 5 }).pan).toBeGreaterThan(0);
    expect(voiceMix({ x: 5, y: 5 }, { x: 5, y: 8 }).pan).toBeLessThan(0);
  });
});
