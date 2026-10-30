import { describe, expect, it } from 'vitest';
import type { Person } from '../domain/person.ts';
import type { PersonRepository } from './ports/person-repository.port.ts';
import { ResolvePerson } from './resolve-person.ts';

class InMemoryPersonRepository implements PersonRepository {
  readonly saved: Person[] = [];
  readonly #bySubject = new Map<string, Person>();

  findByOidcSubject(subject: string): Promise<Person | null> {
    return Promise.resolve(this.#bySubject.get(subject) ?? null);
  }

  save(person: Person): Promise<void> {
    this.saved.push(person);
    this.#bySubject.set(person.oidcSubject, person);
    return Promise.resolve();
  }
}

const sequentialIds = () => {
  let counter = 0;
  return { next: () => `person-${++counter}` };
};

describe('ResolvePerson', () => {
  it('registers a person on the first login', async () => {
    const repository = new InMemoryPersonRepository();
    const result = await new ResolvePerson(repository, sequentialIds()).execute({
      subject: 'sub-1',
      displayName: 'Lena',
    });

    expect(result).toMatchObject({ ok: true, value: { personId: 'person-1', displayName: 'Lena' } });
    expect(repository.saved).toHaveLength(1);
  });

  it('returns the same person on later logins and only saves real changes', async () => {
    const repository = new InMemoryPersonRepository();
    const resolve = new ResolvePerson(repository, sequentialIds());
    await resolve.execute({ subject: 'sub-1', displayName: 'Lena' });

    const again = await resolve.execute({ subject: 'sub-1', displayName: 'Lena' });
    const renamed = await resolve.execute({ subject: 'sub-1', displayName: 'Lena Hoffmann' });

    expect(again).toMatchObject({ ok: true, value: { personId: 'person-1' } });
    expect(renamed).toMatchObject({ ok: true, value: { personId: 'person-1', displayName: 'Lena Hoffmann' } });
    expect(repository.saved).toHaveLength(2);
  });
});
