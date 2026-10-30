import { z } from 'zod';

/**
 * Canonical floor-plan format (ADR-0014, ADR-0029). Seed files and the M5 editor both produce it.
 * Coordinates are tiles (0.5 m); walls run along grid lines between grid points.
 */
const GridIndex = z.number().int().nonnegative();
export const TileCoordSchema = z.object({ x: GridIndex, y: GridIndex });
const Side = z.enum(['north', 'east', 'south', 'west']);
const Rect = z.object({
  x: GridIndex,
  y: GridIndex,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
const Identifier = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'lowercase letters, digits and dashes');

export const FloorMaterial = z.enum(['wood', 'carpet', 'tiles', 'concrete', 'terrace']);
export const WallMaterial = z.enum(['solid', 'glass', 'accent']);
export const DoorMode = z.enum(['open', 'knock', 'locked']);
export const RoomKind = z.enum(['open-space', 'meeting', 'kitchen', 'lounge', 'stage', 'terrace', 'focus']);
export const Rotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);

export const FloorPlan = z.object({
  floorId: Identifier,
  name: z.string().min(1).max(80),
  /** 0 = ground floor; used for ordering and localised level labels. */
  level: z.number().int().min(-5).max(100),
  version: z.number().int().positive(),
  width: z.number().int().positive().max(1024),
  height: z.number().int().positive().max(1024),
  floorAreas: z.array(Rect.extend({ material: FloorMaterial })).min(1),
  walls: z.array(z.object({ from: TileCoordSchema, to: TileCoordSchema, material: WallMaterial })),
  doors: z.array(z.object({ x: GridIndex, y: GridIndex, side: Side })),
  rooms: z.array(
    z.object({
      id: Identifier,
      name: z.string().min(1).max(80),
      kind: RoomKind,
      areas: z.array(Rect).min(1),
      doorMode: DoorMode,
      /** Proximity audio doesn't reach into or out of the room; it has its own room call (ADR-0031). */
      audioIsolated: z.boolean(),
    }),
  ),
  furniture: z.array(
    z.object({
      id: Identifier,
      catalogItemId: z.string().min(1),
      x: GridIndex,
      y: GridIndex,
      rotation: Rotation,
    }),
  ),
  spawnPoints: z.array(TileCoordSchema).min(1),
});
export type FloorPlan = z.infer<typeof FloorPlan>;

/** `GET /api/floors` */
export const FloorSummary = FloorPlan.pick({ floorId: true, name: true, level: true });
export type FloorSummary = z.infer<typeof FloorSummary>;
export const FloorListResponse = z.object({ floors: z.array(FloorSummary) });
export type FloorListResponse = z.infer<typeof FloorListResponse>;
