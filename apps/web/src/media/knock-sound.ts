import { audioContext } from './audio-context.ts';

/** Two soft knocks on wood, synthesised so no audio asset is needed. */
export function playKnock(): void {
  const context = audioContext();
  const start = context.currentTime + 0.02;
  for (const offset of [0, 0.16]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(190, start + offset);
    oscillator.frequency.exponentialRampToValueAtTime(90, start + offset + 0.09);
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.13);
  }
}
