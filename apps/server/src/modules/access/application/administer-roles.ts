import { err, ok, type Result } from '@teamtown/kernel';
import { checkAssignable, type Assignment } from '../domain/assignment.ts';
import { TOWN } from '../domain/scope.ts';
import type { AccessPolicy, CachedAccessPolicy } from './access-policy.ts';
import type { AssignmentRepository } from './ports/assignment-repository.port.ts';

export type AdministerRoleError = 'not-allowed' | 'role-not-assignable' | 'last-owner';

/** Use case: who may administer what, for the client (ADR-0038). */
export class GetMyAccess {
  constructor(private readonly access: AccessPolicy) {}

  async execute(personId: string): Promise<{ canManageRoles: boolean; canManageOwners: boolean }> {
    const [canManageRoles, canManageOwners] = await Promise.all([
      this.access.can(personId, 'town.roles.manage', TOWN),
      this.access.can(personId, 'town.owners.manage', TOWN),
    ]);
    return { canManageRoles, canManageOwners };
  }
}

async function mayChange(access: AccessPolicy, actorId: string, assignment: Assignment): Promise<boolean> {
  const needed = assignment.roleId === 'owner' ? 'town.owners.manage' : 'town.roles.manage';
  return access.can(actorId, needed, TOWN);
}

/** Use case: an Admin or Owner gives a role; only Owners give Owner (ADR-0038). */
export class AssignRole {
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly policy: CachedAccessPolicy,
  ) {}

  async execute(input: { actorId: string; assignment: Assignment }): Promise<Result<void, AdministerRoleError>> {
    if (!(await mayChange(this.policy, input.actorId, input.assignment))) return err('not-allowed');
    const assignable = checkAssignable(input.assignment);
    if (!assignable.ok) return assignable;
    await this.assignments.assign(input.assignment);
    this.policy.forgetAll();
    return ok(undefined);
  }
}

/** Use case: an Admin or Owner takes a role back; a town keeps at least one Owner (ADR-0038). */
export class RevokeRole {
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly policy: CachedAccessPolicy,
  ) {}

  async execute(input: { actorId: string; assignment: Assignment }): Promise<Result<void, AdministerRoleError>> {
    if (!(await mayChange(this.policy, input.actorId, input.assignment))) return err('not-allowed');
    const { assignment } = input;
    if (assignment.roleId === 'owner' && assignment.principal.kind === 'person') {
      const removed = await this.assignments.revokeOwner(assignment.principal.id);
      if (!removed) return err('last-owner');
    } else {
      await this.assignments.revoke(assignment);
    }
    this.policy.forgetAll();
    return ok(undefined);
  }
}
