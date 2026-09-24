/**
 * Keeping the shot clear while skating, and handing the view back cleanly.
 *
 * - `skateWatchPoint`: where the companion cat waits while someone skates —
 *   just outside the nearest spot's pad (its keep-out rectangle), on the side
 *   nearest to where he already is, so he sits at the park edge and watches
 *   instead of trotting through every line.
 * - `skateWalkPose`: the walking camera's first pose when the board goes
 *   away. The chase camera may be low, craned or pulled in beside a ramp; the
 *   walking camera stands further back and higher, and the island's ramps lift
 *   its eye — so behind a ramp it would look straight down. This picks the
 *   nearest heading (from the chase camera's own) whose standing eye is clear.
 */
import {SKATE_KEEP_OUTS, parkPoint} from '../world/layout.ts';
import type {SkateCameraFrame} from './skateCamera.ts';

type Pt = {x: number; z: number};
/** Margin outside a pad's keep-out rectangle (units). */
export const WATCH_MARGIN = 1.4;

export function skateWatchPoint(rider: Pt, cat: Pt): Pt {
  let best: (typeof SKATE_KEEP_OUTS)[number] | null = null, bd = Infinity;
  for (const r of SKATE_KEEP_OUTS) { const d = Math.hypot(rider.x - r.x, rider.z - r.z) - Math.max(r.halfWidth, r.halfDepth); if (d < bd) { bd = d; best = r; } }
  if (!best) return {x: cat.x, z: cat.z};
  const spot = best.id.replace(/^skate-/, '');
  // The spot's own frame, measured rather than assumed: origin and unit axes in island space.
  const [ox, oz] = parkPoint(spot, 0, 0), [ax, az] = parkPoint(spot, 1, 0), [bx, bz] = parkPoint(spot, 0, 1);
  const ux = ax - ox, uz = az - oz, vx = bx - ox, vz = bz - oz;
  // The rectangle's centre in local coordinates.
  const lc = (x: number, z: number) => [(x - ox) * ux + (z - oz) * uz, (x - ox) * vx + (z - oz) * vz] as const;
  const [cx, cz] = lc(best.x, best.z);
  const [px, pz] = lc(cat.x, cat.z);
  const hw = best.halfWidth + WATCH_MARGIN, hd = best.halfDepth + WATCH_MARGIN;
  let lx = Math.min(cx + hw, Math.max(cx - hw, px)), lz = Math.min(cz + hd, Math.max(cz - hd, pz));
  const inside = Math.abs(px - cx) < hw && Math.abs(pz - cz) < hd;
  if (inside) {
    // Out through the nearest side.
    const gaps = [cx + hw - px, px - (cx - hw), cz + hd - pz, pz - (cz - hd)];
    const k = gaps.indexOf(Math.min(...gaps));
    if (k === 0) lx = cx + hw; else if (k === 1) lx = cx - hw; else if (k === 2) lz = cz + hd; else lz = cz - hd;
  }
  const [wx, wz] = parkPoint(spot, lx, lz);
  return {x: wx, z: wz};
}

export type WalkPose = {target: [number, number, number]; r: number; theta: number; phi: number};
/**
 * @param f the chase camera's last frame
 * @param rider where the body stands (feet)
 * @param ground floor height the walking camera will clamp its eye to
 * @param stand the walking camera's own resting distance and tilt (phi from vertical)
 */
export function skateWalkPose(f: SkateCameraFrame, rider: {x: number; y: number; z: number}, ground: (x: number, z: number) => number, stand: {r: number; phi: number; lookHeight: number}): WalkPose {
  const target: [number, number, number] = [rider.x, rider.y + stand.lookHeight, rider.z];
  const start = Math.atan2(f.position[0] - f.target[0], f.position[2] - f.target[2]);
  const horiz = Math.sin(stand.phi) * stand.r, up = Math.cos(stand.phi) * stand.r;
  const clear = (theta: number) => {
    // The eye and the line to it must stand over ground lower than the eye would be.
    for (let i = 1; i <= 4; i++) {
      const t = i / 4, x = target[0] + Math.sin(theta) * horiz * t, z = target[2] + Math.cos(theta) * horiz * t, y = target[1] + up * t;
      const g = ground(x, z);
      if (Number.isFinite(g) && g > y - 0.35) return false;
    }
    return true;
  };
  const tries = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.1, -2.1, Math.PI];
  let theta = start;
  for (const d of tries) if (clear(start + d)) { theta = start + d; break; }
  return {target, r: stand.r, theta: Math.atan2(Math.sin(theta), Math.cos(theta)), phi: stand.phi};
}
