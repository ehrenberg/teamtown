// The only entry point other modules may import from the World context.
export {
  FloorQueries,
  type FloorSummaryView,
  type PublishedFloorView,
  type RoomView,
} from './application/floor-queries.ts';
export type { DoorMode } from './domain/floor-plan.ts';
export { WorldModule } from './world.module.ts';
