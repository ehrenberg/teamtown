import type { Person } from '../../domain/person.ts';

export interface PersonRepository {
  findByOidcSubject(subject: string): Promise<Person | null>;
  findByIds(ids: readonly string[]): Promise<Person[]>;
  save(person: Person): Promise<void>;
}

export const PERSON_REPOSITORY = Symbol('PERSON_REPOSITORY');
