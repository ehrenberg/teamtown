import { err, idFactory, ok, type IdGenerator, type Result } from '@teamtown/kernel';
import { Person, type DisplayNameError, type PersonId } from '../domain/person.ts';
import type { PersonRepository } from './ports/person-repository.port.ts';

/** What other contexts may know about a person. */
export interface PersonView {
  readonly personId: PersonId;
  readonly displayName: string;
  readonly avatarColor: string;
}

export interface IdentityClaims {
  readonly subject: string;
  readonly displayName: string;
}

/**
 * Use case: find the person behind an authenticated identity, creating the profile on the first login
 * and keeping the display name in sync with the identity provider.
 */
export class ResolvePerson {
  readonly #ids: ReturnType<typeof idFactory<'Person'>>;

  constructor(
    private readonly people: PersonRepository,
    idGenerator: IdGenerator,
  ) {
    this.#ids = idFactory<'Person'>(idGenerator);
  }

  async execute(identity: IdentityClaims): Promise<Result<PersonView, DisplayNameError>> {
    const existing = await this.people.findByOidcSubject(identity.subject);
    if (existing) {
      if (existing.syncDisplayName(identity.displayName)) {
        await this.people.save(existing);
      }
      return ok(toView(existing));
    }

    const registered = Person.register({
      id: this.#ids.generate(),
      oidcSubject: identity.subject,
      displayName: identity.displayName,
    });
    if (!registered.ok) return err(registered.error);
    await this.people.save(registered.value);
    return ok(toView(registered.value));
  }
}

const toView = (person: Person): PersonView => ({
  personId: person.id,
  displayName: person.displayName,
  avatarColor: person.avatarColor,
});
