import { Lock, MicOff, Phone, Video } from 'lucide-react';
import { useCallStore } from '../../stores/call-store.ts';
import { useEmoteStore } from '../../stores/emote-store.ts';
import { conversationOf, useConversationStore } from '../../stores/conversation-store.ts';
import { useMediaStore } from '../../stores/media-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { labelElements } from './label-registry.ts';

/**
 * Name labels as plain DOM above the canvas (crisp text, no per-label React roots).
 * Hidden from assistive technology: the people list is the accessible equivalent; reaction emotes are decoration,
 * the reaction itself is in the chat (ADR-0034).
 */
export function AvatarLabels() {
  const avatars = usePresenceStore((state) => state.avatars);
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const conversations = useConversationStore((state) => state.conversations);
  const speaking = useMediaStore((state) => state.speaking);
  const muted = useMediaStore((state) => state.muted);
  const onCall = useCallStore((state) => state.onCall);
  const cameraOn = useMediaStore((state) => state.cameraOn);
  const emotes = useEmoteStore((state) => state.emotes);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Object.values(avatars).map((avatar) => {
        const isMe = avatar.personId === myPersonId;
        const locked = conversationOf(conversations, avatar.personId)?.locked ?? false;
        const isSpeaking = speaking.includes(avatar.personId);
        const isMuted = muted.includes(avatar.personId);
        const emote = emotes[avatar.personId];
        return (
          <span
            key={avatar.personId}
            data-person-id={avatar.personId}
            data-speaking={isSpeaking || undefined}
            ref={(element) => {
              if (element) labelElements.set(avatar.personId, element);
              return () => {
                labelElements.delete(avatar.personId);
              };
            }}
            style={{ visibility: 'hidden' }}
            className={[
              'absolute top-0 left-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap shadow-raised',
              isMe ? 'bg-espresso font-semibold text-cream' : 'bg-surface-raised font-medium text-text-primary',
              isSpeaking ? 'ring-2 ring-status-available' : '',
            ].join(' ')}
          >
            {locked && <Lock className="size-3" />}
            {avatar.displayName}
            {isMuted && <MicOff className="size-3" />}
            {onCall.includes(avatar.personId) && <Phone className="size-3" />}
            {cameraOn.includes(avatar.personId) && <Video className="size-3" />}
            {emote && (
              <span
                key={emote.key}
                className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-2xl leading-none motion-safe:animate-emote-rise motion-reduce:animate-emote-fade"
              >
                {emote.emoji}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
