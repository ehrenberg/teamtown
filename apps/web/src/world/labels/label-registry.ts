import type { Object3D } from 'three';

/**
 * Connects avatars in the 3D scene with their HTML name labels without React re-renders:
 * avatars register their scene node, labels register their DOM element, and one frame hook
 * (LabelProjector) moves every label to its avatar.
 */
export const avatarAnchors = new Map<string, Object3D>();
export const labelElements = new Map<string, HTMLElement>();
