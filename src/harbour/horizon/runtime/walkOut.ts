import type {HorizonPathGraph} from '../world/pathGraph.ts';
import type {Point3} from '../world/definition.ts';
import {HORIZON_MANIFEST,requireScaleFactor} from '../world/manifest.ts';

/**
 * Wave 7 (R3-130, CONTRACT §2.4, NOT-THIS "edge teleports"): Look → Walk never puts the body in water or in the air.
 *
 * A page's eye stands at body-eye height over its own ground (A–I, K, L: 0.0 eu of drop on the bake). Where it does not —
 * page J's eye is 60 eu over the sea, and page I's lite terrain puts its eye 0.6 eu in the river — the body goes, with a fade
 * (a cut under reduced motion or calm), to the page's authored ground point (`views[*].ground`, D-D6) when it is dry and
 * walkable, else to the nearest path node (in plan) that is dry, walkable, unblocked and reachable from the square. An eye
 * that stands on dry ground but farther than walkPlan's snap (8 eu) from every path edge (pages D, E, I, L on candidate 5)
 * moves the same way: a Walk body must be routable.
 */
/** The largest drop from the eye's body position (eye − 1.6) to the floor under it that still counts as "standing there". */
export const HORIZON_WALKOUT_DROP = 1.6;
/** walkPlan's snap distance: a body standing farther than this from every path edge cannot be routed (tap-to-walk). */
export const HORIZON_WALKOUT_SNAP = 8;
/** The body's eye over its feet in a Look pose (the pose → body convention of `shot()`). */
export const HORIZON_POSE_EYE = 1.6;
/** The standing check: the dry, walkable, unblocked floor at or just under `y` (null when there is none). */
export type HorizonWalkProbe = (x: number, z: number, y: number) => {y: number} | null;
export interface HorizonWalkOut {x: number; y: number; z: number; yaw: number; how: 'stand' | 'ground' | 'node' | 'wait'; node?: string; moved: number}

const reachCache = new WeakMap<HorizonPathGraph, Set<string>>();
/** The square (the arrival) in engine units, the root every walk-out node must be reachable from. */
export function horizonSquare(): Point3 {
  const s = requireScaleFactor(), court = HORIZON_MANIFEST.places.find(p => p.id === 'court');
  return court ? [court.xy[0]! * s, court.h * s, court.xy[1]! * s] : [0, 0, 0];
}
/** Nodes connected to the node nearest the square (edges both ways: a walk-out may lead down a stair or up it). */
export function reachableFromSquare(graph: HorizonPathGraph): Set<string> {
  const cached = reachCache.get(graph); if (cached) return cached;
  const sq = horizonSquare(); let root: string | undefined, best = Infinity;
  for (const n of graph.nodes) { const d = Math.hypot(n.at[0] - sq[0], n.at[1] - sq[1], n.at[2] - sq[2]); if (d < best) { best = d; root = n.id; } }
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) { (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push(e.to); (adj.get(e.to) ?? adj.set(e.to, []).get(e.to)!).push(e.from); }
  const seen = new Set<string>(root ? [root] : []), queue = root ? [root] : [];
  while (queue.length) { const id = queue.pop()!; for (const next of adj.get(id) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); } }
  reachCache.set(graph, seen); return seen;
}
/** walkPlan's own snap measure: plan distance to the nearest edge point, combined with the height difference there. */
export function graphDistance(graph: HorizonPathGraph, x: number, y: number, z: number): number {
  let best = Infinity;
  for (const e of graph.edges) for (let i = 1; i < e.points.length; i++) {
    const a = e.points[i - 1]!, b = e.points[i]!, dx = b[0] - a[0], dz = b[2] - a[2], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[2] + dz * t - z, a[1] + (b[1] - a[1]) * t - y));
  }
  return best;
}
const yawTo = (from: readonly number[], to: readonly number[] | undefined, fallback: number) => to ? Math.atan2(to[0]! - from[0]!, to[2]! - from[2]!) : fallback;

