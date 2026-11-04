import { scopeKey } from '../domain/scope.ts';
import type { CachedAccessPolicy } from './access-policy.ts';
import type { AssignmentRepository } from './ports/assignment-repository.port.ts';

/** Use case: makes a channel's creator its Channel Moderator (ADR-0033, ADR-0036). Idempotent. */
export class AssignChannelModerator {
  constructor(
    private readonly repository: AssignmentRepository,
    private readonly policy: CachedAccessPolicy,
  ) {}

  async execute(input: { personId: string; channelId: string }): Promise<void> {
    const scope = scopeKey({ kind: 'channel', channelId: input.channelId });
    await this.repository.assignToPerson(input.personId, { roleId: 'channel-moderator', scope });
    this.policy.forget(input.personId);
  }
}
