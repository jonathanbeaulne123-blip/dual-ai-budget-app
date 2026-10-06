import type { StructureSolid, XY, XYZ } from '../interfaces';
import { box, distance, mix, plan, slab } from './mesh';

/**
 * The Water's Way (D-WW18, D-WW24; STYLE §1.6): the island's open rail. Posts and bars, never a wall: the rail stops a body
 * (1.05 high, a mid rail at body-contact height, a kicker at the deck) and the eye passes between its members.
 *
 * ONE RULE for every consumer that asks "does this solid hide what is behind it?" (the view proof's ID buffer and the story
 * sight chain, world/raycast.ts): a solid of kind OPEN_RAIL_KIND is an open rail, and so is the road main's post-and-rail
 * guard collider (`corridorGuard` in timber, whose visible kit is drawn by the corridor art). Collision is unchanged: the
 * posts and bars are real closed prisms at their drawn height (land/structures `collision is what's drawn`).
 */
export const OPEN_RAIL_KIND = 'openRail';
export function isOpenRail(solid: Pick<StructureSolid, 'kind' | 'surface'>): boolean {
  return solid.kind === OPEN_RAIL_KIND || (solid.kind === 'corridorGuard' && solid.surface === 'timber');
}
/**
 * What stops a body (runtime/geography.ts `contact`): a face is tested at 0.2, 0.65 and 1.25 over the feet, but only if it
 * rises above the 0.48 step (lower members are lips a body steps over). So between posts the member that stops a body is the
 * one through the 0.65 band — the guard bar (or a picket, or a kerb/upstand reaching past it). A bar or kicker under 0.48
 * never touches a body; at 0.2 a body meets only the posts and pickets. A rail with just a 1.05 top rail lets a body walk
 * under it between posts (the pier's posted rail did). `railBarLevels` is the one rule that keeps the 0.65 member in every
 * open rail; the kicker (≤ 0.13) stops wheels (the board's 0.12 step), never bodies.
 */
export const BODY_GUARD_BAND = .65;
/** Light timber open rail (reach SPEC §1, the approved "light timber"; prototype reach-v2 RAIL=open). Heights above the deck. */
export const OPEN_RAIL = {
  height: 1.05,
  /** Posts 0.12 × 0.12, at most this far apart. */
  post: .12, spacing: 2,
  /** Top rail 0.11 wide × 0.08 deep, its top at `height`. */
  top: [.11, .08] as const,
  /** The guard bar: 0.14 wide × 0.10 tall, centred 0.65 over the deck (BODY_GUARD_BAND). It stands 0.01 proud of the posts'
   *  faces, so a body pressed along the rail slides on it and never catches a post. Other bars (`style.bars`) are 0.05 × 0.05. */
  mid: { at: BODY_GUARD_BAND, width: .14, height: .1, bar: .05 },
  /** Kicker 0.06 wide, 0.13 tall at the deck: it closes the gap under the guard bar for a wheel and a board (a lip over the
   *  board's 0.12 step is a wall); a body never reaches it (the guard bar holds it 0.37 off the rail's line). */
  kicker: { width: .06, height: .13 },
  /** Posts are fixed this far down into the deck edge (they read as bolted to the fascia). */
  embed: .3,
} as const;
export interface OpenRailStyle {
  /** Rail height over the line (1.05). */
  height?: number;
  /** Where the posts stand from, over the line (0; a stone pad's rail stands on its kerb, 0.35). */
  from?: number;
  /** 'timber' (posts, top rail, guard bar, kicker) or 'pickets' (the Greenway's bridges: a steel bottom rail at 0.16–0.20, pickets
   *  0.035 every 0.16 from 0.17 to the top rail, posts every 2 m, a cap rail). */
  infill?: 'timber' | 'pickets';
  /** Bar levels over `from` (default: the guard bar at 0.65 over the line). If none of them is the guard (and the rail has no
   *  pickets), the guard bar is added: the one rule, `railBarLevels`. */
  bars?: readonly number[];
  /** No kicker (the Greenway's kerbs stop its wheels). */
  kicker?: boolean;
  /** Post section (0.12) and top-rail section [width, depth] (0.11 × 0.08). */
  post?: number;
  top?: readonly [number, number];
  /** The top rail, bars and kicker run along the path's own segments (one member per drawn segment, the Greenway's long
   *  graded line) instead of post to post. */
  alongPath?: boolean;
  /** Lite drops (CONTRACT §6, "lite drops, never substitutes"): a twin solid that the lite tier leaves out (liteIndices = []).
   *  The bars, the kicker, the pickets and every post but each `liteEvery`-th go into it; the top rail, the pickets' bottom rail
   *  and the kept posts stay in `out`. Full geometry and collision are the same either way. */
  fine?: StructureSolid;
  liteEvery?: number;
}
/** The one rule: the bar levels an open rail draws over its line (absolute) — the style's bars, plus the guard bar at the body's
 *  0.65 contact band unless a bar, the pickets or the upstand under `from` already stands through it. */
