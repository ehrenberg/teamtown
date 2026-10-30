import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { buildFloorGrid, type FloorLayout } from './floor-layout.ts';
import { findPath } from './pathfinding.ts';
import { tile } from './tile.ts';

/**
 * Two rooms side by side, separated by a wall at grid line x = 3 with a door at (3,1):
 *
 *   x: 0 1 2 | 3 4 5
 *   y=0 . . . | . . .
 *   y=1 . . . D . . .
 *   y=2 . . . | . . .
 */
const twoRooms: FloorLayout = {
  width: 6,
  height: 3,
  floorAreas: [{ x: 0, y: 0, width: 6, height: 3 }],
  walls: [{ from: { x: 3, y: 0 }, to: { x: 3, y: 3 } }],
  doors: [{ x: 3, y: 1, side: 'west' }],
  furniture: [],
};

describe('buildFloorGrid', () => {
  it('blocks walls but keeps doors open', () => {
    const grid = unwrap(buildFloorGrid(twoRooms));

    expect(grid.canStep(tile(2, 0), tile(3, 0))).toBe(false);
    expect(grid.canStep(tile(2, 1), tile(3, 1))).toBe(true);
  });

  it('routes through the door', () => {
    const path = unwrap(findPath(unwrap(buildFloorGrid(twoRooms)), tile(0, 0), tile(5, 0)));

    expect(path).toContainEqual(tile(3, 1));
  });

  it('accepts doors described from the other side of the wall', () => {
    const grid = unwrap(buildFloorGrid({ ...twoRooms, doors: [{ x: 2, y: 2, side: 'east' }] }));

    expect(grid.canStep(tile(2, 2), tile(3, 2))).toBe(true);
    expect(grid.canStep(tile(2, 1), tile(3, 1))).toBe(false);
  });

  it('only allows walking inside floor areas', () => {
    const lShape = unwrap(
      buildFloorGrid({
        ...twoRooms,
        floorAreas: [
          { x: 0, y: 0, width: 3, height: 3 },
          { x: 3, y: 2, width: 3, height: 1 },
        ],
        walls: [],
        doors: [],
      }),
    );

    expect(lShape.isWalkable(tile(4, 0))).toBe(false);
    expect(lShape.isWalkable(tile(4, 2))).toBe(true);
  });

  it('blocks the rotated footprint of solid furniture but not of walkable items', () => {
    const grid = unwrap(
      buildFloorGrid({
        ...twoRooms,
        walls: [],
        doors: [],
        furniture: [
          // A 3 × 2 desk rotated by 90° covers x 0..1, y 0..2.
          { catalogItemId: 'desk-straight', x: 0, y: 0, rotation: 90 },
          { catalogItemId: 'rug', x: 3, y: 0, rotation: 0 },
        ],
      }),
    );

    expect(grid.isWalkable(tile(1, 2))).toBe(false);
    expect(grid.isWalkable(tile(2, 0))).toBe(true);
    expect(grid.isWalkable(tile(4, 1))).toBe(true);
  });

  it('rejects diagonal walls and unknown furniture', () => {
    expect(buildFloorGrid({ ...twoRooms, walls: [{ from: { x: 0, y: 0 }, to: { x: 2, y: 2 } }] })).toEqual({
      ok: false,
      error: 'diagonal-wall',
    });
    expect(buildFloorGrid({ ...twoRooms, furniture: [{ catalogItemId: 'hot-tub', x: 0, y: 0, rotation: 0 }] })).toEqual(
      { ok: false, error: 'unknown-furniture' },
    );
  });
});
