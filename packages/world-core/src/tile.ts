/** One tile is 0.5 m × 0.5 m of real office space (docs/architecture/world-and-realtime.md §1). */
export const TILE_SIZE_METERS = 0.5;

export interface TileCoord {
  readonly x: number;
  readonly y: number;
}

export const tile = (x: number, y: number): TileCoord => ({ x, y });

export const tileKey = ({ x, y }: TileCoord): string => `${x},${y}`;

export const sameTile = (a: TileCoord, b: TileCoord): boolean => a.x === b.x && a.y === b.y;

/** The four sides of a tile. Walls live on these edges, not on tiles. */
export type Side = 'north' | 'east' | 'south' | 'west';

export const SIDE_OFFSETS: Readonly<Record<Side, TileCoord>> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

export const neighbourOn = (from: TileCoord, side: Side): TileCoord => ({
  x: from.x + SIDE_OFFSETS[side].x,
  y: from.y + SIDE_OFFSETS[side].y,
});
