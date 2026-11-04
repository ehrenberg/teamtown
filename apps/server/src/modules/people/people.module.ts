import { Module } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/postgresql';
import type { IdGenerator } from '@teamtown/kernel';
import { ID_GENERATOR } from '../../platform/config/config.module.ts';
import { PERSON_REPOSITORY, type PersonRepository } from './application/ports/person-repository.port.ts';
import { PeopleQueries } from './application/people-queries.ts';
import { ResolvePerson } from './application/resolve-person.ts';
import { PEOPLE_MIGRATIONS } from './infrastructure/persistence/migrations/people-initial.migration.ts';
import { MikroOrmPersonRepository } from './infrastructure/persistence/mikro-orm-person.repository.ts';
import { PersonEntity } from './infrastructure/persistence/person.entity.ts';
import { MeController } from './interface/http/me.controller.ts';
import { PeopleController } from './interface/http/people.controller.ts';

import { AccessModule, ClaimFirstOwner } from '../access/public-api.ts';
import { SIGN_IN_OBSERVER, type SignInObserver } from './application/ports/sign-in-observer.port.ts';
@Module({
  imports: [AccessModule],
  controllers: [MeController, PeopleController],
  providers: [
    {
      provide: PERSON_REPOSITORY,
      useFactory: (orm: MikroORM) => new MikroOrmPersonRepository(orm),
      inject: [MikroORM],
    },
    {
      provide: SIGN_IN_OBSERVER,
      useFactory: (claim: ClaimFirstOwner): SignInObserver => ({ signedIn: (personId) => claim.execute(personId) }),
      inject: [ClaimFirstOwner],
    },
    {
      provide: ResolvePerson,
      useFactory: (people: PersonRepository, ids: IdGenerator, signIns: SignInObserver) =>
        new ResolvePerson(people, ids, signIns),
      inject: [PERSON_REPOSITORY, ID_GENERATOR, SIGN_IN_OBSERVER],
    },
    {
      provide: PeopleQueries,
      useFactory: (people: PersonRepository) => new PeopleQueries(people),
      inject: [PERSON_REPOSITORY],
    },
  ],
  exports: [ResolvePerson, PeopleQueries],
})
export class PeopleModule {
  static readonly entities = [PersonEntity];
  static readonly migrations = PEOPLE_MIGRATIONS;
}
