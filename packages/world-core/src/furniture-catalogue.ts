/**
 * Furniture catalogue (docs/design/world-art-direction.md §6). Footprints are in tiles for rotation 0;
 * rotations of 90°/270° swap width and depth. Rendering details live in the web client.
 */
export interface CatalogueItem {
  readonly width: number;
  readonly depth: number;
  /** Whether avatars can stand on the item's tiles (chairs, rugs, stage). */
  readonly walkable: boolean;
}

export const FURNITURE_CATALOGUE = {
  // Footprints use real proportions with 0.5 m tiles, e.g. a desk of 1.5 m × 1 m is 3 × 2 tiles.
  'desk-straight': { width: 3, depth: 2, walkable: false },
  'office-chair': { width: 1, depth: 1, walkable: true },
  'meeting-table-4': { width: 3, depth: 3, walkable: false },
  'meeting-table-8': { width: 6, depth: 3, walkable: false },
  sofa: { width: 4, depth: 2, walkable: false },
  armchair: { width: 2, depth: 2, walkable: false },
  'coffee-table': { width: 2, depth: 1, walkable: false },
  'kitchen-counter': { width: 6, depth: 2, walkable: false },
  fridge: { width: 2, depth: 2, walkable: false },
  'bar-table': { width: 2, depth: 2, walkable: false },
  'dining-table': { width: 4, depth: 2, walkable: false },
  bookshelf: { width: 3, depth: 1, walkable: false },
  plant: { width: 1, depth: 1, walkable: false },
  'tv-wall': { width: 4, depth: 1, walkable: true },
  whiteboard: { width: 4, depth: 1, walkable: true },
  'phone-booth': { width: 2, depth: 2, walkable: false },
  rug: { width: 6, depth: 4, walkable: true },
  stage: { width: 8, depth: 5, walkable: true },
  'deck-chair': { width: 2, depth: 3, walkable: false },
  'parasol-table': { width: 3, depth: 3, walkable: false },
} as const satisfies Readonly<Record<string, CatalogueItem>>;

export type CatalogueItemId = keyof typeof FURNITURE_CATALOGUE;

export type Rotation = 0 | 90 | 180 | 270;

export const isCatalogueItemId = (value: string): value is CatalogueItemId => value in FURNITURE_CATALOGUE;

/** Footprint in tiles after rotation. */
export function footprintOf(itemId: CatalogueItemId, rotation: Rotation): { width: number; depth: number } {
  const item = FURNITURE_CATALOGUE[itemId];
  return rotation === 90 || rotation === 270
    ? { width: item.depth, depth: item.width }
    : { width: item.width, depth: item.depth };
}
