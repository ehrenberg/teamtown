import { z } from 'zod';
import { ChannelId, Emoji, MessageId, MessageSchema } from '../messaging/channels.ts';
import { PersonId } from '../people/me.ts';

/**
 * Messaging pushes (M3a, M3b). Writes go over REST; these events reach the members' open connections
 * (docs/architecture/world-and-realtime.md §5).
 */

export const MessagePostedEvent = z.object({
  t: z.literal('MessagePosted'),
  p: z.object({ message: MessageSchema }),
});

export const MessageEditedEvent = z.object({
  t: z.literal('MessageEdited'),
  p: z.object({ message: MessageSchema }),
});

export const MessageDeletedEvent = z.object({
  t: z.literal('MessageDeleted'),
  p: z.object({ channelId: ChannelId, messageId: MessageId }),
});

/** Something about the channel changed (created, renamed, archived, members): reload it. */
export const ChannelChangedEvent = z.object({
  t: z.literal('ChannelChanged'),
  p: z.object({ channelId: ChannelId }),
});

/** To the person who left: drop the channel. */
export const ChannelLeftEvent = z.object({
  t: z.literal('ChannelLeft'),
  p: z.object({ channelId: ChannelId }),
});

/** To the person's other clients: they read up to this message. */
export const ReadMarkerMovedEvent = z.object({
  t: z.literal('ReadMarkerMoved'),
  p: z.object({ channelId: ChannelId, messageId: MessageId }),
});

/** One person added or removed a reaction; members apply it to the message (ADR-0034). */
export const ReactionChangedEvent = z.object({
  t: z.literal('ReactionChanged'),
  p: z.object({ channelId: ChannelId, messageId: MessageId, personId: PersonId, emoji: Emoji, added: z.boolean() }),
});

/** A followed thread got replies or the person's follow or marker changed: reload the threads. */
export const ThreadActivityEvent = z.object({
  t: z.literal('ThreadActivity'),
  p: z.object({ channelId: ChannelId, rootMessageId: MessageId }),
});

const FloorId = z.string().min(1).max(64);

/**
 * Someone reacted in a public channel: the emoji floats briefly above their avatar. To everyone on their floor;
 * carries no message and is never stored (ADR-0034, ADR-0012).
 */
export const AvatarEmotedEvent = z.object({
  t: z.literal('AvatarEmoted'),
  p: z.object({ floorId: FloorId, personId: PersonId, emoji: Emoji }),
});
