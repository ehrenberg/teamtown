import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { serverClock } from '../shared/server-clock.ts';
import { currentAccessToken, useSessionStore } from '../stores/session-store.ts';
import { RealtimeClient, realtimeUrl } from './realtime-client.ts';

const RealtimeContext = createContext<RealtimeClient | null>(null);

/** Owns the realtime connection while the person is signed in and forwards refreshed tokens. */
export function RealtimeProvider({ children }: { readonly children: ReactNode }) {
  const [client] = useState(
    () =>
      new RealtimeClient({ url: realtimeUrl(window.location), getAccessToken: currentAccessToken, clock: serverClock }),
  );

  useEffect(() => {
    client.start();
    const unsubscribe = useSessionStore.subscribe((state, previous) => {
      if (state.session && state.session.accessToken !== previous.session?.accessToken) {
        client.reauthenticate();
      }
    });
    return () => {
      unsubscribe();
      client.stop();
    };
  }, [client]);

  return <RealtimeContext value={client}>{children}</RealtimeContext>;
}

export function useRealtime(): RealtimeClient {
  const client = useContext(RealtimeContext);
  if (!client) throw new Error('useRealtime must be used inside <RealtimeProvider>');
  return client;
}
