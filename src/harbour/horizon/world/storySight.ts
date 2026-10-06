import type { StructureSolid } from '../land/interfaces.ts';
import type { Point3 } from './definition.ts';
import type { RayCaster } from './raycast.ts';
import { solidBounds } from './geometry.ts';
import { aimPoint, storyEye, storyLandmark, type StoryEye } from './story.ts';

/**
 * The sight-chain proof (docs/horizon/STORY.md, world/story.ts): how far a story sightline clears everything the renderer
 * draws, on the SAME first-hit ray caster as the Sketchbook view proof (world/raycast.ts: heightfield with mouth masks,
 * every water surface, every baked solid). No second ray caster.
 *
 * Clearance = the largest vertical drop d for which the eye→aim segment, translated down by d, reaches the aim with no
 * first hit (negative: how far it must rise). A segment translated down by d unobstructed ⇔ the line clears every hit
 * by ≥ d vertically along its whole length.
 * - The segment starts `near` m out from the eye in plan: 3.5 m for an eye standing on a structure (a lookout's own open
 *   rail, 1.05 under a 1.6 eye, and a belfry's or cabin's own frame stand inside it), 1 m for an eye on the baked ground.
 * - Solids that are the target itself or the eye's own structure are skipped: a solid owns a point when its plan bounds
 *   hold the point and its height span reaches it (±3 m), and it is a building-sized piece (plan extent ≤ 80 m) —
 *   the Lamp's cage and stair, a campanile's roof, a deck under the eye. Everything else occludes.
 */
export interface SightMeasure { clearance: number; distance: number; blocker: string | null }

const OWN_EXTENT = 80;
export function ownsPoint(solid: StructureSolid, point: Point3): boolean {
  const b = solidBounds(solid);
  if (b.max[0] - b.min[0] > OWN_EXTENT || b.max[2] - b.min[2] > OWN_EXTENT) return false;
  return point[0] >= b.min[0] - .5 && point[0] <= b.max[0] + .5 && point[2] >= b.min[2] - .5 && point[2] <= b.max[2] + .5 && point[1] >= b.min[1] - 3 && point[1] <= b.max[1] + 3;
}

export function sightClearance(ray: RayCaster, solids: readonly StructureSolid[], eye: Point3, aim: Point3, options: { near?: number; range?: number; ignore?: (solid: StructureSolid) => boolean } = {}): SightMeasure {
  const near = options.near ?? 3.5, range = options.range ?? 40;
  const plan = Math.hypot(aim[0] - eye[0], aim[2] - eye[2]), f = Math.min(.5, near / (plan || 1));
  const start: Point3 = [eye[0] + (aim[0] - eye[0]) * f, eye[1] + (aim[1] - eye[1]) * f, eye[2] + (aim[2] - eye[2]) * f];
  const v: Point3 = [aim[0] - start[0], aim[1] - start[1], aim[2] - start[2]], length = Math.hypot(...v), dir: Point3 = [v[0] / length, v[1] / length, v[2] / length];
  const own = new Set(solids.filter(s => ownsPoint(s, aim) || ownsPoint(s, eye)));
  const skip = (s: StructureSolid) => own.has(s) || !!options.ignore?.(s);
  const cast = (d: number) => ray.first([start[0], start[1] - d, start[2]], dir, length - .05, { skip, step: 1 });
  const clearAt = (d: number) => cast(d).kind === 'sky';
  const name = (d: number) => { const h = cast(d); return h.kind === 'sky' ? null : h.kind === 'solid' ? h.sourceId : `${h.kind} at [${h.point.map(n => n.toFixed(0)).join(',')}]`; };
  let lo: number, hi: number;
  if (clearAt(0)) { lo = 0; hi = range; if (clearAt(hi)) return { clearance: range, distance: plan, blocker: null }; }
  else { hi = 0; lo = -range; if (!clearAt(lo)) return { clearance: -range, distance: plan, blocker: name(0) }; }
  for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (clearAt(m)) lo = m; else hi = m; }
  return { clearance: lo, distance: plan, blocker: name(hi + .01) };
}

/** A story eye on the bake: its absolute height, or its lift above the baked floor (ground or walkable solid). */
export function storyEyePoint(ray: RayCaster, eye: StoryEye): Point3 { return [eye.at[0], eye.y ?? ray.floorAt(eye.at[0], eye.at[1]) + eye.lift!, eye.at[1]]; }
/** One registry link measured: from a story eye to a story landmark's aim point (top − aimDrop). */
export function measureStoryLink(ray: RayCaster, solids: readonly StructureSolid[], from: string, to: string, options: { ignore?: (solid: StructureSolid) => boolean } = {}): SightMeasure {
  const e = storyEye(from);
  return sightClearance(ray, solids, storyEyePoint(ray, e), aimPoint(storyLandmark(to)), { near: e.y === undefined ? 1 : 3.5, ...options });
}
