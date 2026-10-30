import type { ReactNode } from 'react';
import { WORLD_PALETTE as P } from '../palette.ts';

/**
 * Low-poly furniture built from primitives, centred on its footprint (x = width, z = depth, metres).
 * Placeholders in the world art style until glTF furniture exists (docs/design/world-art-direction.md §6).
 */
type Vec3 = readonly [number, number, number];

function Box({ size, at, color, transparent = false }: { size: Vec3; at: Vec3; color: string; transparent?: boolean }) {
  return (
    <mesh position={[...at]} castShadow={!transparent} receiveShadow>
      <boxGeometry args={[...size]} />
      <meshStandardMaterial
        color={color}
        flatShading
        transparent={transparent}
        opacity={transparent ? 0.35 : 1}
        depthWrite={!transparent}
      />
    </mesh>
  );
}

function Cylinder({
  radius,
  height,
  at,
  color,
  segments = 8,
}: {
  radius: number;
  height: number;
  at: Vec3;
  color: string;
  segments?: number;
}) {
  return (
    <mesh position={[...at]} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, height, segments]} />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
  );
}

function Table({ w, d, height, color = P.wood }: { w: number; d: number; height: number; color?: string }) {
  const legX = w / 2 - 0.06;
  const legZ = d / 2 - 0.06;
  return (
    <>
      <Box size={[w, 0.05, d]} at={[0, height, 0]} color={color} />
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x = 0, z = 0]) => (
        <Box key={`${x}:${z}`} size={[0.05, height, 0.05]} at={[x, height / 2, z]} color={P.woodDark} />
      ))}
    </>
  );
}

function Seat({ w, d, color, backHeight }: { w: number; d: number; color: string; backHeight: number }) {
  return (
    <>
      <Box size={[w, 0.4, d * 0.75]} at={[0, 0.2, d * 0.1]} color={color} />
      <Box size={[w, backHeight, d * 0.25]} at={[0, backHeight / 2, -d * 0.375]} color={color} />
    </>
  );
}

function Plant({ size }: { size: number }) {
  return (
    <>
      <Cylinder radius={size * 0.32} height={size * 0.45} at={[0, size * 0.225, 0]} color={P.terracotta} />
      <mesh position={[0, size * 0.85, 0]} castShadow>
        <icosahedronGeometry args={[size * 0.42, 0]} />
        <meshStandardMaterial color={P.sage} flatShading />
      </mesh>
      <mesh position={[size * 0.08, size * 1.2, -size * 0.05]} castShadow>
        <icosahedronGeometry args={[size * 0.26, 0]} />
        <meshStandardMaterial color={P.sageDark} flatShading />
      </mesh>
    </>
  );
}

