import { Canvas, useFrame } from '@react-three/fiber';
import { isoCameraDirection, TILE_SIZE_METERS, tile, tileCenterToWorld } from '@teamtown/world-core';
import { useRef } from 'react';
import type { Mesh } from 'three';
import { WORLD_PALETTE } from './palette.ts';

const FLOOR_TILES_X = 12;
const FLOOR_TILES_Y = 10;
const CAMERA_DISTANCE = 20;
const CAMERA_ZOOM = 90;

const floorCenter = {
  x: (FLOOR_TILES_X * TILE_SIZE_METERS) / 2,
  z: (FLOOR_TILES_Y * TILE_SIZE_METERS) / 2,
};

const direction = isoCameraDirection();
const cameraPosition: [number, number, number] = [
  floorCenter.x + direction.x * CAMERA_DISTANCE,
  direction.y * CAMERA_DISTANCE,
  floorCenter.z + direction.z * CAMERA_DISTANCE,
];

function Floor() {
  const tiles = Array.from({ length: FLOOR_TILES_X * FLOOR_TILES_Y }, (_, index) =>
    tile(index % FLOOR_TILES_X, Math.floor(index / FLOOR_TILES_X)),
  );
  return (
    <group>
      <mesh position={[floorCenter.x, -0.1, floorCenter.z]} receiveShadow>
        <boxGeometry args={[FLOOR_TILES_X * TILE_SIZE_METERS, 0.2, FLOOR_TILES_Y * TILE_SIZE_METERS]} />
        <meshStandardMaterial color={WORLD_PALETTE.slab} />
      </mesh>
      {tiles.map((coord) => {
        const center = tileCenterToWorld(coord);
        const isAlternate = (coord.x + coord.y * 3) % 5 === 0;
        return (
          <mesh
            key={`${coord.x},${coord.y}`}
            position={[center.x, 0.001, center.z]}
            rotation-x={-Math.PI / 2}
            receiveShadow
          >
            <planeGeometry args={[TILE_SIZE_METERS * 0.98, TILE_SIZE_METERS * 0.98]} />
            <meshStandardMaterial color={isAlternate ? WORLD_PALETTE.woodFloorAlt : WORLD_PALETTE.woodFloor} />
          </mesh>
        );
      })}
    </group>
  );
}

/** The TeamTown house from the logo, as a first world object. */
function House() {
  const base = tileCenterToWorld(tile(5, 4));
  const size = 1.4;
  return (
    <group position={[base.x + TILE_SIZE_METERS / 2, 0, base.z + TILE_SIZE_METERS / 2]}>
      <mesh position={[0, size / 2, 0]} castShadow>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color={WORLD_PALETTE.wall} />
      </mesh>
      <mesh position={[0, size + 0.04, 0]} castShadow>
        <boxGeometry args={[size + 0.06, 0.08, size + 0.06]} />
        <meshStandardMaterial color={WORLD_PALETTE.roof} />
      </mesh>
      <mesh position={[0, size + 0.09, 0]}>
        <boxGeometry args={[size * 0.8, 0.02, size * 0.8]} />
        <meshStandardMaterial color={WORLD_PALETTE.roofInset} />
      </mesh>
      <mesh position={[-0.25, 0.35, size / 2 + 0.005]}>
        <planeGeometry args={[0.32, 0.7]} />
        <meshStandardMaterial
          color={WORLD_PALETTE.doorLight}
          emissive={WORLD_PALETTE.doorLight}
          emissiveIntensity={0.4}
        />
      </mesh>
      <PresenceDot height={size + 0.55} />
    </group>
  );
}

/** "Someone's here": the floating presence dot, gently bobbing. */
function PresenceDot({ height }: { readonly height: number }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = height + Math.sin(clock.elapsedTime * 2) * 0.05;
    }
  });
  return (
    <mesh ref={ref} position={[0, height, 0]} castShadow>
      <icosahedronGeometry args={[0.16, 1]} />
      <meshStandardMaterial color={WORLD_PALETTE.presence} flatShading />
    </mesh>
  );
}

export function WorldCanvas({ label }: { readonly label: string }) {
  return (
    <Canvas
      orthographic
      shadows
      dpr={[1, 2]}
      camera={{ position: cameraPosition, zoom: CAMERA_ZOOM, near: 0.1, far: 100 }}
      onCreated={({ camera }) => {
        camera.lookAt(floorCenter.x, 0, floorCenter.z);
      }}
      aria-label={label}
      role="img"
    >
      <ambientLight intensity={1.1} color={WORLD_PALETTE.keyLight} />
      <directionalLight position={[-4, 10, 2]} intensity={1.6} color={WORLD_PALETTE.keyLight} castShadow />
      <Floor />
      <House />
    </Canvas>
  );
}
