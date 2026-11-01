import { err, ok, type Result } from '@teamtown/kernel';
import type { MessageSnapshot, MessagingEvent } from './events.ts';

export const MAX_MESSAGE_LENGTH = 4000;
/** Different emoji per message (decided 2026-11-01, ADR-0034). */
export const MAX_REACTIONS = 20;

/** `<@personId>` in a body is a mention; it is stored by ID so name changes show everywhere (ADR-0034). */
const MENTION = /<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>/gi;
// The `v` flag needs ES2024 typings; Node 24 runs it.
const SINGLE_EMOJI = new RegExp('^\\p{RGI_Emoji}$', 'v');

export interface Reaction {
  readonly emoji: string;
  /** In the order people reacted. */
  readonly personIds: readonly string[];
}

export interface MessageProps {
  readonly messageId: string;
  readonly channelId: string;
  readonly authorId: string;
  /** Markdown subset (ADR-0033), rendered by the client; empty once deleted. */
  readonly body: string;
  /** Set for thread replies; threads are one level deep. */
  readonly threadRootId: string | null;
  /** A reply that also shows in the channel (ADR-0034). */
  readonly alsoInChannel: boolean;
  /** People mentioned in the body. */
  readonly mentions: readonly string[];
  readonly reactions: readonly Reaction[];
  readonly postedAt: Date;
  readonly editedAt: Date | null;
  readonly deletedAt: Date | null;
}

export type MessageError = 'invalid-message' | 'not-message-author';
export type ReactionError = 'invalid-message' | 'invalid-emoji' | 'too-many-reactions';

/** One person's reaction that was added or removed since loading. */
export interface ReactionChange {
  readonly emoji: string;
  readonly personId: string;
  readonly added: boolean;
}

/** Drops blank lines around the text but keeps indentation inside it (code blocks). */
function messageBody(raw: string): Result<string, 'invalid-message'> {
  const body = raw.replace(/^\s*\n/, '').trimEnd();
  return body.trim().length > 0 && body.length <= MAX_MESSAGE_LENGTH ? ok(body) : err('invalid-message');
}

export function mentionsIn(body: string): string[] {
  return [...new Set([...body.matchAll(MENTION)].map((match) => (match[1] ?? '').toLowerCase()))];
}

/**
 * A message in a channel or DM: its own aggregate, so that busy channels don't lock the channel
 * (docs/architecture/domain-model.md). Created through `Channel.post`, which checks membership.
 */
export class Message {
  #events: MessagingEvent[] = [];
  #reactionChanges: ReactionChange[] = [];

  private constructor(private state: MessageProps) {}

  /** Only `Channel.post` calls this; it has checked that the author may post and that the root fits. */
  static create(
    input: {
      messageId: string;
      channelId: string;
      authorId: string;
      body: string;
      threadRootId: string | null;
      alsoInChannel: boolean;
      now: Date;
    },
    recipients: readonly string[],
  ): Result<Message, 'invalid-message'> {
    const body = messageBody(input.body);
    if (!body.ok) return body;
    const message = new Message({
      messageId: input.messageId,
      channelId: input.channelId,
      authorId: input.authorId,
      body: body.value,
      threadRootId: input.threadRootId,
      alsoInChannel: input.threadRootId !== null && input.alsoInChannel,
      mentions: mentionsIn(body.value),
      reactions: [],
      postedAt: input.now,
      editedAt: null,
      deletedAt: null,
    });
    message.#events.push({ type: 'MessagePosted', message: message.snapshot, recipients });
    return ok(message);
  }

  /** Restores a stored message; it was valid when it was saved. */
  static restore(props: MessageProps): Message {
    return new Message(props);
  }

  get props(): MessageProps {
    return this.state;
  }

  get isDeleted(): boolean {
    return this.state.deletedAt !== null;
  }

  get isReply(): boolean {
    return this.state.threadRootId !== null;
  }

  /** Whether it shows in the channel: everything but thread replies that stay in their thread. */
  get inChannel(): boolean {
    return !this.isReply || this.state.alsoInChannel;
  }

