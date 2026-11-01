import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { Channel, ChannelError } from '../domain/channel.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';

export type UpdateChannelError = ChannelError | 'not-found' | 'channel-name-taken';

/** Use case: the creator renames, archives or unarchives a channel (ADR-0033). */
export class UpdateChannel {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    name?: string | undefined;
    archived?: boolean | undefined;
  }): Promise<Result<Channel, UpdateChannelError>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    if (!channel) return err('not-found');
    // Unarchive first, so that "unarchive and rename" works in one go.
    if (input.archived === false) {
      const unarchived = channel.setArchived(input.personId, false, this.clock.now());
      if (!unarchived.ok) return unarchived;
    }
    if (input.name !== undefined) {
      const renamed = channel.rename(input.personId, input.name);
      if (!renamed.ok) return renamed;
      const sameName = channel.props.name ? await this.channels.findByName(channel.props.name) : null;
      if (sameName && sameName.props.channelId !== channel.props.channelId) return err('channel-name-taken');
    }
    if (input.archived === true) {
      const archived = channel.setArchived(input.personId, true, this.clock.now());
      if (!archived.ok) return archived;
    }
    const saved = await this.channels.save(channel);
    return saved.ok ? ok(channel) : err('channel-name-taken');
  }
}
