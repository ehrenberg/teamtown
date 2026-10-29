import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { FloorGrid } from './floor-grid.ts';
import { findPath } from './pathfinding.ts';
import { tile } from './tile.ts';

const emptyGrid = (width: number, height: number) => unwrap(FloorGrid.builder(width, height)).build();

describe('findPath', () => {
  it('returns an empty path when already at the target', () => {
    expect(findPath(emptyGrid(3, 3), tile(1, 1), tile(1, 1))).toEqual({ ok: true, value: [] });
  });

  it('walks diagonally on an empty floor, excluding the start tile', () => {
    const path = unwrap(findPath(emptyGrid(5, 5), tile(0, 0), tile(3, 3)));
    expect(path).toEqual([tile(1, 1), tile(2, 2), tile(3, 3)]);
  });

  it('walks around a wall instead of through it', () => {
    // A wall on the east side of column 1, rows 0..2, with a gap at row 3.
    const builder = unwrap(FloorGrid.builder(4, 4));
    [0, 1, 2].forEach((y) => builder.addWall(tile(1, y), 'east'));
    const grid = builder.build();

    const path = unwrap(findPath(grid, tile(0, 0), tile(3, 0)));

    expect(path.some((step) => step.y === 3)).toBe(true);
    expect(path.at(-1)).toEqual(tile(3, 0));
  });

  it('never cuts the corner of a blocked tile', () => {
    const grid = unwrap(FloorGrid.builder(2, 2)).blockTile(tile(1, 0)).build();

    const path = unwrap(findPath(grid, tile(0, 0), tile(1, 1)));

    expect(path).toEqual([tile(0, 1), tile(1, 1)]);
  });

  it('reports unreachable targets behind closed walls', () => {
    const builder = unwrap(FloorGrid.builder(3, 1));
    builder.addWall(tile(1, 0), 'west');
    expect(findPath(builder.build(), tile(0, 0), tile(2, 0))).toEqual({ ok: false, error: 'unreachable' });
  });

  it('rejects blocked or outside targets', () => {
    const grid = unwrap(FloorGrid.builder(3, 3)).blockTile(tile(2, 2)).build();
    expect(findPath(grid, tile(0, 0), tile(2, 2))).toEqual({ ok: false, error: 'target-not-walkable' });
    expect(findPath(grid, tile(0, 0), tile(9, 9))).toEqual({ ok: false, error: 'target-not-walkable' });
  });
});
