import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { ModeratorAssignment } from './ports/moderator-assignment.port.ts';

/**
 * Use case: makes the creators of existing channels their Channel Moderators, once per channel (ADR-0033, ADR-0036).
 * Each is marked afterwards, so a restart doesn't bring back a role that was taken away later.
 */
export class AssignCreatorModerators {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly moderators: ModeratorAssignment,
  ) {}

  async execute(): Promise<void> {
    for (const { channelId, creatorId } of await this.channels.listCreatorsWithoutRole()) {
      await this.moderators.execute({ personId: creatorId, channelId });
      await this.channels.markCreatorRoleAssigned(channelId);
    }
  }
}
