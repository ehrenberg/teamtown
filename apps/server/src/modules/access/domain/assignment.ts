import { err, ok, type Result } from '@teamtown/kernel';
import type { BuiltInRole } from './roles.ts';

export type AssignableRole = Exclude<BuiltInRole, 'member' | 'guest'>;

export type Principal =
  { readonly kind: 'person'; readonly id: string } | { readonly kind: 'group'; readonly id: string };

export interface Assignment {
  readonly principal: Principal;
  readonly roleId: AssignableRole;
  /** From `scopeKey`. */
  readonly scope: string;
}

const scopeKindOf = (scope: string) => (scope === 'town' ? 'town' : (scope.split(':')[0] ?? ''));

/** Where each role makes sense (docs/features/access-administration.md). */
const ASSIGNABLE_SCOPES: Readonly<Record<AssignableRole, readonly string[]>> = {
  owner: ['town'],
  admin: ['town'],
  editor: ['town', 'floor'],
  'room-host': ['town', 'floor', 'room'],
  'channel-moderator': ['town', 'channel'],
};

/** Owner goes to people only, so that "at least one remains" stays checkable (ADR-0038). */
export function checkAssignable(assignment: Assignment): Result<void, 'role-not-assignable'> {
  const { principal, roleId, scope } = assignment;
  if (roleId === 'owner' && principal.kind !== 'person') return err('role-not-assignable');
  return ASSIGNABLE_SCOPES[roleId].includes(scopeKindOf(scope)) ? ok(undefined) : err('role-not-assignable');
}
