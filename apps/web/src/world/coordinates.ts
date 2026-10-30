import { TILE_SIZE_METERS, type TileCoord } from '@teamtown/world-core';

/** World space: grid x → world x, grid y → world z, height → world y, in metres (Y-up). */
export const gridToWorld = (gridX: number, gridY: number): [number, number] => [
  gridX * TILE_SIZE_METERS,
  gridY * TILE_SIZE_METERS,
];

/** Centre of a tile (or of a continuous tile position during movement). */
export const tileCentreToWorld = (x: number, y: number): [number, number] => gridToWorld(x + 0.5, y + 0.5);

export const worldToTile = (worldX: number, worldZ: number): TileCoord => ({
  x: Math.floor(worldX / TILE_SIZE_METERS),
  y: Math.floor(worldZ / TILE_SIZE_METERS),
});

export const metres = (tiles: number): number => tiles * TILE_SIZE_METERS;
