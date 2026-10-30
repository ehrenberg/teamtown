import { err, ok, type Result } from '@teamtown/kernel';
import { FloorGrid } from './floor-grid.ts';
import { footprintOf, FURNITURE_CATALOGUE, isCatalogueItemId, type Rotation } from './furniture-catalogue.ts';
import { tileKey, type Side, type TileCoord } from './tile.ts';

/**
 * Structural description of a floor that the walkability grid is built from. It matches the
 * `FloorPlan` contract in packages/contracts, but world-core stays independent of schema libraries.
 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A wall along a grid line, from one grid point to another (axis-aligned). */
export interface WallSegment {
  readonly from: TileCoord;
  readonly to: TileCoord;
}

/** A door is an opening on one side of a tile. */
export interface Door {
  readonly x: number;
  readonly y: number;
  readonly side: Side;
}

export interface FurniturePlacement {
  readonly catalogItemId: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: Rotation;
}

export interface FloorLayout {
  readonly width: number;
  readonly height: number;
  readonly floorAreas: readonly Rect[];
  readonly walls: readonly WallSegment[];
  readonly doors: readonly Door[];
  readonly furniture: readonly FurniturePlacement[];
}

export type FloorLayoutError = 'invalid-size' | 'diagonal-wall' | 'unknown-furniture';

const tilesOf = (rect: Rect): TileCoord[] =>
  Array.from({ length: rect.width * rect.height }, (_, index) => ({
    x: rect.x + (index % rect.width),
    y: rect.y + Math.floor(index / rect.width),
  }));

/** Expands a wall segment into the tile edges it blocks, described as (tile, side). */
function edgesOf(wall: WallSegment): Result<{ tile: TileCoord; side: Side }[], FloorLayoutError> {
  const { from, to } = wall;
  if (from.y === to.y) {
    const [start, end] = from.x < to.x ? [from.x, to.x] : [to.x, from.x];
    return ok(Array.from({ length: end - start }, (_, i) => ({ tile: { x: start + i, y: from.y }, side: 'north' })));
  }
  if (from.x === to.x) {
    const [start, end] = from.y < to.y ? [from.y, to.y] : [to.y, from.y];
    return ok(Array.from({ length: end - start }, (_, i) => ({ tile: { x: from.x, y: start + i }, side: 'west' })));
  }
  return err('diagonal-wall');
}

/** Normalises a door to the same (tile, side) form used for wall edges: north or west of a tile. */
function doorEdgeKey({ x, y, side }: Door): string {
  switch (side) {
    case 'north':
      return `${tileKey({ x, y })}:north`;
    case 'south':
      return `${tileKey({ x, y: y + 1 })}:north`;
    case 'west':
      return `${tileKey({ x, y })}:west`;
    case 'east':
      return `${tileKey({ x: x + 1, y })}:west`;
  }
}

/**
 * Builds the walkability grid of a floor: only tiles inside floor areas are walkable,
 * walls block tile edges except where a door is, and non-walkable furniture blocks its footprint.
 */
export function buildFloorGrid(layout: FloorLayout): Result<FloorGrid, FloorLayoutError> {
  const builderResult = FloorGrid.builder(layout.width, layout.height);
  if (!builderResult.ok) return builderResult;
  const builder = builderResult.value;

  const floorTiles = new Set(layout.floorAreas.flatMap(tilesOf).map(tileKey));
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      if (!floorTiles.has(tileKey({ x, y }))) builder.blockTile({ x, y });
    }
  }

  const doorEdges = new Set(layout.doors.map(doorEdgeKey));
  for (const wall of layout.walls) {
    const edges = edgesOf(wall);
    if (!edges.ok) return edges;
    for (const { tile, side } of edges.value) {
      if (!doorEdges.has(`${tileKey(tile)}:${side}`)) builder.addWall(tile, side);
    }
  }

  for (const item of layout.furniture) {
    if (!isCatalogueItemId(item.catalogItemId)) return err('unknown-furniture');
    if (FURNITURE_CATALOGUE[item.catalogItemId].walkable) continue;
    const { width, depth } = footprintOf(item.catalogItemId, item.rotation);
    tilesOf({ x: item.x, y: item.y, width, height: depth }).forEach((coord) => builder.blockTile(coord));
  }

  return ok(builder.build());
}
