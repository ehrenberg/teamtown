import type { FloorPlan } from '@teamtown/contracts';
import { reachableTiles, RoomMap, tileDistance, tileKey, type FloorGrid, type TileCoord } from '@teamtown/world-core';

export interface RoomInfo {
  readonly roomId: string;
  readonly name: string;
  readonly hasDoor: boolean;
  /** Only enclosed rooms without a spawn point can change their door mode (same rule as the server). */
  readonly doorModeAdjustable: boolean;
  readonly audioIsolated: boolean;
}

export interface FloorRooms {
  readonly roomMap: RoomMap;
  readonly rooms: readonly RoomInfo[];
}

export function floorRooms(plan: FloorPlan): FloorRooms {
  const roomMap = RoomMap.build(plan, plan.rooms);
  return {
    roomMap,
    rooms: plan.rooms.map((room) => ({
      roomId: room.id,
      name: room.name,
      hasDoor: roomMap.isEnclosed(room.id),
      doorModeAdjustable: roomMap.isDoorModeAdjustable(room.id, plan.spawnPoints),
      audioIsolated: room.audioIsolated,
    })),
  };
}

/** Where to walk to enter a room: the nearest free tile inside it that can be reached from here. */
export function entryTarget(
  grid: FloorGrid,
  roomMap: RoomMap,
  roomId: string,
  me: TileCoord,
  occupied: readonly TileCoord[],
): TileCoord | null {
  const taken = new Set(occupied.map(tileKey));
  const candidates = [...reachableTiles(grid, me)]
    .filter((key) => !taken.has(key))
    .map((key) => {
      const [x = 0, y = 0] = key.split(',').map(Number);
      return { x, y };
    })
    .filter((tile) => roomMap.roomAt(tile) === roomId);
  candidates.sort((a, b) => tileDistance(a, me) - tileDistance(b, me));
  return candidates[0] ?? null;
}
