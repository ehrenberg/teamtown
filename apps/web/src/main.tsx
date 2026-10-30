import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { App } from './app/app.tsx';
import { AuthProvider } from './app/auth-context.tsx';
import { appConfig } from './app/config.ts';
import { i18n } from './app/i18n.ts';
import type { AuthClient } from './auth/auth-client.ts';
import { DesktopAuthClient } from './auth/desktop-auth-client.ts';
import { OidcAuthClient } from './auth/oidc-auth-client.ts';
import { getPlatformBridge } from './platform/platform-bridge.ts';
import { useSessionStore } from './stores/session-store.ts';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element in index.html');
}

const platform = getPlatformBridge();
const authClient: AuthClient = platform.auth
  ? new DesktopAuthClient(platform.auth)
  : new OidcAuthClient({
      issuer: appConfig.oidcIssuer,
      clientId: appConfig.oidcClientId,
      origin: window.location.origin,
    });

const { setSession } = useSessionStore.getState();
authClient.onSessionChanged(setSession);
authClient.initialise().then(setSession, (error: unknown) => {
  console.error('Login could not be completed', error);
  setSession(null);
});

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

createRoot(rootElement).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={authClient}>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </I18nextProvider>
  </StrictMode>,
);
