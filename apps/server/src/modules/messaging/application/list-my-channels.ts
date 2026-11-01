import type { Clock } from '@teamtown/kernel';
import { SEED_CHANNEL_IDS } from '../domain/channel.ts';
import type { ChannelOverview, ChannelRepository } from './ports/channel-repository.port.ts';

/** Use case: the person's channels and DMs. The first visit adds them to the seed channels (ADR-0033). */
export class ListMyChannels {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly clock: Clock,
  ) {}

  async execute(personId: string): Promise<ChannelOverview[]> {
    if (!(await this.channels.isSeeded(personId))) {
      for (const channelId of SEED_CHANNEL_IDS) {
        const channel = await this.channels.findById(channelId);
        if (!channel) continue;
        channel.joinAsSeed(personId, this.clock.now());
        await this.channels.save(channel);
      }
      // Only once: someone who leaves #random later stays out.
      await this.channels.markSeeded(personId);
    }
    return this.channels.listForMember(personId);
  }
}
