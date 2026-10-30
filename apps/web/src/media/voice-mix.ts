import { isoScreenOffsetX, proximityPan, proximityVolume, tileDistance, type Point } from '@teamtown/world-core';

export interface VoiceMix {
  /** 0–1 */
  readonly volume: number;
  /** -1 (left) … 1 (right) */
  readonly pan: number;
}

export function voiceMix(listener: Point, speaker: Point): VoiceMix {
  return {
    volume: proximityVolume(tileDistance(listener, speaker)),
    pan: proximityPan(isoScreenOffsetX(speaker.x - listener.x, speaker.y - listener.y)),
  };
}
