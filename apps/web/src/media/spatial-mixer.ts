import type { VoiceMix } from './voice-mix.ts';

interface Voice {
  readonly element: HTMLAudioElement;
  readonly source: MediaStreamAudioSourceNode;
  readonly gain: GainNode;
  readonly panner: StereoPannerNode;
}

const SMOOTHING = 0.08;

/**
 * Chrome only delivers remote WebRTC audio to WebAudio while the stream is attached to a media element,
 * so each voice also has a muted `<audio>` element.
 */
export class SpatialMixer {
  readonly #voices = new Map<string, Voice>();

  constructor(private readonly context: AudioContext) {}

  add(personId: string, track: MediaStreamTrack): void {
    this.remove(personId);
    const stream = new MediaStream([track]);
    const element = new Audio();
    element.srcObject = stream;
    element.muted = true;
    void element.play().catch(() => undefined);

    const source = this.context.createMediaStreamSource(stream);
    const gain = this.context.createGain();
    gain.gain.value = 0; // silent until the first position update
    const panner = this.context.createStereoPanner();
    source.connect(gain).connect(panner).connect(this.context.destination);
    this.#voices.set(personId, { element, source, gain, panner });
  }

  remove(personId: string): void {
    const voice = this.#voices.get(personId);
    if (!voice) return;
    voice.source.disconnect();
    voice.gain.disconnect();
    voice.panner.disconnect();
    voice.element.srcObject = null;
    this.#voices.delete(personId);
  }

  set(personId: string, mix: VoiceMix): void {
    const voice = this.#voices.get(personId);
    if (!voice) return;
    const now = this.context.currentTime;
    voice.gain.gain.setTargetAtTime(mix.volume, now, SMOOTHING);
    voice.panner.pan.setTargetAtTime(mix.pan, now, SMOOTHING);
  }

  personIds(): string[] {
    return [...this.#voices.keys()];
  }

  clear(): void {
    for (const personId of [...this.#voices.keys()]) this.remove(personId);
  }
}
