import { ACCESS_PERMISSIONS, type Permission } from './permissions.ts';
import { BUILT_IN_ROLES } from './roles.ts';
import { scopeKey, withParents, type ScopeRef } from './scope.ts';

export interface RoleAssignment {
  /** A built-in role or a custom one (`custom-…`). */
  readonly roleId: string;
  /** From `scopeKey`. */
  readonly scope: string;
}

/**
 * Whether any role held at the resource's scope or above contains the permission (permissions.md §1). There is no
 * deny: a private resource only stops `*.read` and `room.enter` from being inherited, so that an explicit assignment
 * there is the only way in. Reading private content is never granted by a town role (ADR-0026).
 */
/** The permissions of a role; `undefined` for one that doesn't exist (any more), which grants nothing. */
export type RoleLookup = (roleId: string) => readonly Permission[] | undefined;

export const builtInRoles: RoleLookup = (roleId) =>
  Object.hasOwn(BUILT_IN_ROLES, roleId) ? BUILT_IN_ROLES[roleId as keyof typeof BUILT_IN_ROLES] : undefined;

export function holds(
  assignments: readonly RoleAssignment[],
  permission: Permission,
  resource: ScopeRef,
  roles: RoleLookup = builtInRoles,
): boolean {
  const isPrivate = 'private' in resource && (resource.private ?? false);
  const scopes =
    isPrivate && ACCESS_PERMISSIONS.has(permission) ? [scopeKey(resource)] : withParents(resource).map(scopeKey);
  return assignments.some(
    (assignment) => scopes.includes(assignment.scope) && (roles(assignment.roleId)?.includes(permission) ?? false),
  );
}
