import { err, ok, type Result } from '@teamtown/kernel';
import { channelName } from './channel-name.ts';
import type { MessagingEvent } from './events.ts';
import { Message, type ReactionError } from './message.ts';

/** `pair`: a 1:1 DM, `group`: a DM with 3–8 people; both are `direct` channels to the outside. */
export type ChannelKind = 'public' | 'private' | 'pair' | 'group';

/** Seed channels (ADR-0033): everyone joins them on their first visit; `#general` can't be left. */
export const GENERAL_CHANNEL_ID = 'general';
export const RANDOM_CHANNEL_ID = 'random';
export const SEED_CHANNEL_IDS = [GENERAL_CHANNEL_ID, RANDOM_CHANNEL_ID] as const;

/** A DM has at most 8 people (ADR-0033). */
export const MAX_DIRECT_MEMBERS = 8;

/** The newest message a member has read. Its time orders it; no reading time is stored (ADR-0033). */
export interface ReadMarker {
  readonly messageId: string;
  readonly postedAt: Date;
}

export interface Membership {
  readonly personId: string;
  readonly joinedAt: Date;
  readonly readMarker: ReadMarker | null;
}

export interface ChannelProps {
  readonly channelId: string;
  readonly kind: ChannelKind;
  /** Without the `#`; `null` for DMs. */
  readonly name: string | null;
  /** Moderates the channel until M4 (ADR-0033); `null` for seed channels and DMs. */
  readonly creatorId: string | null;
  readonly memberships: readonly Membership[];
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
}

/** What changed since loading, so that the repository writes only that (members read concurrently). */
export interface ChannelChanges {
  readonly channel: boolean;
  readonly upserted: readonly Membership[];
  readonly removed: readonly string[];
}

export type ChannelError =
  | 'invalid-channel-name'
  | 'channel-archived'
  | 'not-channel-creator'
  | 'not-channel-member'
  | 'direct-message-too-large'
  | 'cannot-leave-channel'
  | 'cannot-invite'
  | 'invalid-request';

const isLater = (a: ReadMarker, b: ReadMarker | null): boolean =>
  !b || a.postedAt > b.postedAt || (a.postedAt.getTime() === b.postedAt.getTime() && a.messageId > b.messageId);

/**
 * A channel or DM with its memberships (docs/architecture/domain-model.md "Messaging"). Until M4 the creator
 * moderates and every member posts (ADR-0033). Messages are their own aggregate, created through `post`.
 */
export class Channel {
  #events: MessagingEvent[] = [];
  #channelChanged = false;
  readonly #upserted = new Set<string>();
  readonly #removed = new Set<string>();

  private constructor(private state: ChannelProps) {}

  static create(input: {
    channelId: string;
    kind: 'public' | 'private';
    name: string;
    creatorId: string;
    now: Date;
  }): Result<Channel, 'invalid-channel-name'> {
    const name = channelName(input.name);
    if (!name.ok) return name;
    const channel = new Channel({
      channelId: input.channelId,
      kind: input.kind,
      name: name.value,
      creatorId: input.creatorId,
      memberships: [],
      archivedAt: null,
      createdAt: input.now,
    });
    channel.#channelChanged = true;
    channel.#addMembers([input.creatorId], input.now);
    return ok(channel);
  }

  /** A new DM between `memberIds` (the opener included): `pair` for two people, `group` for up to eight. */
  static openDirect(input: {
    channelId: string;
    memberIds: readonly string[];
    now: Date;
  }): Result<Channel, 'direct-message-too-large' | 'invalid-request'> {
    const memberIds = [...new Set(input.memberIds)];
    if (memberIds.length < 2) return err('invalid-request');
    if (memberIds.length > MAX_DIRECT_MEMBERS) return err('direct-message-too-large');
    const channel = new Channel({
      channelId: input.channelId,
      kind: memberIds.length === 2 ? 'pair' : 'group',
      name: null,
      creatorId: null,
      memberships: [],
      archivedAt: null,
      createdAt: input.now,
    });
    channel.#channelChanged = true;
    channel.#addMembers(memberIds, input.now);
    return ok(channel);
  }

