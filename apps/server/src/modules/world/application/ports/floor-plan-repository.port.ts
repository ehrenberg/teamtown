import type { FloorPlan } from '../../domain/floor-plan.ts';

export interface FloorPlanRepository {
  list(): Promise<FloorPlan[]>;
  findById(floorId: string): Promise<FloorPlan | null>;
  exists(floorId: string): Promise<boolean>;
  save(plan: FloorPlan): Promise<void>;
}

export const FLOOR_PLAN_REPOSITORY = Symbol('FLOOR_PLAN_REPOSITORY');
