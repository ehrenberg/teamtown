import type { MikroORM } from '@mikro-orm/postgresql';
import type { AssignmentRepository } from '../../application/ports/assignment-repository.port.ts';
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
