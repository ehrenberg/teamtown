import { Migration } from '@mikro-orm/migrations';

/**
 * Adds `audioIsolated` to every room of the stored floor plans (ADR-0031): meeting and focus rooms are isolated,
 * as in the seeds. Plans that already have the field keep their value.
 */
export class WorldAudioIsolationMigration extends Migration {
  override up(): void {
    this.addSql(`update "world"."floor_plan" set "plan" = jsonb_set("plan", '{rooms}', (
      select coalesce(jsonb_agg(
        case when room ? 'audioIsolated' then room
             else room || jsonb_build_object('audioIsolated', room->>'kind' in ('meeting', 'focus')) end
        order by ordinality), '[]'::jsonb)
      from jsonb_array_elements("plan"->'rooms') with ordinality as rooms(room, ordinality)
    ));`);
  }

  override down(): void {
    this.addSql(`update "world"."floor_plan" set "plan" = jsonb_set("plan", '{rooms}', (
      select coalesce(jsonb_agg(room - 'audioIsolated' order by ordinality), '[]'::jsonb)
      from jsonb_array_elements("plan"->'rooms') with ordinality as rooms(room, ordinality)
    ));`);
  }
}
