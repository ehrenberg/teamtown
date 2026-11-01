import type { ReadMarker } from './channel.ts';
import type { MessagingEvent } from './events.ts';
import type { Message } from './message.ts';

/** A person's relation to a thread. `following: false` stays stored, so later replies don't follow again. */
export interface ThreadFollow {
  readonly personId: string;
  readonly following: boolean;
  /** The newest reply the person read; no reading time is stored. */
  readonly readMarker: ReadMarker | null;
}

export interface ThreadProps {
  readonly rootMessageId: string;
  readonly channelId: string;
  readonly follows: readonly ThreadFollow[];
}

const isLater = (a: ReadMarker, b: ReadMarker | null): boolean =>
  !b || a.postedAt > b.postedAt || (a.postedAt.getTime() === b.postedAt.getTime() && a.messageId > b.messageId);

/**
 * The replies to one message and who follows them (ADR-0034). The replies are `Message`s; this aggregate keeps
 * the follows: the root's author, repliers and mentioned members follow automatically and can stop following.
 */
export class Thread {
  #events: MessagingEvent[] = [];
  readonly #changed = new Set<string>();

  private constructor(private state: ThreadProps) {}

  /** A thread with the follows stored so far (none for a new thread). */
  static restore(props: ThreadProps): Thread {
    return new Thread(props);
  }

  get props(): ThreadProps {
    return this.state;
  }

  get followerIds(): string[] {
    return this.state.follows.filter((follow) => follow.following).map((follow) => follow.personId);
  }

  followOf(personId: string): ThreadFollow | null {
    return this.state.follows.find((follow) => follow.personId === personId) ?? null;
  }

  /**
   * A reply was posted: the root's author, the replier and the mentioned members follow, unless they stopped
   * following before. The replier has read their own reply; every follower hears of it.
   */
  recordReply(reply: Message, rootAuthorId: string, mentionedMemberIds: readonly string[]): void {
    this.#autoFollow([rootAuthorId, reply.props.authorId, ...mentionedMemberIds]);
    this.#moveMarker(reply.props.authorId, { messageId: reply.props.messageId, postedAt: reply.props.postedAt });
    this.#announce(this.followerIds);
  }

  /** Members mentioned in an edited reply follow, like on posting. */
  recordMentions(mentionedMemberIds: readonly string[]): void {
    const before = new Set(this.followerIds);
    this.#autoFollow(mentionedMemberIds);
    const added = this.followerIds.filter((personId) => !before.has(personId));
    if (added.length > 0) this.#announce(added);
  }

  follow(personId: string): void {
    this.#setFollowing(personId, true);
  }

  unfollow(personId: string): void {
    this.#setFollowing(personId, false);
  }

  /** Moves the person's marker forward to `marker`; never back. */
  markRead(personId: string, marker: ReadMarker): void {
    if (this.#moveMarker(personId, marker)) this.#announce([personId]);
  }

  /** Returns and clears the follows that changed since loading. */
  pullChanges(): readonly ThreadFollow[] {
    const changed = this.state.follows.filter((follow) => this.#changed.has(follow.personId));
    this.#changed.clear();
    return changed;
  }

  /** Returns and clears the recorded events. */
  pullEvents(): readonly MessagingEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }

  #autoFollow(personIds: readonly string[]): void {
    for (const personId of new Set(personIds)) {
      if (!this.followOf(personId)) this.#put({ personId, following: true, readMarker: null });
    }
  }

  #setFollowing(personId: string, following: boolean): void {
    const follow = this.followOf(personId);
    if (follow?.following === following) return;
    this.#put({ personId, following, readMarker: follow?.readMarker ?? null });
    this.#announce([personId]);
  }

  #moveMarker(personId: string, marker: ReadMarker): boolean {
    // Only people with a follow keep a marker; reading alone must not block following later.
    const follow = this.followOf(personId);
    if (!follow || !isLater(marker, follow.readMarker)) return false;
    this.#put({ ...follow, readMarker: marker });
    return true;
  }

  #put(follow: ThreadFollow): void {
    const known = this.followOf(follow.personId) !== null;
    const follows = known
      ? this.state.follows.map((existing) => (existing.personId === follow.personId ? follow : existing))
      : [...this.state.follows, follow];
    this.state = { ...this.state, follows };
    this.#changed.add(follow.personId);
  }

  /** One activity event per change set, to everyone who should reload their threads. */
  #announce(personIds: readonly string[]): void {
    const previous = this.#events.find((event) => event.type === 'ThreadActivity');
    const recipients = [...new Set([...(previous?.recipients ?? []), ...personIds])];
    this.#events = [
      ...this.#events.filter((event) => event.type !== 'ThreadActivity'),
      {
        type: 'ThreadActivity',
        channelId: this.state.channelId,
        rootMessageId: this.state.rootMessageId,
        recipients,
      },
    ];
  }
}
