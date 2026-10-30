import { useFrame, useThree } from '@react-three/fiber';
import { isoCameraDirection, positionAt } from '@teamtown/world-core';
import { useEffect, useRef } from 'react';
import { Vector3, type OrthographicCamera } from 'three';
import { serverClock } from '../shared/server-clock.ts';
import { usePresenceStore } from '../stores/presence-store.ts';
import { tileCentreToWorld } from './coordinates.ts';

const CAMERA_DISTANCE = 40;
const FOLLOW_SPEED = 4;
const ZOOM = { initial: 70, min: 30, max: 160, step: 1.1 } as const;
const direction = isoCameraDirection();

/** Isometric camera that follows the own avatar smoothly; the mouse wheel zooms. */
export function CameraRig({ fallbackTarget }: { readonly fallbackTarget: readonly [number, number] }) {
  const domElement = useThree((state) => state.gl.domElement);
  const focus = useRef(new Vector3(fallbackTarget[0], 0, fallbackTarget[1]));
  const zoom = useRef<number>(ZOOM.initial);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 1 / ZOOM.step : ZOOM.step;
      zoom.current = Math.min(ZOOM.max, Math.max(ZOOM.min, zoom.current * factor));
    };
    domElement.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      domElement.removeEventListener('wheel', onWheel);
    };
  }, [domElement]);

  useFrame((state, delta) => {
    const camera = state.camera as OrthographicCamera;
    if (camera.zoom !== zoom.current) {
      camera.zoom = zoom.current;
      camera.updateProjectionMatrix();
    }
    const { avatars, myPersonId } = usePresenceStore.getState();
    const me = myPersonId ? avatars[myPersonId] : undefined;
    if (me) {
      const position = me.movement ? positionAt(me.movement, serverClock.now()) : me.tile;
      const [x, z] = tileCentreToWorld(position.x, position.y);
      focus.current.lerp(new Vector3(x, 0, z), Math.min(1, delta * FOLLOW_SPEED));
    }
    camera.position.set(
      focus.current.x + direction.x * CAMERA_DISTANCE,
      direction.y * CAMERA_DISTANCE,
      focus.current.z + direction.z * CAMERA_DISTANCE,
    );
    camera.lookAt(focus.current);
  });

  return null;
}
