export interface GroupView {
  readonly groupId: string;
  readonly name: string;
  readonly memberIds: readonly string[];
}

export interface GroupRepository {
  list(): Promise<GroupView[]>;
  exists(groupId: string): Promise<boolean>;
  /** `false`: the name is taken. */
  create(groupId: string, name: string): Promise<boolean>;
  /** `false`: the name is taken. */
  rename(groupId: string, name: string): Promise<boolean>;
  /** Removes its memberships and assignments, too. */
  delete(groupId: string): Promise<void>;
  addMember(groupId: string, personId: string): Promise<void>;
  removeMember(groupId: string, personId: string): Promise<void>;
}

export const GROUP_REPOSITORY = Symbol('GROUP_REPOSITORY');
