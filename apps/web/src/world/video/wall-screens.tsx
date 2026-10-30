import type { FloorPlan } from '@teamtown/contracts';
import { FURNITURE_CATALOGUE, RoomMap } from '@teamtown/world-core';
import { useEffect, useMemo, useState } from 'react';
import { SRGBColorSpace, VideoTexture } from 'three';
import { useMediaStore } from '../../stores/media-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { roomCallOf, useRoomStore } from '../../stores/room-store.ts';
import { metres } from '../coordinates.ts';

/** Matches the screen of the `tv-wall` model (furniture-models.tsx). */
const SCREEN_HEIGHT = 1.4;
const SCREEN_SIZE = { width: 0.76, height: 0.69 };

/**
 * Plays a live track in a detached video element and hands out a texture once the first frame is there: a
 * texture created before the video knows its size stays black.
 */
class TrackTexture {
  readonly #video = document.createElement('video');
  #texture: VideoTexture | null = null;

  constructor() {
    this.#video.muted = true;
    this.#video.playsInline = true;
  }

  play(track: MediaStreamTrack, onReady: (texture: VideoTexture) => void): () => void {
    const ready = () => {
      this.#texture ??= new VideoTexture(this.#video);
      this.#texture.colorSpace = SRGBColorSpace;
      onReady(this.#texture);
    };
    this.#video.addEventListener('loadeddata', ready, { once: true });
    this.#video.srcObject = new MediaStream([track]);
    void this.#video.play().catch(() => undefined);
    return () => {
      this.#video.removeEventListener('loadeddata', ready);
      this.#video.srcObject = null;
    };
  }

  dispose(): void {
    this.#texture?.dispose();
  }
}

function SharedScreen({
  track,
  width,
  onSelect,
}: {
  readonly track: MediaStreamTrack;
  readonly width: number;
  readonly onSelect: () => void;
}) {
  const [screen] = useState(() => new TrackTexture());
  const [texture, setTexture] = useState<VideoTexture | null>(null);
  useEffect(() => screen.play(track, setTexture), [screen, track]);
  useEffect(
    () => () => {
      screen.dispose();
    },
    [screen],
  );
  if (!texture) return null;

  return (
    <mesh
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      <planeGeometry args={[width * SCREEN_SIZE.width, SCREEN_SIZE.height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/**
 * The shared screen of one's room call, live on the wall screens of that room (C5). Only people in the call receive
 * the share, so everyone else keeps seeing a dark screen. A click asks for full screen.
 */
export function WallScreens({ plan, onSelect }: { readonly plan: FloorPlan; readonly onSelect: () => void }) {
  const roomMap = useMemo(() => RoomMap.build(plan, plan.rooms), [plan]);
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const myRoomCall = useRoomStore((state) => roomCallOf(state.roomCalls, myPersonId));
  const screenShare = useMediaStore((state) => state.screenShare);
  if (!screenShare || !myRoomCall) return null;

  const { width, depth } = FURNITURE_CATALOGUE['tv-wall'];
  return (
    <group>
      {plan.furniture
        .filter((item) => item.catalogItemId === 'tv-wall' && roomMap.roomAt(item) === myRoomCall)
        .map((item) => {
          const quarterTurn = item.rotation === 90 || item.rotation === 270;
          const footprintWidth = quarterTurn ? depth : width;
          const footprintDepth = quarterTurn ? width : depth;
          return (
            <group
              key={item.id}
              position={[metres(item.x + footprintWidth / 2), 0, metres(item.y + footprintDepth / 2)]}
              rotation-y={(-item.rotation * Math.PI) / 180}
            >
              <group position={[0, SCREEN_HEIGHT, -metres(depth) / 2 + 0.09]}>
                <SharedScreen track={screenShare.track} width={metres(width)} onSelect={onSelect} />
              </group>
            </group>
          );
        })}
    </group>
  );
}
