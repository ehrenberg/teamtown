import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { FloorGrid } from './floor-grid.ts';
import { tile } from './tile.ts';

describe('FloorGrid', () => {
  it('rejects invalid sizes', () => {
    expect(FloorGrid.builder(0, 5)).toEqual({ ok: false, error: 'invalid-size' });
    expect(FloorGrid.builder(2.5, 5)).toEqual({ ok: false, error: 'invalid-size' });
  });

  it('treats a wall as blocking in both directions', () => {
    const grid = unwrap(FloorGrid.builder(2, 1)).addWall(tile(0, 0), 'east').build();

    expect(grid.canStep(tile(0, 0), tile(1, 0))).toBe(false);
    expect(grid.canStep(tile(1, 0), tile(0, 0))).toBe(false);
  });

  it('only allows steps to adjacent tiles', () => {
    const grid = unwrap(FloorGrid.builder(5, 5)).build();

    expect(grid.canStep(tile(0, 0), tile(2, 0))).toBe(false);
    expect(grid.canStep(tile(0, 0), tile(0, 0))).toBe(false);
  });

  it('is not affected by changes to the builder after build()', () => {
    const builder = unwrap(FloorGrid.builder(2, 2));
    const grid = builder.build();
    builder.blockTile(tile(1, 1));

    expect(grid.isWalkable(tile(1, 1))).toBe(true);
  });
});
