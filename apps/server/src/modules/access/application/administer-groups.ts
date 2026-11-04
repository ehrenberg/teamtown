import { err, ok, type IdGenerator, type Result } from '@teamtown/kernel';
import { groupName } from '../domain/group-name.ts';
import { TOWN } from '../domain/scope.ts';
import type { AccessPolicy, CachedAccessPolicy } from './access-policy.ts';
import type { AssignmentRepository } from './ports/assignment-repository.port.ts';
import type { GroupRepository, GroupView } from './ports/group-repository.port.ts';
import type { Assignment } from '../domain/assignment.ts';

export type GroupError = 'not-allowed' | 'not-found' | 'invalid-group-name' | 'group-name-taken';

/** Use case: everything the administration view shows; names of people and places live in their own contexts. */
export class GetAccessOverview {
  constructor(
    private readonly access: AccessPolicy,
    private readonly assignments: AssignmentRepository,
    private readonly groups: GroupRepository,
  ) {}

  async execute(actorId: string): Promise<Result<{ assignments: Assignment[]; groups: GroupView[] }, 'not-allowed'>> {
    if (!(await this.access.can(actorId, 'town.roles.manage', TOWN))) return err('not-allowed');
    const [assignments, groups] = await Promise.all([this.assignments.listAll(), this.groups.list()]);
    return ok({ assignments, groups });
  }
}

/**
 * Use cases on groups (ADR-0036). One class, since each is a permission check around one repository call. Any change
 * may change what the members hold, so the policy forgets everyone.
 */
export class AdministerGroups {
  constructor(
    private readonly policy: CachedAccessPolicy,
    private readonly groups: GroupRepository,
    private readonly ids: IdGenerator,
  ) {}

  async create(input: { actorId: string; name: string }): Promise<Result<string, GroupError>> {
    const allowed = await this.#check(input.actorId);
    if (!allowed.ok) return allowed;
    const name = groupName(input.name);
    if (!name.ok) return name;
    const groupId = this.ids.next();
    return (await this.groups.create(groupId, name.value)) ? ok(groupId) : err('group-name-taken');
  }

  async rename(input: { actorId: string; groupId: string; name: string }): Promise<Result<void, GroupError>> {
    const allowed = await this.#check(input.actorId, input.groupId);
    if (!allowed.ok) return allowed;
    const name = groupName(input.name);
    if (!name.ok) return name;
    return (await this.groups.rename(input.groupId, name.value)) ? ok(undefined) : err('group-name-taken');
  }

  async delete(input: { actorId: string; groupId: string }): Promise<Result<void, GroupError>> {
    const allowed = await this.#check(input.actorId, input.groupId);
    if (!allowed.ok) return allowed;
    await this.groups.delete(input.groupId);
    this.policy.forgetAll();
    return ok(undefined);
  }

  async setMember(input: {
    actorId: string;
    groupId: string;
    personId: string;
    member: boolean;
  }): Promise<Result<void, GroupError>> {
    const allowed = await this.#check(input.actorId, input.groupId);
    if (!allowed.ok) return allowed;
    if (input.member) await this.groups.addMember(input.groupId, input.personId);
    else await this.groups.removeMember(input.groupId, input.personId);
    this.policy.forgetAll();
    return ok(undefined);
  }

  async #check(actorId: string, groupId?: string): Promise<Result<void, GroupError>> {
    if (!(await this.policy.can(actorId, 'town.roles.manage', TOWN))) return err('not-allowed');
    if (groupId !== undefined && !(await this.groups.exists(groupId))) return err('not-found');
    return ok(undefined);
  }
}
