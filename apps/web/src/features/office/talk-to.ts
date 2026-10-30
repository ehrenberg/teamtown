import { hasLineOfSight, sameTile, tileDistance, type FloorGrid, type TileCoord } from '@teamtown/world-core';

const NEIGHBOURS: readonly TileCoord[] = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
];

export function talkToTarget(
  grid: FloorGrid,
  me: TileCoord,
  them: TileCoord,
  occupied: readonly TileCoord[],
): TileCoord | null {
  const candidates = NEIGHBOURS.map(({ x, y }) => ({ x: them.x + x, y: them.y + y })).filter(
    (tile) =>
      grid.isWalkable(tile) && hasLineOfSight(grid, tile, them) && !occupied.some((other) => sameTile(other, tile)),
  );
  candidates.sort((a, b) => tileDistance(a, me) - tileDistance(b, me));
  return candidates[0] ?? null;
}