  /** The key that makes a 1:1 DM unique per pair of people. */
  static pairKeyOf(memberIds: readonly string[]): string {
    return [...new Set(memberIds)].sort().join(':');
  }

  /** Restores a stored channel; it was valid when it was saved. */
  static restore(props: ChannelProps): Channel {
    return new Channel(props);
  }

  get props(): ChannelProps {
    return this.state;
  }

  get memberIds(): string[] {
    return this.state.memberships.map((membership) => membership.personId);
  }

  get isDirect(): boolean {
    return this.state.kind === 'pair' || this.state.kind === 'group';
  }

  get isArchived(): boolean {
    return this.state.archivedAt !== null;
  }

  get pairKey(): string | null {
    return this.state.kind === 'pair' ? Channel.pairKeyOf(this.memberIds) : null;
  }

  isMember(personId: string): boolean {
    return this.state.memberships.some((membership) => membership.personId === personId);
  }

  membershipOf(personId: string): Membership | null {
    return this.state.memberships.find((membership) => membership.personId === personId) ?? null;
  }

  /** Public channels are readable by everyone; private channels and DMs only by their members. */
  canRead(personId: string): boolean {
    return this.state.kind === 'public' || this.isMember(personId);
  }

  rename(actorId: string, raw: string): Result<void, ChannelError> {
    const allowed = this.#moderate(actorId);
    if (!allowed.ok) return allowed;
    if (this.isArchived) return err('channel-archived');
    const name = channelName(raw);
    if (!name.ok) return name;
    if (name.value === this.state.name) return ok(undefined);
    this.state = { ...this.state, name: name.value };
    this.#changed();
    return ok(undefined);
  }

  /** Archived channels stay readable but take no new messages; the creator can unarchive them. */
  setArchived(actorId: string, archived: boolean, now: Date): Result<void, ChannelError> {
    const allowed = this.#moderate(actorId);
    if (!allowed.ok) return allowed;
    if (archived === this.isArchived) return ok(undefined);
    this.state = { ...this.state, archivedAt: archived ? now : null };
    this.#changed();
    return ok(undefined);
  }

  /** Someone joins a public channel themselves. */
  join(personId: string, now: Date): Result<void, ChannelError> {
    if (this.state.kind !== 'public') return err('cannot-invite');
    if (this.isArchived) return err('channel-archived');
    if (this.isMember(personId)) return ok(undefined);
    this.#addMembers([personId], now);
    return ok(undefined);
  }

  /** Joins a seed channel on the first visit, archived or not. */
  joinAsSeed(personId: string, now: Date): void {
    if (!this.isMember(personId)) this.#addMembers([personId], now);
  }

  /**
   * Members add people to a public channel (ADR-0034) or a group DM (up to eight in total); the creator invites
   * into a private channel.
   */
  invite(actorId: string, personIds: readonly string[], now: Date): Result<void, ChannelError> {
    const newcomers = [...new Set(personIds)].filter((personId) => !this.isMember(personId));
    switch (this.state.kind) {
      case 'public':
        if (!this.isMember(actorId)) return err('not-channel-member');
        break;
      case 'private':
        if (actorId !== this.state.creatorId) return err('not-channel-creator');
        break;
      case 'group':
        if (!this.isMember(actorId)) return err('not-channel-member');
        if (this.state.memberships.length + newcomers.length > MAX_DIRECT_MEMBERS) {
          return err('direct-message-too-large');
        }
        break;
      default:
        // A 1:1 DM stays between its two people.
        return err('cannot-invite');
    }
    if (this.isArchived) return err('channel-archived');
    if (newcomers.length > 0) this.#addMembers(newcomers, now);
    return ok(undefined);
  }

  leave(personId: string): Result<void, ChannelError> {
    if (this.state.channelId === GENERAL_CHANNEL_ID || this.state.kind === 'pair') {
      return err('cannot-leave-channel');
    }
    if (!this.isMember(personId)) return ok(undefined);
    this.state = {
      ...this.state,
      memberships: this.state.memberships.filter((membership) => membership.personId !== personId),
    };
    this.#upserted.delete(personId);
    this.#removed.add(personId);
    this.#events.push({ type: 'ChannelLeft', channelId: this.state.channelId, personId });
    this.#events.push({ type: 'ChannelChanged', channelId: this.state.channelId, recipients: this.memberIds });
    return ok(undefined);
  }

