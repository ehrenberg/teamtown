import { err, ok, type Clock, type IdGenerator, type Result } from '@teamtown/kernel';
import { Channel } from '../domain/channel.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { PeopleDirectory } from './ports/people-directory.port.ts';

export type OpenDirectMessageError = 'direct-message-too-large' | 'invalid-request' | 'unknown-person';

/**
 * Use case: opens the DM whose current members are exactly the sender and these people, or creates it
 * (decided 2026-11-01; proposal in the feature spec). There is one 1:1 DM per pair.
 */
export class OpenDirectMessage {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly people: PeopleDirectory,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    personId: string;
    personIds: readonly string[];
  }): Promise<Result<Channel, OpenDirectMessageError>> {
    const memberIds = [...new Set([input.personId, ...input.personIds])];
    const others = memberIds.filter((personId) => personId !== input.personId);
    const known = await this.people.existing(others);
    if (others.some((personId) => !known.has(personId))) return err('unknown-person');

    const existing =
      memberIds.length === 2
        ? await this.channels.findPair(Channel.pairKeyOf(memberIds))
        : await this.channels.findGroupWithMembers(memberIds);
    if (existing) return ok(existing);

    const opened = Channel.openDirect({ channelId: this.ids.next(), memberIds, now: this.clock.now() });
    if (!opened.ok) return opened;
    const saved = await this.channels.save(opened.value);
    if (saved.ok) return ok(opened.value);
    // The other person opened the same 1:1 DM a moment earlier.
    const raced = await this.channels.findPair(Channel.pairKeyOf(memberIds));
    return raced ? ok(raced) : err('invalid-request');
  }
}
