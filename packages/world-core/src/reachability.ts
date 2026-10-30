import type { FloorGrid } from './floor-grid.ts';
import { tileKey, type TileCoord } from './tile.ts';

const NEIGHBOUR_STEPS: readonly TileCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

/** All tiles reachable from `start` (breadth-first), as tile keys. Empty if the start is not walkable. */
export function reachableTiles(grid: FloorGrid, start: TileCoord): ReadonlySet<string> {
  const reached = new Set<string>();
  if (!grid.isWalkable(start)) return reached;

  const queue: TileCoord[] = [start];
  reached.add(tileKey(start));
  for (let current = queue.shift(); current; current = queue.shift()) {
    for (const step of NEIGHBOUR_STEPS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      const key = tileKey(next);
      if (!reached.has(key) && grid.canStep(current, next)) {
        reached.add(key);
        queue.push(next);
      }
    }
  }
  return reached;
}
