import type { TileCoord } from './tile.ts';

/** Walking speed: about 1.5 m/s with 0.5 m tiles (docs/architecture/world-and-realtime.md §3). */
export const WALK_SPEED_TILES_PER_SECOND = 3;

/**
 * A movement is synchronised as intent + path + start time, never as a stream of positions.
 * Server and clients compute the same position for any point in time.
 */
export interface Movement {
  readonly from: TileCoord;
  /** Tiles to walk through, excluding `from`, ending with the target. */
  readonly path: readonly TileCoord[];
  /** Server time in milliseconds since the epoch. */
  readonly startedAt: number;
  readonly speedTilesPerSecond: number;
}

export interface MovementPosition {
  /** Continuous tile coordinates (tile x/y, not yet shifted to the tile centre). */
  readonly x: number;
  readonly y: number;
  readonly arrived: boolean;
  /** Direction of the current segment, useful for facing the avatar. */
  readonly heading: { readonly dx: number; readonly dy: number };
}

const segmentLength = (a: TileCoord, b: TileCoord): number => Math.hypot(b.x - a.x, b.y - a.y);

function* segmentsOf(movement: Movement): Generator<{ start: TileCoord; end: TileCoord }> {
  let start = movement.from;
  for (const end of movement.path) {
    yield { start, end };
    start = end;
  }
}

export function movementDurationMs(movement: Movement): number {
  let length = 0;
  for (const { start, end } of segmentsOf(movement)) {
    length += segmentLength(start, end);
  }
  return (length / movement.speedTilesPerSecond) * 1000;
}

export function positionAt(movement: Movement, now: number): MovementPosition {
  let remaining = (Math.max(0, now - movement.startedAt) / 1000) * movement.speedTilesPerSecond;
  let heading = { dx: 0, dy: 1 };

  for (const { start, end } of segmentsOf(movement)) {
    const length = segmentLength(start, end);
    heading = { dx: end.x - start.x, dy: end.y - start.y };
    if (remaining < length) {
      const progress = remaining / length;
      return {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
        arrived: false,
        heading,
      };
    }
    remaining -= length;
  }

  const last = movement.path.at(-1) ?? movement.from;
  return { x: last.x, y: last.y, arrived: true, heading };
}

/**
 * The tile an avatar occupies at a point in time: the tile it is closest to along its path.
 * Used by the server when a walking avatar receives a new command.
 */
export function tileAt(movement: Movement, now: number): TileCoord {
  const { x, y } = positionAt(movement, now);
  return { x: Math.round(x), y: Math.round(y) };
}
