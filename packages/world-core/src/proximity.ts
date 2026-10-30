import type { FloorGrid } from './floor-grid.ts';

/**
 * Proximity audio rules (ADR-0031). Positions are continuous tile coordinates: tile (x, y) has its centre at
 * (x, y), and walls lie on the grid lines half a tile away from it.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export const CONVERSATION_FORM_DISTANCE = 4;
export const CONVERSATION_DISSOLVE_DISTANCE = 6;
export const VOLUME_FULL_DISTANCE = 2;
export const VOLUME_SILENT_DISTANCE = 6;

const EPSILON = 1e-9;

export const tileDistance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/** Grid lines (at k + 0.5) that lie strictly between two coordinates. */
function* gridLinesBetween(from: number, to: number): Generator<number> {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  for (let k = Math.ceil(low - 0.5 + EPSILON); k + 0.5 < high - EPSILON; k++) yield k;
}

/** Tile rows (or columns) touched at a crossing; at a tile corner both neighbours count (conservative). */
function tilesAt(value: number): number[] {
  const fraction = value - Math.floor(value);
  return Math.abs(fraction - 0.5) < EPSILON ? [Math.floor(value), Math.ceil(value)] : [Math.round(value)];
}

/** Every wall blocks sound, glass included; doors are openings. Furniture does not block sound. */
export function hasLineOfSight(grid: FloorGrid, a: Point, b: Point): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  for (const k of gridLinesBetween(a.x, b.x)) {
    const y = a.y + ((k + 0.5 - a.x) / dx) * dy;
    for (const row of tilesAt(y)) {
      if (grid.hasWallBetween({ x: k, y: row }, { x: k + 1, y: row })) return false;
    }
  }
  for (const k of gridLinesBetween(a.y, b.y)) {
    const x = a.x + ((k + 0.5 - a.y) / dy) * dx;
    for (const column of tilesAt(x)) {
      if (grid.hasWallBetween({ x: column, y: k }, { x: column, y: k + 1 })) return false;
    }
  }
  return true;
}

export function proximityVolume(distance: number): number {
  if (distance <= VOLUME_FULL_DISTANCE) return 1;
  if (distance >= VOLUME_SILENT_DISTANCE) return 0;
  const t = (distance - VOLUME_FULL_DISTANCE) / (VOLUME_SILENT_DISTANCE - VOLUME_FULL_DISTANCE);
  // Smoothstep: no audible jumps at either end.
  return 1 - t * t * (3 - 2 * t);
}

export function proximityPan(screenOffsetTiles: number): number {
  return Math.max(-1, Math.min(1, screenOffsetTiles / VOLUME_SILENT_DISTANCE));
}
