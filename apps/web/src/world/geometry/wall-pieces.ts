import type { FloorPlan } from '@teamtown/contracts';

type WallMaterial = FloorPlan['walls'][number]['material'];

/** A straight, renderable wall piece between two grid points, with door openings already cut out. */
export interface WallPiece {
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly material: WallMaterial;
  /** Front walls (facing the camera) are rendered low so rooms stay visible (cut-away). */
  readonly isFront: boolean;
}

const edgeKey = (x: number, y: number, orientation: 'h' | 'v') => `${orientation}:${x},${y}`;

/** Door openings as unit edges: horizontal edge (x..x+1 on line y) or vertical edge (y..y+1 on line x). */
function doorEdges(plan: FloorPlan): Set<string> {
  const edges = new Set<string>();
  for (const { x, y, side } of plan.doors) {
    if (side === 'north') edges.add(edgeKey(x, y, 'h'));
    if (side === 'south') edges.add(edgeKey(x, y + 1, 'h'));
    if (side === 'west') edges.add(edgeKey(x, y, 'v'));
    if (side === 'east') edges.add(edgeKey(x + 1, y, 'v'));
  }
  return edges;
}

/**
 * Splits the plan's wall segments at door openings. The camera looks from the +x/+y corner, so walls
 * on the far bottom/right edges of the floor face the camera and are marked as front walls.
 */
export function wallPieces(plan: FloorPlan): WallPiece[] {
  const doors = doorEdges(plan);
  const pieces: WallPiece[] = [];

  for (const wall of plan.walls) {
    const horizontal = wall.from.y === wall.to.y;
    const line = horizontal ? wall.from.y : wall.from.x;
    const start = Math.min(horizontal ? wall.from.x : wall.from.y, horizontal ? wall.to.x : wall.to.y);
    const end = Math.max(horizontal ? wall.from.x : wall.from.y, horizontal ? wall.to.x : wall.to.y);
    const isFront = horizontal ? line === plan.height : line === plan.width;

    let runStart: number | null = null;
    for (let position = start; position <= end; position++) {
      const isOpen =
        position === end || doors.has(horizontal ? edgeKey(position, line, 'h') : edgeKey(line, position, 'v'));
      if (!isOpen && runStart === null) runStart = position;
      if (isOpen && runStart !== null) {
        pieces.push({
          from: horizontal ? { x: runStart, y: line } : { x: line, y: runStart },
          to: horizontal ? { x: position, y: line } : { x: line, y: position },
          material: wall.material,
          isFront,
        });
        runStart = null;
      }
    }
  }
  return pieces;
}
