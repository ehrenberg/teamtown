import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { conversationOf, useConversationStore } from '../../stores/conversation-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';

export function ConversationAnnouncer() {
  const { t } = useTranslation();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const conversation = useConversationStore((state) => conversationOf(state.conversations, myPersonId));
  const [message, setMessage] = useState('');
  const previous = useRef<{ id: string; participants: string; locked: boolean } | null>(null);

  useEffect(() => {
    const before = previous.current;
    const now = conversation
      ? { id: conversation.conversationId, participants: conversation.participants.join(), locked: conversation.locked }
      : null;
    previous.current = now;
    if (!now) {
      if (before) setMessage(t('conversation.left'));
      return;
    }
    if (before?.participants !== now.participants || before.id !== now.id) {
      const { avatars } = usePresenceStore.getState();
      const names = (conversation?.participants ?? [])
        .filter((id) => id !== myPersonId)
        .map((id) => avatars[id]?.displayName ?? '')
        .filter(Boolean);
      setMessage(t('conversation.talkingWith', { names: names.join(', ') }));
    } else if (before.locked !== now.locked) {
      setMessage(t(now.locked ? 'conversation.nowLocked' : 'conversation.nowUnlocked'));
    }
  }, [conversation, myPersonId, t]);

  return (
    <p aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
