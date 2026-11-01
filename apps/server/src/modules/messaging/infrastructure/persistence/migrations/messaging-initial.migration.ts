import { Migration } from '@mikro-orm/migrations';
import { outboxTableSql } from '../../../../../platform/outbox/outbox.ts';
import { MessagingThreadsMigration } from './messaging-threads.migration.ts';

/** Channels, memberships with read markers, messages, the seed channels and the outbox (M3a, ADR-0033). */
export class MessagingInitialMigration extends Migration {
  override up(): void {
    this.addSql('create schema if not exists "messaging";');
    this.addSql(`create table "messaging"."channel" (
      "channel_id" varchar(64) primary key,
      "kind" varchar(16) not null,
      "name" varchar(40) null,
      "creator_id" uuid null,
      "pair_key" varchar(80) null,
      "archived_at" timestamptz null,
      "created_at" timestamptz not null
    );`);
    this.addSql(
      'create unique index "channel_name_unique" on "messaging"."channel" ("name") where "name" is not null;',
    );
    this.addSql(
      'create unique index "channel_pair_key_unique" on "messaging"."channel" ("pair_key") where "pair_key" is not null;',
    );
    this.addSql(`create table "messaging"."membership" (
      "channel_id" varchar(64) not null references "messaging"."channel" ("channel_id") on delete cascade,
      "person_id" uuid not null,
      "joined_at" timestamptz not null,
      "read_message_id" varchar(64) null,
      "read_posted_at" timestamptz null,
      primary key ("channel_id", "person_id")
    );`);
    this.addSql('create index "membership_person_id_index" on "messaging"."membership" ("person_id");');
    this.addSql(`create table "messaging"."message" (
      "message_id" varchar(64) primary key,
      "channel_id" varchar(64) not null references "messaging"."channel" ("channel_id") on delete cascade,
      "author_id" uuid not null,
      "body" text not null,
      "posted_at" timestamptz not null,
      "edited_at" timestamptz null,
      "deleted_at" timestamptz null
    );`);
    this.addSql(
      'create index "message_channel_order_index" on "messaging"."message" ("channel_id", "posted_at", "message_id");',
    );
    this.addSql('create table "messaging"."seeded_person" ("person_id" uuid primary key);');
    this.addSql(outboxTableSql('messaging'));
    this.addSql(`insert into "messaging"."channel" ("channel_id", "kind", "name", "created_at") values
      ('general', 'public', 'general', now()),
      ('random', 'public', 'random', now());`);
  }

  override down(): void {
    this.addSql('drop schema if exists "messaging" cascade;');
  }
}

export const MESSAGING_MIGRATIONS = [
  { name: '20261101120000_messaging_initial', class: MessagingInitialMigration },
  { name: '20261101200000_messaging_threads', class: MessagingThreadsMigration },
];
