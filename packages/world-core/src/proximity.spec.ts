import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { FloorGrid } from './floor-grid.ts';
import { hasLineOfSight, proximityPan, proximityVolume, tileDistance } from './proximity.ts';

/**
 * 10 × 6 floor. A wall runs between columns 4 and 5 for rows 0–3, with an opening (door) at row 4–5.
 *
 *   x: 0 1 2 3 4 | 5 6 7 8 9
 *   y0           |
 *   y1           |
 *   y2           |
 *   y3           |
 *   y4                         (opening)
 *   y5
 */
function grid(): FloorGrid {
  const builder = unwrap(FloorGrid.builder(10, 6));
  for (let y = 0; y <= 3; y++) builder.addWall({ x: 4, y }, 'east');
  return builder.build();
}

describe('tileDistance', () => {
  it('is the euclidean distance in tiles', () => {
    expect(tileDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('hasLineOfSight', () => {
  it('sees along an open row', () => {
    expect(hasLineOfSight(grid(), { x: 0, y: 5 }, { x: 9, y: 5 })).toBe(true);
  });

  it('is blocked by a wall between two tiles', () => {
    expect(hasLineOfSight(grid(), { x: 3, y: 1 }, { x: 6, y: 1 })).toBe(false);
  });

  it('is symmetric', () => {
    expect(hasLineOfSight(grid(), { x: 6, y: 2 }, { x: 2, y: 0 })).toBe(false);
    expect(hasLineOfSight(grid(), { x: 2, y: 0 }, { x: 6, y: 2 })).toBe(false);
  });

  it('passes through the opening below the wall', () => {
    expect(hasLineOfSight(grid(), { x: 3, y: 4 }, { x: 6, y: 5 })).toBe(true);
  });

  it('is blocked when a diagonal line clips the end of a wall', () => {
    // The line from (3,5) to (6,2) crosses x = 4.5 at y = 3.5, the corner where the wall ends.
    expect(hasLineOfSight(grid(), { x: 3, y: 5 }, { x: 6, y: 2 })).toBe(false);
  });

  it('works with positions between tiles (walking avatars)', () => {
    expect(hasLineOfSight(grid(), { x: 3.6, y: 4.2 }, { x: 5.4, y: 4.4 })).toBe(true);
    expect(hasLineOfSight(grid(), { x: 3.6, y: 2.2 }, { x: 5.4, y: 2.4 })).toBe(false);
  });

  it('sees itself', () => {
    expect(hasLineOfSight(grid(), { x: 2, y: 2 }, { x: 2, y: 2 })).toBe(true);
  });

  it('ignores furniture: blocked tiles do not stop sound', () => {
    const builder = unwrap(FloorGrid.builder(5, 1));
    builder.blockTile({ x: 2, y: 0 });
    expect(hasLineOfSight(builder.build(), { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
  });
});

describe('proximityVolume', () => {
  it('is full up to 2 tiles and silent from 6 tiles', () => {
    expect(proximityVolume(0)).toBe(1);
    expect(proximityVolume(2)).toBe(1);
    expect(proximityVolume(6)).toBe(0);
    expect(proximityVolume(9)).toBe(0);
  });

  it('falls off smoothly and monotonically in between', () => {
    const samples = [2, 3, 4, 5, 6].map(proximityVolume);
    expect(samples).toEqual([...samples].sort((a, b) => b - a));
    expect(proximityVolume(4)).toBeCloseTo(0.5, 5);
  });
});

describe('proximityPan', () => {
  it('is centred for a speaker straight ahead and clamps to the sides', () => {
    expect(proximityPan(0)).toBe(0);
    expect(proximityPan(3)).toBeGreaterThan(0);
    expect(proximityPan(-3)).toBeLessThan(0);
    expect(proximityPan(100)).toBe(1);
    expect(proximityPan(-100)).toBe(-1);
  });
});
