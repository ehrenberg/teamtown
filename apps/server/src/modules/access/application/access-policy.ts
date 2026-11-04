import { holds, type RoleAssignment } from '../domain/evaluate.ts';
import type { Permission } from '../domain/permissions.ts';
import type { ScopeRef } from '../domain/scope.ts';
import type { AssignmentRepository } from './ports/assignment-repository.port.ts';

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

  constructor(private readonly repository: AssignmentRepository) {}

  async can(personId: string, permission: Permission, resource: ScopeRef): Promise<boolean> {
    return holds([MEMBER, ...(await this.#assignmentsOf(personId))], permission, resource);
  }

  forget(personId: string): void {
    this.#assignments.delete(personId);
  }

  /** A group or role change can touch anyone. */
  forgetAll(): void {
    this.#assignments.clear();
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
