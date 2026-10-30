import type { FloorQueries } from '../../world/public-api.ts';
import type { FloorDefinition, FloorSource } from '../application/ports/floor-source.port.ts';

/** Adapter: reads published floors from the World context through its public API. */
export class WorldFloorSource implements FloorSource {
  constructor(private readonly floors: FloorQueries) {}

  getFloor(floorId: string): Promise<FloorDefinition | null> {
    return this.floors.getPublishedFloor(floorId);
  }
}
