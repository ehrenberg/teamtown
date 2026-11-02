import { Migration } from '@mikro-orm/migrations';

/** Attachments and pinning on messages (M3d, P-19–P-26). */
export class MessagingFilesMigration extends Migration {
  override up(): void {
    this.addSql('alter table "messaging"."message" add column "pinned" boolean not null default false;');
    this.addSql(`create table "messaging"."attachment" (
      "message_id" varchar(64) not null references "messaging"."message" ("message_id") on delete cascade,
      "file_id" varchar(64) not null,
      "order" integer not null,
      "file_name" varchar(255) not null,
      "content_type" varchar(128) not null,
      "byte_size" integer not null,
      "preview_kind" varchar(8) not null,
      primary key ("message_id", "file_id")
    );`);
    this.addSql('create index "attachment_message_order_index" on "messaging"."attachment" ("message_id", "order");');
  }

  override down(): void {
    this.addSql('drop table if exists "messaging"."attachment";');
    this.addSql('alter table "messaging"."message" drop column "pinned";');
  }
}