  /** Members post; archived channels take nothing new. A reply names the root of its thread (ADR-0034). */
  post(input: {
    messageId: string;
    authorId: string;
    body: string;
    threadRoot?: Message | null | undefined;
    alsoInChannel?: boolean | undefined;
    now: Date;
  }): Result<Message, 'not-channel-member' | 'channel-archived' | 'invalid-message' | 'invalid-thread-root'> {
    if (!this.isMember(input.authorId)) return err('not-channel-member');
    if (this.isArchived) return err('channel-archived');
    const root = input.threadRoot ?? null;
    if (root && (root.props.channelId !== this.state.channelId || root.isReply)) return err('invalid-thread-root');
    return Message.create(
      {
        messageId: input.messageId,
        channelId: this.state.channelId,
        authorId: input.authorId,
        body: input.body,
        threadRootId: root?.props.messageId ?? null,
        alsoInChannel: input.alsoInChannel ?? false,
        now: input.now,
      },
      this.memberIds,
    );
  }

  /** Members react; archived channels take no new reactions. Public reactions may show in the office. */
  react(
    message: Message,
    input: { personId: string; emoji: string; add: boolean },
  ): Result<void, 'not-channel-member' | 'channel-archived' | ReactionError> {
    if (!this.isMember(input.personId)) return err('not-channel-member');
    if (this.isArchived) return err('channel-archived');
    return message.react({ ...input, inOffice: this.state.kind === 'public', recipients: this.memberIds });
  }

  /** The mentioned people who are members; mentions of others notify nobody (ADR-0034). */
  membersAmong(personIds: readonly string[]): string[] {
    return personIds.filter((personId) => this.isMember(personId));
  }

  /** Edits and deletions need an open channel, too. */
  checkOpen(): Result<void, 'channel-archived'> {
    return this.isArchived ? err('channel-archived') : ok(undefined);
  }

  /** Moves the member's read marker forward to `marker`; never back. */
  markRead(personId: string, marker: ReadMarker): void {
    const membership = this.membershipOf(personId);
    if (!membership || !isLater(marker, membership.readMarker)) return;
    this.state = {
      ...this.state,
      memberships: this.state.memberships.map((m) => (m.personId === personId ? { ...m, readMarker: marker } : m)),
    };
    this.#upserted.add(personId);
    this.#events.push({
      type: 'ReadMarkerMoved',
      channelId: this.state.channelId,
      personId,
      messageId: marker.messageId,
    });
  }

  /** Returns and clears what changed since loading. */
  pullChanges(): ChannelChanges {
    const changes: ChannelChanges = {
      channel: this.#channelChanged,
      upserted: this.state.memberships.filter((membership) => this.#upserted.has(membership.personId)),
      removed: [...this.#removed],
    };
    this.#channelChanged = false;
    this.#upserted.clear();
    this.#removed.clear();
    return changes;
  }

  /** Returns and clears the recorded events. */
  pullEvents(): readonly MessagingEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }

  #moderate(actorId: string): Result<void, 'not-channel-creator'> {
    return this.state.creatorId !== null && actorId === this.state.creatorId
      ? ok(undefined)
      : err('not-channel-creator');
  }

  #addMembers(personIds: readonly string[], now: Date): void {
    const added = personIds.map((personId) => ({ personId, joinedAt: now, readMarker: null }));
    this.state = { ...this.state, memberships: [...this.state.memberships, ...added] };
    for (const { personId } of added) {
      this.#removed.delete(personId);
      this.#upserted.add(personId);
    }
    this.#announce();
  }

  #changed(): void {
    this.#channelChanged = true;
    this.#announce();
  }

  /** One `ChannelChanged` per change set, to the members as they are now. */
  #announce(): void {
    this.#events = this.#events.filter((event) => event.type !== 'ChannelChanged');
    this.#events.push({ type: 'ChannelChanged', channelId: this.state.channelId, recipients: this.memberIds });
  }
}
