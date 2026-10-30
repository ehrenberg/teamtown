import { z } from 'zod';
import { PersonId } from '../people/me.ts';

export const ConversationId = z.string().min(1).max(64);
const CorrelationId = z.string().min(1).max(64);
const FloorId = z.string().min(1).max(64);

export const ConversationSchema = z.object({
  conversationId: ConversationId,
  participants: z.array(PersonId),
  locked: z.boolean(),
});
export type ConversationContract = z.infer<typeof ConversationSchema>;

export const LockConversationCommand = z.object({
  t: z.literal('LockConversation'),
  id: CorrelationId.optional(),
  p: z.object({ conversationId: ConversationId }),
});

export const UnlockConversationCommand = z.object({
  t: z.literal('UnlockConversation'),
  id: CorrelationId.optional(),
  p: z.object({ conversationId: ConversationId }),
});

export const RequestConversationTokenCommand = z.object({
  t: z.literal('RequestConversationToken'),
  id: CorrelationId.optional(),
  p: z.object({ conversationId: ConversationId }),
});

export const ConversationFormedEvent = z.object({
  t: z.literal('ConversationFormed'),
  p: z.object({ floorId: FloorId, conversation: ConversationSchema }),
});

export const ConversationChangedEvent = z.object({
  t: z.literal('ConversationChanged'),
  p: z.object({ floorId: FloorId, conversation: ConversationSchema }),
});

export const ConversationDissolvedEvent = z.object({
  t: z.literal('ConversationDissolved'),
  p: z.object({ floorId: FloorId, conversationId: ConversationId }),
});

/** Sent only to the participant it is for; the token is valid for 30 s. */
export const ConversationAccessGrantedEvent = z.object({
  t: z.literal('ConversationAccessGranted'),
  p: z.object({
    conversationId: ConversationId,
    url: z.string().min(1),
    token: z.string().min(1).max(8192),
  }),
});
