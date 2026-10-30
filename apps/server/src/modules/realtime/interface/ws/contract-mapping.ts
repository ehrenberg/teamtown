import type { AvatarState as AvatarStateContract, ConversationContract, ServerEvent } from '@teamtown/contracts';
import type { Conversation, ConversationEvent } from '../../../meetings/public-api.ts';
import type { AvatarState, PresenceEvent } from '../../../presence/public-api.ts';

export const toAvatarContract = (avatar: AvatarState): AvatarStateContract => ({
  personId: avatar.occupant.personId,
  displayName: avatar.occupant.displayName,
  avatarColor: avatar.occupant.avatarColor,
  tile: avatar.tile,
  movement: avatar.movement ? { ...avatar.movement, path: [...avatar.movement.path] } : null,
});

export function toServerEvent(event: PresenceEvent): ServerEvent {
  switch (event.type) {
    case 'AvatarJoined':
      return { t: 'AvatarJoined', p: { floorId: event.floorId, avatar: toAvatarContract(event.avatar) } };
    case 'AvatarLeft':
      return { t: 'AvatarLeft', p: { floorId: event.floorId, personId: event.personId } };
    case 'AvatarPathStarted':
      return {
        t: 'AvatarPathStarted',
        p: {
          floorId: event.floorId,
          personId: event.personId,
          movement: { ...event.movement, path: [...event.movement.path] },
        },
      };
  }
}

export const toConversationContract = (conversation: Conversation): ConversationContract => ({
  conversationId: conversation.conversationId,
  participants: [...conversation.participants],
  locked: conversation.locked,
});

export function toConversationServerEvent(event: ConversationEvent): ServerEvent {
  switch (event.type) {
    case 'ConversationFormed':
      return {
        t: 'ConversationFormed',
        p: { floorId: event.floorId, conversation: toConversationContract(event.conversation) },
      };
    case 'ConversationChanged':
      return {
        t: 'ConversationChanged',
        p: { floorId: event.floorId, conversation: toConversationContract(event.conversation) },
      };
    case 'ConversationDissolved':
      return { t: 'ConversationDissolved', p: { floorId: event.floorId, conversationId: event.conversationId } };
  }
}
