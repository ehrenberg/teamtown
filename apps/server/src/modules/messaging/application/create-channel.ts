import { err, ok, type Clock, type IdGenerator, type Result } from '@teamtown/kernel';
import type { AccessPolicy } from '../../access/public-api.ts';
import { Channel } from '../domain/channel.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { ModeratorAssignment } from './ports/moderator-assignment.port.ts';

export type CreateChannelError = 'invalid-channel-name' | 'channel-name-taken' | 'not-allowed';

/** Use case: someone creates a public or private channel and becomes its Channel Moderator (ADR-0033, ADR-0036). */
export class CreateChannel {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly access: AccessPolicy,
    private readonly moderators: ModeratorAssignment,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    personId: string;
    kind: 'public' | 'private';
    name: string;
  }): Promise<Result<Channel, CreateChannelError>> {
    const permission = input.kind === 'public' ? 'channel.create.public' : 'channel.create.private';
    if (!(await this.access.can(input.personId, permission, { kind: 'town' }))) return err('not-allowed');
    const created = Channel.create({
      channelId: this.ids.next(),
      kind: input.kind,
      name: input.name,
      creatorId: input.personId,
      now: this.clock.now(),
    });
    if (!created.ok) return created;
    const channel = created.value;
    if (channel.props.name && (await this.channels.findByName(channel.props.name))) return err('channel-name-taken');
    const saved = await this.channels.save(channel);
    if (!saved.ok) return err('channel-name-taken');
    await this.moderators.execute({ personId: input.personId, channelId: channel.props.channelId });
    await this.channels.markCreatorRoleAssigned(channel.props.channelId);
    return ok(channel);
  }
}
