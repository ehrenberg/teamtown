import type { PersonRepository } from './ports/person-repository.port.ts';

/** Read side of the People context for other modules. */
export class PeopleQueries {
  constructor(private readonly people: PersonRepository) {}

  /** Display names by person ID; unknown IDs are left out. */
  async namesOf(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const people = await this.people.findByIds(ids);
    return new Map(people.map((person) => [person.id, person.displayName]));
  }
}
