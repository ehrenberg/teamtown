import type { MikroORM } from '@mikro-orm/postgresql';
import type { PersonRepository } from '../../application/ports/person-repository.port.ts';
import { Person, type PersonId } from '../../domain/person.ts';
import { PersonRecord } from './person.entity.ts';

export class MikroOrmPersonRepository implements PersonRepository {
  constructor(private readonly orm: MikroORM) {}

  async findByOidcSubject(subject: string): Promise<Person | null> {
    const record = await this.orm.em.fork().findOne(PersonRecord, { oidcSubject: subject });
    return record
      ? Person.rehydrate({
          id: record.id as PersonId,
          oidcSubject: record.oidcSubject,
          displayName: record.displayName,
          avatarColor: record.avatarColor,
        })
      : null;
  }

  async findByIds(ids: readonly string[]): Promise<Person[]> {
    if (ids.length === 0) return [];
    const records = await this.orm.em.fork().find(PersonRecord, { id: { $in: [...ids] } });
    return records.map((record) =>
      Person.rehydrate({
        id: record.id as PersonId,
        oidcSubject: record.oidcSubject,
        displayName: record.displayName,
        avatarColor: record.avatarColor,
      }),
    );
  }

  async listAll(): Promise<Person[]> {
    const records = await this.orm.em.fork().find(PersonRecord, {}, { orderBy: { displayName: 'asc' } });
    return records.map((record) =>
      Person.rehydrate({
        id: record.id as PersonId,
        oidcSubject: record.oidcSubject,
        displayName: record.displayName,
        avatarColor: record.avatarColor,
      }),
    );
  }

  async save(person: Person): Promise<void> {
    const em = this.orm.em.fork();
    const record = await em.findOne(PersonRecord, { id: person.id });
    if (record) {
      record.displayName = person.displayName;
    } else {
      em.create(PersonRecord, {
        id: person.id,
        oidcSubject: person.oidcSubject,
        displayName: person.displayName,
        avatarColor: person.avatarColor,
      });
    }
    await em.flush();
  }
}
