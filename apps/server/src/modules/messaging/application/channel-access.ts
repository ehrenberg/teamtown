import type { Channel } from '../domain/channel.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';

/**
 * Who may see a channel until M4 (ADR-0033): public channels everyone, private channels and DMs their members.
 * Anything else looks like a channel that doesn't exist, so private channels don't leak.
 * M4 routes this through the `AccessPolicy` port (`channel.read`).
 */
export async function findReadableChannel(
  channels: ChannelRepository,
  channelId: string,
  personId: string,
): Promise<Channel | null> {
  const channel = await channels.findById(channelId);
  return channel?.canRead(personId) ? channel : null;
}
