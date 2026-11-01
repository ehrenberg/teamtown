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
    postedAt: p.datetime(),
    editedAt: p.datetime().nullable(),
    deletedAt: p.datetime().nullable(),
  },
});
export class MessageRecord extends MessageEntity.class {}
MessageEntity.setClass(MessageRecord);

export const MESSAGING_ENTITIES = [ChannelEntity, MembershipEntity, MessageEntity];
