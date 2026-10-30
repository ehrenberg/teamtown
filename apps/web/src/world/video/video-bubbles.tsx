import { useFrame } from '@react-three/fiber';
import { TILE_SIZE_METERS } from '@teamtown/world-core';
import { Vector3 } from 'three';
import { VideoTrack } from '../../shared/video-track.tsx';
import { conversationOf, useConversationStore } from '../../stores/conversation-store.ts';
import { useMediaStore } from '../../stores/media-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { avatarAnchors } from '../labels/label-registry.ts';
import { videoBubbleLook } from './bubble-size.ts';

/** The bubble floats above the name label. */
const BUBBLE_HEIGHT = 2.35;
const bubbleElements = new Map<string, HTMLElement>();
const point = new Vector3();
const mine = new Vector3();

/** Moves each video bubble above its avatar and sizes it by distance, once per frame. Inside the canvas. */
export function VideoBubbleProjector() {
  useFrame(({ camera, size }) => {
    const me = usePresenceStore.getState().myPersonId;
    const myAnchor = me ? avatarAnchors.get(me) : undefined;
    if (myAnchor) myAnchor.getWorldPosition(mine);
    for (const [personId, element] of bubbleElements) {
      const anchor = avatarAnchors.get(personId);
      if (!anchor || !myAnchor) {
        element.style.visibility = 'hidden';
        continue;
      }
      anchor.getWorldPosition(point);
      const { scale, opacity } = videoBubbleLook(Math.hypot(point.x - mine.x, point.z - mine.z) / TILE_SIZE_METERS);
      point.y += BUBBLE_HEIGHT;
      point.project(camera);
      const x = ((point.x + 1) / 2) * size.width;
      const y = ((1 - point.y) / 2) * size.height;
      element.style.visibility = 'visible';
      element.style.opacity = opacity.toFixed(2);
      element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(2)})`;
    }
  });
  return null;
}

/**
 * Round video bubbles above the avatars of people in one's own conversation whose camera is on. Only they send
 * their picture to this conversation (ADR-0031); everyone else just sees the camera icon in the name label.
 */
export function VideoBubbles({ labelOf }: { readonly labelOf: (name: string) => string }) {
  const videos = useMediaStore((state) => state.videos);
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const avatars = usePresenceStore((state) => state.avatars);
  const conversation = useConversationStore((state) => conversationOf(state.conversations, myPersonId));
  const shown = conversation ? [...videos].filter(([personId]) => conversation.participants.includes(personId)) : [];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {shown.map(([personId, track]) => (
        <div
          key={personId}
          ref={(element) => {
            if (element) bubbleElements.set(personId, element);
            return () => {
              bubbleElements.delete(personId);
            };
          }}
          style={{ visibility: 'hidden', transformOrigin: 'bottom center' }}
          className="absolute top-0 left-0 size-20 overflow-hidden rounded-full border-2 border-cream shadow-raised"
        >
          <VideoTrack track={track} label={labelOf(avatars[personId]?.displayName ?? '')} className="size-full" />
        </div>
      ))}
    </div>
  );
}
