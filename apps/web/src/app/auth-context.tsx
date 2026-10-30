import { createContext, useContext, type ReactNode } from 'react';
import type { AuthClient } from '../auth/auth-client.ts';

const AuthContext = createContext<AuthClient | null>(null);

export function AuthProvider({ client, children }: { readonly client: AuthClient; readonly children: ReactNode }) {
  return <AuthContext value={client}>{children}</AuthContext>;
}

export function useAuthClient(): AuthClient {
  const client = useContext(AuthContext);
  if (!client) throw new Error('useAuthClient must be used inside <AuthProvider>');
  return client;
}
