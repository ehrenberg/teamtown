import { Button } from '@teamtown/ui';
import { ChevronDown, ChevronUp, MicOff, Video, VideoOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMyCallId } from '../../media/use-call-audio.ts';
import { useRealtime } from '../../realtime/realtime-context.tsx';
import { VideoTrack } from '../../shared/video-track.tsx';
import { useMediaStore } from '../../stores/media-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { useNameOf } from './calls.tsx';

/** Camera on/off, only while in a conversation or call (opt-in per call, ADR-0031), with a small self-preview. */
export function CameraToggle() {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const myCallId = useMyCallId();
  const camera = useMediaStore((state) => state.camera);
  const localVideo = useMediaStore((state) => state.localVideo);
  if (!myCallId) return null;

  const on = camera === 'on';
  const toggle = () => {
    const { setCamera } = useMediaStore.getState();
    if (on) {
      setCamera('off');
      void realtime.setCamera(false);
      return;
    }
    void realtime.setCamera(true).then((result) => {
      if (result.ok) setCamera('on');
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      {on && localVideo && (
        <VideoTrack track={localVideo} label={t('video.you')} mirrored className="size-8 rounded-full" />
      )}
      <Button variant="ghost" aria-pressed={on} disabled={camera === 'unavailable'} onClick={toggle}>
        {on ? <Video aria-hidden="true" className="size-4" /> : <VideoOff aria-hidden="true" className="size-4" />}
        {camera === 'unavailable' ? t('video.cameraUnavailable') : t(on ? 'video.cameraOn' : 'video.cameraOff')}
      </Button>
    </div>
  );
}

/**
 * The video grid of room calls and direct calls: a collapsible panel at the top of the world view. It opens by
 * itself when the first camera goes on.
 */
export function VideoGrid() {
  const { t } = useTranslation();
  const myCallId = useMyCallId();
  const videos = useMediaStore((state) => state.videos);
  const localVideo = useMediaStore((state) => state.localVideo);
  const muted = useMediaStore((state) => state.muted);
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const nameOf = useNameOf();
  const [expanded, setExpanded] = useState(true);
  const [hadVideo, setHadVideo] = useState(false);

  const isGridCall = myCallId !== null && !myCallId.startsWith('conversation:');
  const tiles = [
    ...(localVideo && myPersonId ? [{ personId: myPersonId, track: localVideo, mine: true }] : []),
    ...[...videos].map(([personId, track]) => ({ personId, track, mine: false })),
  ];
  const hasVideo = isGridCall && tiles.length > 0;
  if (hasVideo !== hadVideo) {
    setHadVideo(hasVideo);
    if (hasVideo) setExpanded(true);
  }
  if (!hasVideo) return null;

  return (
    <section
      aria-label={t('video.grid')}
      className="absolute top-3 left-1/2 z-10 flex max-w-[90%] -translate-x-1/2 flex-col items-center gap-2"
    >
      {expanded && (
        <ul id="video-grid" className="flex flex-wrap justify-center gap-2 rounded-md bg-espresso/80 p-2 shadow-raised">
          {tiles.map(({ personId, track, mine }) => {
            const name = mine ? t('video.you') : nameOf(personId);
            return (
              <li key={personId} className="relative">
                <VideoTrack
                  track={track}
                  label={t('video.of', { name })}
                  mirrored={mine}
                  className="h-32 w-44 rounded-sm bg-espresso"
                />
                <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-sm bg-espresso/80 px-1.5 py-0.5 text-xs text-cream">
                  {name}
                  {muted.includes(personId) && (
                    <MicOff role="img" aria-label={t('conversation.muted')} className="size-3" />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        variant="secondary"
        aria-expanded={expanded}
        aria-controls="video-grid"
        onClick={() => {
          setExpanded(!expanded);
        }}
      >
        {expanded ? (
          <ChevronUp aria-hidden="true" className="size-4" />
        ) : (
          <ChevronDown aria-hidden="true" className="size-4" />
        )}
        {t(expanded ? 'video.hide' : 'video.show')}
      </Button>
    </section>
  );
}
