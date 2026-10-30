import { describe, expect, it } from 'vitest';
import { videoBubbleLook } from './bubble-size.ts';

describe('videoBubbleLook', () => {
  it('is full size and opaque up to 2 tiles', () => {
    expect(videoBubbleLook(0)).toEqual({ scale: 1, opacity: 1 });
    expect(videoBubbleLook(2)).toEqual({ scale: 1, opacity: 1 });
  });

  it('is smallest and faintest from 6 tiles on', () => {
    expect(videoBubbleLook(6)).toEqual({ scale: 0.5, opacity: 0.5 });
    expect(videoBubbleLook(9)).toEqual({ scale: 0.5, opacity: 0.5 });
  });

  it('shrinks steadily in between', () => {
    const near = videoBubbleLook(3);
    const far = videoBubbleLook(5);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.opacity).toBeGreaterThan(far.opacity);
  });
});
