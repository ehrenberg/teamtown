import type { Result } from '@teamtown/kernel';
import type { Channel } from '../../domain/channel.ts';

/** A channel as its member lists it: with unread messages by others and the newest message's time. */
export interface ChannelOverview {
  readonly channel: Channel;
  readonly unreadCount: number;
  readonly lastMessageAt: Date | null;
}

export interface ChannelRepository {
  findById(channelId: string): Promise<Channel | null>;
  /** Public and private channels by name. */
  findByName(name: string): Promise<Channel | null>;
  findPair(pairKey: string): Promise<Channel | null>;
  /** The group DM whose current members are exactly these people. */
  findGroupWithMembers(memberIds: readonly string[]): Promise<Channel | null>;
  /** The person's channels, or only `channelId` if they are a member of it. */
  listForMember(personId: string, channelId?: string): Promise<ChannelOverview[]>;
  listPublic(): Promise<Channel[]>;
  /**
   * Writes what changed, plus the recorded events into the outbox, in one transaction (ADR-0018).
   * `conflict`: the name or the 1:1 pair is taken meanwhile.
   */
  save(channel: Channel): Promise<Result<void, 'conflict'>>;
  /** Whether the person already got the seed channels (ADR-0033). */
  isSeeded(personId: string): Promise<boolean>;
  markSeeded(personId: string): Promise<void>;
}

export const CHANNEL_REPOSITORY = Symbol('CHANNEL_REPOSITORY');