  get snapshot(): MessageSnapshot {
    return {
      messageId: this.state.messageId,
      channelId: this.state.channelId,
      authorId: this.state.authorId,
      body: this.state.body,
      threadRootId: this.state.threadRootId,
      alsoInChannel: this.state.alsoInChannel,
      mentions: [...this.state.mentions],
      reactions: this.state.reactions.map((reaction) => ({ ...reaction, personIds: [...reaction.personIds] })),
      postedAt: this.state.postedAt.toISOString(),
      editedAt: this.state.editedAt?.toISOString() ?? null,
      deleted: this.isDeleted,
    };
  }

  /** The thread a reply to this message belongs to: answering a reply answers its root. */
  get threadId(): string {
    return this.state.threadRootId ?? this.state.messageId;
  }

  edit(personId: string, raw: string, now: Date, recipients: readonly string[]): Result<void, MessageError> {
    if (personId !== this.state.authorId) return err('not-message-author');
    if (this.isDeleted) return err('invalid-message');
    const body = messageBody(raw);
    if (!body.ok) return body;
    if (body.value === this.state.body) return ok(undefined);
    // Mentions follow the body: new ones count, removed ones are withdrawn (decided 2026-11-01).
    this.state = { ...this.state, body: body.value, mentions: mentionsIn(body.value), editedAt: now };
    this.#events.push({ type: 'MessageEdited', message: this.snapshot, recipients });
    return ok(undefined);
  }

  /** Removes body, mentions and reactions for good; it stays as "Message deleted" so its thread keeps its place. */
  delete(personId: string, now: Date, recipients: readonly string[]): Result<void, 'not-message-author'> {
    if (personId !== this.state.authorId) return err('not-message-author');
    if (this.isDeleted) return ok(undefined);
    for (const reaction of this.state.reactions) {
      for (const reactor of reaction.personIds) {
        this.#reactionChanges.push({ emoji: reaction.emoji, personId: reactor, added: false });
      }
    }
    this.state = { ...this.state, body: '', mentions: [], reactions: [], deletedAt: now };
    this.#events.push({
      type: 'MessageDeleted',
      channelId: this.state.channelId,
      messageId: this.state.messageId,
      recipients,
    });
    return ok(undefined);
  }

  /**
   * Adds or removes one person's reaction; both are idempotent. `inOffice`: the reaction may show as an emote
   * above the avatar (public channels only, ADR-0034).
   */
  react(input: {
    personId: string;
    emoji: string;
    add: boolean;
    inOffice: boolean;
    recipients: readonly string[];
  }): Result<void, ReactionError> {
    if (this.isDeleted) return err('invalid-message');
    if (!SINGLE_EMOJI.test(input.emoji)) return err('invalid-emoji');
    const existing = this.state.reactions.find((reaction) => reaction.emoji === input.emoji);
    const has = existing?.personIds.includes(input.personId) ?? false;
    if (has === input.add) return ok(undefined);
    if (input.add && !existing && this.state.reactions.length >= MAX_REACTIONS) return err('too-many-reactions');

    const reactions = input.add
      ? existing
        ? this.state.reactions.map((reaction) =>
            reaction === existing ? { ...reaction, personIds: [...reaction.personIds, input.personId] } : reaction,
          )
        : [...this.state.reactions, { emoji: input.emoji, personIds: [input.personId] }]
      : this.state.reactions
          .map((reaction) =>
            reaction === existing
              ? { ...reaction, personIds: reaction.personIds.filter((personId) => personId !== input.personId) }
              : reaction,
          )
          .filter((reaction) => reaction.personIds.length > 0);
    this.state = { ...this.state, reactions };
    this.#reactionChanges.push({ emoji: input.emoji, personId: input.personId, added: input.add });
    this.#events.push({
      type: 'ReactionChanged',
      channelId: this.state.channelId,
      messageId: this.state.messageId,
      personId: input.personId,
      emoji: input.emoji,
      added: input.add,
      inOffice: input.add && input.inOffice,
      recipients: input.recipients,
    });
    return ok(undefined);
  }

  /** Returns and clears the reactions added or removed since loading, so the repository writes only those. */
  pullReactionChanges(): readonly ReactionChange[] {
    const changes = this.#reactionChanges;
    this.#reactionChanges = [];
    return changes;
  }

  /** Returns and clears the recorded events. */
  pullEvents(): readonly MessagingEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }
}
