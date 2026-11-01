import type { Channel } from '../domain/channel.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';

/** Use case: every public channel, to find and join one. */
export class BrowseChannels {
  constructor(private readonly channels: ChannelRepository) {}

  execute(): Promise<Channel[]> {
    return this.channels.listPublic();
  }
}
