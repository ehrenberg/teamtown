import { Migration } from '@mikro-orm/migrations';

/** Thread replies, mentions, reactions and thread follows (M3b, ADR-0034). */
export class MessagingThreadsMigration extends Migration {
  override up(): void {
    this.addSql(`alter table "messaging"."message"
      add column "thread_root_id" varchar(64) null references "messaging"."message" ("message_id") on delete cascade,
      add column "also_in_channel" boolean not null default false,
      add column "mentions" uuid[] not null default '{}';`);
    this.addSql(
      'create index "message_thread_order_index" on "messaging"."message" ("thread_root_id", "posted_at", "message_id") where "thread_root_id" is not null;',
    );
    this.addSql(`create table "messaging"."reaction" (
      "message_id" varchar(64) not null references "messaging"."message" ("message_id") on delete cascade,
      "emoji" varchar(64) not null,
      "person_id" uuid not null,
      "reacted_at" timestamptz not null,
      primary key ("message_id", "emoji", "person_id")
    );`);
    this.addSql(`create table "messaging"."thread_follow" (
      "root_message_id" varchar(64) not null references "messaging"."message" ("message_id") on delete cascade,
      "person_id" uuid not null,
      "channel_id" varchar(64) not null,
      "following" boolean not null,
      "read_message_id" varchar(64) null,
      "read_posted_at" timestamptz null,
      primary key ("root_message_id", "person_id")
    );`);
    this.addSql(
      'create index "thread_follow_person_index" on "messaging"."thread_follow" ("person_id") where "following";',
    );
  }

  override down(): void {
    this.addSql('drop table if exists "messaging"."thread_follow";');
    this.addSql('drop table if exists "messaging"."reaction";');
    this.addSql(
      'alter table "messaging"."message" drop column "thread_root_id", drop column "also_in_channel", drop column "mentions";',
    );
  }
}
