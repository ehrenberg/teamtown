/**
 * Messaging domain events (docs/architecture/domain-model.md §5). They pass through the outbox (ADR-0018), so
 * payloads are plain JSON: times are ISO strings. `recipients` are the members who should hear of it.
 */

export interface MessageSnapshot {
  readonly messageId: string;
  readonly channelId: string;
  readonly authorId: string;
  readonly body: string;
  readonly postedAt: string;
  readonly editedAt: string | null;
  readonly deleted: boolean;
}

export interface MessagePosted {
  readonly type: 'MessagePosted';
  readonly message: MessageSnapshot;
  readonly recipients: readonly string[];
}

export interface MessageEdited {
  readonly type: 'MessageEdited';
  readonly message: MessageSnapshot;
  readonly recipients: readonly string[];
}

export interface MessageDeleted {
  readonly type: 'MessageDeleted';
  readonly channelId: string;
  readonly messageId: string;
  readonly recipients: readonly string[];
}

/** Created, renamed, archived, unarchived or members joined: the recipients reload the channel. */
export interface ChannelChanged {
  readonly type: 'ChannelChanged';
  readonly channelId: string;
  readonly recipients: readonly string[];
}

export interface ChannelLeft {
  readonly type: 'ChannelLeft';
  readonly channelId: string;
  readonly personId: string;
}

export interface ReadMarkerMoved {
  readonly type: 'ReadMarkerMoved';
  readonly channelId: string;
  readonly personId: string;
  readonly messageId: string;
}

export type MessagingEvent =
  MessagePosted | MessageEdited | MessageDeleted | ChannelChanged | ChannelLeft | ReadMarkerMoved;
