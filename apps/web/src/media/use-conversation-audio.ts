import { positionAt, type Point } from '@teamtown/world-core';
import { useEffect, useState } from 'react';
import type { RealtimeClient } from '../realtime/realtime-client.ts';
import { serverClock } from '../shared/server-clock.ts';
import { conversationOf, useConversationStore } from '../stores/conversation-store.ts';
import { useMediaStore } from '../stores/media-store.ts';
import { usePresenceStore } from '../stores/presence-store.ts';
import { audioContext } from './audio-context.ts';
import { ConversationAudio } from './conversation-audio.ts';
import { voiceMix, type VoiceMix } from './voice-mix.ts';

const MIX_INTERVAL_MS = 100;
/** If no token arrived this long after entering a conversation, ask for one (e.g. after a reconnect). */
const TOKEN_REQUEST_DELAY_MS = 1_500;

function positionOf(personId: string, now: number): Point | null {
  const avatar = usePresenceStore.getState().avatars[personId];
  if (!avatar) return null;
  return avatar.movement ? positionAt(avatar.movement, now) : avatar.tile;
}

export function useConversationAudio(realtime: RealtimeClient): void {
  const microphone = useMediaStore((state) => state.microphone);
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const myConversationId = useConversationStore(
    (state) => conversationOf(state.conversations, myPersonId)?.conversationId ?? null,
  );
  const [audio] = useState(() => {
    const media = useMediaStore.getState();
    return new ConversationAudio(audioContext(), media.microphone === 'on', {
      onSpeaking: (ids) => {
        useMediaStore.getState().setSpeaking(ids);
      },
      onMuted: (ids) => {
        useMediaStore.getState().setMuted(ids);
      },
      onConnectionLost: (conversationId) => void realtime.requestConversationToken(conversationId),
      onMicrophoneFailed: () => {
        useMediaStore.getState().setMicrophone('unavailable');
      },
    });
  });

  useEffect(
    () =>
      realtime.onConversationAccess((access) => {
        void audio.join(access);
      }),
    [realtime, audio],
  );

  useEffect(() => {
    if (!myConversationId) {
      void audio.leave();
      return;
    }
    if (audio.isActive(myConversationId)) return;
    const timer = setTimeout(() => {
      if (!audio.isActive(myConversationId)) void realtime.requestConversationToken(myConversationId);
    }, TOKEN_REQUEST_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [audio, realtime, myConversationId]);

  useEffect(() => {
    void audio.setMicrophoneOn(microphone === 'on');
  }, [audio, microphone]);

  useEffect(() => {
    const timer = setInterval(() => {
      const me = usePresenceStore.getState().myPersonId;
      const now = serverClock.now();
      const myPosition = me ? positionOf(me, now) : null;
      const conversation = conversationOf(useConversationStore.getState().conversations, me);
      const mixes = new Map<string, VoiceMix>();
      if (myPosition && conversation) {
        for (const personId of conversation.participants) {
          const position = personId === me ? null : positionOf(personId, now);
          if (position) mixes.set(personId, voiceMix(myPosition, position));
        }
      }
      audio.mix(mixes);
    }, MIX_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [audio]);

  useEffect(
    () => () => {
      void audio.leave();
    },
    [audio],
  );
}
