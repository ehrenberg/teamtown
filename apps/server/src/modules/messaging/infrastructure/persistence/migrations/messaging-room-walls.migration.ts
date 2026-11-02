import { Migration } from '@mikro-orm/migrations';

/** Room-linked channels with titles that need not be unique (M3c, P-16–P-18). */
export class MessagingRoomWallsMigration extends Migration {
  override up(): void {
    this.addSql('drop index if exists "messaging"."channel_name_unique";');
    this.addSql('alter table "messaging"."channel" alter column "name" type varchar(80);');
    this.addSql('alter table "messaging"."channel" add column "floor_id" varchar(63) null;');
    this.addSql('alter table "messaging"."channel" add column "room_id" varchar(63) null;');
    this.addSql(
      `create unique index "channel_name_unique" on "messaging"."channel" ("name")
       where "name" is not null and "kind" in ('public', 'private');`,
    );
    this.addSql(
      `create unique index "channel_room_unique" on "messaging"."channel" ("floor_id", "room_id")
       where "floor_id" is not null and "room_id" is not null;`,
    );
  }

  override down(): void {
    this.addSql('drop index if exists "messaging"."channel_room_unique";');
    this.addSql('drop index if exists "messaging"."channel_name_unique";');
    this.addSql('alter table "messaging"."channel" drop column "room_id";');
    this.addSql('alter table "messaging"."channel" drop column "floor_id";');
    this.addSql('alter table "messaging"."channel" alter column "name" type varchar(40);');
    this.addSql(
      'create unique index "channel_name_unique" on "messaging"."channel" ("name") where "name" is not null;',
    );
  }
}
