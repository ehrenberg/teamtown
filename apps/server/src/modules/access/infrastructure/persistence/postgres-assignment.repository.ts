import type { MikroORM } from '@mikro-orm/postgresql';
import type { AssignmentRepository } from '../../application/ports/assignment-repository.port.ts';
import type { Assignment } from '../../domain/assignment.ts';
import type { RoleAssignment } from '../../domain/evaluate.ts';
import type { BuiltInRole } from '../../domain/roles.ts';

const INSERT_ASSIGNMENT = `insert into "access"."role_assignment" ("principal_kind", "principal_id", "role_id", "scope")
  values ('person', ?, ?, ?) on conflict do nothing`;

export class PostgresAssignmentRepository implements AssignmentRepository {
  constructor(private readonly orm: MikroORM) {}

  async assignmentsOf(personId: string): Promise<RoleAssignment[]> {
    const rows = await this.orm.em.fork().execute<{ role_id: string; scope: string }[]>(
      `select a."role_id", a."scope" from "access"."role_assignment" a
        where (a."principal_kind" = 'person' and a."principal_id" = ?)
           or (a."principal_kind" = 'group' and a."principal_id" in (
                select m."group_id" from "access"."group_member" m where m."person_id" = ?))`,
      [personId, personId],
    );
    return rows.map((row) => ({ roleId: row.role_id as BuiltInRole, scope: row.scope }));
  }

  async assignToPerson(personId: string, assignment: RoleAssignment): Promise<void> {
    await this.orm.em.fork().execute(INSERT_ASSIGNMENT, [personId, assignment.roleId, assignment.scope]);
  }

  async listAll(): Promise<Assignment[]> {
    const rows = await this.orm.em
      .fork()
      .execute<{ principal_kind: string; principal_id: string; role_id: string; scope: string }[]>(
        `select "principal_kind", "principal_id", "role_id", "scope" from "access"."role_assignment"`,
      );
    return rows.map((row) => ({
      principal: { kind: row.principal_kind as Assignment['principal']['kind'], id: row.principal_id },
      roleId: row.role_id as Assignment['roleId'],
      scope: row.scope,
    }));
  }

  async assign({ principal, roleId, scope }: Assignment): Promise<void> {
    await this.orm.em.fork().execute(
      `insert into "access"."role_assignment" ("principal_kind", "principal_id", "role_id", "scope")
       values (?, ?, ?, ?) on conflict do nothing`,
      [principal.kind, principal.id, roleId, scope],
    );
  }

  async revoke({ principal, roleId, scope }: Assignment): Promise<void> {
    await this.orm.em.fork().execute(
      `delete from "access"."role_assignment"
        where "principal_kind" = ? and "principal_id" = ? and "role_id" = ? and "scope" = ?`,
      [principal.kind, principal.id, roleId, scope],
    );
  }

  revokeOwner(personId: string): Promise<boolean> {
    return this.orm.em.fork().transactional(async (em) => {
      // Locks every Owner row, so that two Owners removing each other run one after the other.
      const owners = await em.execute<{ principal_id: string }[]>(
        `select "principal_id" from "access"."role_assignment" where "role_id" = 'owner' for update`,
      );
      if (!owners.some((owner) => owner.principal_id === personId)) return true;
      if (owners.length <= 1) return false;
      await em.execute(`delete from "access"."role_assignment" where "role_id" = 'owner' and "principal_id" = ?`, [
        personId,
      ]);
      return true;
    });
  }

  claimOwner(personId: string): Promise<boolean> {
    return this.orm.em.fork().transactional(async (em) => {
      const claimed = await em.execute<{ person_id: string }[]>(
        `insert into "access"."first_owner" ("person_id") values (?) on conflict do nothing returning "person_id"`,
        [personId],
      );
      if (claimed.length === 0) return false;
      await em.execute(INSERT_ASSIGNMENT, [personId, 'owner', 'town']);
      return true;
    });
  }
}
