/** Which people exist (People context), so that nobody adds unknown IDs to a channel. */
export interface PeopleDirectory {
  /** The given IDs that belong to people. */
  existing(personIds: readonly string[]): Promise<ReadonlySet<string>>;
}

export const PEOPLE_DIRECTORY = Symbol('PEOPLE_DIRECTORY');
