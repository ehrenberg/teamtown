import { Migration } from '@mikro-orm/migrations';
import { outboxTableSql } from '../../../../../platform/outbox/outbox.ts';

export class WorldRoomEventsMigration extends Migration {
  override up(): void {
    this.addSql(outboxTableSql('world'));
  }

  override down(): void {
    this.addSql('drop table if exists "world"."outbox";');
  }
}
