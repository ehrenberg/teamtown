import { builtInRoles, holds, type RoleAssignment } from '../domain/evaluate.ts';
import type { Permission } from '../domain/permissions.ts';
import type { ScopeRef } from '../domain/scope.ts';
import type { AssignmentRepository } from './ports/assignment-repository.port.ts';
import type { RoleRepository } from './ports/role-repository.port.ts';

/** Whether a person may do something. The only way other contexts learn about rights (ADR-0011). */
export interface AccessPolicy {
  can(personId: string, permission: Permission, resource: ScopeRef): Promise<boolean>;
}

export const ACCESS_POLICY = Symbol('ACCESS_POLICY');

/** Everyone holds Member at town scope without an assignment (ADR-0036); guests will be the exception (M4d). */
const MEMBER: RoleAssignment = { roleId: 'member', scope: 'town' };

/**
 * Evaluates against a person's assignments, kept in memory until they change: `can` runs on many requests and
 * realtime commands, and there is one server process (ADR-0017). Holds no record of what was checked.
 */
export class CachedAccessPolicy implements AccessPolicy {
  readonly #assignments = new Map<string, Promise<RoleAssignment[]>>();
  #customRoles: Promise<ReadonlyMap<string, readonly Permission[]>> | null = null;

  constructor(
    private readonly repository: AssignmentRepository,
    private readonly roles: RoleRepository,
  ) {}

  async can(personId: string, permission: Permission, resource: ScopeRef): Promise<boolean> {
    const [assignments, custom] = await Promise.all([this.#assignmentsOf(personId), this.#customRolesLoaded()]);
    return holds(
      [MEMBER, ...assignments],
      permission,
      resource,
      (roleId) => builtInRoles(roleId) ?? custom.get(roleId),
    );
  }

  /** A role's permissions, built-in or custom; `undefined` for one that doesn't exist. */
  async permissionsOf(roleId: string): Promise<readonly Permission[] | undefined> {
    return builtInRoles(roleId) ?? (await this.#customRolesLoaded()).get(roleId);
  }

  forget(personId: string): void {
    this.#assignments.delete(personId);
  }

  /** A group or role change can touch anyone. */
  forgetAll(): void {
    this.#assignments.clear();
    this.#customRoles = null;
  }

  #customRolesLoaded(): Promise<ReadonlyMap<string, readonly Permission[]>> {
    if (this.#customRoles) return this.#customRoles;
    const loading = this.roles.list().then((roles) => new Map(roles.map((role) => [role.roleId, role.permissions])));
    this.#customRoles = loading;
    loading.catch(() => {
      this.#customRoles = null;
    });
    return loading;
  }

  #assignmentsOf(personId: string): Promise<RoleAssignment[]> {
    const cached = this.#assignments.get(personId);
    if (cached) return cached;
    const loading = this.repository.assignmentsOf(personId);
    this.#assignments.set(personId, loading);
    // A failed load must not stay cached.
    loading.catch(() => {
      this.forget(personId);
    });
    return loading;
  }
}
