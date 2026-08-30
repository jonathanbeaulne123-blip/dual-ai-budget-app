export const HUMAN_IDLE_FLY_CHASE_MS = 10_000;
export const IDLE_FLY_CAPTURE_AT_MS = 360;
export const IDLE_FLY_POUNCE_MS = 650;

export type FlyPoint = { x: number; y: number };

export function idleFlyPounceLanding(
  cat: FlyPoint,
  fly: FlyPoint,
  viewport: { w: number; h: number },
  catSize = 96,
  nav = 76,
): FlyPoint {
  const approach = {
    x: fly.x - catSize * 0.42,
    y: fly.y - catSize * 0.48,
  };
  const maxX = Math.max(4, viewport.w - catSize - 4);
  const maxY = Math.max(4, viewport.h - catSize - nav);
  const landing = {
    x: Math.min(maxX, Math.max(4, approach.x)),
    y: Math.min(maxY, Math.max(4, approach.y)),
  };
  if (Math.abs(landing.x - cat.x) < 1 && Math.abs(landing.y - cat.y) < 1) {
    return { x: Math.min(maxX, landing.x + 2), y: landing.y };
  }
  return landing;
}
