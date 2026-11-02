import type { FloorQueries } from '../../world/public-api.ts';
import type { RoomDescriptor, RoomDirectory } from '../application/ports/room-directory.port.ts';

export class WorldRoomDirectoryAdapter implements RoomDirectory {
  constructor(private readonly floors: FloorQueries) {}

  async listRooms(): Promise<RoomDescriptor[]> {
    const result: RoomDescriptor[] = [];
    for (const floor of await this.floors.listFloors()) {
      const plan = await this.floors.getFloorPlan(floor.floorId);
      if (!plan) continue;
      result.push(...plan.rooms.map((room) => ({ floorId: floor.floorId, roomId: room.id, name: room.name })));
    }
    return result;
  }
}
