/**
 * Harbour skate spots — the island-facing table (v2).
 *
 * The places themselves live in `world/layout.ts` and are ridden through
 * `world/field.ts` (`createSkateField`). This module keeps the names the rest
 * of the island imports (`planting.ts`, `places.ts`, `session.ts`, `driver.ts`).
 *
 *  - `SKATE_SPOTS` rows carry the contract's `start`/`startYaw`.
 *  - `skateSurface(x, z, ground)` is backed by a cached v2 field for that ground
 *    function, so walking follows the new pads, ramps, stairs and ledges.
 *  - `SKATE_RAILS`/`railPoint` are a 2-point view of v2's straight flat round
 *    rails (session's default grind-goal table). The ride uses `SkateField.grindables`.
 */
import { PAD_FIT_LIFT, createSkateField, type SkateWorldField } from './world/field.ts';
import { ROUTES, SPOTS, SPOT_LAYOUTS, type SkateSpotEntry } from './world/layout.ts';
export { SKATE_KEEP_OUTS } from './world/layout.ts';
import { frameToWorld } from './world/profiles.ts';

export type SkatePoint = readonly [number, number];
/** A flat round rail as a 2-point segment; v2 grindables are 3D polylines (`SkateField.grindables`). */
export type SkateRail = { id: string; a: SkatePoint; b: SkatePoint; height: number; name: string };

export type SkateSpotId = 'tideline' | 'bookends' | 'fundsteps' | 'drydock' | 'orchard' | 'northlight' | 'tidepools';
export const SKATE_SPOTS = SPOTS as readonly (SkateSpotEntry & { id: SkateSpotId })[];

export const SKATE_ROUTES = ROUTES;
export type SkateRouteId = typeof SKATE_ROUTES[number]['id'];

export const SKATE_DECKS = [
  { id: 'tideline', name: 'Tideline', colour: '#43c7b6', ink: '#153d41', discoveries: 0 },
  { id: 'afterglow', name: 'Afterglow', colour: '#ee9dc0', ink: '#823d71', discoveries: 0 },
  { id: 'saltwood', name: 'Saltwood', colour: '#e6ae56', ink: '#36536c', discoveries: 0 },
  { id: 'orchard', name: 'Wild apple', colour: '#b5d576', ink: '#355c42', discoveries: 2 },
  { id: 'northlight', name: 'Northlight', colour: '#89b9ef', ink: '#253453', discoveries: 4 },
  { id: 'islander', name: 'Islander', colour: '#f1dfb4', ink: '#9b443e', discoveries: 6 },
] as const;
export type SkateDeckId = typeof SKATE_DECKS[number]['id'];

/* ------------------------------------------------------------------ the field, per ground */

const fields = new WeakMap<(x: number, z: number) => number, SkateWorldField>();
/** One v2 field per ground function (built on first use; ~20 ms). */
export function skateFieldFor(ground: (x: number, z: number) => number): SkateWorldField {
  let f = fields.get(ground);
  if (!f) { f = createSkateField(ground); fields.set(ground, f); }
  return f;
}

/** Height (and feature id) of the skateable island under a point. `ramp` is the v2 feature id, or null on pads and open ground. */
export function skateSurface(x: number, z: number, ground: (x: number, z: number) => number): { y: number; ramp: string | null } {
  const s = skateFieldFor(ground).sample(x, z);
  return { y: s.y, ramp: s.feature };
}

/* ------------------------------------------------------------------ flat rails */

/** A 2-point view of v2's straight, flat round rails (island ground + height). */
export const SKATE_RAILS: readonly SkateRail[] = SPOT_LAYOUTS.flatMap(l => l.features.flatMap(f => {
  if (f.type !== 'rail' || f.kind !== 'round-rail' || f.points.length !== 2 || f.points[0]![2] !== f.points[1]![2]) return [];
  const a = frameToWorld(l.frame, f.points[0]![0], f.points[0]![1]), b = frameToWorld(l.frame, f.points[1]![0], f.points[1]![1]);
  return [{ id: f.id, name: f.name, a: [a[0], a[1]] as SkatePoint, b: [b[0], b[1]] as SkatePoint, height: f.points[0]![2] + PAD_FIT_LIFT - 0.035 }];
}));
export function railPoint(r: SkateRail, t: number, ground: (x: number, z: number) => number): { x: number; y: number; z: number } {
  return { x: r.a[0] + (r.b[0] - r.a[0]) * t, z: r.a[1] + (r.b[1] - r.a[1]) * t, y: ground(...r.a) + (ground(...r.b) - ground(...r.a)) * t + r.height + 0.035 };
}
