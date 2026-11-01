import type { ChannelOverview, ChannelRepository } from './ports/channel-repository.port.ts';

/** Use case: one channel as the person sees it (a public channel also before joining it). */
export class GetChannel {
  constructor(private readonly channels: ChannelRepository) {}

  async execute(input: { personId: string; channelId: string }): Promise<ChannelOverview | null> {
    const [overview] = await this.channels.listForMember(input.personId, input.channelId);
    if (overview) return overview;
    const channel = await this.channels.findById(input.channelId);
    return channel?.canRead(input.personId) ? { channel, unreadCount: 0, mentionCount: 0, lastMessageAt: null } : null;
  }
}
