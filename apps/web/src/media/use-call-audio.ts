import { positionAt, type Point } from '@teamtown/world-core';
import { useEffect, useState } from 'react';
import { conversationCallId, roomCallId, type CallId, type RealtimeClient } from '../realtime/realtime-client.ts';
import { serverClock } from '../shared/server-clock.ts';
import { conversationOf, useConversationStore } from '../stores/conversation-store.ts';
import { useMediaStore } from '../stores/media-store.ts';
import { usePresenceStore } from '../stores/presence-store.ts';
import { roomCallOf, useRoomStore } from '../stores/room-store.ts';
import { audioContext } from './audio-context.ts';
import { CallAudio } from './call-audio.ts';
import { voiceMix, type VoiceMix } from './voice-mix.ts';

const MIX_INTERVAL_MS = 100;
/** If no token arrived this long after entering a call, ask for one (e.g. after a reconnect). */
const TOKEN_REQUEST_DELAY_MS = 1_500;
/** Everyone in a room call is heard at full volume from the front (ADR-0031). */
const ROOM_CALL_MIX: VoiceMix = { volume: 1, pan: 0 };

function positionOf(personId: string, now: number): Point | null {
  const avatar = usePresenceStore.getState().avatars[personId];
  if (!avatar) return null;
  return avatar.movement ? positionAt(avatar.movement, now) : avatar.tile;
}

/** The call one is in: a proximity conversation, or the call of the audio-isolated room one is inside. */
function currentCall(): { readonly callId: CallId; readonly participants: readonly string[] } | null {
  const me = usePresenceStore.getState().myPersonId;
  const conversation = conversationOf(useConversationStore.getState().conversations, me);
  if (conversation) return { callId: conversationCallId(conversation.conversationId), ...conversation };
  const { roomCalls } = useRoomStore.getState();
  const roomId = roomCallOf(roomCalls, me);
  return roomId ? { callId: roomCallId(roomId), participants: roomCalls[roomId] ?? [] } : null;
}

export function useCallAudio(realtime: RealtimeClient): void {
  const microphone = useMediaStore((state) => state.microphone);
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const myConversationId = useConversationStore(
    (state) => conversationOf(state.conversations, myPersonId)?.conversationId ?? null,
  );
  const myRoomCallId = useRoomStore((state) => roomCallOf(state.roomCalls, myPersonId));
  const myCallId = myConversationId
    ? conversationCallId(myConversationId)
    : myRoomCallId
      ? roomCallId(myRoomCallId)
      : null;

  const [audio] = useState(() => {
    const media = useMediaStore.getState();
    return new CallAudio(audioContext(), media.microphone === 'on', {
      onSpeaking: (ids) => {
        useMediaStore.getState().setSpeaking(ids);
      },
      onMuted: (ids) => {
        useMediaStore.getState().setMuted(ids);
      },
      onConnectionLost: (callId) => void realtime.requestCallToken(callId),
      onMicrophoneFailed: () => {
        useMediaStore.getState().setMicrophone('unavailable');
      },
    });
  });

  useEffect(
    () =>
      realtime.onCallAccess((access) => {
        void audio.join(access);
      }),
    [realtime, audio],
  );

  useEffect(() => {
    if (!myCallId) {
      void audio.leave();
      return;
    }
    if (audio.isActive(myCallId)) return;
    const timer = setTimeout(() => {
      if (!audio.isActive(myCallId)) void realtime.requestCallToken(myCallId);
    }, TOKEN_REQUEST_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [audio, realtime, myCallId]);

  useEffect(() => {
    void audio.setMicrophoneOn(microphone === 'on');
  }, [audio, microphone]);

  useEffect(() => {
    const timer = setInterval(() => {
      const me = usePresenceStore.getState().myPersonId;
      const call = currentCall();
      const mixes = new Map<string, VoiceMix>();
      if (call?.callId.startsWith('room:')) {
        for (const personId of call.participants) if (personId !== me) mixes.set(personId, ROOM_CALL_MIX);
      } else if (call && me) {
        const now = serverClock.now();
        const myPosition = positionOf(me, now);
        for (const personId of call.participants) {
          const position = personId === me ? null : positionOf(personId, now);
          if (myPosition && position) mixes.set(personId, voiceMix(myPosition, position));
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
