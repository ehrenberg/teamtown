import type { FloorPlan } from '@teamtown/contracts';
import { useMemo } from 'react';
import { gridToWorld } from '../coordinates.ts';
import { wallPieces, type WallPiece } from '../geometry/wall-pieces.ts';
import { WORLD_PALETTE } from '../palette.ts';

const THICKNESS = 0.1;
/** Cut-away heights: tall walls only at the back of the floor, low walls elsewhere so rooms stay visible. */
const HEIGHT = { back: 2.6, inner: 1.1, front: 0.25 } as const;

function heightOf(piece: WallPiece): number {
  if (piece.isFront) return HEIGHT.front;
  const isBackEdge =
    (piece.from.y === piece.to.y && piece.from.y === 0) || (piece.from.x === piece.to.x && piece.from.x === 0);
  return isBackEdge ? HEIGHT.back : HEIGHT.inner;
}

function Wall({ piece }: { readonly piece: WallPiece }) {
  const [fromX, fromZ] = gridToWorld(piece.from.x, piece.from.y);
  const [toX, toZ] = gridToWorld(piece.to.x, piece.to.y);
  const height = heightOf(piece);
  const horizontal = piece.from.y === piece.to.y;
  const length = horizontal ? toX - fromX : toZ - fromZ;
  const size: [number, number, number] = horizontal
    ? [length + THICKNESS, height, THICKNESS]
    : [THICKNESS, height, length + THICKNESS];
  const position: [number, number, number] = [(fromX + toX) / 2, height / 2, (fromZ + toZ) / 2];
  const isGlass = piece.material === 'glass';

  return (
    <group position={position}>
      <mesh castShadow={!isGlass} receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={WORLD_PALETTE.wall[piece.material]}
          transparent={isGlass}
          opacity={isGlass ? 0.35 : 1}
          depthWrite={!isGlass}
        />
      </mesh>
      {/* Darker cap on top makes the cut-away edge readable. */}
      <mesh position={[0, height / 2 + 0.005, 0]}>
        <boxGeometry args={[size[0], 0.01, size[2]]} />
        <meshStandardMaterial color={isGlass ? WORLD_PALETTE.ocean : WORLD_PALETTE.wallCap} />
      </mesh>
    </group>
  );
}

export function Walls({ plan }: { readonly plan: FloorPlan }) {
  const pieces = useMemo(() => wallPieces(plan), [plan]);
  return (
    <group>
      {pieces.map((piece) => (
        <Wall key={`${piece.from.x},${piece.from.y}-${piece.to.x},${piece.to.y}`} piece={piece} />
      ))}
    </group>
  );
}
