import type { FloorPlanProps } from './floor-plan.ts';

export type WorldEvent =
  | { readonly type: 'RoomCreated'; readonly floorId: string; readonly roomId: string; readonly name: string }
  | { readonly type: 'RoomRenamed'; readonly floorId: string; readonly roomId: string; readonly name: string }
  | { readonly type: 'RoomDeleted'; readonly floorId: string; readonly roomId: string };

/** Persistent room lifecycle changes between two published versions of one floor plan. */
export function roomLifecycleEvents(previous: FloorPlanProps | null, next: FloorPlanProps): WorldEvent[] {
  const before = new Map(previous?.rooms.map((room) => [room.id, room]) ?? []);
  const after = new Map(next.rooms.map((room) => [room.id, room]));
  const events: WorldEvent[] = [];

  for (const room of next.rooms) {
    const old = before.get(room.id);
    if (!old) events.push({ type: 'RoomCreated', floorId: next.floorId, roomId: room.id, name: room.name });
    else if (old.name !== room.name) {
      events.push({ type: 'RoomRenamed', floorId: next.floorId, roomId: room.id, name: room.name });
    }
  }
  for (const room of previous?.rooms ?? []) {
    if (!after.has(room.id)) events.push({ type: 'RoomDeleted', floorId: next.floorId, roomId: room.id });
  }
  return events;
}
