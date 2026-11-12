import { err, ok, type IdGenerator, type Result } from '@teamtown/kernel';
import { customRole, customRoleId, isCustomRoleId } from '../domain/custom-role.ts';
import type { Permission } from '../domain/permissions.ts';
import { placeOf, placesFor, type Place } from '../domain/places.ts';
import { BUILT_IN_ROLES } from '../domain/roles.ts';
import { TOWN } from '../domain/scope.ts';
import type { CachedAccessPolicy } from './access-policy.ts';
import type { RoleRepository } from './ports/role-repository.port.ts';

export type CustomRoleError =
  'not-allowed' | 'not-found' | 'invalid-role' | 'role-name-taken' | 'role-assigned-elsewhere' | 'built-in-role';

export interface RoleView {
  readonly roleId: string;
  /** `null` for built-in roles, which the client names. */
  readonly name: string | null;
  readonly permissions: readonly Permission[];
  readonly builtIn: boolean;
  readonly places: readonly Place[];
}

/** The built-in roles an administrator can give; Member and Guest are never assigned here. */
const ASSIGNABLE_BUILT_IN = ['owner', 'admin', 'room-host', 'channel-moderator', 'editor'] as const;

/**
 * Use cases on custom roles (M4b-2). Built-in roles stay fixed (P-39). A change applies at once to everyone holding the
 * role (P-38), so the policy forgets all it knows.
 */
export class AdministerCustomRoles {
  constructor(
    private readonly policy: CachedAccessPolicy,
    private readonly roles: RoleRepository,
    private readonly ids: IdGenerator,
  ) {}

  /** Every role an administrator can give, with where it applies (P-37). */
  async list(): Promise<RoleView[]> {
    const builtIn = ASSIGNABLE_BUILT_IN.map((roleId) => ({
      roleId,
      name: null,
      permissions: BUILT_IN_ROLES[roleId],
      builtIn: true,
      places: placesFor(BUILT_IN_ROLES[roleId]),
    }));
    const custom = (await this.roles.list()).map((role) => ({
      ...role,
      builtIn: false,
      places: placesFor(role.permissions),
    }));
    return [...builtIn, ...custom];
  }

  async create(input: {
    actorId: string;
    name: string;
    permissions: readonly string[];
  }): Promise<Result<string, CustomRoleError>> {
    if (!(await this.#mayManage(input.actorId))) return err('not-allowed');
    const role = customRole({ roleId: customRoleId(this.ids.next()), ...input });
    if (!role.ok) return role;
    if (!(await this.roles.create(role.value))) return err('role-name-taken');
    this.policy.forgetAll();
    return ok(role.value.roleId);
  }

  /** _Proposal within P-38:_ refused while the role is assigned somewhere its new permissions don't apply. */
  async update(input: {
    actorId: string;
    roleId: string;
    name: string;
    permissions: readonly string[];
  }): Promise<Result<void, CustomRoleError>> {
    const known = await this.#known(input.actorId, input.roleId);
    if (!known.ok) return known;
    const role = customRole(input);
    if (!role.ok) return role;
    const places = placesFor(role.value.permissions);
    const inUse = await this.roles.scopesOf(input.roleId);
    if (inUse.some((scope) => !places.includes(placeOf(scope) ?? 'town'))) return err('role-assigned-elsewhere');
    if (!(await this.roles.update(role.value))) return err('role-name-taken');
    this.policy.forgetAll();
    return ok(undefined);
  }

  /** The client asked first, naming how many assignments go with it (P-38). */
  async delete(input: { actorId: string; roleId: string }): Promise<Result<number, CustomRoleError>> {
    const known = await this.#known(input.actorId, input.roleId);
    if (!known.ok) return known;
    const removed = await this.roles.delete(input.roleId);
    this.policy.forgetAll();
    return ok(removed);
  }

  async #known(actorId: string, roleId: string): Promise<Result<void, CustomRoleError>> {
    if (!(await this.#mayManage(actorId))) return err('not-allowed');
    if (!isCustomRoleId(roleId)) return err('built-in-role');
    const exists = (await this.roles.list()).some((role) => role.roleId === roleId);
    return exists ? ok(undefined) : err('not-found');
  }

  #mayManage(actorId: string): Promise<boolean> {
    return this.policy.can(actorId, 'town.roles.manage', TOWN);
  }
}
