import { Button } from '@teamtown/ui';
import { Lock, LockOpen, Mic, MicOff } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRealtime } from '../../realtime/realtime-context.tsx';
import { conversationOf, useConversationStore } from '../../stores/conversation-store.ts';
import { useMediaStore } from '../../stores/media-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const toggleMicrophone = () => {
  const { microphone, setMicrophone } = useMediaStore.getState();
  setMicrophone(microphone === 'on' ? 'off' : 'on');
};

export function MicrophoneToggle() {
  const { t } = useTranslation();
  const microphone = useMediaStore((state) => state.microphone);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyM' || isTyping(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      toggleMicrophone();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const on = microphone === 'on';
  return (
    <Button
      variant="ghost"
      aria-pressed={on}
      aria-keyshortcuts="M"
      title={t('media.microphoneShortcut')}
      onClick={toggleMicrophone}
    >
      {on ? <Mic aria-hidden="true" className="size-4" /> : <MicOff aria-hidden="true" className="size-4" />}
      {microphone === 'unavailable'
        ? t('media.microphoneUnavailable')
        : t(on ? 'media.microphoneOn' : 'media.microphoneOff')}
    </Button>
  );
}

export function ConversationLockToggle() {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const conversation = useConversationStore((state) => conversationOf(state.conversations, myPersonId));
  if (!conversation) return null;

  const { locked } = conversation;
  return (
    <Button
      variant="ghost"
      aria-pressed={locked}
      onClick={() => void realtime.lockConversation(conversation.conversationId, !locked)}
    >
      {locked ? <Lock aria-hidden="true" className="size-4" /> : <LockOpen aria-hidden="true" className="size-4" />}
      {t(locked ? 'conversation.unlock' : 'conversation.lock')}
    </Button>
  );
}
