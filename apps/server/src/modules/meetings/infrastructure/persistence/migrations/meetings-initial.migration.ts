import { Migration } from '@mikro-orm/migrations';

/** Logged meetings (ADR-0026/0027): the only table of the Meetings context. */
export class MeetingsInitialMigration extends Migration {
  override up(): void {
    this.addSql('create schema if not exists "meetings";');
    this.addSql(`create table "meetings"."meeting_log" (
      "meeting_id" varchar(64) primary key,
      "floor_id" varchar(64) not null,
      "room_id" varchar(64) not null,
      "title" varchar(120) not null,
      "host_id" uuid not null,
      "consents" jsonb not null,
      "started_at" timestamptz not null,
      "ended_at" timestamptz null,
      "expires_at" timestamptz not null
    );`);
    this.addSql('create index "meeting_log_expires_at_index" on "meetings"."meeting_log" ("expires_at");');
    this.addSql('create index "meeting_log_consents_index" on "meetings"."meeting_log" using gin ("consents");');
  }

  override down(): void {
    this.addSql('drop table if exists "meetings"."meeting_log";');
    this.addSql('drop schema if exists "meetings";');
  }
}

export const MEETINGS_MIGRATIONS = [{ name: '20261030200000_meetings_initial', class: MeetingsInitialMigration }];
