import { Migration } from '@mikro-orm/migrations';

/** Uploads in temporary storage until a message claims them, or they expire after 24 hours (M3d, P-19–P-23). */
export class FilesInitialMigration extends Migration {
  override up(): void {
    this.addSql('create schema if not exists "files";');
    this.addSql(`create table "files"."upload" (
      "upload_id" varchar(64) primary key,
      "uploader_id" uuid not null,
      "file_name" varchar(255) not null,
      "content_type" varchar(128) not null,
      "byte_size" integer not null,
      "storage_key" varchar(255) not null,
      "status" varchar(16) not null,
      "claimed_by_message_id" varchar(64) null,
      "created_at" timestamptz not null,
      "expires_at" timestamptz not null
    );`);
    this.addSql('create index "upload_expiry_index" on "files"."upload" ("status", "expires_at");');
    this.addSql('create index "upload_claimed_by_message_index" on "files"."upload" ("claimed_by_message_id");');
  }

  override down(): void {
    this.addSql('drop schema if exists "files" cascade;');
  }
}

export const FILES_MIGRATIONS = [{ name: '20261102220000_files_initial', class: FilesInitialMigration }];
