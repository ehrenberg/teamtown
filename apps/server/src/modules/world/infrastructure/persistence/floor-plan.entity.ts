import { defineEntity, p } from '@mikro-orm/postgresql';
import type { FloorPlanProps } from '../../domain/floor-plan.ts';

/** Persistence record of a published floor plan. The full layout is stored as JSONB. */
export const FloorPlanEntity = defineEntity({
  name: 'FloorPlanRecord',
  schema: 'world',
  tableName: 'floor_plan',
  properties: {
    floorId: p.string().length(64).primary(),
    name: p.string().length(80),
    level: p.integer(),
    version: p.integer(),
    plan: p.json<FloorPlanProps>(),
    publishedAt: p.datetime().onCreate(() => new Date()),
  },
});

export class FloorPlanRecord extends FloorPlanEntity.class {}
FloorPlanEntity.setClass(FloorPlanRecord);
