import { edgeKeyOf, edgesOf, tilesOf, type Door, type FloorLayout, type Rect } from './floor-layout.ts';
import { neighbourOn, tileKey, type Side, type TileCoord } from './tile.ts';

/** The areas a room covers; matches the rooms of the `FloorPlan` contract. */
export interface RoomArea {
  readonly id: string;
  readonly areas: readonly Rect[];
}

/** Decides whether a single step between adjacent tiles is allowed, on top of walls and furniture. */
export type StepGuard = (from: TileCoord, to: TileCoord) => boolean;

const SIDES: readonly Side[] = ['north', 'east', 'south', 'west'];

/** Which room each tile belongs to, and which rooms can only be entered through doors. */
export class RoomMap {
  private constructor(
    private readonly roomOfTile: ReadonlyMap<string, string>,
    private readonly enclosed: ReadonlySet<string>,
  ) {}

  static build(layout: FloorLayout, rooms: readonly RoomArea[]): RoomMap {
    const roomOfTile = new Map<string, string>();
    for (const room of rooms) {
      for (const coord of room.areas.flatMap(tilesOf)) roomOfTile.set(tileKey(coord), room.id);
    }

    const floorTiles = new Set(layout.floorAreas.flatMap(tilesOf).map(tileKey));
    // Doors sit on walls, so a wall edge is either closed or a door; both count as an enclosed border.
    const wallEdges = new Set(
      layout.walls.flatMap((wall) => {
        const edges = edgesOf(wall);
        return edges.ok ? edges.value.map(({ tile, side }) => edgeKeyOf({ ...tile, side })) : [];
      }),
    );

    const enclosed = new Set<string>();
    for (const room of rooms) {
      const hasOpenBorder = room.areas.flatMap(tilesOf).some((coord) =>
        SIDES.some((side) => {
          const neighbour = neighbourOn(coord, side);
          const crossesBorder = floorTiles.has(tileKey(neighbour)) && roomOfTile.get(tileKey(neighbour)) !== room.id;
          return crossesBorder && !wallEdges.has(edgeKeyOf({ ...coord, side }));
        }),
      );
      if (!hasOpenBorder) enclosed.add(room.id);
    }
    return new RoomMap(roomOfTile, enclosed);
  }

  roomAt(coord: TileCoord): string | null {
    return this.roomOfTile.get(tileKey(coord)) ?? null;
  }

  isEnclosed(roomId: string): boolean {
    return this.enclosed.has(roomId);
  }

  /**
   * Only rooms that can be entered through doors alone and have no spawn point may be closed, so nobody is
   * placed inside a closed room or locked out of the floor (M2b).
   */
  isDoorModeAdjustable(roomId: string, spawnPoints: readonly TileCoord[]): boolean {
    return this.isEnclosed(roomId) && !spawnPoints.some((spawn) => this.roomAt(spawn) === roomId);
  }

  /** Forbids steps into another room unless `mayEnter` allows it. Moving inside a room or leaving it is always allowed. */
  entryGuard(mayEnter: (roomId: string) => boolean): StepGuard {
    return (from, to) => {
      const target = this.roomAt(to);
      return target === null || target === this.roomAt(from) || mayEnter(target);
    };
  }
}

/** The two tiles a door connects: the door's own tile and its neighbour on the door's side, in reading order. */
export function tilesBesideDoor(door: Door): readonly [TileCoord, TileCoord] {
  const own = { x: door.x, y: door.y };
  const other = neighbourOn(own, door.side);
  return door.side === 'north' || door.side === 'west' ? [other, own] : [own, other];
}
