import { describe, expect, it } from 'vitest';
import { isoScreenOffsetX } from './iso.ts';

describe('isoScreenOffsetX', () => {
  it('puts grid east (+x) to the right and grid south (+y) to the left of the screen', () => {
    expect(isoScreenOffsetX(1, 0)).toBeCloseTo(Math.SQRT1_2);
    expect(isoScreenOffsetX(0, 1)).toBeCloseTo(-Math.SQRT1_2);
  });

  it('is zero for points straight above or below on screen', () => {
    expect(isoScreenOffsetX(2, 2)).toBe(0);
    expect(isoScreenOffsetX(-3, -3)).toBe(0);
  });
});
