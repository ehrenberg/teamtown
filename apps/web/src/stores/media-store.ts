import { create } from 'zustand';

/** `unavailable`: no permission or no device; the person can still listen. */
export type MicrophoneState = 'on' | 'off' | 'unavailable';
/** Off by default and again in every new call (ADR-0031); `unavailable`: no permission or no camera. */
export type CameraState = 'on' | 'off' | 'unavailable';

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
  readonly camera: CameraState;
  /** Remote camera tracks of the current call. Live media only, never stored anywhere. */
  readonly videos: ReadonlyMap<string, MediaStreamTrack>;
  readonly localVideo: MediaStreamTrack | null;
  /** People on the current floor whose camera is on (no picture unless they are in one's call). */
  readonly cameraOn: readonly string[];
  /** The screen shared in one's call (by someone else or oneself). */
  readonly screenShare: { readonly personId: string; readonly track: MediaStreamTrack } | null;
  readonly sharingScreen: boolean;
  /** Bumped to ask the video panel to show the shared screen in full screen (e.g. after a click on the wall). */
  readonly fullScreenRequests: number;
  readonly setScreenShare: (share: MediaState['screenShare']) => void;
  readonly setSharingScreen: (sharing: boolean) => void;
  readonly requestFullScreen: () => void;
  readonly setCamera: (camera: CameraState) => void;
  readonly setVideos: (videos: ReadonlyMap<string, MediaStreamTrack>) => void;
  readonly setLocalVideo: (track: MediaStreamTrack | null) => void;
  readonly setCameraOn: (personIds: readonly string[]) => void;
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
  camera: 'off',
  videos: new Map(),
  localVideo: null,
  cameraOn: [],
  screenShare: null,
  sharingScreen: false,
  fullScreenRequests: 0,
  setScreenShare: (screenShare) => {
    set({ screenShare });
  },
  setSharingScreen: (sharingScreen) => {
    set({ sharingScreen });
  },
  requestFullScreen: () => {
    set((state) => ({ fullScreenRequests: state.fullScreenRequests + 1 }));
  },
  setCamera: (camera) => {
    set({ camera });
  },
  setVideos: (videos) => {
    set({ videos });
  },
  setLocalVideo: (localVideo) => {
    set({ localVideo });
  },
  setCameraOn: (cameraOn) => {
    set({ cameraOn });
  },
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
