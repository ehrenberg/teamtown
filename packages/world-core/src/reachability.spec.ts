import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { FloorGrid } from './floor-grid.ts';
import { reachableTiles } from './reachability.ts';
import { tile, tileKey } from './tile.ts';

describe('reachableTiles', () => {
  it('finds every tile of an open floor', () => {
    expect(reachableTiles(unwrap(FloorGrid.builder(3, 2)).build(), tile(0, 0)).size).toBe(6);
  });

  it('does not cross walls', () => {
    const builder = unwrap(FloorGrid.builder(2, 1));
    builder.addWall(tile(0, 0), 'east');

    expect(reachableTiles(builder.build(), tile(0, 0))).toEqual(new Set([tileKey(tile(0, 0))]));
  });

  it('is empty when starting on a blocked tile', () => {
    const grid = unwrap(FloorGrid.builder(2, 2)).blockTile(tile(0, 0)).build();

    expect(reachableTiles(grid, tile(0, 0)).size).toBe(0);
  });
});
