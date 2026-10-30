import type { ConversationContract, ServerEvent } from '@teamtown/contracts';
import { create } from 'zustand';

interface ConversationState {
  readonly conversations: Readonly<Record<string, ConversationContract>>;
  readonly floorId: string | null;
  readonly applySnapshot: (floorId: string, conversations: readonly ConversationContract[]) => void;
  readonly applyEvent: (event: ServerEvent) => void;
}

export const useConversationStore = create<ConversationState>()((set) => ({
  conversations: {},
  floorId: null,
  applySnapshot: (floorId, conversations) => {
    set({ floorId, conversations: Object.fromEntries(conversations.map((c) => [c.conversationId, c])) });
  },
  applyEvent: (event) => {
    set((state) => {
      switch (event.t) {
        case 'ConversationFormed':
        case 'ConversationChanged': {
          if (event.p.floorId !== state.floorId) return {};
          const { conversation } = event.p;
          return { conversations: { ...state.conversations, [conversation.conversationId]: conversation } };
        }
        case 'ConversationDissolved': {
          if (event.p.floorId !== state.floorId) return {};
          const { [event.p.conversationId]: _removed, ...rest } = state.conversations;
          return { conversations: rest };
        }
        default:
          return {};
      }
    });
  },
}));

export const conversationOf = (
  conversations: Readonly<Record<string, ConversationContract>>,
  personId: string | null,
): ConversationContract | null =>
  personId ? (Object.values(conversations).find((c) => c.participants.includes(personId)) ?? null) : null;
