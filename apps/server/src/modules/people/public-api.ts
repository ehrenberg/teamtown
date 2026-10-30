// The only entry point other modules may import from the People context.
export { PeopleQueries } from './application/people-queries.ts';
export { ResolvePerson, type IdentityClaims, type PersonView } from './application/resolve-person.ts';
export type { PersonId } from './domain/person.ts';
export { PeopleModule } from './people.module.ts';
