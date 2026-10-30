import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { AvatarState } from '@teamtown/contracts';
import { positionAt } from '@teamtown/world-core';
import { useEffect, useMemo, useRef } from 'react';
import type { MeshStandardMaterial } from 'three';
import { AnimationClip, AnimationMixer, Mesh, type Group } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { serverClock } from '../../shared/server-clock.ts';
import { tileCentreToWorld } from '../coordinates.ts';
import { avatarAnchors } from '../labels/label-registry.ts';

export const AVATAR_MODEL_URL = '/assets/avatars/avatar.glb';
/** The glTF material that shows the person's colour (contract with tools/blender/avatar.py). */
const TINTED_MATERIAL = 'Top';
const CROSSFADE_SECONDS = 0.2;
const TURN_SPEED = 12;

/** Shortest signed angle from `from` to `to`. */
const angleDelta = (from: number, to: number): number => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export function AvatarFigure({ avatar }: { readonly avatar: AvatarState }) {
  const { scene, animations } = useGLTF(AVATAR_MODEL_URL);
  const group = useRef<Group>(null);
  const walking = useRef(false);

  const model = useMemo(() => {
    const figure = cloneSkinned(scene);
    figure.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        const material = object.material as MeshStandardMaterial;
        if (material.name === TINTED_MATERIAL) {
          const tinted = material.clone();
          tinted.color.set(avatar.avatarColor);
          object.material = tinted;
        }
      }
    });
    return figure;
  }, [scene, avatar.avatarColor]);

  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const actions = useMemo(() => {
    const idleClip = AnimationClip.findByName(animations, 'Idle');
    const walkClip = AnimationClip.findByName(animations, 'Walk');
    return {
      idle: idleClip ? mixer.clipAction(idleClip) : null,
      walk: walkClip ? mixer.clipAction(walkClip) : null,
    };
  }, [animations, mixer]);

  useEffect(() => {
    const node = group.current;
    if (!node) return;
    avatarAnchors.set(avatar.personId, node);
    return () => {
      avatarAnchors.delete(avatar.personId);
    };
  }, [avatar.personId]);

  useEffect(() => {
    actions.idle?.play();
    return () => {
      mixer.stopAllAction();
    };
  }, [actions, mixer]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const position = avatar.movement
      ? positionAt(avatar.movement, serverClock.now())
      : { x: avatar.tile.x, y: avatar.tile.y, arrived: true, heading: null };
    const [x, z] = tileCentreToWorld(position.x, position.y);
    node.position.set(x, 0, z);

    if (!position.arrived && position.heading) {
      // The model faces +Z; grid x maps to world x and grid y to world z.
      const target = Math.atan2(position.heading.dx, position.heading.dy);
      node.rotation.y += angleDelta(node.rotation.y, target) * Math.min(1, delta * TURN_SPEED);
    }

    const shouldWalk = !position.arrived;
    if (shouldWalk !== walking.current && actions.idle && actions.walk) {
      const [from, to] = shouldWalk ? [actions.idle, actions.walk] : [actions.walk, actions.idle];
      to.reset().play();
      from.crossFadeTo(to, CROSSFADE_SECONDS, false);
      walking.current = shouldWalk;
    }
    mixer.update(delta);
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(AVATAR_MODEL_URL);
