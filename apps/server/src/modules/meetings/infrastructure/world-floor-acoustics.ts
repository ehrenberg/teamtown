import type { FloorQueries } from '../../world/public-api.ts';
import type { FloorAcoustics, FloorAcousticsSource } from '../application/ports/floor-acoustics.port.ts';

export class WorldFloorAcoustics implements FloorAcousticsSource {
  constructor(private readonly floors: FloorQueries) {}

  async getFloor(floorId: string): Promise<FloorAcoustics | null> {
    const floor = await this.floors.getPublishedFloor(floorId);
    if (!floor) return null;
    const areas = floor.audioIsolatedAreas;
    return {
      floorId,
      grid: floor.grid,
      isIsolated: ({ x, y }) => {
        const tx = Math.round(x);
        const ty = Math.round(y);
        return areas.some((a) => tx >= a.x && tx < a.x + a.width && ty >= a.y && ty < a.y + a.height);
      },
    };
  }
}
