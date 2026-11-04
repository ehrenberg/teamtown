import { create } from 'zustand';

/** A message to bring into view; a reply shows through its opened thread. */
export interface MessageTarget {
  readonly channelId: string;
  readonly messageId: string;
  readonly threadRootId: string | null;
}

const NO_THREADS: ReadonlySet<string> = new Set();

interface ChatState {
  /** The channel shown in the chat panel (ADR-0033). */
  readonly openChannelId: string | null;
  /** The threads view is shown in the chat panel instead of a channel (ADR-0034). */
  readonly threadsOpen: boolean;
  /** The open channel shows its pinned messages instead of the conversation (P-24). */
  readonly pinnedOpen: boolean;
  /** Roots of the open channel whose threads are expanded inline (ADR-0034). */
  readonly expandedThreads: ReadonlySet<string>;
  /** Waiting to be scrolled to, from the pinned view or a search result. */
  readonly showing: MessageTarget | null;
  readonly open: (channelId: string) => void;
  readonly openThreads: () => void;
  readonly close: () => void;
  readonly togglePinned: () => void;
  readonly toggleThread: (rootMessageId: string) => void;
  readonly show: (target: MessageTarget) => void;
  readonly shown: () => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  openChannelId: null,
  threadsOpen: false,
  pinnedOpen: false,
  expandedThreads: NO_THREADS,
  showing: null,
  open: (channelId) => {
    set((state) => ({
      openChannelId: channelId,
      threadsOpen: false,
      pinnedOpen: false,
      showing: null,
      expandedThreads: state.openChannelId === channelId ? state.expandedThreads : NO_THREADS,
    }));
  },
  openThreads: () => {
    set({ openChannelId: null, threadsOpen: true, pinnedOpen: false, showing: null, expandedThreads: NO_THREADS });
  },
  close: () => {
    set({ openChannelId: null, threadsOpen: false, pinnedOpen: false, showing: null, expandedThreads: NO_THREADS });
  },
  togglePinned: () => {
    set((state) => ({ pinnedOpen: !state.pinnedOpen }));
  },
  toggleThread: (rootMessageId) => {
    set((state) => {
      const expandedThreads = new Set(state.expandedThreads);
      if (!expandedThreads.delete(rootMessageId)) expandedThreads.add(rootMessageId);
      return { expandedThreads };
    });
  },
  show: (target) => {
    set((state) => {
      const expandedThreads = new Set(state.openChannelId === target.channelId ? state.expandedThreads : NO_THREADS);
      if (target.threadRootId) expandedThreads.add(target.threadRootId);
      return {
        openChannelId: target.channelId,
        threadsOpen: false,
        pinnedOpen: false,
        showing: target,
        expandedThreads,
      };
    });
  },
  shown: () => {
    set({ showing: null });
  },
}));

/** Whether the chat panel is open, with a channel or the threads view. */
export const selectPanelOpen = (state: ChatState): boolean => state.openChannelId !== null || state.threadsOpen;
