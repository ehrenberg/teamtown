import { z } from 'zod';
import { PersonId } from '../people/me.ts';

/** Channels and direct messages (M3a, ADR-0033, docs/features/messaging-channels-and-dms.md). */

export const ChannelId = z.string().min(1).max(64);
export const MessageId = z.string().min(1).max(64);

export const MAX_MESSAGE_LENGTH = 4000;
/** Different emoji per message (ADR-0034). */
export const MAX_REACTIONS = 20;
/** A DM has at most 8 people, oneself included (ADR-0033). */
export const MAX_DIRECT_MESSAGE_MEMBERS = 8;

export const ChannelKind = z.enum(['public', 'private', 'direct']);
export type ChannelKind = z.infer<typeof ChannelKind>;

/** A channel or DM as one of its members sees it. Times are ISO 8601. */
export const ChannelSummarySchema = z.object({
  channelId: ChannelId,
  kind: ChannelKind,
  /** A group DM: people can be added and leave. A 1:1 DM (`false`) stays between its two people. */
  group: z.boolean(),
  /** Without the `#`; `null` for DMs. */
  name: z.string().nullable(),
  /** `null` for the seed channels. */
  creatorId: PersonId.nullable(),
  members: z.array(PersonId),
  archived: z.boolean(),
  /** Messages by others after the read marker, shown in the channel (thread replies only if also sent there). */
  unreadCount: z.number().int().nonnegative(),
  /** Of those, the ones that mention me (ADR-0034). */
  mentionCount: z.number().int().nonnegative(),
  lastMessageAt: z.iso.datetime().nullable(),
  readMarker: MessageId.nullable(),
});
export type ChannelSummary = z.infer<typeof ChannelSummarySchema>;

/** `GET /api/channels`: my channels and DMs. */
export const ChannelListResponse = z.object({ channels: z.array(ChannelSummarySchema) });
export type ChannelListResponse = z.infer<typeof ChannelListResponse>;

/** `GET /api/channels/browse`: every public channel. */
export const BrowseChannelsResponse = z.object({
  channels: z.array(
    z.object({
      channelId: ChannelId,
      name: z.string(),
      memberCount: z.number().int().nonnegative(),
      archived: z.boolean(),
      isMember: z.boolean(),
    }),
  ),
});
export type BrowseChannelsResponse = z.infer<typeof BrowseChannelsResponse>;

/** `POST /api/channels`; answered with the new `ChannelSummary`. */
export const CreateChannelRequest = z.object({
  kind: z.enum(['public', 'private']),
  name: z.string().min(1).max(64),
});
export type CreateChannelRequest = z.infer<typeof CreateChannelRequest>;

/** `PATCH /api/channels/{channelId}`: creator only. */
export const UpdateChannelRequest = z
  .object({ name: z.string().min(1).max(64).optional(), archived: z.boolean().optional() })
  .refine((request) => request.name !== undefined || request.archived !== undefined);
export type UpdateChannelRequest = z.infer<typeof UpdateChannelRequest>;

/** `POST /api/channels/{channelId}/members`: join yourself, invite into a private channel, add to a group DM. */
export const AddMembersRequest = z.object({
  personIds: z.array(PersonId).min(1).max(MAX_DIRECT_MESSAGE_MEMBERS),
});
export type AddMembersRequest = z.infer<typeof AddMembersRequest>;

/** `POST /api/direct-messages`: the other people; opens the existing DM or creates one. */
export const OpenDirectMessageRequest = z.object({
  personIds: z
    .array(PersonId)
    .min(1)
    .max(MAX_DIRECT_MESSAGE_MEMBERS * 2),
});
export type OpenDirectMessageRequest = z.infer<typeof OpenDirectMessageRequest>;

/** One emoji (ADR-0034); a path segment of the reaction endpoints. */
export const Emoji = z.string().min(1).max(64);

export const ReactionSchema = z.object({
  emoji: Emoji,
  /** In the order people reacted; the count is their number. */
  personIds: z.array(PersonId),
});

