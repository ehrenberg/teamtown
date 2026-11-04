import type { Assignment } from '../../domain/assignment.ts';
import type { RoleAssignment } from '../../domain/evaluate.ts';

export interface AssignmentRepository {
  /** The person's own assignments and those of their groups. */
  assignmentsOf(personId: string): Promise<RoleAssignment[]>;
  /** Idempotent. */
  assignToPerson(personId: string, assignment: RoleAssignment): Promise<void>;
  listAll(): Promise<Assignment[]>;
  /** Idempotent. */
  assign(assignment: Assignment): Promise<void>;
  /** Idempotent. */
  revoke(assignment: Assignment): Promise<void>;
  /** Takes Owner from the person unless they are the last one, also if two try at the same moment; answers whether. */
  revokeOwner(personId: string): Promise<boolean>;
  /** Makes the person the town's first Owner, unless someone already is; answers whether they are now. */
  claimOwner(personId: string): Promise<boolean>;
}

export const ASSIGNMENT_REPOSITORY = Symbol('ASSIGNMENT_REPOSITORY');
