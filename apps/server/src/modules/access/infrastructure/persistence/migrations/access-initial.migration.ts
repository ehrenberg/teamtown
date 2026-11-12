import { Migration } from '@mikro-orm/migrations';
import { AccessCustomRolesMigration } from './access-custom-roles.migration.ts';

/** Role assignments, groups and the first Owner (M4a, ADR-0011, ADR-0036). Custom roles add their tables in M4b. */
export class AccessInitialMigration extends Migration {
  override up(): void {
    this.addSql('create schema if not exists "access";');
    this.addSql(`create table "access"."role_assignment" (
      "principal_kind" varchar(8) not null check ("principal_kind" in ('person', 'group')),
      "principal_id" varchar(64) not null,
      "role_id" varchar(64) not null,
      "scope" varchar(200) not null,
      primary key ("principal_kind", "principal_id", "role_id", "scope")
    );`);
    this.addSql(`create table "access"."group" (
      "group_id" varchar(64) primary key,
      "name" varchar(80) not null unique
    );`);
    this.addSql(`create table "access"."group_member" (
      "group_id" varchar(64) not null references "access"."group" ("group_id") on delete cascade,
      "person_id" uuid not null,
      primary key ("group_id", "person_id")
    );`);
    this.addSql('create index "group_member_person_index" on "access"."group_member" ("person_id");');
    // At most one row: whoever inserts it first is the first Owner, also at the same moment.
    this.addSql(`create table "access"."first_owner" (
      "only_row" boolean primary key default true check ("only_row"),
      "person_id" uuid not null,
      "claimed_at" timestamptz not null default now()
    );`);
  }

  override down(): void {
    this.addSql('drop schema if exists "access" cascade;');
  }
}

export const ACCESS_MIGRATIONS = [
  { name: '20261104180000_access_initial', class: AccessInitialMigration },
  { name: '20261112120000_access_custom_roles', class: AccessCustomRolesMigration },
];
