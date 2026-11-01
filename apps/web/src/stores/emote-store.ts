import { create } from 'zustand';

/** How long a reaction floats above the avatar. */
export const EMOTE_DURATION_MS = 3000;

interface Emote {
  readonly emoji: string;
  /** Restarts the animation when the same person reacts again. */
  readonly key: number;
}

interface EmoteState {
  /** Reactions in public channels, shown briefly above the avatar (ADR-0034). Live only, never persisted. */
  readonly emotes: Readonly<Record<string, Emote>>;
  readonly show: (personId: string, emoji: string) => void;
}

let nextKey = 0;

export const useEmoteStore = create<EmoteState>()((set, get) => ({
  emotes: {},
  show: (personId, emoji) => {
    const key = ++nextKey;
    set((state) => ({ emotes: { ...state.emotes, [personId]: { emoji, key } } }));
    setTimeout(() => {
      if (get().emotes[personId]?.key !== key) return;
      set((state) => ({
        emotes: Object.fromEntries(Object.entries(state.emotes).filter(([id]) => id !== personId)),
      }));
    }, EMOTE_DURATION_MS);
  },
}));
