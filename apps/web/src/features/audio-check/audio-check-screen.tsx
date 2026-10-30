import { Button } from '@teamtown/ui';
import { Mic, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audioContext, unlockAudio } from '../../media/audio-context.ts';
import { microphoneDefault, useMediaStore } from '../../stores/media-store.ts';

type Permission = 'unknown' | 'granted' | 'denied';

function playTestSound(): void {
  const context = audioContext();
  const start = context.currentTime;
  for (const [index, frequency] of [660, 880].entries()) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start + index * 0.18);
    gain.gain.linearRampToValueAtTime(0.2, start + index * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + index * 0.18 + 0.4);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + index * 0.18);
    oscillator.stop(start + index * 0.18 + 0.45);
  }
}

function useLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream) return;
    const context = audioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let frame = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      setLevel(Math.min(100, Math.round(rms * 400)));
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
    };
  }, [stream]);
  return level;
}

export function AudioCheckScreen() {
  const { t } = useTranslation();
  const finish = useMediaStore((state) => state.finishAudioCheck);
  const [permission, setPermission] = useState<Permission>('unknown');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const level = useLevel(stream);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    },
    [],
  );

  const allowMicrophone = async () => {
    await unlockAudio();
    try {
      const granted = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = granted;
      setStream(granted);
      setPermission('granted');
    } catch {
      setPermission('denied');
    }
  };

  const enter = async (withMicrophone: boolean) => {
    await unlockAudio();
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    if (!withMicrophone) finish('off');
    else if (permission === 'denied') finish('unavailable');
    else finish(microphoneDefault());
  };

  return (
    <main className="grid h-full place-items-center bg-[radial-gradient(ellipse_at_50%_40%,var(--color-surface-raised)_0%,var(--color-cream)_60%,var(--color-neutral-100)_100%)] p-6">
      <section
        aria-labelledby="audio-check-title"
        className="flex w-full max-w-md flex-col gap-6 rounded-lg border border-border-subtle bg-surface-raised p-8 shadow-raised"
      >
        <div>
          <h1 id="audio-check-title" className="font-display text-2xl font-semibold">
            {t('audioCheck.title')}
          </h1>
          <p className="mt-2 text-text-secondary">{t('audioCheck.intro')}</p>
        </div>

        <div className="flex flex-col gap-3">
          {permission === 'granted' ? (
            <div className="flex items-center gap-3">
              <Mic aria-hidden="true" className="size-5 shrink-0 text-text-secondary" />
              <div
                role="meter"
                aria-label={t('audioCheck.level')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={level}
                className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-200"
              >
                <div className="h-full rounded-full bg-status-available" style={{ width: `${level}%` }} />
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => void allowMicrophone()}>
              <Mic aria-hidden="true" className="size-4" />
              {t('audioCheck.allowMicrophone')}
            </Button>
          )}
          {permission === 'granted' && <p className="text-sm text-text-secondary">{t('audioCheck.speakNow')}</p>}
          {permission === 'denied' && (
            <p role="alert" className="text-sm text-text-secondary">
              {t('audioCheck.denied')}
            </p>
          )}
          <Button variant="secondary" onClick={() => void unlockAudio().then(playTestSound)}>
            <Volume2 aria-hidden="true" className="size-4" />
            {t('audioCheck.testSpeakers')}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={() => void enter(true)}>{t('audioCheck.enter')}</Button>
          <Button variant="ghost" onClick={() => void enter(false)}>
            {t('audioCheck.withoutMicrophone')}
          </Button>
        </div>
      </section>
    </main>
  );
}
