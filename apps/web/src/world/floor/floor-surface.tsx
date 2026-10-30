import type { FloorPlan } from '@teamtown/contracts';
import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { gridToWorld, metres } from '../coordinates.ts';
import { WORLD_PALETTE } from '../palette.ts';

const SLAB_THICKNESS = 0.25;
const GRID_HEIGHT = 0.004;

/** Thin lines along every tile edge of the floor rectangle, merged into one draw call. */
function useTileGrid(width: number, height: number): BufferGeometry {
  return useMemo(() => {
    const positions: number[] = [];
    for (let x = 0; x <= width; x++) positions.push(metres(x), GRID_HEIGHT, 0, metres(x), GRID_HEIGHT, metres(height));
    for (let y = 0; y <= height; y++) positions.push(0, GRID_HEIGHT, metres(y), metres(width), GRID_HEIGHT, metres(y));
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geometry;
  }, [width, height]);
}

/** Floor areas (later areas paint over earlier ones) on the building slab, plus a subtle tile grid. */
export function FloorSurface({ plan }: { readonly plan: FloorPlan }) {
  const [width, depth] = gridToWorld(plan.width, plan.height);
  const grid = useTileGrid(plan.width, plan.height);
  return (
    <group>
      <mesh position={[width / 2, -SLAB_THICKNESS / 2, depth / 2]} receiveShadow>
        <boxGeometry args={[width, SLAB_THICKNESS, depth]} />
        <meshStandardMaterial color={WORLD_PALETTE.slab} />
      </mesh>
      {plan.floorAreas.map((area, index) => (
        <mesh
          key={`${area.x}-${area.y}-${area.width}-${area.height}`}
          position={[metres(area.x + area.width / 2), 0.001 + index * 0.0005, metres(area.y + area.height / 2)]}
          rotation-x={-Math.PI / 2}
          receiveShadow
        >
          <planeGeometry args={[metres(area.width), metres(area.height)]} />
          <meshStandardMaterial color={WORLD_PALETTE.floor[area.material]} />
        </mesh>
      ))}
      <lineSegments geometry={grid}>
        <lineBasicMaterial color={WORLD_PALETTE.espresso} transparent opacity={0.06} />
      </lineSegments>
    </group>
  );
}
