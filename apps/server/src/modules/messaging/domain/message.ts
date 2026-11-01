import { err, ok, type Result } from '@teamtown/kernel';
import type { MessageSnapshot, MessagingEvent } from './events.ts';

export const MAX_MESSAGE_LENGTH = 4000;

export interface MessageProps {
  readonly messageId: string;
  readonly channelId: string;
  readonly authorId: string;
  /** Markdown subset (ADR-0033), rendered by the client; empty once deleted. */
  readonly body: string;
  readonly postedAt: Date;
  readonly editedAt: Date | null;
  readonly deletedAt: Date | null;
}

export type MessageError = 'invalid-message' | 'not-message-author';

/** Drops blank lines around the text but keeps indentation inside it (code blocks). */
function messageBody(raw: string): Result<string, 'invalid-message'> {
  const body = raw.replace(/^\s*\n/, '').trimEnd();
  return body.trim().length > 0 && body.length <= MAX_MESSAGE_LENGTH ? ok(body) : err('invalid-message');
}

/**
 * A message in a channel or DM: its own aggregate, so that busy channels don't lock the channel
 * (docs/architecture/domain-model.md). Created through `Channel.post`, which checks membership.
 */
export class Message {
  #events: MessagingEvent[] = [];

  private constructor(private state: MessageProps) {}

  /** Only `Channel.post` calls this; it has checked that the author may post. */
  static create(
    input: { messageId: string; channelId: string; authorId: string; body: string; now: Date },
    recipients: readonly string[],
  ): Result<Message, 'invalid-message'> {
    const body = messageBody(input.body);
    if (!body.ok) return body;
    const message = new Message({
      messageId: input.messageId,
      channelId: input.channelId,
      authorId: input.authorId,
      body: body.value,
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

  get snapshot(): MessageSnapshot {
    return {
      messageId: this.state.messageId,
      channelId: this.state.channelId,
      authorId: this.state.authorId,
      body: this.state.body,
      postedAt: this.state.postedAt.toISOString(),
      editedAt: this.state.editedAt?.toISOString() ?? null,
      deleted: this.isDeleted,
    };
  }

  edit(personId: string, raw: string, now: Date, recipients: readonly string[]): Result<void, MessageError> {
    if (personId !== this.state.authorId) return err('not-message-author');
    if (this.isDeleted) return err('invalid-message');
    const body = messageBody(raw);
    if (!body.ok) return body;
    if (body.value === this.state.body) return ok(undefined);
    this.state = { ...this.state, body: body.value, editedAt: now };
    this.#events.push({ type: 'MessageEdited', message: this.snapshot, recipients });
    return ok(undefined);
  }

  /** Removes the body for good; the message stays as "Message deleted" so replies keep their place. */
  delete(personId: string, now: Date, recipients: readonly string[]): Result<void, 'not-message-author'> {
    if (personId !== this.state.authorId) return err('not-message-author');
    if (this.isDeleted) return ok(undefined);
    this.state = { ...this.state, body: '', deletedAt: now };
    this.#events.push({
      type: 'MessageDeleted',
      channelId: this.state.channelId,
      messageId: this.state.messageId,
      recipients,
    });
    return ok(undefined);
  }

  /** Returns and clears the recorded events. */
  pullEvents(): readonly MessagingEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }
}
