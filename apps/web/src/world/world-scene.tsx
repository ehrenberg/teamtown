import { Canvas } from '@react-three/fiber';
import type { FloorPlan } from '@teamtown/contracts';
import type { TileCoord } from '@teamtown/world-core';
import { Suspense, useState } from 'react';
import { Object3D } from 'three';
import { Avatars } from './avatars/avatars.tsx';
import { CameraRig } from './camera-rig.tsx';
import { ConversationBubbles } from './conversations/conversation-bubbles.tsx';
import { gridToWorld, tileCentreToWorld } from './coordinates.ts';
import { FloorSurface } from './floor/floor-surface.tsx';
import { Walls } from './floor/walls.tsx';
import { Furniture } from './furniture/furniture.tsx';
import { WORLD_PALETTE } from './palette.ts';
import { TilePicker } from './tile-picker.tsx';
import { AvatarLabels } from './labels/avatar-labels.tsx';
import { LabelProjector } from './labels/label-projector.tsx';
import { DoorLeaves, DoorSigns } from './doors/doors.tsx';
import { VideoBubbleProjector, VideoBubbles } from './video/video-bubbles.tsx';
import { WallScreens } from './video/wall-screens.tsx';
import type { DoorMode } from '../stores/room-store.ts';

/**
 * The isometric office (ADR-0006). Renders state only: the floor plan from props and avatars from the
 * presence store. User intent leaves the world through callbacks.
 */
export function WorldScene({
  plan,
  label,
  onTileSelected,
  doorModeLabels,
  videoLabelOf,
  onWallScreenSelected,
}: {
  readonly plan: FloorPlan;
  readonly label: string;
  readonly onTileSelected: (tile: TileCoord) => void;
  /** Translated door mode names for the door signs. */
  readonly doorModeLabels: Record<DoorMode, string>;
  /** Accessible label of a video bubble, given the person's name. */
  readonly videoLabelOf: (name: string) => string;
  /** A click on a wall screen showing a share. */
  readonly onWallScreenSelected: () => void;
}) {
  const [width, depth] = gridToWorld(plan.width, plan.height);
  const spawn = plan.spawnPoints[0] ?? { x: plan.width / 2, y: plan.height / 2 };
  const fallbackTarget = tileCentreToWorld(spawn.x, spawn.y);
  // The light's target must be part of the scene, otherwise it keeps aiming at the origin.
  const [lightTarget] = useState(() => new Object3D());
  const shadowExtent = Math.max(width, depth);

  return (
    <div className="relative h-full w-full">
      <Canvas
        orthographic
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ near: 0.1, far: 200 }}
        aria-label={label}
        role="img"
      >
        <ambientLight intensity={1.0} color={WORLD_PALETTE.keyLight} />
        {/* Key light from the top left of the screen (brand light direction). */}
        <primitive object={lightTarget} position={[width / 2, 0, depth / 2]} />
        <directionalLight
          position={[width / 2 - 12, 20, depth / 2 - 4]}
          target={lightTarget}
          intensity={1.5}
          color={WORLD_PALETTE.keyLight}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
          shadow-camera-left={-shadowExtent}
          shadow-camera-right={shadowExtent}
          shadow-camera-top={shadowExtent}
          shadow-camera-bottom={-shadowExtent}
          shadow-camera-far={80}
        />
        <FloorSurface plan={plan} />
        <Walls plan={plan} />
        <Furniture plan={plan} />
        <DoorLeaves plan={plan} />
        <WallScreens plan={plan} onSelect={onWallScreenSelected} />
        <TilePicker width={plan.width} height={plan.height} onTileSelected={onTileSelected} />
        <ConversationBubbles />
        <Suspense fallback={null}>
          <Avatars />
        </Suspense>
        <CameraRig fallbackTarget={fallbackTarget} />
        <LabelProjector />
        <VideoBubbleProjector />
      </Canvas>
      <DoorSigns plan={plan} labels={doorModeLabels} />
      <AvatarLabels />
      <VideoBubbles labelOf={videoLabelOf} />
    </div>
  );
}
