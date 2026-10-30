import { Controller, Get, Inject, NotFoundException, Param, UseGuards } from '@nestjs/common';
import type { FloorListResponse, FloorPlan } from '@teamtown/contracts';
import { AuthGuard } from '../../../identity/public-api.ts';
import { FloorQueries } from '../../application/floor-queries.ts';

@Controller('floors')
@UseGuards(AuthGuard)
export class FloorsController {
  constructor(@Inject(FloorQueries) private readonly floors: FloorQueries) {}

  @Get()
  async list(): Promise<FloorListResponse> {
    return { floors: await this.floors.listFloors() };
  }

  @Get(':floorId/plan')
  async plan(@Param('floorId') floorId: string): Promise<FloorPlan> {
    const plan = await this.floors.getFloorPlan(floorId);
    if (!plan) {
      throw new NotFoundException();
    }
    // The domain props are structurally the contract; copy readonly arrays into the response type.
    return structuredClone(plan) as FloorPlan;
  }
}
