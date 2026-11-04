import { Migration } from '@mikro-orm/migrations';

/** Marks channels whose creator got the Channel Moderator role (M4a, ADR-0036). */
export class MessagingModeratorsMigration extends Migration {
  override up(): void {
    this.addSql('alter table "messaging"."channel" add column "creator_role_assigned" boolean not null default false;');
  }

  override down(): void {
    this.addSql('alter table "messaging"."channel" drop column "creator_role_assigned";');
  }
}
