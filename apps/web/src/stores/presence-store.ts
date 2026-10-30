import type { AvatarState, ServerEvent } from '@teamtown/contracts';
import { create } from 'zustand';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';
type Movement = NonNullable<AvatarState['movement']>;

interface PresenceState {
  readonly connection: ConnectionStatus;
  readonly myPersonId: string | null;
  readonly floorId: string | null;
  /** Avatars on the current floor by person ID. Live data only, never persisted (ADR-0012). */
  readonly avatars: Readonly<Record<string, AvatarState>>;
  readonly setConnection: (connection: ConnectionStatus) => void;
  readonly setMyPersonId: (personId: string) => void;
  readonly applySnapshot: (floorId: string, avatars: readonly AvatarState[]) => void;
  readonly applyEvent: (event: ServerEvent) => void;
  /** Client-side prediction for keyboard movement; replaced by the server's path when it arrives. */
  readonly predictMovement: (personId: string, movement: Movement) => void;
}

const withoutKey = <T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([id]) => id !== key));

export const usePresenceStore = create<PresenceState>()((set) => ({
  connection: 'connecting',
  myPersonId: null,
  floorId: null,
  avatars: {},
  setConnection: (connection) => {
    set({ connection });
  },
  setMyPersonId: (myPersonId) => {
    set({ myPersonId });
  },
  applySnapshot: (floorId, avatars) => {
    set({ floorId, avatars: Object.fromEntries(avatars.map((avatar) => [avatar.personId, avatar])) });
  },
  applyEvent: (event) => {
    set((state) => {
      switch (event.t) {
        case 'AvatarJoined':
          return event.p.floorId === state.floorId
            ? { avatars: { ...state.avatars, [event.p.avatar.personId]: event.p.avatar } }
            : {};
        case 'AvatarLeft':
          return event.p.floorId === state.floorId ? { avatars: withoutKey(state.avatars, event.p.personId) } : {};
        case 'AvatarPathStarted': {
          const avatar = state.avatars[event.p.personId];
          return event.p.floorId === state.floorId && avatar
            ? {
                avatars: {
                  ...state.avatars,
                  [avatar.personId]: { ...avatar, tile: event.p.movement.from, movement: event.p.movement },
                },
              }
            : {};
        }
        default:
          return {};
      }
    });
  },
  predictMovement: (personId, movement) => {
    set((state) => {
      const avatar = state.avatars[personId];
      return avatar ? { avatars: { ...state.avatars, [personId]: { ...avatar, tile: movement.from, movement } } } : {};
    });
  },
}));
