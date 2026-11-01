import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { Channel, ChannelError } from '../domain/channel.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { PeopleDirectory } from './ports/people-directory.port.ts';

export type AddChannelMembersError = ChannelError | 'not-found' | 'unknown-person';

/**
 * Use case: someone joins a public channel themselves, a member adds people to a public channel (ADR-0034) or a
 * group DM, or the creator invites into a private channel (ADR-0033).
 */
export class AddChannelMembers {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly people: PeopleDirectory,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    personIds: readonly string[];
  }): Promise<Result<Channel, AddChannelMembersError>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    if (!channel) return err('not-found');
    const now = this.clock.now();
    const joinsThemselves = input.personIds.length === 1 && input.personIds[0] === input.personId;
    if (joinsThemselves && channel.props.kind === 'public') {
      const joined = channel.join(input.personId, now);
      if (!joined.ok) return joined;
    } else {
      const known = await this.people.existing(input.personIds);
      if (input.personIds.some((personId) => !known.has(personId))) return err('unknown-person');
      const invited = channel.invite(input.personId, input.personIds, now);
      if (!invited.ok) return invited;
    }
    await this.channels.save(channel);
    return ok(channel);
  }
}
