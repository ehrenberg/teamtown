import type { RoleAssignment } from '../../domain/evaluate.ts';

export interface AssignmentRepository {
  /** The person's own assignments and those of their groups. */
  assignmentsOf(personId: string): Promise<RoleAssignment[]>;
  /** Idempotent. */
  assignToPerson(personId: string, assignment: RoleAssignment): Promise<void>;
  /** Makes the person the town's first Owner, unless someone already is; answers whether they are now. */
  claimOwner(personId: string): Promise<boolean>;
}

export const ASSIGNMENT_REPOSITORY = Symbol('ASSIGNMENT_REPOSITORY');
