import { useTranslation } from 'react-i18next';
import { AudioCheckScreen } from '../features/audio-check/audio-check-screen.tsx';
import { SignInScreen } from '../features/auth/sign-in-screen.tsx';
import { ChannelList } from '../features/chat/channel-list.tsx';
import { ChatPanel } from '../features/chat/chat-panel.tsx';
import { MessagingSync } from '../features/chat/messaging-sync.ts';
import { OfficePage } from '../features/office/office-page.tsx';
import { RealtimeProvider } from '../realtime/realtime-context.tsx';
import { useMediaStore } from '../stores/media-store.ts';
import { useSessionStore } from '../stores/session-store.ts';

export function App() {
  const { t } = useTranslation();
  const status = useSessionStore((state) => state.status);
  const audioCheckDone = useMediaStore((state) => state.audioCheckDone);

  if (status === 'initialising') {
    return <p className="grid h-full place-items-center text-text-secondary">{t('auth.opening')}</p>;
  }
  if (status === 'signed-out') {
    return <SignInScreen />;
  }
  if (!audioCheckDone) {
    return <AudioCheckScreen />;
  }
  return (
    <RealtimeProvider>
      <MessagingSync />
      <OfficePage sidebar={<ChannelList />} sidePanel={<ChatPanel />} />
    </RealtimeProvider>
  );
}
