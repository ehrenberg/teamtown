import { UniqueConstraintViolationException, type MikroORM } from '@mikro-orm/postgresql';
import type { RoleRepository } from '../../application/ports/role-repository.port.ts';
import type { CustomRole } from '../../domain/custom-role.ts';
import type { Permission } from '../../domain/permissions.ts';

export class PostgresRoleRepository implements RoleRepository {
  constructor(private readonly orm: MikroORM) {}

  async list(): Promise<CustomRole[]> {
    const rows = await this.orm.em
      .fork()
      .execute<{ role_id: string; name: string; permissions: string[] }[]>(
        `select "role_id", "name", "permissions" from "access"."custom_role" order by "name"`,
      );
    return rows.map((row) => ({ roleId: row.role_id, name: row.name, permissions: row.permissions as Permission[] }));
  }

  create(role: CustomRole): Promise<boolean> {
    return this.#unlessTaken(
      `insert into "access"."custom_role" ("role_id", "name", "permissions") values (?, ?, array[?]::text[])`,
      [role.roleId, role.name, [...role.permissions]],
    );
  }

  update(role: CustomRole): Promise<boolean> {
    return this.#unlessTaken(
      `update "access"."custom_role" set "name" = ?, "permissions" = array[?]::text[] where "role_id" = ?`,
      [role.name, [...role.permissions], role.roleId],
    );
  }

  delete(roleId: string): Promise<number> {
    return this.orm.em.fork().transactional(async (em) => {
      const removed = await em.execute<{ role_id: string }[]>(
        `delete from "access"."role_assignment" where "role_id" = ? returning "role_id"`,
        [roleId],
      );
      await em.execute(`delete from "access"."custom_role" where "role_id" = ?`, [roleId]);
      return removed.length;
    });
  }

  async scopesOf(roleId: string): Promise<string[]> {
    const rows = await this.orm.em
      .fork()
      .execute<{ scope: string }[]>(`select distinct "scope" from "access"."role_assignment" where "role_id" = ?`, [
        roleId,
      ]);
    return rows.map((row) => row.scope);
  }

  /** MikroORM spreads an array parameter into a list, hence `array[?]` for the permissions. */
  async #unlessTaken(sql: string, params: unknown[]): Promise<boolean> {
    try {
      await this.orm.em.fork().execute(sql, params);
      return true;
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) return false;
      throw error;
    }
  }
}
