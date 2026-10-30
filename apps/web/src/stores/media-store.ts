import { create } from 'zustand';

/** `unavailable`: no permission or no device; the person can still listen. */
export type MicrophoneState = 'on' | 'off' | 'unavailable';

const MICROPHONE_DEFAULT_KEY = 'teamtown.microphone-default';

const storage = (): Storage | null => (typeof localStorage === 'undefined' ? null : localStorage);

/** The per-person microphone default (ADR-0031: initially on). Stored on this device for now. */
export const microphoneDefault = (): 'on' | 'off' =>
  storage()?.getItem(MICROPHONE_DEFAULT_KEY) === 'off' ? 'off' : 'on';

interface MediaState {
  readonly audioCheckDone: boolean;
  readonly microphone: MicrophoneState;
  readonly speaking: readonly string[];
  readonly muted: readonly string[];
  readonly finishAudioCheck: (microphone: MicrophoneState) => void;
  readonly setMicrophone: (microphone: MicrophoneState) => void;
  readonly setSpeaking: (personIds: readonly string[]) => void;
  readonly setMuted: (personIds: readonly string[]) => void;
}

export const useMediaStore = create<MediaState>()((set) => ({
  audioCheckDone: false,
  microphone: microphoneDefault(),
  speaking: [],
  muted: [],
  finishAudioCheck: (microphone) => {
    set({ audioCheckDone: true, microphone });
  },
  setMicrophone: (microphone) => {
    if (microphone !== 'unavailable') storage()?.setItem(MICROPHONE_DEFAULT_KEY, microphone);
    set({ microphone });
  },
  setSpeaking: (speaking) => {
    set({ speaking });
  },
  setMuted: (muted) => {
    set({ muted });
  },
}));
