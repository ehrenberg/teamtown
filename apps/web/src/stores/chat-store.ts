import { create } from 'zustand';

interface ChatState {
  /** The channel shown in the chat panel (ADR-0033). */
  readonly openChannelId: string | null;
  /** The threads view is shown in the chat panel instead of a channel (ADR-0034). */
  readonly threadsOpen: boolean;
  readonly open: (channelId: string) => void;
  readonly openThreads: () => void;
  readonly close: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  openChannelId: null,
  threadsOpen: false,
  open: (channelId) => {
    set({ openChannelId: channelId, threadsOpen: false });
  },
  openThreads: () => {
    set({ openChannelId: null, threadsOpen: true });
  },
  close: () => {
    set({ openChannelId: null, threadsOpen: false });
  },
}));

/** Whether the chat panel is open, with a channel or the threads view. */
export const selectPanelOpen = (state: ChatState): boolean => state.openChannelId !== null || state.threadsOpen;