/** What a root shows about its replies. Deleted replies count: they keep their place. */
export const ThreadSummarySchema = z.object({
  replyCount: z.number().int().positive(),
  lastReplyAt: z.iso.datetime(),
  /** The newest three different repliers, newest first. */
  replierIds: z.array(PersonId),
});
export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;

export const MessageSchema = z.object({
  messageId: MessageId,
  channelId: ChannelId,
  authorId: PersonId,
  /** Markdown subset (ADR-0033) with mentions as `<@personId>` (ADR-0034); empty once deleted. */
  body: z.string().max(MAX_MESSAGE_LENGTH),
  /** Set for thread replies; threads are one level deep. */
  threadRootId: MessageId.nullable(),
  /** A reply that shows in the channel, too. */
  alsoInChannel: z.boolean(),
  mentions: z.array(PersonId),
  reactions: z.array(ReactionSchema),
  /** Roots with replies only; always `null` for replies and in realtime events. */
  thread: ThreadSummarySchema.nullable(),
  postedAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
  deleted: z.boolean(),
});
export type MessageContract = z.infer<typeof MessageSchema>;

/**
 * `GET /api/channels/{channelId}/messages?before={messageId}&limit=50`: oldest first, without thread replies
 * unless they were also sent to the channel. `GET …/messages/{rootId}/replies` pages through a thread the same way.
 */
export const MessagePageResponse = z.object({
  messages: z.array(MessageSchema),
  /** There are older messages before the first one. */
  hasMore: z.boolean(),
});
export type MessagePageResponse = z.infer<typeof MessagePageResponse>;

export const MessagePageQuery = z.object({
  before: MessageId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** `PATCH /api/channels/{channelId}/messages/{messageId}`; answered with the message. */
export const MessageBodyRequest = z.object({ body: z.string().min(1).max(MAX_MESSAGE_LENGTH) });
export type MessageBodyRequest = z.infer<typeof MessageBodyRequest>;

/**
 * `POST /api/channels/{channelId}/messages`; answered with the message. With `threadRootId` it is a reply; a reply
 * to a reply goes to the same root. `alsoInChannel` shows the reply in the channel, too (ADR-0034).
 */
export const PostMessageRequest = MessageBodyRequest.extend({
  threadRootId: MessageId.optional(),
  alsoInChannel: z.boolean().optional(),
});
export type PostMessageRequest = z.infer<typeof PostMessageRequest>;

/** `GET /api/threads`: the threads I follow, newest activity first (ADR-0034). */
export const ThreadListResponse = z.object({
  threads: z.array(
    z.object({
      channelId: ChannelId,
      root: MessageSchema,
      /** Replies by others after my thread read marker. */
      unreadCount: z.number().int().nonnegative(),
    }),
  ),
});
export type ThreadListResponse = z.infer<typeof ThreadListResponse>;

/** `PUT /api/channels/{channelId}/threads/{rootId}/read-marker` */
export const MoveThreadReadMarkerRequest = z.object({ messageId: MessageId });

/** `PUT /api/channels/{channelId}/read-marker` */
export const MoveReadMarkerRequest = z.object({ messageId: MessageId });
export type MoveReadMarkerRequest = z.infer<typeof MoveReadMarkerRequest>;

/** Stable error codes in the `message` field of 4xx answers, translated in the client. */
export const MessagingErrorCode = z.enum([
  'invalid-request',
  'invalid-channel-name',
  'channel-name-taken',
  'channel-archived',
  'not-channel-creator',
  /** Join the public channel first. */
  'not-channel-member',
  'not-message-author',
  'invalid-message',
  'direct-message-too-large',
  'cannot-leave-channel',
  /** A 1:1 DM takes nobody else. */
  'cannot-invite',
  'unknown-person',
  /** The message to reply to is in another channel or doesn't exist. */
  'invalid-thread-root',
  'invalid-emoji',
  'too-many-reactions',
]);
export type MessagingErrorCode = z.infer<typeof MessagingErrorCode>;
