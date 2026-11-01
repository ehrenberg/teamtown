import { defineEntity, p } from '@mikro-orm/postgresql';

/** Persistence records of the Messaging context (schema `messaging`); the domain classes stay undecorated. */

export const ChannelEntity = defineEntity({
  name: 'ChannelRecord',
  schema: 'messaging',
  tableName: 'channel',
  properties: {
    channelId: p.string().length(64).primary(),
    kind: p.string().length(16),
    name: p.string().length(40).nullable(),
    creatorId: p.uuid().nullable(),
    pairKey: p.string().length(80).nullable(),
    archivedAt: p.datetime().nullable(),
    createdAt: p.datetime(),
  },
});
export class ChannelRecord extends ChannelEntity.class {}
ChannelEntity.setClass(ChannelRecord);

export const MembershipEntity = defineEntity({
  name: 'MembershipRecord',
  schema: 'messaging',
  tableName: 'membership',
  properties: {
    channelId: p.string().length(64).primary(),
    personId: p.uuid().primary(),
    joinedAt: p.datetime(),
    readMessageId: p.string().length(64).nullable(),
    readPostedAt: p.datetime().nullable(),
  },
});
export class MembershipRecord extends MembershipEntity.class {}
MembershipEntity.setClass(MembershipRecord);

export const MessageEntity = defineEntity({
  name: 'MessageRecord',
  schema: 'messaging',
  tableName: 'message',
  properties: {
    messageId: p.string().length(64).primary(),
    channelId: p.string().length(64),
    authorId: p.uuid(),
    body: p.text(),
    threadRootId: p.string().length(64).nullable(),
    alsoInChannel: p.boolean(),
    mentions: p.array().columnType('uuid[]'),
    postedAt: p.datetime(),
    editedAt: p.datetime().nullable(),
    deletedAt: p.datetime().nullable(),
  },
});
export class MessageRecord extends MessageEntity.class {}
MessageEntity.setClass(MessageRecord);

export const ReactionEntity = defineEntity({
  name: 'ReactionRecord',
  schema: 'messaging',
  tableName: 'reaction',
  properties: {
    messageId: p.string().length(64).primary(),
    emoji: p.string().length(64).primary(),
    personId: p.uuid().primary(),
    reactedAt: p.datetime(),
  },
});
export class ReactionRecord extends ReactionEntity.class {}
ReactionEntity.setClass(ReactionRecord);

export const ThreadFollowEntity = defineEntity({
  name: 'ThreadFollowRecord',
  schema: 'messaging',
  tableName: 'thread_follow',
  properties: {
    rootMessageId: p.string().length(64).primary(),
    personId: p.uuid().primary(),
    channelId: p.string().length(64),
    following: p.boolean(),
    readMessageId: p.string().length(64).nullable(),
    readPostedAt: p.datetime().nullable(),
  },
});
export class ThreadFollowRecord extends ThreadFollowEntity.class {}
ThreadFollowEntity.setClass(ThreadFollowRecord);

export const MESSAGING_ENTITIES = [ChannelEntity, MembershipEntity, MessageEntity, ReactionEntity, ThreadFollowEntity];
