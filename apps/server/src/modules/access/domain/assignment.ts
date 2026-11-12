import { err, ok, type Result } from '@teamtown/kernel';
import type { Permission } from './permissions.ts';
import { placeOf, placesFor } from './places.ts';

export type Principal =
  { readonly kind: 'person'; readonly id: string } | { readonly kind: 'group'; readonly id: string };

export interface Assignment {
  readonly principal: Principal;
  /** A built-in role but Member and Guest, or a custom one. */
  readonly roleId: string;
  /** From `scopeKey`. */
  readonly scope: string;
}

/**
 * Whether a role may be given like this: Member and Guest are never assigned here, Owner goes to people only so that
 * "at least one remains" stays checkable (ADR-0038), and the scope must be a place the role's permissions apply to
 * (P-37). `permissions` is `undefined` for a role that doesn't exist.
 */
export function checkAssignable(
  assignment: Assignment,
  permissions: readonly Permission[] | undefined,
): Result<void, 'role-not-assignable'> {
  const { principal, roleId, scope } = assignment;
  if (!permissions || roleId === 'member' || roleId === 'guest') return err('role-not-assignable');
  if (roleId === 'owner' && principal.kind !== 'person') return err('role-not-assignable');
  const place = placeOf(scope);
  return place !== null && placesFor(permissions).includes(place) ? ok(undefined) : err('role-not-assignable');
}
