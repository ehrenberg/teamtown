import { create } from 'zustand';

interface ChatState {
  /** The channel shown in the chat panel; `null` while the panel is closed (ADR-0033). */
  readonly openChannelId: string | null;
  readonly open: (channelId: string) => void;
  readonly close: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  openChannelId: null,
  open: (channelId) => {
    set({ openChannelId: channelId });
  },
  close: () => {
    set({ openChannelId: null });
  },
}));
