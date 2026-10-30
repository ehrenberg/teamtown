import { Migration } from '@mikro-orm/migrations';

export class PeopleInitialMigration extends Migration {
  override up(): void {
    this.addSql('create schema if not exists "people";');
    this.addSql(`create table "people"."person" (
      "id" uuid primary key,
      "oidc_subject" varchar(255) not null unique,
      "display_name" varchar(80) not null,
      "avatar_color" varchar(7) not null,
      "created_at" timestamptz not null,
      "updated_at" timestamptz not null
    );`);
  }

  override down(): void {
    this.addSql('drop table if exists "people"."person";');
    this.addSql('drop schema if exists "people";');
  }
}

export const PEOPLE_MIGRATIONS = [{ name: '20261030100000_people_initial', class: PeopleInitialMigration }];
