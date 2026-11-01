import type { PeopleQueries } from '../../people/public-api.ts';
import type { PeopleDirectory } from '../application/ports/people-directory.port.ts';

/** Asks the People context which IDs belong to people. */
export class PeopleDirectoryAdapter implements PeopleDirectory {
  constructor(private readonly people: PeopleQueries) {}

  async existing(personIds: readonly string[]): Promise<ReadonlySet<string>> {
    return new Set((await this.people.namesOf(personIds)).keys());
  }
}
