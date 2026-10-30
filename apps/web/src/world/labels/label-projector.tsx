import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { avatarAnchors, labelElements } from './label-registry.ts';

/** Height of the label above the avatar's feet, in metres. */
const LABEL_HEIGHT = 1.95;
const point = new Vector3();

/** Projects each avatar's position to screen space and moves its HTML label there, once per frame. */
export function LabelProjector() {
  useFrame(({ camera, size }) => {
    for (const [personId, element] of labelElements) {
      const anchor = avatarAnchors.get(personId);
      if (!anchor) {
        element.style.visibility = 'hidden';
        continue;
      }
      anchor.getWorldPosition(point);
      point.y += LABEL_HEIGHT;
      point.project(camera);
      const x = ((point.x + 1) / 2) * size.width;
      const y = ((1 - point.y) / 2) * size.height;
      element.style.visibility = 'visible';
      element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  });
  return null;
}
