import type { FloorQueries } from '../../world/public-api.ts';
import type { FloorDefinition, FloorSource } from '../application/ports/floor-source.port.ts';

/** Adapter: reads published floors from the World context through its public API. */
export class WorldFloorSource implements FloorSource {
  constructor(private readonly floors: FloorQueries) {}

  async getFloor(floorId: string): Promise<FloorDefinition | null> {
    const floor = await this.floors.getPublishedFloor(floorId);
    if (!floor) return null;
    return {
      floorId: floor.floorId,
      grid: floor.grid,
      spawnPoints: floor.spawnPoints,
      rooms: {
        roomMap: floor.roomMap,
        settings: floor.rooms.map(({ roomId, doorMode, doorModeAdjustable }) => ({
          roomId,
          doorMode,
          doorModeAdjustable,
        })),
      },
    };
  }
}
