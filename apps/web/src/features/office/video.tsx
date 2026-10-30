import { Button } from '@teamtown/ui';
import { ChevronDown, ChevronUp, Maximize, MicOff, MonitorUp, MonitorX, Video, VideoOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMyCallId } from '../../media/use-call-audio.ts';
import { useRealtime } from '../../realtime/realtime-context.tsx';
import { VideoTrack } from '../../shared/video-track.tsx';
import { useCallStore } from '../../stores/call-store.ts';
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

/** Screen sharing, only in room calls and direct calls (ADR-0031). The browser asks what to share. */
export function ScreenShareToggle() {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const myCallId = useMyCallId();
  const sharing = useMediaStore((state) => state.sharingScreen);
  if (!myCallId || myCallId.startsWith('conversation:')) return null;

  const toggle = () => {
    const { setSharingScreen } = useMediaStore.getState();
    if (sharing) {
      setSharingScreen(false);
      void realtime.stopScreenShare();
      return;
    }
    useCallStore.getState().notifyScreenShare(undefined);
    void realtime.startScreenShare().then((result) => {
      if (result.ok) setSharingScreen(true);
    });
  };

  return (
    <Button variant="ghost" aria-pressed={sharing} onClick={toggle}>
      {sharing ? (
        <MonitorX aria-hidden="true" className="size-4" />
      ) : (
        <MonitorUp aria-hidden="true" className="size-4" />
      )}
      {t(sharing ? 'screen.stop' : 'screen.share')}
    </Button>
  );
}

/**
 * The video panel of room calls and direct calls, collapsible, at the top of the world view: the shared screen as a
 * large tile, then the cameras. It opens by itself when the first picture arrives.
 */
export function VideoGrid() {
  const { t } = useTranslation();
  const myCallId = useMyCallId();
  const videos = useMediaStore((state) => state.videos);
  const localVideo = useMediaStore((state) => state.localVideo);
  const screenShare = useMediaStore((state) => state.screenShare);
  const muted = useMediaStore((state) => state.muted);
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const nameOf = useNameOf();
  const [expanded, setExpanded] = useState(true);
  const [hadVideo, setHadVideo] = useState(false);
  const shareTile = useRef<HTMLDivElement>(null);

  // A click on the wall screen asks for the shared screen in full screen.
  useEffect(
    () =>
      useMediaStore.subscribe((state, previous) => {
        if (state.fullScreenRequests === previous.fullScreenRequests) return;
        setExpanded(true);
        requestAnimationFrame(() => void shareTile.current?.requestFullscreen().catch(() => undefined));
      }),
    [],
  );

  const isGridCall = myCallId !== null && !myCallId.startsWith('conversation:');
  const tiles = [
    ...(localVideo && myPersonId ? [{ personId: myPersonId, track: localVideo, mine: true }] : []),
    ...[...videos].map(([personId, track]) => ({ personId, track, mine: false })),
  ];
  const hasVideo = isGridCall && (tiles.length > 0 || screenShare !== null);
  if (hasVideo !== hadVideo) {
    setHadVideo(hasVideo);
    if (hasVideo) setExpanded(true);
  }
  if (!hasVideo) return null;

  const sharer = screenShare
    ? screenShare.personId === myPersonId
      ? t('video.you')
      : nameOf(screenShare.personId)
    : '';
  return (
    <section
      aria-label={t('video.grid')}
      className="absolute top-3 left-1/2 z-10 flex max-w-[90%] -translate-x-1/2 flex-col items-center gap-2"
    >
      {expanded && (
        <div id="video-grid" className="flex flex-col items-center gap-2 rounded-md bg-espresso/80 p-2 shadow-raised">
          {screenShare && (
            <div ref={shareTile} className="relative">
              <VideoTrack
                track={screenShare.track}
                label={t('screen.of', { name: sharer })}
                className="h-64 w-[28rem] max-w-full rounded-sm bg-espresso object-contain"
              />
              <span className="absolute bottom-1 left-1 rounded-sm bg-espresso/80 px-1.5 py-0.5 text-xs text-cream">
                {t('screen.of', { name: sharer })}
              </span>
              <Button
                variant="secondary"
                className="absolute top-1 right-1"
                onClick={() => void shareTile.current?.requestFullscreen().catch(() => undefined)}
              >
                <Maximize aria-hidden="true" className="size-4" />
                {t('screen.fullScreen')}
              </Button>
            </div>
          )}
          {tiles.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2">
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
        </div>
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

/** Polite announcements when someone starts or stops sharing, and a visible note when one's share was taken over. */
export function ScreenShareAnnouncer() {
  const { t } = useTranslation();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const screenShare = useMediaStore((state) => state.screenShare);
  const takenBy = useCallStore((state) => state.screenShareTakenBy);
  const nameOf = useNameOf();
  const sharer = screenShare?.personId ?? null;
  const [previous, setPrevious] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  if (sharer !== previous) {
    setPrevious(sharer);
    if (sharer && sharer !== myPersonId) setMessage(t('screen.started', { name: nameOf(sharer) }));
    else if (!sharer && previous && previous !== myPersonId) setMessage(t('screen.ended'));
  }

  return (
    <>
      {takenBy !== undefined && (
        <p role="status" className="mb-4 text-xs text-text-secondary">
          {takenBy ? t('screen.takenOver', { name: nameOf(takenBy) }) : t('screen.stopped')}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {message}
      </p>
    </>
  );
}
