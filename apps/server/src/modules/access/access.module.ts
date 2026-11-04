import { MikroORM } from '@mikro-orm/postgresql';
import { Module } from '@nestjs/common';
import { ACCESS_POLICY, CachedAccessPolicy } from './application/access-policy.ts';
import { AssignChannelModerator } from './application/assign-channel-moderator.ts';
import { ClaimFirstOwner } from './application/claim-first-owner.ts';
import { ASSIGNMENT_REPOSITORY, type AssignmentRepository } from './application/ports/assignment-repository.port.ts';
import { ACCESS_MIGRATIONS } from './infrastructure/persistence/migrations/access-initial.migration.ts';
import { PostgresAssignmentRepository } from './infrastructure/persistence/postgres-assignment.repository.ts';

/** Roles, assignments and policy evaluation (ADR-0011). Other contexts ask through `AccessPolicy`. */
@Module({
  providers: [
    {
      provide: ASSIGNMENT_REPOSITORY,
      useFactory: (orm: MikroORM) => new PostgresAssignmentRepository(orm),
      inject: [MikroORM],
    },
    {
      provide: CachedAccessPolicy,
      useFactory: (repository: AssignmentRepository) => new CachedAccessPolicy(repository),
      inject: [ASSIGNMENT_REPOSITORY],
    },
    { provide: ACCESS_POLICY, useExisting: CachedAccessPolicy },
    {
      provide: ClaimFirstOwner,
      useFactory: (repository: AssignmentRepository, policy: CachedAccessPolicy) =>
        new ClaimFirstOwner(repository, policy),
      inject: [ASSIGNMENT_REPOSITORY, CachedAccessPolicy],
    },
    {
      provide: AssignChannelModerator,
      useFactory: (repository: AssignmentRepository, policy: CachedAccessPolicy) =>
        new AssignChannelModerator(repository, policy),
      inject: [ASSIGNMENT_REPOSITORY, CachedAccessPolicy],
    },
  ],
  exports: [ACCESS_POLICY, ClaimFirstOwner, AssignChannelModerator],
})
export class AccessModule {
  static readonly migrations = ACCESS_MIGRATIONS;
}
