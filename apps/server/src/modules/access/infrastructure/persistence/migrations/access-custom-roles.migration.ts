import { Migration } from '@mikro-orm/migrations';

/** Custom roles (M4b-2, P-36–P-39); built-in roles stay in code. */
export class AccessCustomRolesMigration extends Migration {
  override up(): void {
    this.addSql(`create table "access"."custom_role" (
      "role_id" varchar(64) primary key,
      "name" varchar(80) not null unique,
      "permissions" text[] not null
    );`);
  }

  override down(): void {
    this.addSql('drop table if exists "access"."custom_role";');
  }
}
