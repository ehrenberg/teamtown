import type { FloorPlan } from '@teamtown/contracts';
import { describe, expect, it } from 'vitest';
import { wallPieces } from './wall-pieces.ts';

const plan = (overrides: Partial<FloorPlan>): FloorPlan => ({
  floorId: 'f',
  name: 'F',
  level: 0,
  version: 1,
  width: 10,
  height: 6,
  floorAreas: [{ x: 0, y: 0, width: 10, height: 6, material: 'wood' }],
  walls: [],
  doors: [],
  rooms: [],
  furniture: [],
  spawnPoints: [{ x: 0, y: 0 }],
  ...overrides,
});

describe('wallPieces', () => {
  it('keeps a wall without doors in one piece', () => {
    expect(wallPieces(plan({ walls: [{ from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, material: 'solid' }] }))).toEqual([
      { from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, material: 'solid', isFront: false },
    ]);
  });

  it('cuts a two-tile door out of a vertical wall', () => {
    const pieces = wallPieces(
      plan({
        walls: [{ from: { x: 4, y: 0 }, to: { x: 4, y: 6 }, material: 'glass' }],
        doors: [
          { x: 4, y: 2, side: 'west' },
          { x: 3, y: 3, side: 'east' },
        ],
      }),
    );

    expect(pieces.map((piece) => [piece.from.y, piece.to.y])).toEqual([
      [0, 2],
      [4, 6],
    ]);
  });

  it('marks walls on the far edges as front walls', () => {
    const pieces = wallPieces(
      plan({
        walls: [
          { from: { x: 0, y: 6 }, to: { x: 10, y: 6 }, material: 'solid' },
          { from: { x: 10, y: 0 }, to: { x: 10, y: 6 }, material: 'solid' },
        ],
      }),
    );

    expect(pieces.every((piece) => piece.isFront)).toBe(true);
  });
});
