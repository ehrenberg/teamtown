import { err, ok, type Result } from '@teamtown/kernel';
import { PERMISSIONS, type Permission } from './permissions.ts';

const MAX_NAME_LENGTH = 80;
const PREFIX = 'custom-';

export interface CustomRole {
  readonly roleId: string;
  readonly name: string;
  /** In catalogue order, without repeats. */
  readonly permissions: readonly Permission[];
}

export const isCustomRoleId = (roleId: string): boolean => roleId.startsWith(PREFIX);

export const customRoleId = (id: string): string => `${PREFIX}${id}`;

/**
 * A role an Owner or Admin puts together (M4b-2): a name and at least one permission, any but `town.owners.manage`, so
 * that no role hands out the Owner's rights (P-36, ADR-0038).
 */
export function customRole(input: {
  roleId: string;
  name: string;
  permissions: readonly string[];
}): Result<CustomRole, 'invalid-role'> {
  const name = input.name.trim();
  const wanted = new Set(input.permissions);
  const permissions = PERMISSIONS.filter((permission) => wanted.has(permission));
  if (
    !isCustomRoleId(input.roleId) ||
    name.length === 0 ||
    name.length > MAX_NAME_LENGTH ||
    permissions.length === 0 ||
    permissions.length !== wanted.size ||
    wanted.has('town.owners.manage')
  ) {
    return err('invalid-role');
  }
  return ok({ roleId: input.roleId, name, permissions });
}
