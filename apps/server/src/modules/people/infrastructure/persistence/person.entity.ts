import { defineEntity, p } from '@mikro-orm/postgresql';

/** Persistence record of a person. Mapped to/from the domain `Person` in the repository. */
export const PersonEntity = defineEntity({
  name: 'PersonRecord',
  schema: 'people',
  tableName: 'person',
  properties: {
    id: p.uuid().primary(),
    oidcSubject: p.string().length(255).unique(),
    displayName: p.string().length(80),
    avatarColor: p.string().length(7),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p
      .datetime()
      .onCreate(() => new Date())
      .onUpdate(() => new Date()),
  },
});

export class PersonRecord extends PersonEntity.class {}
PersonEntity.setClass(PersonRecord);