const MODELS: Readonly<Record<string, (w: number, d: number) => ReactNode>> = {
  'desk-straight': (w, d) => (
    <>
      <Table w={w} d={d} height={0.74} />
      <Box size={[0.6, 0.36, 0.03]} at={[0, 1.0, -d * 0.3]} color={P.espresso} />
      <Box size={[0.56, 0.32, 0.005]} at={[0, 1.0, -d * 0.3 + 0.018]} color={P.screen} />
      <Box size={[0.05, 0.12, 0.05]} at={[0, 0.82, -d * 0.32]} color={P.espresso} />
    </>
  ),
  'office-chair': (w, d) => (
    <>
      <Box size={[w * 0.85, 0.07, d * 0.85]} at={[0, 0.46, 0]} color={P.ocean} />
      <Box size={[w * 0.85, 0.42, 0.06]} at={[0, 0.72, -d * 0.4]} color={P.ocean} />
      <Cylinder radius={0.03} height={0.42} at={[0, 0.21, 0]} color={P.espresso} />
    </>
  ),
  'meeting-table-4': (w, d) => <Table w={w * 0.9} d={d * 0.9} height={0.74} />,
  'meeting-table-8': (w, d) => <Table w={w * 0.95} d={d * 0.85} height={0.74} />,
  'dining-table': (w, d) => <Table w={w * 0.95} d={d * 0.9} height={0.74} />,
  'coffee-table': (w, d) => <Table w={w * 0.9} d={d * 0.8} height={0.4} />,
  sofa: (w, d) => (
    <>
      <Seat w={w} d={d} color={P.ocean} backHeight={0.8} />
      <Box size={[0.15, 0.6, d * 0.9]} at={[-w / 2 + 0.075, 0.3, 0]} color={P.ocean} />
      <Box size={[0.15, 0.6, d * 0.9]} at={[w / 2 - 0.075, 0.3, 0]} color={P.ocean} />
    </>
  ),
  armchair: (w, d) => <Seat w={w * 0.9} d={d * 0.9} color={P.ochre} backHeight={0.8} />,
  'kitchen-counter': (w, d) => (
    <>
      <Box size={[w, 0.86, d * 0.9]} at={[0, 0.43, 0]} color={P.terracotta} />
      <Box size={[w + 0.02, 0.05, d * 0.95]} at={[0, 0.885, 0]} color={P.cream} />
      <Box size={[0.3, 0.35, 0.3]} at={[-w / 2 + 0.4, 1.09, -d * 0.15]} color={P.espresso} />
    </>
  ),
  fridge: (w, d) => <Box size={[w * 0.6, 1.8, d * 0.6]} at={[0, 0.9, -d * 0.15]} color={P.white} />,
  'bar-table': (w) => (
    <>
      <Cylinder radius={w * 0.35} height={0.05} at={[0, 1.05, 0]} color={P.wood} segments={10} />
      <Cylinder radius={0.04} height={1.05} at={[0, 0.525, 0]} color={P.espresso} />
    </>
  ),
  bookshelf: (w, d) => (
    <>
      <Box size={[w, 1.4, d * 0.8]} at={[0, 0.7, 0]} color={P.wood} />
      {[0.35, 0.75, 1.15].map((y, index) => (
        <Box
          key={y}
          size={[w * 0.8, 0.22, d * 0.82]}
          at={[0, y, 0]}
          color={[P.ocean, P.terracotta, P.sage][index] ?? P.ocean}
        />
      ))}
    </>
  ),
  plant: (w) => <Plant size={w * 0.9} />,
  'tv-wall': (w, d) => (
    <>
      <Box size={[w * 0.8, 0.75, 0.05]} at={[0, 1.4, -d / 2 + 0.05]} color={P.espresso} />
      <Box size={[w * 0.76, 0.69, 0.01]} at={[0, 1.4, -d / 2 + 0.08]} color={P.screen} />
    </>
  ),
  whiteboard: (w, d) => <Box size={[w * 0.85, 0.9, 0.04]} at={[0, 1.4, -d / 2 + 0.05]} color={P.white} />,
  'phone-booth': (w, d) => (
    <>
      <Box size={[w * 0.95, 2.1, d * 0.95]} at={[0, 1.05, 0]} color={P.wall.glass} transparent />
      <Box size={[w * 0.95, 0.08, d * 0.95]} at={[0, 2.14, 0]} color={P.espresso} />
    </>
  ),
  rug: (w, d) => <Box size={[w * 0.95, 0.01, d * 0.95]} at={[0, 0.006, 0]} color={P.terracottaLight} />,
  stage: (w, d) => <Box size={[w, 0.3, d]} at={[0, 0.15, 0]} color={P.woodDark} />,
  'deck-chair': (w, d) => (
    <>
      <Box size={[w * 0.7, 0.12, d * 0.7]} at={[0, 0.3, d * 0.1]} color={P.cream} />
      <mesh position={[0, 0.5, -d * 0.3]} rotation-x={-0.6} castShadow>
        <boxGeometry args={[w * 0.7, 0.08, d * 0.35]} />
        <meshStandardMaterial color={P.cream} flatShading />
      </mesh>
    </>
  ),
  'parasol-table': (w, d) => (
    <>
      <Table w={w * 0.4} d={d * 0.4} height={0.74} color={P.cream} />
      <Cylinder radius={0.025} height={2.2} at={[0, 1.1, 0]} color={P.espresso} />
      <mesh position={[0, 2.25, 0]} castShadow>
        <coneGeometry args={[w * 0.55, 0.45, 8]} />
        <meshStandardMaterial color={P.ochre} flatShading />
      </mesh>
    </>
  ),
};

export function FurnitureModel({
  catalogItemId,
  width,
  depth,
}: {
  readonly catalogItemId: string;
  readonly width: number;
  readonly depth: number;
}) {
  const model = MODELS[catalogItemId];
  return <>{model ? model(width, depth) : <Box size={[width, 0.5, depth]} at={[0, 0.25, 0]} color={P.wood} />}</>;
}
