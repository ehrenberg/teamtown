import type { FloorPlan } from '@teamtown/contracts';
import { RoomMap, tilesBesideDoor } from '@teamtown/world-core';

export interface DoorOpening {
  /** Centre of the door edge in continuous tile coordinates. */
  readonly x: number;
  readonly y: number;
  /** Whether the door lies on a horizontal grid line (between two rows). */
  readonly horizontal: boolean;
}

export interface RoomDoorGroup {
  readonly roomId: string;
  readonly openings: readonly DoorOpening[];
  /** Where the room's door sign hangs: the centre of all its door openings. */
  readonly sign: { readonly x: number; readonly y: number };
}

/** The doors of every room whose door mode can change, grouped per room. */
export function adjustableRoomDoors(plan: FloorPlan): RoomDoorGroup[] {
  const roomMap = RoomMap.build(plan, plan.rooms);
  const groups = new Map<string, DoorOpening[]>();
  for (const door of plan.doors) {
    const [a, b] = tilesBesideDoor(door);
    const opening = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, horizontal: a.x === b.x };
    for (const roomId of new Set([roomMap.roomAt(a), roomMap.roomAt(b)])) {
      if (roomId === null || !roomMap.isDoorModeAdjustable(roomId, plan.spawnPoints)) continue;
      groups.set(roomId, [...(groups.get(roomId) ?? []), opening]);
    }
  }
  return [...groups].map(([roomId, openings]) => ({
    roomId,
    openings,
    sign: {
      x: openings.reduce((sum, o) => sum + o.x, 0) / openings.length,
      y: openings.reduce((sum, o) => sum + o.y, 0) / openings.length,
    },
  }));
}
