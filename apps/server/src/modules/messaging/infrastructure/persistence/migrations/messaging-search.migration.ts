import { Migration } from '@mikro-orm/migrations';

/**
 * Full-text search over messages (M3e, ADR-0024). German and English match inflected forms, `simple` the start of a
 * word while typing. File names split on their separators, so "Angebot-2026.pdf" is found by "angebot" (P-30).
 */
export class MessagingSearchMigration extends Migration {
  override up(): void {
    this.addSql(`alter table "messaging"."message" add column "search_vector" tsvector generated always as (
      to_tsvector('german', "body") || to_tsvector('english', "body") || to_tsvector('simple', "body")
    ) stored;`);
    this.addSql('create index "message_search_index" on "messaging"."message" using gin ("search_vector");');
    this.addSql(`create index "attachment_file_name_search_index" on "messaging"."attachment"
      using gin (to_tsvector('simple', translate("file_name", '._-', '   ')));`);
  }

  override down(): void {
    this.addSql('drop index "messaging"."attachment_file_name_search_index";');
    this.addSql('alter table "messaging"."message" drop column "search_vector";');
  }
}
