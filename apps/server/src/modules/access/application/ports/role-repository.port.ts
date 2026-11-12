import type { CustomRole } from '../../domain/custom-role.ts';

export interface RoleRepository {
  list(): Promise<CustomRole[]>;
  /** `false`: the name is taken. */
  create(role: CustomRole): Promise<boolean>;
  /** `false`: the name is taken. */
  update(role: CustomRole): Promise<boolean>;
  /** Removes the role and its assignments in one go; answers how many assignments went with it. */
  delete(roleId: string): Promise<number>;
  /** The scopes it is assigned at. */
  scopesOf(roleId: string): Promise<string[]>;
}

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
