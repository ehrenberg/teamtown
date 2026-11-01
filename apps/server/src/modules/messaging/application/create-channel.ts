import { err, ok, type Clock, type IdGenerator, type Result } from '@teamtown/kernel';
import { Channel } from '../domain/channel.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';

export type CreateChannelError = 'invalid-channel-name' | 'channel-name-taken';

/** Use case: anyone creates a public or private channel and moderates it until M4 (ADR-0033). */
export class CreateChannel {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    personId: string;
    kind: 'public' | 'private';
    name: string;
  }): Promise<Result<Channel, CreateChannelError>> {
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
    return saved.ok ? ok(channel) : err('channel-name-taken');
  }
}
