import { err, ok, type Result } from '@teamtown/kernel';
import {
  buildFloorGrid,
  footprintOf,
  isCatalogueItemId,
  reachableTiles,
  tileKey,
  type FloorGrid,
  type FloorLayout,
  type FloorLayoutError,
  type Rect,
  type Rotation,
  type TileCoord,
} from '@teamtown/world-core';

export type FloorMaterial = 'wood' | 'carpet' | 'tiles' | 'concrete' | 'terrace';
export type WallMaterial = 'solid' | 'glass' | 'accent';
export type DoorMode = 'open' | 'knock' | 'locked';
export type RoomKind = 'open-space' | 'meeting' | 'kitchen' | 'lounge' | 'stage' | 'terrace' | 'focus';

export interface RoomProps {
  readonly id: string;
  readonly name: string;
  readonly kind: RoomKind;
  readonly areas: readonly Rect[];
  readonly doorMode: DoorMode;
}

export interface FloorPlanProps extends FloorLayout {
  readonly floorId: string;
  readonly name: string;
  readonly level: number;
  readonly version: number;
  readonly floorAreas: readonly (Rect & { readonly material: FloorMaterial })[];
  readonly walls: readonly (FloorLayout['walls'][number] & { readonly material: WallMaterial })[];
  readonly rooms: readonly RoomProps[];
  readonly furniture: readonly (FloorLayout['furniture'][number] & {
    readonly id: string;
    readonly rotation: Rotation;
  })[];
  readonly spawnPoints: readonly TileCoord[];
}

export type FloorPlanError =
  FloorLayoutError | 'spawn-not-walkable' | 'room-unreachable' | 'furniture-outside-floor' | 'duplicate-id';

const hasDuplicates = (ids: readonly string[]): boolean => new Set(ids).size !== ids.length;

/**
 * A published floor plan (World context). Invariants: the layout forms a valid grid, people can only
 * spawn on walkable tiles, and every room can be reached from the spawn points.
 */
export class FloorPlan {
  private constructor(
    readonly props: FloorPlanProps,
    readonly grid: FloorGrid,
  ) {}

  static create(props: FloorPlanProps): Result<FloorPlan, FloorPlanError> {
    if (hasDuplicates(props.rooms.map((room) => room.id)) || hasDuplicates(props.furniture.map((item) => item.id))) {
      return err('duplicate-id');
    }
    const outsideFloor = props.furniture.some((item) => {
      if (!isCatalogueItemId(item.catalogItemId)) return false;
      const { width, depth } = footprintOf(item.catalogItemId, item.rotation);
      return item.x + width > props.width || item.y + depth > props.height;
    });
    if (outsideFloor) return err('furniture-outside-floor');

    const grid = buildFloorGrid(props);
    if (!grid.ok) return grid;

    if (!props.spawnPoints.every((spawn) => grid.value.isWalkable(spawn))) {
      return err('spawn-not-walkable');
    }
    const firstSpawn = props.spawnPoints[0];
    const reachable = firstSpawn ? reachableTiles(grid.value, firstSpawn) : new Set<string>();
    const everyRoomReachable = props.rooms.every((room) =>
      room.areas.some((area) =>
        Array.from({ length: area.width * area.height }, (_, i) => ({
          x: area.x + (i % area.width),
          y: area.y + Math.floor(i / area.width),
        })).some((coord) => reachable.has(tileKey(coord))),
      ),
    );
    if (!everyRoomReachable) return err('room-unreachable');

    return ok(new FloorPlan(props, grid.value));
  }

  get floorId(): string {
    return this.props.floorId;
  }
}
