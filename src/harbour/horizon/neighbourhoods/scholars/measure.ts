/**
 * Scholars' Edge measurements (pure): the crown of a planted tree, the canopy cover of the woods, the courtyard's
 * golden-hour sun and the story's sightlines over the woods. The module plants by these rules and the tests prove the
 * same numbers with the same functions (horizon-create rule 2: one definition).
 *
 * Crowns are the corridor kit's expected plant forms (`land/corridor/plan/species.ts` PLANT_FORM: the planting art draws
 * every species no larger than this at the same scale): a vertical cylinder of radius `canopy × scale` from
 * `base × scale` to `height × scale` above the root.
 */
import type { Point2, Point3 } from '../../world/definition.ts';
import { PLANT_FORM } from '../../land/corridor/plan/species.ts';
import { STORY_EYES, aimPoint, storyLandmark } from '../../world/story.ts';
import type { PlantRecord } from '../types.ts';
import { FLOOR, LOC, SUN, TERRACE_RECTS, W, WOODS_C } from './frame.ts';

export type Crown = { x: number; z: number; r: number; lo: number; hi: number };
/** A tree's crown cylinder, or null for a plant that is not a tree (ferns, drifts). */
export function crownOf(p: Pick<PlantRecord, 'species' | 'at' | 'scale'>): Crown | null {
  const f = PLANT_FORM[p.species];
  if (!f?.tree) return null;
  return { x: p.at[0], z: p.at[2], r: f.canopy * p.scale, lo: p.at[1] + f.base * p.scale, hi: p.at[1] + f.height * p.scale };
}

/** The share (0…1) of the disc of radius `radius` round the woods' centre under a crown disc of 0.9 × its radius
 * (the prototype's measure, protos/scholars checks.py), on a 1 m grid. */
export function canopyCover(plants: readonly Pick<PlantRecord, 'species' | 'at' | 'scale'>[], radius = 110, centre: Point2 = WOODS_C): number {
  const n = Math.ceil(radius) * 2 + 1, x0 = centre[0] - Math.ceil(radius), z0 = centre[1] - Math.ceil(radius), grid = new Uint8Array(n * n);
  for (const p of plants) {
    const c = crownOf(p); if (!c) continue;
    const r = c.r * 0.9, i0 = Math.max(0, Math.floor(c.x - r - x0)), i1 = Math.min(n - 1, Math.ceil(c.x + r - x0)), j0 = Math.max(0, Math.floor(c.z - r - z0)), j1 = Math.min(n - 1, Math.ceil(c.z + r - z0));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if ((x0 + i - c.x) ** 2 + (z0 + j - c.z) ** 2 < r * r) grid[j * n + i] = 1;
  }
  let inside = 0, covered = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { if ((x0 + i - centre[0]) ** 2 + (z0 + j - centre[1]) ** 2 >= radius * radius) continue; inside++; covered += grid[j * n + i]!; }
  return covered / inside;
}

/** The courtyard proper: the terrace's main and north pads on the gable (the door pad is the strip along the Library's
 * door face, in its shadow at golden hour by design: the sun comes from the west-north-west over the gable). */
export const COURT_RECTS = TERRACE_RECTS.slice(0, 2);
/** The courtyard sample points: a 2 m grid on its pads, 0.5 m in from their edges. */
export function terraceSamples(step = 2, rects = COURT_RECTS): Point2[] {
  const out: Point2[] = [];
  for (const [u0, u1, v0, v1] of rects) for (let u = u0 + 0.5; u <= u1 - 0.5; u += step) for (let v = v0 + 0.5; v <= v1 - 0.5; v += step) out.push(W(u, v));
  return out;
}

/** The re-dressed Library as drawn (eave 5.2, two 50° roofs, ridges at v = ±7.5 at the shell's roof): is (x, y, z) inside it? */
export function insideLibrary(x: number, y: number, z: number, eave = 5.2, rise = 9.2): boolean {
  const [u, v] = LOC(x, z);
  if (Math.abs(u) > 21.9 || Math.abs(v) > 16 || y < FLOOR - 1) return false;
  return y < FLOOR + eave + Math.max(0, rise * (1 - Math.abs(Math.abs(v) - 7.5) / 8.4));
}

