import { useEffect, useRef } from 'react';

/** Plays a live camera track. Muted: the sound of a call is played by the audio pipeline. */
export function VideoTrack({
  track,
  label,
  mirrored = false,
  className = '',
}: {
  readonly track: MediaStreamTrack;
  readonly label: string;
  /** One's own picture is mirrored, like a mirror. */
  readonly mirrored?: boolean;
  readonly className?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = new MediaStream([track]);
    void element.play().catch(() => undefined);
    return () => {
      element.srcObject = null;
    };
  }, [track]);

  return (
    <video
      ref={video}
      muted
      playsInline
      aria-label={label}
      className={`object-cover ${mirrored ? '-scale-x-100' : ''} ${className}`}
    />
  );
}
