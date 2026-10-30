import { TILE_SIZE_METERS, type TileCoord } from './tile.ts';

/**
 * Classic isometric camera: yaw 45°, pitch arctan(1/√2) ≈ 35.264° (docs/architecture/world-and-realtime.md §2).
 * The renderer uses these with an orthographic camera.
 */
export const ISO_CAMERA_YAW_RADIANS = Math.PI / 4;
export const ISO_CAMERA_PITCH_RADIANS = Math.atan(1 / Math.SQRT2);

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Maps a tile to the 3D position of its centre. Grid x → world x, grid y → world z, height → world y (Y-up).
 */
export const tileCenterToWorld = ({ x, y }: TileCoord, heightMeters = 0): WorldPoint => ({
  x: (x + 0.5) * TILE_SIZE_METERS,
  y: heightMeters,
  z: (y + 0.5) * TILE_SIZE_METERS,
});

/** Direction from which the iso camera looks at a target, as a unit vector. */
export const isoCameraDirection = (): WorldPoint => ({
  x: Math.cos(ISO_CAMERA_PITCH_RADIANS) * Math.sin(ISO_CAMERA_YAW_RADIANS),
  y: Math.sin(ISO_CAMERA_PITCH_RADIANS),
  z: Math.cos(ISO_CAMERA_PITCH_RADIANS) * Math.cos(ISO_CAMERA_YAW_RADIANS),
});

/**
 * Horizontal screen offset (in tiles, positive = right) of a point that lies (dx, dy) grid tiles away. The camera
 * looks from +x/+z towards -x/-z, so screen-right runs along (1, -1) on the grid. Used for stereo panning.
 */
export const isoScreenOffsetX = (dx: number, dy: number): number => (dx - dy) / Math.SQRT2;
