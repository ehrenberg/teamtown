import { err, ok, type Result } from '@teamtown/kernel';
import type { FloorGrid } from './floor-grid.ts';
import type { StepGuard } from './rooms.ts';
import { sameTile, tileKey, type TileCoord } from './tile.ts';

export type PathError = 'start-not-walkable' | 'target-not-walkable' | 'unreachable';

const STRAIGHT_COST = 1;
const DIAGONAL_COST = Math.SQRT2;
const STEPS: readonly TileCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

/** Octile distance: the exact cost on an empty 8-connected grid, so A* stays optimal. */
const octileDistance = (a: TileCoord, b: TileCoord): number => {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return STRAIGHT_COST * (dx + dy) + (DIAGONAL_COST - 2 * STRAIGHT_COST) * Math.min(dx, dy);
};

interface OpenNode {
  readonly coord: TileCoord;
  readonly estimatedTotal: number;
}

/** Minimal binary heap ordered by estimated total cost. */
class OpenSet {
  readonly #heap: OpenNode[] = [];

  get isEmpty(): boolean {
    return this.#heap.length === 0;
  }

  push(node: OpenNode): void {
    this.#heap.push(node);
    let index = this.#heap.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.#at(parent).estimatedTotal <= this.#at(index).estimatedTotal) break;
      this.#swap(parent, index);
      index = parent;
    }
  }

  pop(): OpenNode | undefined {
    const top = this.#heap[0];
    const last = this.#heap.pop();
    if (this.#heap.length > 0 && last) {
      this.#heap[0] = last;
      this.#siftDown();
    }
    return top;
  }

  #siftDown(): void {
    let index = 0;
    for (;;) {
      const left = 2 * index + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.#heap.length && this.#at(left).estimatedTotal < this.#at(smallest).estimatedTotal)
        smallest = left;
      if (right < this.#heap.length && this.#at(right).estimatedTotal < this.#at(smallest).estimatedTotal)
        smallest = right;
      if (smallest === index) return;
      this.#swap(index, smallest);
      index = smallest;
    }
  }

  #at(index: number): OpenNode {
    const node = this.#heap[index];
    if (!node) throw new Error(`OpenSet index ${index} out of range`);
    return node;
  }

  #swap(a: number, b: number): void {
    [this.#heap[a], this.#heap[b]] = [this.#at(b), this.#at(a)];
  }
}

/**
 * Finds the cheapest path with A*. The result excludes the start tile and ends with the target;
 * it is empty if start and target are the same tile. The optional guard forbids further steps (e.g. into closed rooms).
 */
export function findPath(
  grid: FloorGrid,
  start: TileCoord,
  target: TileCoord,
  guard?: StepGuard,
): Result<TileCoord[], PathError> {
  if (!grid.isWalkable(start)) return err('start-not-walkable');
  if (!grid.isWalkable(target)) return err('target-not-walkable');
  if (sameTile(start, target)) return ok([]);

  const cameFrom = new Map<string, TileCoord>();
  const costSoFar = new Map<string, number>([[tileKey(start), 0]]);
  const open = new OpenSet();
  open.push({ coord: start, estimatedTotal: octileDistance(start, target) });

  while (!open.isEmpty) {
    const current = open.pop();
    if (!current) break;
    if (sameTile(current.coord, target)) {
      return ok(reconstructPath(cameFrom, target));
    }
    const currentCost = costSoFar.get(tileKey(current.coord)) ?? Number.POSITIVE_INFINITY;

    for (const step of STEPS) {
      const next = { x: current.coord.x + step.x, y: current.coord.y + step.y };
      if (!grid.canStep(current.coord, next) || (guard && !guard(current.coord, next))) continue;

      const isDiagonal = step.x !== 0 && step.y !== 0;
      const nextCost = currentCost + (isDiagonal ? DIAGONAL_COST : STRAIGHT_COST);
      const key = tileKey(next);
      if (nextCost < (costSoFar.get(key) ?? Number.POSITIVE_INFINITY)) {
        costSoFar.set(key, nextCost);
        cameFrom.set(key, current.coord);
        open.push({ coord: next, estimatedTotal: nextCost + octileDistance(next, target) });
      }
    }
  }
  return err('unreachable');
}

function reconstructPath(cameFrom: ReadonlyMap<string, TileCoord>, target: TileCoord): TileCoord[] {
  const path: TileCoord[] = [target];
  let previous = cameFrom.get(tileKey(target));
  while (previous && cameFrom.has(tileKey(previous))) {
    path.unshift(previous);
    previous = cameFrom.get(tileKey(previous));
  }
  return path;
}