export function railBarLevels(style: OpenRailStyle = {}): number[] {
  const from = style.from ?? 0, pickets = style.infill === 'pickets';
  const bars = (style.bars ?? (pickets ? [] : [OPEN_RAIL.mid.at - from])).map(b => from + b);
  const guarded = pickets || from > BODY_GUARD_BAND + .05 || bars.some(b => Math.abs(b - BODY_GUARD_BAND) <= OPEN_RAIL.mid.height / 2 - .01);
  if (!guarded) bars.push(BODY_GUARD_BAND);
  return bars;
}
/** One horizontal bar between two rail stations, `level` over their line: the guard bar's section at the body-contact level
 *  (OPEN_RAIL.mid.at), a slim 0.05 bar elsewhere. */
export function railBar(out: StructureSolid, a: XYZ, b: XYZ, offset: number, level: number): void {
  const guard = Math.abs(level - OPEN_RAIL.mid.at) < .06, w = guard ? OPEN_RAIL.mid.width : OPEN_RAIL.mid.bar, h = guard ? OPEN_RAIL.mid.height : OPEN_RAIL.mid.bar;
  slab(out, a, b, w, h, offset, level + h / 2);
}
/** Arc length of a plan polyline. */
export const planLength = (path: readonly XYZ[]): number => path.slice(1).reduce((n, p, i) => n + distance(plan(path[i]!), plan(p)), 0);
/** Point and plan unit direction at arc length s along a polyline (clamped to its ends). */
export function pointAlong(path: readonly XYZ[], s: number): { p: XYZ; dir: XY } {
  let run = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!, len = distance(plan(a), plan(b)); if (len < 1e-9) continue;
    if (run + len >= s || i === path.length - 1) { const t = Math.max(0, Math.min(1, (s - run) / len)); return { p: [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)], dir: [(b[0] - a[0]) / len, (b[2] - a[2]) / len] }; }
    run += len;
  }
  const p = path[0]!, q = path[1] ?? p, l = distance(plan(p), plan(q)) || 1; return { p, dir: [(q[0] - p[0]) / l, (q[2] - p[2]) / l] };
}
/**
 * THE open-rail builder (every open rail on the island draws through here: the Reach, the Greenway, the pier, the Scholars and
 * Flats decks, the meeting bays, the open spans). Along `path` (its points are the deck surface under the rail), moved `offset`
 * along the path's left normal: posts at both ends and at most OPEN_RAIL.spacing apart; the top rail, the bars (railBarLevels)
 * and the kicker or the pickets run post to post (or along the path's own segments, `alongPath`).
 */
export function openRail(out: StructureSolid, path: readonly XYZ[], offset = 0, style: OpenRailStyle = {}): void {
  const H = style.height ?? OPEN_RAIL.height, from = style.from ?? 0, length = planLength(path); if (length < .05) return;
  const n = Math.max(1, Math.ceil(length / OPEN_RAIL.spacing)), stations: { p: XYZ; xy: XY }[] = [];
  for (let k = 0; k <= n; k++) { const { p, dir } = pointAlong(path, length * k / n); stations.push({ p, xy: [p[0] - dir[1] * offset, p[2] + dir[0] * offset] }); }
  const picket = style.infill === 'pickets', fine = style.fine ?? out, every = style.liteEvery ?? 1, post = style.post ?? OPEN_RAIL.post, top = style.top ?? OPEN_RAIL.top;
  const kicker = !picket && from <= 0 && style.kicker !== false, bars = railBarLevels(style);
  stations.forEach(({ p, xy }, k) => box(k % every === 0 || k === n ? out : fine, xy, p[1] + H, [post, post], p[1] + Math.min(from, 0) - OPEN_RAIL.embed));
  const members = style.alongPath ? path.slice(1).map((b, i) => [path[i]!, b] as const) : stations.slice(1).map((st, k) => [stations[k]!.p, st.p] as const);
  for (const [a, b] of members) {
    if (distance(plan(a), plan(b)) < 1e-6) continue;
    slab(out, a, b, top[0], top[1], offset, H);
    if (picket) {
      slab(out, a, b, .05, .04, offset, from + .2);
      const run = distance(plan(a), plan(b)), m = Math.max(1, Math.round(run / .16));
      for (let j = 1; j < m; j++) { const t = j / m, q: XYZ = [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)], d = run || 1, dir: XY = [(b[0] - a[0]) / d, (b[2] - a[2]) / d];
        box(fine, [q[0] - dir[1] * offset, q[2] + dir[0] * offset], q[1] + H - top[1], [.035, .035], q[1] + from + .17); }
      continue;
    }
    for (const at of bars) railBar(fine, a, b, offset, at);
    if (kicker) slab(fine, a, b, OPEN_RAIL.kicker.width, OPEN_RAIL.kicker.height, offset, OPEN_RAIL.kicker.height);
  }
}
/** An open rail round a closed or open loop of plan corners at one deck height each (a bay, a pad, a terrace). */
export function openRailLoop(out: StructureSolid, corners: readonly XYZ[], closed: boolean, style: OpenRailStyle = {}): void {
  const loop = closed ? [...corners, corners[0]!] : [...corners];
  for (let i = 1; i < loop.length; i++) openRail(out, [loop[i - 1]!, loop[i]!], 0, style);
}
