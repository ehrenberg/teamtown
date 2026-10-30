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
import type { CallAccess, CallId } from '../realtime/realtime-client.ts';
import { SpatialMixer } from './spatial-mixer.ts';
import type { VoiceMix } from './voice-mix.ts';

export interface CallAudioCallbacks {
  readonly onSpeaking: (personIds: string[]) => void;
  readonly onMuted: (personIds: string[]) => void;
  /** The media connection dropped although the call goes on; ask for a fresh token. */
  readonly onConnectionLost: (callId: CallId) => void;
  readonly onMicrophoneFailed: () => void;
  /** Remote camera tracks of the current call, by person. */
  readonly onVideos: (videos: ReadonlyMap<string, MediaStreamTrack>) => void;
  /** One's own camera track while it is on. */
  readonly onLocalVideo: (track: MediaStreamTrack | null) => void;
  readonly onCameraFailed: () => void;
}

/**
 * Audio and video of the call one is in. Switching rooms is make-before-break, so a merge or split doesn't cut off
 * the voices. The camera follows `setCameraOn`; switching it off for every new call is up to the caller.
 */
export class CallAudio {
  #current: { readonly callId: CallId; readonly room: Room } | null = null;
  /** The call whose room is being joined right now; a second token for it must not open a second room. */
  #joining: CallId | null = null;
  /** Bumped by `leave()`, so a join that finishes afterwards is dropped. */
  #generation = 0;
  #microphoneOn: boolean;
  #cameraOn = false;
  readonly #videos = new Map<string, MediaStreamTrack>();
  readonly #mixer: SpatialMixer;

  constructor(
    context: AudioContext,
    microphoneOn: boolean,
    private readonly callbacks: CallAudioCallbacks,
  ) {
    this.#mixer = new SpatialMixer(context);
    this.#microphoneOn = microphoneOn;
  }

  get callId(): CallId | null {
    return this.#current?.callId ?? null;
  }

  isActive(callId: CallId): boolean {
    return (
      this.#joining === callId ||
      (this.#current?.callId === callId && this.#current.room.state === ConnectionState.Connected)
    );
  }

  async join(access: CallAccess): Promise<void> {
    if (this.isActive(access.callId)) return;

    this.#joining = access.callId;
    const generation = this.#generation;
    const room = new Room({ adaptiveStream: false, dynacast: false });
    try {
      this.#wire(room, access.callId);
      await room.connect(access.url, access.token, { autoSubscribe: true });
    } finally {
      if (this.#joining === access.callId) this.#joining = null;
    }
    if (generation !== this.#generation) {
      await room.disconnect(); // left the call while connecting
      return;
    }

    // Switch over at once, so no event of the new room is missed (LiveKit reports speakers only on change) …
    const previous = this.#current;
    this.#current = { callId: access.callId, room };
    this.#mixer.clear();
    this.#videos.clear();
    this.callbacks.onLocalVideo(null);
    for (const participant of room.remoteParticipants.values()) this.#addVoices(participant);
    this.#reportVideos();
    this.callbacks.onSpeaking(room.activeSpeakers.map((speaker) => speaker.identity));
    this.#reportMuted();
    // … but keep the old room until one's own voice is on air in the new one (make-before-break).
    if (this.#microphoneOn) await this.#enableMicrophone(room);
    this.#reportMuted();
    // The camera may have been switched on while the room was still connecting.
    if (this.#cameraOn) await this.setCameraOn(true);
    await previous?.room.disconnect();
  }

  async leave(callId?: CallId): Promise<void> {
    if (!callId || this.#joining === callId) {
      this.#generation++;
      this.#joining = null;
    }
    const current = this.#current;
    if (!current || (callId && current.callId !== callId)) return;
    this.#current = null;
    this.#clearMedia();
    this.callbacks.onMuted([]);
    await current.room.disconnect();
  }

  async setCameraOn(on: boolean): Promise<void> {
    this.#cameraOn = on;
    const room = this.#current?.room;
    if (!room) return;
    try {
      await room.localParticipant.setCameraEnabled(on);
    } catch {
      if (this.#current?.room !== room || room.state !== ConnectionState.Connected) return;
      this.#cameraOn = false;
      this.callbacks.onCameraFailed();
    }
    const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    this.callbacks.onLocalVideo(this.#cameraOn && track ? track.mediaStreamTrack : null);
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
      // Leaving the room while the microphone starts aborts it: that is no microphone problem.
      if (this.#current?.room !== room || room.state !== ConnectionState.Connected) return;
      this.#microphoneOn = false;
      this.callbacks.onMicrophoneFailed();
    }
  }

  #wire(room: Room, callId: CallId): void {
    const isCurrent = () => this.#current?.room === room;
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication, participant: RemoteParticipant) => {
      if (!isCurrent()) return;
      if (track.kind === Track.Kind.Audio) this.#mixer.add(participant.identity, track.mediaStreamTrack);
      if (track.source === Track.Source.Camera) {
        this.#videos.set(participant.identity, track.mediaStreamTrack);
        this.#reportVideos();
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _publication, participant: RemoteParticipant) => {
      if (!isCurrent()) return;
      if (track.kind === Track.Kind.Audio) this.#mixer.remove(participant.identity);
      if (track.source === Track.Source.Camera && this.#videos.delete(participant.identity)) this.#reportVideos();
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      if (!isCurrent()) return;
      this.#mixer.remove(participant.identity);
      if (this.#videos.delete(participant.identity)) this.#reportVideos();
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
      this.#clearMedia();
      // Removed by the server (left the conversation or room) or replaced by another connection of ours is expected;
      // anything else is a lost connection.
      const expected = [
        DisconnectReason.PARTICIPANT_REMOVED,
        DisconnectReason.ROOM_DELETED,
        DisconnectReason.DUPLICATE_IDENTITY,
      ];
      if (reason === undefined || !expected.includes(reason)) {
        this.callbacks.onConnectionLost(callId);
      }
    });
  }

  #addVoices(participant: RemoteParticipant): void {
    const track = participant.getTrackPublication(Track.Source.Microphone)?.track;
    if (track) this.#mixer.add(participant.identity, track.mediaStreamTrack);
    const camera = participant.getTrackPublication(Track.Source.Camera)?.track;
    if (camera) this.#videos.set(participant.identity, camera.mediaStreamTrack);
  }

  #reportVideos(): void {
    this.callbacks.onVideos(new Map(this.#videos));
  }

  #clearMedia(): void {
    this.#mixer.clear();
    this.#videos.clear();
    this.callbacks.onSpeaking([]);
    this.callbacks.onLocalVideo(null);
    this.#reportVideos();
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
