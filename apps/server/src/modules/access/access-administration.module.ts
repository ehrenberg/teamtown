import { MikroORM } from '@mikro-orm/postgresql';
import { Module } from '@nestjs/common';
import type { IdGenerator } from '@teamtown/kernel';
import { ID_GENERATOR } from '../../platform/config/config.module.ts';
import { PeopleModule } from '../people/public-api.ts';
import { AccessModule } from './access.module.ts';
import { CachedAccessPolicy } from './application/access-policy.ts';
import { AdministerGroups, GetAccessOverview } from './application/administer-groups.ts';
import { AssignRole, GetMyAccess, RevokeRole } from './application/administer-roles.ts';
import { ASSIGNMENT_REPOSITORY, type AssignmentRepository } from './application/ports/assignment-repository.port.ts';
import { GROUP_REPOSITORY, type GroupRepository } from './application/ports/group-repository.port.ts';
import { PostgresGroupRepository } from './infrastructure/persistence/postgres-group.repository.ts';
import { AccessController } from './interface/http/access.controller.ts';

/**
 * The administration of roles and groups (M4b-1). Apart from `AccessModule` and not in `public-api.ts`: its controller
 * needs People to know who is asking, and People needs `AccessModule` to report sign-ins.
 */
@Module({
  imports: [AccessModule, PeopleModule],
  controllers: [AccessController],
  providers: [
    {
      provide: GROUP_REPOSITORY,
      useFactory: (orm: MikroORM) => new PostgresGroupRepository(orm),
      inject: [MikroORM],
    },
    {
      provide: GetMyAccess,
      useFactory: (policy: CachedAccessPolicy) => new GetMyAccess(policy),
      inject: [CachedAccessPolicy],
    },
    {
      provide: GetAccessOverview,
      useFactory: (policy: CachedAccessPolicy, assignments: AssignmentRepository, groups: GroupRepository) =>
        new GetAccessOverview(policy, assignments, groups),
      inject: [CachedAccessPolicy, ASSIGNMENT_REPOSITORY, GROUP_REPOSITORY],
    },
    {
      provide: AssignRole,
      useFactory: (assignments: AssignmentRepository, policy: CachedAccessPolicy) =>
        new AssignRole(assignments, policy),
      inject: [ASSIGNMENT_REPOSITORY, CachedAccessPolicy],
    },
    {
      provide: RevokeRole,
      useFactory: (assignments: AssignmentRepository, policy: CachedAccessPolicy) =>
        new RevokeRole(assignments, policy),
      inject: [ASSIGNMENT_REPOSITORY, CachedAccessPolicy],
    },
    {
      provide: AdministerGroups,
      useFactory: (policy: CachedAccessPolicy, groups: GroupRepository, ids: IdGenerator) =>
        new AdministerGroups(policy, groups, ids),
      inject: [CachedAccessPolicy, GROUP_REPOSITORY, ID_GENERATOR],
    },
  ],
})
export class AccessAdministrationModule {}
