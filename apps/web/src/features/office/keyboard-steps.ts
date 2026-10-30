import type { TileCoord } from '@teamtown/world-core';

/**
 * Keys move the avatar in screen directions. The isometric camera looks from the +x/+y corner,
 * so "up" on screen is the diagonal (-1, -1) on the grid.
 */
const SCREEN_DIRECTIONS: Readonly<Record<string, TileCoord>> = {
  ArrowUp: { x: -1, y: -1 },
  KeyW: { x: -1, y: -1 },
  ArrowDown: { x: 1, y: 1 },
  KeyS: { x: 1, y: 1 },
  ArrowLeft: { x: -1, y: 1 },
  KeyA: { x: -1, y: 1 },
  ArrowRight: { x: 1, y: -1 },
  KeyD: { x: 1, y: -1 },
};

/** The grid step for a keyboard event code, or null if the key doesn't move the avatar. */
export const stepForKey = (code: string): TileCoord | null => SCREEN_DIRECTIONS[code] ?? null;
