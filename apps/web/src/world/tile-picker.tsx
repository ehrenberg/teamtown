import type { ThreeEvent } from '@react-three/fiber';
import type { TileCoord } from '@teamtown/world-core';
import { useState } from 'react';
import { gridToWorld, tileCentreToWorld, worldToTile } from './coordinates.ts';
import { WORLD_PALETTE } from './palette.ts';

/** Invisible plane over the floor: hover highlights a tile, a click selects it as walking target. */
export function TilePicker({
  width,
  height,
  onTileSelected,
}: {
  readonly width: number;
  readonly height: number;
  readonly onTileSelected: (tile: TileCoord) => void;
}) {
  const [hovered, setHovered] = useState<TileCoord | null>(null);
  const [worldWidth, worldDepth] = gridToWorld(width, height);
  const inside = (tile: TileCoord) => tile.x >= 0 && tile.y >= 0 && tile.x < width && tile.y < height;

  const toTile = (event: ThreeEvent<PointerEvent | MouseEvent>) => worldToTile(event.point.x, event.point.z);
  const [hoverX, hoverZ] = hovered ? tileCentreToWorld(hovered.x, hovered.y) : [0, 0];

  return (
    <group>
      <mesh
        position={[worldWidth / 2, 0.02, worldDepth / 2]}
        rotation-x={-Math.PI / 2}
        onPointerMove={(event) => {
          const tile = toTile(event);
          setHovered(inside(tile) ? tile : null);
        }}
        onPointerOut={() => {
          setHovered(null);
        }}
        onClick={(event) => {
          const tile = toTile(event);
          if (inside(tile)) onTileSelected(tile);
        }}
      >
        <planeGeometry args={[worldWidth, worldDepth]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {hovered && (
        <mesh position={[hoverX, 0.015, hoverZ]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.46, 0.46]} />
          <meshBasicMaterial color={WORLD_PALETTE.hover} transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  );
}
