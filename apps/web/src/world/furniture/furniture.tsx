import type { FloorPlan } from '@teamtown/contracts';
import { FURNITURE_CATALOGUE, isCatalogueItemId } from '@teamtown/world-core';
import { metres } from '../coordinates.ts';
import { FurnitureModel } from './furniture-models.tsx';

/** Places every furniture item of the plan on its (rotated) footprint. */
export function Furniture({ plan }: { readonly plan: FloorPlan }) {
  return (
    <group>
      {plan.furniture.map((item) => {
        if (!isCatalogueItemId(item.catalogItemId)) return null;
        const { width, depth } = FURNITURE_CATALOGUE[item.catalogItemId];
        const quarterTurn = item.rotation === 90 || item.rotation === 270;
        const footprintWidth = quarterTurn ? depth : width;
        const footprintDepth = quarterTurn ? width : depth;
        return (
          <group
            key={item.id}
            position={[metres(item.x + footprintWidth / 2), 0, metres(item.y + footprintDepth / 2)]}
            rotation-y={(-item.rotation * Math.PI) / 180}
          >
            <FurnitureModel catalogItemId={item.catalogItemId} width={metres(width)} depth={metres(depth)} />
          </group>
        );
      })}
    </group>
  );
}
