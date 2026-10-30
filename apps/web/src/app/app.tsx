import { useTranslation } from 'react-i18next';
import { SignInScreen } from '../features/auth/sign-in-screen.tsx';
import { OfficePage } from '../features/office/office-page.tsx';
import { RealtimeProvider } from '../realtime/realtime-context.tsx';
import { useSessionStore } from '../stores/session-store.ts';

export function App() {
  const { t } = useTranslation();
  const status = useSessionStore((state) => state.status);

  if (status === 'initialising') {
    return <p className="grid h-full place-items-center text-text-secondary">{t('auth.opening')}</p>;
  }
  if (status === 'signed-out') {
    return <SignInScreen />;
  }
  return (
    <RealtimeProvider>
      <OfficePage />
    </RealtimeProvider>
  );
}