/** Whether a point on the terrace sees the golden-hour sun past the Library, the ground and every crown. */
export function sunlit(x: number, z: number, crowns: readonly Crown[], ground: (x: number, z: number) => number, y = FLOOR + 0.1): boolean {
  const [sx, sy, sz] = SUN, h2 = sx * sx + sz * sz;
  for (let t = 0.5; t < 400; t += 0.7) {
    const px = x + sx * t, py = y + sy * t, pz = z + sz * t;
    if (insideLibrary(px, py, pz)) return false;
    if (t > 2 && py < ground(px, pz)) return false;
    if (py > FLOOR + 60) break;
  }
  for (const c of crowns) {
    const dx = c.x - x, dz = c.z - z, t = (dx * sx + dz * sz) / h2;
    if (t < 0) continue;
    // The ray's plan passage through the crown disc and its height there.
    const px = x + sx * t, pz = z + sz * t, off = Math.hypot(px - c.x, pz - c.z);
    if (off > c.r) continue;
    const half = Math.sqrt(c.r * c.r - off * off) / Math.sqrt(h2), yIn = y + sy * Math.max(0, t - half), yOut = y + sy * (t + half);
    if (yIn < c.hi && yOut > c.lo) return false;
  }
  return true;
}
/** The lowest height the sun's ray from (x, z) has while it crosses the crown's disc (Infinity: it never does). */
export function sunRayUnder(x: number, z: number, c: Pick<Crown, 'x' | 'z' | 'r'>, y = FLOOR + 0.1): number {
  const [sx, sy, sz] = SUN, h2 = sx * sx + sz * sz, dx = c.x - x, dz = c.z - z, t = (dx * sx + dz * sz) / h2;
  if (t < 0) return Infinity;
  const off = Math.hypot(x + sx * t - c.x, z + sz * t - c.z);
  if (off > c.r) return Infinity;
  return y + sy * Math.max(0, t - Math.sqrt(c.r * c.r - off * off) / Math.sqrt(h2));
}
export function sunlitShare(crowns: readonly Crown[], ground: (x: number, z: number) => number, rects = COURT_RECTS): { share: number; samples: number } {
  const pts = terraceSamples(2, rects), lit = pts.filter(([x, z]) => sunlit(x, z, crowns, ground)).length;
  return { share: lit / pts.length, samples: pts.length };
}

/* ---------------------------------------------------------------- the story's sightlines */

export type Sightline = { from: string; to: string; a: Point3; b: Point3 };
/** Every story eye → each binocular target (the Lamp included), aimed at the target's top less its aim drop: the lines the
 * woods must keep clear (the sight-chain proofs measure baked solids; a crown is a module's, measured here). */
export function storySightlines(ground: (x: number, z: number) => number): Sightline[] {
  const out: Sightline[] = [];
  for (const e of STORY_EYES) {
    const a: Point3 = [e.at[0], e.y ?? ground(e.at[0], e.at[1]) + (e.lift ?? 1.6), e.at[1]];
    for (const t of e.targets) { let l; try { l = storyLandmark(t); } catch { continue; } out.push({ from: e.id, to: t, a, b: aimPoint(l) }); }
  }
  return out;
}
/** How far (m) a crown stays under a sightline where the line passes over it (negative: the crown pokes into it).
 * Infinity when the line never passes over the crown's disc. */
export function crownClearance(line: Pick<Sightline, 'a' | 'b'>, c: Crown): number {
  const [ax, ay, az] = line.a, [bx, by, bz] = line.b, dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.z - az) * dz) / (L2 || 1))), off = Math.hypot(ax + dx * t - c.x, az + dz * t - c.z);
  if (off > c.r) return Infinity;
  const half = Math.sqrt(c.r * c.r - off * off) / Math.sqrt(L2 || 1), y0 = ay + (by - ay) * Math.max(0, t - half), y1 = ay + (by - ay) * Math.min(1, t + half);
  return Math.min(y0, y1) - c.hi;
}
/** The plan bearing (degrees, 0 = +x east, 90 = +z south) from a to b. */
export const bearing = (a: Point2, b: Point2) => ((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + 360) % 360;
