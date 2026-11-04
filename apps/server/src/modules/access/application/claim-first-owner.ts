import type { CachedAccessPolicy } from './access-policy.ts';
import type { AssignmentRepository } from './ports/assignment-repository.port.ts';

/**
 * Use case: the first person to sign in becomes the town's Owner (ADR-0036). Runs on every sign-in, so it stops
 * asking the database once the question is settled; the database decides between two people at the same moment.
 */
export class ClaimFirstOwner {
  #settled = false;

  constructor(
    private readonly repository: AssignmentRepository,
    private readonly policy: CachedAccessPolicy,
  ) {}

  async execute(personId: string): Promise<void> {
    if (this.#settled) return;
    const won = await this.repository.claimOwner(personId);
    this.#settled = true;
    if (won) this.policy.forget(personId);
  }
}
