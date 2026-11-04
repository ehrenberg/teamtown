import { UniqueConstraintViolationException, type MikroORM } from '@mikro-orm/postgresql';
import type { GroupRepository, GroupView } from '../../application/ports/group-repository.port.ts';

export class PostgresGroupRepository implements GroupRepository {
  constructor(private readonly orm: MikroORM) {}

  async list(): Promise<GroupView[]> {
    const em = this.orm.em.fork();
    const [groups, members] = await Promise.all([
      em.execute<{ group_id: string; name: string }[]>(
        `select "group_id", "name" from "access"."group" order by "name"`,
      ),
      em.execute<{ group_id: string; person_id: string }[]>(
        `select "group_id", "person_id" from "access"."group_member"`,
      ),
    ]);
    return groups.map((group) => ({
      groupId: group.group_id,
      name: group.name,
      memberIds: members.filter((member) => member.group_id === group.group_id).map((member) => member.person_id),
    }));
  }

  async exists(groupId: string): Promise<boolean> {
    const rows = await this.orm.em
      .fork()
      .execute<unknown[]>(`select 1 from "access"."group" where "group_id" = ?`, [groupId]);
    return rows.length > 0;
  }

  create(groupId: string, name: string): Promise<boolean> {
    return this.#unlessTaken(`insert into "access"."group" ("group_id", "name") values (?, ?)`, [groupId, name]);
  }

  rename(groupId: string, name: string): Promise<boolean> {
    return this.#unlessTaken(`update "access"."group" set "name" = ? where "group_id" = ?`, [name, groupId]);
  }

  delete(groupId: string): Promise<void> {
    return this.orm.em.fork().transactional(async (em) => {
      await em.execute(
        `delete from "access"."role_assignment" where "principal_kind" = 'group' and "principal_id" = ?`,
        [groupId],
      );
      await em.execute(`delete from "access"."group" where "group_id" = ?`, [groupId]);
    });
  }

  async addMember(groupId: string, personId: string): Promise<void> {
    await this.orm.em
      .fork()
      .execute(`insert into "access"."group_member" ("group_id", "person_id") values (?, ?) on conflict do nothing`, [
        groupId,
        personId,
      ]);
  }

  async removeMember(groupId: string, personId: string): Promise<void> {
    await this.orm.em
      .fork()
      .execute(`delete from "access"."group_member" where "group_id" = ? and "person_id" = ?`, [groupId, personId]);
  }

  async #unlessTaken(sql: string, params: readonly string[]): Promise<boolean> {
    try {
      await this.orm.em.fork().execute(sql, [...params]);
      return true;
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) return false;
      throw error;
    }
  }
}
