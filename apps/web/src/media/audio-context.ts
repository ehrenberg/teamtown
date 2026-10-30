let shared: AudioContext | null = null;

/** Browsers only let an AudioContext play after a user gesture; the audio check calls `unlockAudio()`. */
export function audioContext(): AudioContext {
  shared ??= new AudioContext();
  return shared;
}

export async function unlockAudio(): Promise<void> {
  const context = audioContext();
  if (context.state !== 'running') await context.resume();
}
