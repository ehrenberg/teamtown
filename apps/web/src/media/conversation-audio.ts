import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
} from 'livekit-client';
import type { ConversationAccess } from '../realtime/realtime-client.ts';
import { SpatialMixer } from './spatial-mixer.ts';
import type { VoiceMix } from './voice-mix.ts';

export interface ConversationAudioCallbacks {
  readonly onSpeaking: (personIds: string[]) => void;
  readonly onMuted: (personIds: string[]) => void;
  /** The media connection dropped although the conversation goes on; ask for a fresh token. */
  readonly onConnectionLost: (conversationId: string) => void;
  readonly onMicrophoneFailed: () => void;
}

/** Switching rooms is make-before-break, so a merge or split doesn't cut off the voices. */
export class ConversationAudio {
  #current: { readonly conversationId: string; readonly room: Room } | null = null;
  /** The conversation whose room is being joined right now; a second token for it must not open a second room. */
  #joining: string | null = null;
  /** Bumped by `leave()`, so a join that finishes afterwards is dropped. */
  #generation = 0;
  #microphoneOn: boolean;
  readonly #mixer: SpatialMixer;

  constructor(
    context: AudioContext,
    microphoneOn: boolean,
    private readonly callbacks: ConversationAudioCallbacks,
  ) {
    this.#mixer = new SpatialMixer(context);
    this.#microphoneOn = microphoneOn;
  }

  get conversationId(): string | null {
    return this.#current?.conversationId ?? null;
  }

  isActive(conversationId: string): boolean {
    return (
      this.#joining === conversationId ||
      (this.#current?.conversationId === conversationId && this.#current.room.state === ConnectionState.Connected)
    );
  }

  async join(access: ConversationAccess): Promise<void> {
    if (this.isActive(access.conversationId)) return;

    this.#joining = access.conversationId;
    const generation = this.#generation;
    const room = new Room({ adaptiveStream: false, dynacast: false });
    try {
      this.#wire(room, access.conversationId);
      await room.connect(access.url, access.token, { autoSubscribe: true });
    } finally {
      if (this.#joining === access.conversationId) this.#joining = null;
    }
    if (generation !== this.#generation) {
      await room.disconnect(); // left the conversation while connecting
      return;
    }

    // Switch over at once, so no event of the new room is missed (LiveKit reports speakers only on change) …
    const previous = this.#current;
    this.#current = { conversationId: access.conversationId, room };
    this.#mixer.clear();
    for (const participant of room.remoteParticipants.values()) this.#addVoices(participant);
    this.callbacks.onSpeaking(room.activeSpeakers.map((speaker) => speaker.identity));
    this.#reportMuted();
    // … but keep the old room until one's own voice is on air in the new one (make-before-break).
    if (this.#microphoneOn) await this.#enableMicrophone(room);
    this.#reportMuted();
    await previous?.room.disconnect();
  }

  async leave(conversationId?: string): Promise<void> {
    if (!conversationId || this.#joining === conversationId) {
      this.#generation++;
      this.#joining = null;
    }
    const current = this.#current;
    if (!current || (conversationId && current.conversationId !== conversationId)) return;
    this.#current = null;
    this.#mixer.clear();
    this.callbacks.onSpeaking([]);
    this.callbacks.onMuted([]);
    await current.room.disconnect();
  }

  async setMicrophoneOn(on: boolean): Promise<void> {
    this.#microphoneOn = on;
    const room = this.#current?.room;
    if (!room) return;
    if (on) await this.#enableMicrophone(room);
    else await room.localParticipant.setMicrophoneEnabled(false);
    this.#reportMuted();
  }

  mix(mixes: ReadonlyMap<string, VoiceMix>): void {
    for (const personId of this.#mixer.personIds()) {
      this.#mixer.set(personId, mixes.get(personId) ?? { volume: 0, pan: 0 });
    }
  }

  async #enableMicrophone(room: Room): Promise<void> {
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch {
      this.#microphoneOn = false;
      this.callbacks.onMicrophoneFailed();
    }
  }

  #wire(room: Room, conversationId: string): void {
    const isCurrent = () => this.#current?.room === room;
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication, participant: RemoteParticipant) => {
      if (isCurrent() && track.kind === Track.Kind.Audio) this.#mixer.add(participant.identity, track.mediaStreamTrack);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _publication, participant: RemoteParticipant) => {
      if (isCurrent() && track.kind === Track.Kind.Audio) this.#mixer.remove(participant.identity);
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (isCurrent()) this.#mixer.remove(participant.identity);
    });
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      if (isCurrent()) this.callbacks.onSpeaking(speakers.map((speaker) => speaker.identity));
    });
    for (const event of [
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
    ] as const) {
      room.on(event, () => {
        if (isCurrent()) this.#reportMuted();
      });
    }
    room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      if (!isCurrent()) return;
      this.#current = null;
      this.#mixer.clear();
      this.callbacks.onSpeaking([]);
      // Removed by the server (left the conversation) or replaced by another connection of ours is expected;
      // anything else is a lost connection.
      const expected = [
        DisconnectReason.PARTICIPANT_REMOVED,
        DisconnectReason.ROOM_DELETED,
        DisconnectReason.DUPLICATE_IDENTITY,
      ];
      if (reason === undefined || !expected.includes(reason)) {
        this.callbacks.onConnectionLost(conversationId);
      }
    });
  }

  #addVoices(participant: RemoteParticipant): void {
    const track = participant.getTrackPublication(Track.Source.Microphone)?.track;
    if (track) this.#mixer.add(participant.identity, track.mediaStreamTrack);
  }

  #reportMuted(): void {
    const room = this.#current?.room;
    if (!room) return;
    const silent = (participant: Participant) => {
      const microphone = participant.getTrackPublication(Track.Source.Microphone);
      return !microphone || microphone.isMuted;
    };
    const muted = [...room.remoteParticipants.values()].filter(silent).map((p) => p.identity);
    if (silent(room.localParticipant)) muted.push(room.localParticipant.identity);
    this.callbacks.onMuted(muted);
  }
}
