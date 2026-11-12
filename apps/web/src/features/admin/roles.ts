import type { Permission, RoleContract } from '@teamtown/contracts';
import type { TFunction } from 'i18next';

/** Built-in roles are named by the client; custom ones carry their name. */
export const roleLabel = (role: Pick<RoleContract, 'roleId' | 'name'>, t: TFunction): string =>
  role.name ?? t(`admin.role.${role.roleId}`);

/** i18next reads dots as nesting, so a permission's key uses underscores. */
export const permissionLabel = (permission: Permission, t: TFunction): string =>
  t(`admin.permission.${permission.replaceAll('.', '_')}`);

export type Area = 'town' | 'rooms' | 'channels' | 'direct';

/** The catalogue grouped for the role form; `town.owners.manage` stays out of every custom role (P-36). */
export function areaOf(permission: Permission): Area | null {
  if (permission === 'town.owners.manage') return null;
  if (permission === 'dm.start' || permission === 'call.direct') return 'direct';
  if (permission.startsWith('town.') || permission.startsWith('channel.create.')) return 'town';
  if (/^(channel|message|file)\./.test(permission)) return 'channels';
  return 'rooms';
}
