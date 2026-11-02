import { Migration } from '@mikro-orm/migrations';
import { WorldAudioIsolationMigration } from './world-audio-isolation.migration.ts';
import { WorldRoomEventsMigration } from './world-room-events.migration.ts';

export class WorldInitialMigration extends Migration {
  override up(): void {
    this.addSql('create schema if not exists "world";');
    this.addSql(`create table "world"."floor_plan" (
      "floor_id" varchar(64) primary key,
      "name" varchar(80) not null,
      "level" int not null,
      "version" int not null,
      "plan" jsonb not null,
      "published_at" timestamptz not null
    );`);
  }

  override down(): void {
    this.addSql('drop table if exists "world"."floor_plan";');
    this.addSql('drop schema if exists "world";');
  }
}

export const WORLD_MIGRATIONS = [
  { name: '20261030100100_world_initial', class: WorldInitialMigration },
  { name: '20261030150000_world_audio_isolation', class: WorldAudioIsolationMigration },
  { name: '20261102205900_world_room_events', class: WorldRoomEventsMigration },
];
