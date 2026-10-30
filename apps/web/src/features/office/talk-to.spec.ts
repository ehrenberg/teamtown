import { unwrap } from '@teamtown/kernel';
import { FloorGrid } from '@teamtown/world-core';
import { describe, expect, it } from 'vitest';
import { talkToTarget } from './talk-to.ts';

/** 10 × 10 floor; a wall runs along the west side of column 6 for rows 0–9. */
function grid(): FloorGrid {
  const builder = unwrap(FloorGrid.builder(10, 10));
  for (let y = 0; y < 10; y++) builder.addWall({ x: 6, y }, 'west');
  builder.blockTile({ x: 4, y: 4 });
  return builder.build();
}

describe('talkToTarget', () => {
  it('picks the free tile next to the person that is closest to me', () => {
    expect(talkToTarget(grid(), { x: 0, y: 5 }, { x: 3, y: 5 }, [])).toEqual({ x: 2, y: 5 });
  });

  it('skips occupied and blocked tiles', () => {
    expect(talkToTarget(grid(), { x: 4, y: 0 }, { x: 4, y: 3 }, [{ x: 4, y: 2 }])).toEqual({ x: 3, y: 2 });
  });

  it('never picks a tile on the other side of a wall', () => {
    // Me east of the wall, the person directly west of it: the target must be on the person's side.
    const target = talkToTarget(grid(), { x: 8, y: 5 }, { x: 5, y: 5 }, []);
    expect(target?.x).toBeLessThanOrEqual(5);
  });

  it('returns null when there is no free spot around the person', () => {
    const builder = unwrap(FloorGrid.builder(1, 1));
    expect(talkToTarget(builder.build(), { x: 0, y: 0 }, { x: 0, y: 0 }, [])).toBeNull();
  });
});
