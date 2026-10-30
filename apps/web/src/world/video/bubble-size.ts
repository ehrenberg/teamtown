import { proximityVolume } from '@teamtown/world-core';

const MIN_SCALE = 0.5;
const MIN_OPACITY = 0.5;

/** Video bubbles follow the distance like the voice: full up to 2 tiles, smallest and faintest at 6 tiles. */
export function videoBubbleLook(distanceTiles: number): { readonly scale: number; readonly opacity: number } {
  const closeness = proximityVolume(distanceTiles);
  return {
    scale: MIN_SCALE + (1 - MIN_SCALE) * closeness,
    opacity: MIN_OPACITY + (1 - MIN_OPACITY) * closeness,
  };
}
