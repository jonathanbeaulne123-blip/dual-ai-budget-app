/**
 * Hearth Mountain v2 · keeping the eye out of the world (C2, C8, C11).
 *
 * One line test and one smoothing rule, shared by Look, Walk and the ride
 * camera:
 *
 * - `clearFraction` marches from what the camera looks at toward the eye and
 *   says how much of that line is open — terrain and every camera solid
 *   (`worldAdapter.cameraBlocked`) count.
 * - `createPullIn` turns the per-frame answer into the distance the eye may
 *   actually stand at: **fast in** (at once — the eye is never drawn inside
 *   anything), **slow out** (eased back over about a second, so a tree
 *   brushing past does not make the camera breathe).
 *
 * Pure: no three.js, no DOM, no time of its own.
 */
export type Blocked = (x: number, y: number, z: number) => boolean;
type P3 = readonly [number, number, number];

/** How much of the segment from `from` toward `to` is open, 0…1. `from` itself is never tested. */
export function clearFraction(from: P3, to: P3, blocked: Blocked, step = 0.2, maxSamples = 48): number {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const length = Math.hypot(dx, dy, dz);
  if (!(length > 1e-6)) return 1;
  const samples = Math.max(2, Math.min(maxSamples, Math.ceil(length / step)));
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    if (blocked(from[0] + dx * t, from[1] + dy * t, from[2] + dz * t)) return Math.max(0, (i - 1) / samples);
  }
  return 1;
}

/** Out slowly: the share of the remaining gap given back per second. */
export const PULL_OUT_RATE = 1.3;
/** The eye never comes nearer than this share of its distance, however close the wall. */
export const PULL_MIN = 0.12;

export type PullIn = {
  /** The line is `clear` open this frame: returns the share of its distance the eye may stand at. */
  update(clear: number, dt: number, reduced?: boolean): number;
  value(): number;
  reset(to?: number): void;
};

export function createPullIn(outRate = PULL_OUT_RATE): PullIn {
  let v = 1;
  return {
    update(clear, dt, reduced = false) {
      const c = Math.max(PULL_MIN, Math.min(1, Number.isFinite(clear) ? clear : 1));
      // In at once: never inside. Out eased: never breathing.
      if (c <= v || reduced) v = c;
      else if (dt > 0) {
        v += (c - v) * (1 - Math.exp(-outRate * Math.min(dt, 0.25)));
        if (c - v < 1e-4) v = c;
      }
      return v;
    },
    value: () => v,
    reset(to = 1) { v = to; },
  };
}
