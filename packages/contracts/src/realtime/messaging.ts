import { z } from 'zod';
import { ChannelId, MessageId, MessageSchema } from '../messaging/channels.ts';

/**
 * Messaging pushes (M3a). Writes go over REST; these events reach the members' open connections
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
