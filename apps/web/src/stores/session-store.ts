import { create } from 'zustand';
import type { AuthSession } from '../auth/auth-client.ts';

export type SessionStatus = 'initialising' | 'signed-out' | 'signed-in';

interface SessionState {
  readonly status: SessionStatus;
  readonly session: AuthSession | null;
  readonly setSession: (session: AuthSession | null) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  status: 'initialising',
  session: null,
  setSession: (session) => {
    set({ session, status: session ? 'signed-in' : 'signed-out' });
  },
}));

/** For non-React code (API and realtime clients). */
export const currentAccessToken = (): string | null => useSessionStore.getState().session?.accessToken ?? null;
