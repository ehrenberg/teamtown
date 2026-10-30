import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';

const SAMPLE_RATE = 16_000;
const SECONDS = 6;

/**
 * Writes a speech-like test signal (a tone in syllables, about four per second) as 16-bit mono WAV.
 * Each person gets their own pitch: two identical signals would cancel each other out in Chrome's echo
 * cancellation, and nobody would be detected as speaking.
 */
function writeVoice(file: string, frequency: number): void {
  const samples = SAMPLE_RATE * SECONDS;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const t = i / SAMPLE_RATE;
    const syllable = Math.max(0, Math.sin(2 * Math.PI * 4 * t)) ** 2;
    const voice = Math.sin(2 * Math.PI * frequency * t) + 0.5 * Math.sin(2 * Math.PI * frequency * 2.01 * t);
    data.writeInt16LE(Math.round(syllable * voice * 0.4 * 32_767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
}

export async function browserWithVoice(frequency: number): Promise<Browser> {
  const file = path.join(tmpdir(), `teamtown-voice-${String(frequency)}.wav`);
  writeVoice(file, frequency);
  return chromium.launch({
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${file}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
}
