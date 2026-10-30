import { audioContext } from './audio-context.ts';

/** One soft two-tone ring, synthesised so no audio asset is needed. Repeat it while a call rings. */
export function playRing(): void {
  const context = audioContext();
  const start = context.currentTime + 0.02;
  for (const [offset, frequency] of [
    [0, 660],
    [0.18, 880],
  ] as const) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start + offset);
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.17);
  }
}