/**
 * Where Walk stands the body when it leaves a Look eye. `eye` is the pose's eye (or the body's eye: body + 1.6); `target`
 * orients a relocated body toward the page's subject; `ground` is the page's authored dry ground point, when it has one.
 *
 * PR #561 review (Codex P2): `resident(x, z)` (the runtime's chunk gate) says whether the collision at a point has arrived.
 * The walk-out never decides on partial collision: the first point it must probe whose chunk is missing — the eye (G's floor is
 * only in `undercroft`), the page's ground (J's is in `prow`), a candidate node — returns `wait` at that point, and the
 * runtime holds the body where it is until that chunk lands, then asks again.
 */
export function horizonWalkOut(view: {eye: readonly number[]; target?: readonly number[]; ground?: readonly number[]; yaw?: number}, graph: HorizonPathGraph, probe: HorizonWalkProbe, resident: (x: number, z: number) => boolean = () => true): HorizonWalkOut {
  const eye = view.eye, y0 = eye[1]! - HORIZON_POSE_EYE, fallbackYaw = view.yaw ?? yawTo(eye, view.target, 0);
  const wait = (x: number, z: number): HorizonWalkOut => ({x, y: y0, z, yaw: fallbackYaw, how: 'wait', moved: 0});
  if (!resident(eye[0]!, eye[2]!)) return wait(eye[0]!, eye[2]!);
  const here = probe(eye[0]!, eye[2]!, y0);
  // Standing there, and routable from there (a Walk body out of the graph's snap cannot tap-to-walk anywhere).
  if (here && y0 - here.y <= HORIZON_WALKOUT_DROP && graphDistance(graph, eye[0]!, here.y, eye[2]!) <= HORIZON_WALKOUT_SNAP) return {x: eye[0]!, y: here.y, z: eye[2]!, yaw: fallbackYaw, how: 'stand', moved: 0};
  const planFromEye = (p: readonly number[]) => Math.hypot(p[0]! - eye[0]!, p[2]! - eye[2]!);
  if (view.ground) {
    const g = view.ground;
    if (!resident(g[0]!, g[2]!)) return wait(g[0]!, g[2]!);
    const at = probe(g[0]!, g[2]!, g[1]! + .5);
    if (at && Math.abs(at.y - g[1]!) <= HORIZON_WALKOUT_DROP) return {x: g[0]!, y: at.y, z: g[2]!, yaw: yawTo(g, view.target, fallbackYaw), how: 'ground', moved: planFromEye(g)};
  }
  const reach = reachableFromSquare(graph);
  const candidates = graph.nodes.filter(n => reach.has(n.id)).map(n => ({n, d: planFromEye(n.at)})).sort((a, b) => a.d - b.d || a.n.id.localeCompare(b.n.id));
  for (const {n, d} of candidates) {
    if (!resident(n.at[0], n.at[2])) return wait(n.at[0], n.at[2]);
    const at = probe(n.at[0], n.at[2], n.at[1] + .5);
    if (at && Math.abs(at.y - n.at[1]) <= HORIZON_WALKOUT_DROP) return {x: n.at[0], y: at.y, z: n.at[2], yaw: yawTo(n.at, view.target, fallbackYaw), how: 'node', node: n.id, moved: d};
  }
  throw new Error('The Horizon has no dry, walkable path node for a walk-out.');
}

/**
 * PR #561 review (Codex P2): what a foot frame may do while a walk-out, a restore or a resume waits on ground whose chunk
 * has not arrived. `free` — nothing pending, step normally; `held` — the chunk the hold waits on (under the body, or the
 * walk-out's `wait` point) is still missing: no movement, no fall, no jump, no parachute (the body stays exactly where it was
 * placed); `reseat` — that chunk is resident now: finish what was pending (the dry walk-out, the restore's validation) before
 * any physics runs. `gateOpenAtHold` may parse fetched bytes (runtime gateOpen), so a chunk that just landed reseats that frame.
 */
export type HorizonFootFrame = 'free' | 'held' | 'reseat';
export function horizonFootFrame(pending: {walkOut: boolean; restore: boolean; resnap: boolean}, gateOpenAtHold: () => boolean): HorizonFootFrame {
  if (!pending.walkOut && !pending.restore && !pending.resnap) return 'free';
  return gateOpenAtHold() ? 'reseat' : 'held';
}
