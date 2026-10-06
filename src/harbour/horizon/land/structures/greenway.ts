import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { BedCut, HeightQuery, LandCuts, StructureSolid, XY, XYZ } from '../interfaces';
import { bed } from '../beds/profiles';
import { box, distance, districtAt, mitredSlab, nearestOnPath, plan, prism, slab, solid } from './mesh';
import { OPEN_RAIL, OPEN_RAIL_KIND, planLength, pointAlong, railBar } from './openRail';

/**
 * The Water's Way — the Greenway (D-WW22, D-WW24; MANIFEST profiles.greenway + structures.greenway; the prototype's
 * greenway.mjs, reach SPEC §4, project doc claude/greenway-concept-2026-10-05.md).
 *
 * A 6 m shared deck on piles from Reach Gate [1215,1317.5] to Bluff End [870,705] (1.13 km, ≤ 5 %, ≥ 0.6 over the ground or
 * the water), carried by its own structure end to end (its bed cuts no terrain; the terrain under it is capped 0.65 under the
 * deck like every open span). Section: a 2.5 plank foot lane on the left (view, −) side, a 0.12 pale inlay, a 3.3 smooth
 * wheel lane, kerbs, open timber rails 1.05 at ±3.05 (steel pickets on the two bridges). Timber bents every 4 m where the
 * deck stands more than `piled_over_m` over the ground or the water, short posts on footings below that. The Twin Crossing
 * (S4 + the Year Walk) and the Calendar Bridge (the Year Walk) are steel girders on concrete piers placed off every bed.
 * Places: A Reach Gate (terrace + the Gate Bridge to the Landing quay), B the Reed Maze trail (ramp, low boardwalks, the
 * Dune Overlook; the dipping platform is built with the pools, land/water/marsh.ts), C the Twin Crossing bays, E the Arch
 * Pier, F the Paddle Dock, G the Sunset Balcony, H Bluff End (dead end), and the Marsh Hide. Dressing (lamps, viewers,
 * benches, panels, the gateway frame, the pavilion, planting, rafts) is PR 3.
 *
 * Frame (the prototype's P(s)): f = the travel direction, r = (−f.z, f.x); W(off, dy, fwd) = P + r·off + f·fwd, deck + dy.
 * Negative offsets are the left, the sea and view side.
 */
type GS = typeof M.structures.greenway;
export const GREENWAY: GS = M.structures.greenway;
const PRO = M.profiles.greenway;
export interface GreenwayFrame { s: number; p: XYZ; ground: number; f: XY; r: XY; W: (off: number, dy?: number, fwd?: number) => XYZ }
export interface GreenwayLine {
  /** Every 2 m sample: [x, deck, z] and the solved ground under it. */ full: XYZ[]; ground: number[]; arcs: number[]; length: number;
  /** The drawn and carried line: the samples simplified (≤ 0.01 eu) with forced breaks (bridges, gaps), each with its arc. */ pts: XYZ[]; ptsS: number[];
  at: (s: number) => GreenwayFrame;
}
/** Douglas–Peucker over [x, deck, z] (keeps both ends). */
function simplify(points: readonly XYZ[], tolerance: number): number[] {
  const keep = new Set([0, points.length - 1]);
  const rec = (a: number, b: number) => {
    let best = -1, d = tolerance; const A = points[a]!, B = points[b]!, v: XYZ = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2 || 1;
    for (let i = a + 1; i < b; i++) { const P = points[i]!, t = Math.max(0, Math.min(1, ((P[0] - A[0]) * v[0] + (P[1] - A[1]) * v[1] + (P[2] - A[2]) * v[2]) / l2)), e = Math.hypot(P[0] - A[0] - v[0] * t, P[1] - A[1] - v[1] * t, P[2] - A[2] - v[2] * t); if (e > d) { d = e; best = i; } }
    if (best >= 0) { keep.add(best); rec(a, best); rec(best, b); }
  };
  rec(0, points.length - 1);
  return [...keep].sort((x, y) => x - y);
}
let LINE: GreenwayLine | undefined;
/** The forced break stations (bridges, rail gaps, places) so a drawn segment is wholly on one side of each. */
function breaks(): number[] {
  const out: number[] = [];
  for (const b of GREENWAY.bridges) out.push(b.s[0]!, b.s[1]!);
  for (const side of ['left', 'right'] as const) for (const g of GREENWAY.gaps[side]) out.push(g[0]!, g[1]!);
  return out;
}
export function greenwayLine(): GreenwayLine {
  if (LINE) return LINE;
  const raw = GREENWAY.pts as unknown as readonly (readonly number[])[], full: XYZ[] = raw.map(p => [p[0]!, p[2]!, p[1]!]), ground = raw.map(p => p[3]!), arcs = [0];
  for (let i = 1; i < full.length; i++) arcs.push(arcs[i - 1]! + distance(plan(full[i - 1]!), plan(full[i]!)));
  const length = arcs.at(-1)!;
  const lerpAt = (s: number): { p: XYZ; g: number; i: number } => {
    const c = Math.max(0, Math.min(length, s)); let i = 1; while (i < full.length - 1 && arcs[i]! < c) i++;
    const a = full[i - 1]!, b = full[i]!, t = (c - arcs[i - 1]!) / ((arcs[i]! - arcs[i - 1]!) || 1);
    return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], g: ground[i - 1]! + (ground[i]! - ground[i - 1]!) * t, i };
  };
  const keep = simplify(full, .01), entries = keep.map(i => ({ s: arcs[i]!, p: full[i]! }));
  for (const s of breaks()) if (s > 0 && s < length && !entries.some(e => Math.abs(e.s - s) < .05)) entries.push({ s, p: lerpAt(s).p });
  entries.sort((a, b) => a.s - b.s);
  // The solved profile holds ≤ 5 % per 2 m of its own polyline; a chord across a bend is shorter than the arc it spans, so the
  // drawn line is lifted (never lowered, by millimetres) until every drawn chord holds ≤ 5 % too (the profile's own envelope).
  { const g = PRO.grade_max_pct / 100 - 1e-5, y = entries.map(e => e.p[1]), c = entries.map((e, i) => i ? distance(plan(entries[i - 1]!.p), plan(e.p)) : 0);
    for (let it = 0; it < 6; it++) { for (let i = 1; i < y.length; i++) y[i] = Math.max(y[i]!, y[i - 1]! - g * c[i]!); for (let i = y.length - 2; i >= 0; i--) y[i] = Math.max(y[i]!, y[i + 1]! - g * c[i + 1]!); }
    entries.forEach((e, i) => { e.p = [e.p[0], y[i]!, e.p[2]]; }); }
  const at = (s: number): GreenwayFrame => {
    const { p, g, i } = lerpAt(s), a = full[Math.max(0, i - 2)]!, b = full[Math.min(full.length - 1, i + 1)]!, l = distance(plan(a), plan(b)) || 1, f: XY = [(b[0] - a[0]) / l, (b[2] - a[2]) / l], r: XY = [-f[1], f[0]];
    const ext = s < 0 ? s : s > length ? s - length : 0, P: XYZ = [p[0] + f[0] * ext, p[1], p[2] + f[1] * ext];
    return { s, p: P, ground: g, f, r, W: (off, dy = 0, fwd = 0) => [P[0] + r[0] * off + f[0] * fwd, P[1] + dy, P[2] + r[1] * off + f[1] * fwd] };
  };
  LINE = { full, ground, arcs, length, pts: entries.map(e => e.p), ptsS: entries.map(e => e.s), at };
  return LINE;
}
const inSpans = (s: number, spans: readonly (readonly number[])[], pad = 0) => spans.some(g => s > g[0]! - pad && s < g[1]! + pad);
/** The rail gaps on one side (−1 left, +1 right): the authored gaps, plus Bluff End's terrace on the left. */
const GAPS = new Map<number, number[][]>();
export function greenwayGaps(side: -1 | 1): number[][] {
  const memo = GAPS.get(side); if (memo) return memo;
  const L = greenwayLine(), out = (side < 0 ? GREENWAY.gaps.left : GREENWAY.gaps.right).map(g => [g[0]!, g[1]!]);
  if (side < 0) out.push([terraceJoin().s, L.length + 1]);
  GAPS.set(side, out); return out;
}
/** Where Bluff End's terrace (R about its centre) first meets the deck's left edge, walking toward the end. */
function terraceJoin(): { s: number } {
  const L = greenwayLine(), H = GREENWAY.places.H, c = H.centre as unknown as XY;
  for (let s = L.length - 30; s <= L.length; s += .25) { const q = L.at(s).W(-3.05); if (Math.hypot(q[0] - c[0], q[2] - c[1]) <= H.r_m - .3) return { s }; }
  return { s: L.length };
}
export const isBridge = (s: number): boolean => inSpans(s, GREENWAY.bridges.map(b => b.s));
/** Distance (plan) from a point to the nearest bed not of the Greenway's own (centreline − half-width). */
function bedClearance(cuts: LandCuts, xy: XY): { d: number; id: string } {
  let d = Infinity, id = '';
  for (const b of cuts.beds) { if (b.id.startsWith('structure.greenway') || ['cable', 'cave', 'rail'].includes(b.kind) || b.points.length < 2) continue;
    const n = nearestOnPath(xy, b.points), e = n.distance - b.width / 2; if (e < d) { d = e; id = b.id; } }
  return { d, id };
}
/** A four-corner prism with the corners wound as `box` winds them (negative plan shoelace), whatever order they come in. */
export function windCorners<T>(c: readonly T[], at: (p: T) => XY): number[] { let a = 0; for (let i = 0; i < c.length; i++) { const p = at(c[i]!), q = at(c[(i + 1) % c.length]!); a += p[0] * q[1] - q[0] * p[1]; } return a > 0 ? [3, 2, 1, 0] : [0, 1, 2, 3]; }
const quad = (out: StructureSolid, c: readonly XY[], top: number | readonly number[], bottom: number | readonly number[]) => {
  const o = windCorners(c, p => p);
  prism(out, o.map(i => [c[i]![0], typeof top === 'number' ? top : top[i]!, c[i]![1]] as XYZ), typeof bottom === 'number' ? bottom : o.map(i => bottom[i]!));
};
/** A pile (square shaft) from `top` down to the ground under it − 0.3 (settleFoundations carries it to the final ground). */
function pile(out: StructureSolid, xy: XY, top: number, ground: number, size = .3): void { box(out, xy, top, [size, size], Math.min(top - .3, ground - .3)); }
/**
 * Lite drops (CONTRACT §6, "lite drops, never substitutes"): the members a phone's lite tier leaves out are drawn into a twin
 * solid (`<id>.fine`, liteIndices = []): the rails' bars and pickets and two posts of every three, the bents' braces and every
 * other bent. Full geometry and collision are unchanged; the lite tier keeps the deck, the kerbs, the top rail, a post every
 * 6 m, the bridges' steel bottom rail and a bent every 8 m.
 */
const FINE = new Map<StructureSolid, StructureSolid>();
function fineOf(out: StructureSolid): StructureSolid {
  let f = FINE.get(out); if (!f) { f = solid(`${out.id}.fine`, out.kind, out.surface, out.role, out.bedIds, out.districtId); f.liteIndices = []; FINE.set(out, f); } return f;
}
function flushFine(cuts: LandCuts): void { for (const f of FINE.values()) if (f.indices.length) cuts.solids.push(f); FINE.clear(); }
/** An open timber rail along a short polyline (side structures): posts every ≤ 2 m (every third kept in lite), the top rail, bars. */
function railAlong(out: StructureSolid, pts: readonly XYZ[], offset: number, bars: readonly number[] = PRO.rail_bars): void {
  const length = planLength(pts); if (length < .05) return;
  const n = Math.max(1, Math.ceil(length / OPEN_RAIL.spacing)), fine = fineOf(out);
  for (let k = 0; k <= n; k++) { const { p, dir } = pointAlong(pts, length * k / n); box(k % 6 === 0 || k === n ? out : fine, [p[0] - dir[1] * offset, p[2] + dir[0] * offset], p[1] + OPEN_RAIL.height, [OPEN_RAIL.post, OPEN_RAIL.post], p[1] - OPEN_RAIL.embed); }
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1]!, b = pts[i]!; slab(out, a, b, OPEN_RAIL.top[0], OPEN_RAIL.top[1], offset, OPEN_RAIL.height); for (const at of bars) railBar(fine, a, b, offset, at); }
}
/** A deck ribbon (mitred, 0.3 thick) along points. */
function ribbon(out: StructureSolid, pts: readonly XYZ[], width: number, thickness = .3): void { for (let i = 1; i < pts.length; i++) mitredSlab(out, pts, i, width, thickness); }
const sample = (a: XY, b: XY, step: number): XY[] => { const l = distance(a, b), n = Math.max(1, Math.ceil(l / step)), o: XY[] = []; for (let k = 0; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); return o; };

export interface GreenwayReport { length: number; points: number; maxGrade: number; minOverGround: number; bents: number; piers: number; spans: { bridge: string; maxSpan: number }[]; clear: { bridge: string; bed: string; at: XY; measured: number; required: number }[] }
export let greenwayReport: GreenwayReport | undefined;

/** Builds the Greenway's deck, bridges, rails and places into `cuts` (call after every route it crosses exists). */
export function buildGreenway(cuts: LandCuts, base: HeightQuery): void {
  const L = greenwayLine(), pts = L.pts, S = L.ptsS, n = pts.length, own = ['greenway'], mid = (i: number) => (S[i - 1]! + S[i]!) / 2;
  const dist = (s: number) => districtAt(...plan(L.at(s).p));
  // Solids are split by district at the ends of their own ranges (one solid per member kind per district).
  const pool = new Map<string, StructureSolid>(), get = (key: string, s: number, kind: string, surface: string, role: StructureSolid['role'], bedIds = own) => {
    const d = dist(s), id = `greenway.${key}.${d}`; let out = pool.get(id); if (!out) { out = solid(id, kind, surface, role, bedIds, d); pool.set(id, out); } return out; };
  const lane = PRO.lanes, footW = lane.foot_m - .02, inlayO = lane.inlay_o, wheelW = lane.wheel_m - .08;
  const foot0 = inlayO - lane.inlay_m / 2, wheel0 = inlayO + lane.inlay_m / 2;
  // ---- the deck: the lanes (the walking surface, 0.06 boards), the fascia/stringers under them (off the bridges), kerbs.
  for (let i = 1; i < n; i++) {
    const s = mid(i), onBridge = isBridge(s);
    mitredSlab(get('deck.foot', s, 'bed', 'boardwalk', 'deck'), pts, i, footW, .06, foot0 - footW / 2);
    mitredSlab(fineOf(get('deck.inlay', s, 'bed', 'plaza', 'deck')), pts, i, lane.inlay_m, .06, inlayO);
    mitredSlab(get('deck.wheel', s, 'bed', 'timber', 'deck'), pts, i, wheelW, .06, wheel0 + wheelW / 2);
    // The fascia (the deck's structure under the boards) is part of the deck (never settled to the ground; its underside is the
    // deck's underside for the register's headroom); off the bridges it spans the deck, on them it is the edge boards.
    if (!onBridge) mitredSlab(fineOf(get('fascia', s, 'bed', 'timber', 'deck')), pts, i, PRO.fascia_m[0]!, PRO.fascia_m[1]!, 0, -.06);
    else for (const sd of [-1, 1]) mitredSlab(fineOf(get('fascia', s, 'bed', 'timber', 'deck')), pts, i, .3, PRO.fascia_m[1]!, sd * (PRO.fascia_m[0]! / 2 - .15), -.06);
    for (const sd of [-1, 1] as const) { const gaps = greenwayGaps(sd); if (inSpans(s, gaps)) continue;
      mitredSlab(fineOf(get('kerbs', s, 'kerb', 'timber', 'wall')), pts, i, PRO.kerb_m[0]!, PRO.kerb_m[1]! + .1, sd * PRO.kerb_o, PRO.kerb_m[1]!, j => j >= 1 && j < n && inSpans(mid(j), gaps)); }
  }
  // ---- the rails: posts every ≤ 2 m on each run between gaps; bars per drawn segment; pickets on the bridges.
  for (const sd of [-1, 1] as const) {
    const gaps = greenwayGaps(sd).sort((a, b) => a[0]! - b[0]!), runs: [number, number][] = []; let from = 0;
    for (const g of gaps) { if (g[0]! > from + .3) runs.push([from, Math.min(g[0]!, L.length)]); from = Math.max(from, g[1]!); }
    if (from < L.length - .3) runs.push([from, L.length]);
    for (const [a0, a1] of runs) {
      // A run is split at the bridge ends so a bridge's rail is the steel picket rail.
      const cutsAt = [a0, ...GREENWAY.bridges.flatMap(b => b.s).filter(x => x > a0 && x < a1), a1];
      for (let k = 1; k < cutsAt.length; k++) {
        const r0 = cutsAt[k - 1]!, r1 = cutsAt[k]!, line: XYZ[] = [L.at(r0).p, ...pts.filter((_, i) => S[i]! > r0 + .01 && S[i]! < r1 - .01), L.at(r1).p], bridge = isBridge((r0 + r1) / 2);
        const out = get(bridge ? 'rails.steel' : 'rails', (r0 + r1) / 2, OPEN_RAIL_KIND, bridge ? 'metal' : 'timber', 'rail');
        greenwayRail(out, line, sd * PRO.rail_o, bridge);
      }
    }
  }
  // C · the Twin Crossing bays: the deck widened to ±6.1 over s 240–254 on both sides, picket rails round them, struts.
  { const C = GREENWAY.places.C, s0 = C.s[0]!, s1 = C.s[1]!, line: XYZ[] = [L.at(s0).p, ...pts.filter((_, i) => S[i]! > s0 + .01 && S[i]! < s1 - .01), L.at(s1).p];
    for (const sd of [-1, 1]) {
      const deck = get('bays', (s0 + s1) / 2, 'bed', 'boardwalk', 'deck'), rails = get('rails.steel', (s0 + s1) / 2, OPEN_RAIL_KIND, 'metal', 'rail'), struts = get('girders', (s0 + s1) / 2, 'beam', 'metal', 'support');
      for (let i = 1; i < line.length; i++) { mitredSlab(deck, line, i, C.bay_m, .06, sd * C.bay_o); mitredSlab(deck, line, i, C.bay_m + .1, .32, sd * C.bay_o, -.06); }
      greenwayRail(rails, line, sd * C.rail_o, true);
      for (const s of [s0, s1]) { const q = L.at(s); greenwayRail(rails, [q.W(sd * (PRO.rail_o - .05)), q.W(sd * C.rail_o)], 0, true); }
      for (const s of [s0 + 4, s1 - 4]) { const q = L.at(s); slab(struts, q.W(sd * (C.rail_o - .5), -.4), q.W(sd * PRO.bridge.girder_o, -2.6), .18, .18); }
    }
  }
  // ---- substructure: bents every 4 m off the bridges; concrete piers and steel girders on the bridges.
  let bents = 0, piers = 0, minOver = Infinity, maxGrade = 0;
  for (let i = 1; i < n; i++) maxGrade = Math.max(maxGrade, Math.abs(pts[i]![1] - pts[i - 1]![1]) / (distance(plan(pts[i]!), plan(pts[i - 1]!)) || 1));
  for (let k = 0; k < L.full.length; k++) minOver = Math.min(minOver, L.full[k]![1] - Math.max(L.ground[k]!, 0));
  const top = (s: number) => L.at(s).p[1] - .06 - PRO.fascia_m[1]!;
  for (let s = 2; s < L.length - 1; s += PRO.bent_m) {
    if (inSpans(s, GREENWAY.bridges.map(b => b.s), 1)) continue;
    // Three bents of four are lite drops (the lite tier keeps a bent every 16 m).
    const q = L.at(s), g = q.ground, over = q.p[1] - Math.max(g, 0), keepLite = bents % 4 === 0, lite = (o: StructureSolid) => keepLite ? o : fineOf(o), piles = lite(get('piles', s, 'pile', 'timber', 'support'));
    if (over > PRO.piled_over_m || g < .3) {
      // A bent: a cap under the fascia, two piles to the ground (or the sea bed), cross bracing over 3 m, a waler over 6.5 m.
      const capTop = top(s), caps = lite(get('caps', s, 'capBeam', 'timber', 'support'));
      slab(caps, q.W(-3.0, capTop - q.p[1]), q.W(3.0, capTop - q.p[1]), .28, PRO.cap_below_m - .06 - PRO.fascia_m[1]! + .04);
      const capBottom = capTop - (PRO.cap_below_m - .06 - PRO.fascia_m[1]! + .04);
      for (const sd of [-1, 1]) { const w = q.W(sd * PRO.pile_o); pile(piles, [w[0], w[2]], capBottom, g); }
      const len = capBottom - g;
      if (len > 3) { const braces = fineOf(get('braces', s, 'beam', 'timber', 'support')), lo = capBottom - Math.min(len - .5, 3.2);
        slab(braces, q.W(-PRO.pile_o, capBottom - q.p[1]), q.W(PRO.pile_o, lo - q.p[1]), .16, .08); slab(braces, q.W(-PRO.pile_o, lo - q.p[1]), q.W(PRO.pile_o, capBottom - q.p[1]), .16, .08);
        if (len > 6.5) slab(braces, q.W(-2.7, lo - .3 - q.p[1]), q.W(2.7, lo - .3 - q.p[1]), .12, .18); }
    } else for (const sd of [-1, 1]) { const w = q.W(sd * PRO.pile_o); pile(piles, [w[0], w[2]], top(s), g, .25); }
    bents++;
  }
  const spans: GreenwayReport['spans'] = [], clear: GreenwayReport['clear'] = [], B = PRO.bridge;
  for (const br of GREENWAY.bridges) {
    const s0 = br.s[0]!, s1 = br.s[1]!, girders = get('girders', (s0 + s1) / 2, 'beam', 'metal', 'support'), line: XYZ[] = [L.at(s0).p, ...pts.filter((_, i) => S[i]! > s0 + .01 && S[i]! < s1 - .01), L.at(s1).p];
    const gTop = -.06, gBottom = gTop - B.girders_m[1]!;
    for (let i = 1; i < line.length; i++) for (const sd of [-1, 1]) mitredSlab(girders, line, i, B.girders_m[0]!, B.girders_m[1]!, sd * B.girder_o, gTop);
    // Supports: the timber bents just outside each end, concrete piers every 11 m from s0 + 2 where both stand > 4.5 m off every bed.
    const placed = [s0 - 1, s1 + 1];
    for (let s = s0 + 2; s < s1 - 1; s += B.pier_every_m) {
      const q = L.at(s), feet = [-1, 1].map(sd => { const w = q.W(sd * B.pier_o); return [w[0], w[2]] as XY; });
      if (feet.some(xy => bedClearance(cuts, xy).d <= B.pier_bed_clear_m)) continue;
      const pp = get('piers', s, 'pier', 'concrete', 'support'), cross = get('crossbeams', s, 'capBeam', 'concrete', 'support'), cb = q.p[1] + gBottom;
      slab(cross, q.W(-2.8, gBottom), q.W(2.8, gBottom), .9, .62);
      for (const xy of feet) box(pp, xy, cb - .62, [B.pier_m, B.pier_m], Math.min(cb - 1, q.ground - .3));
      placed.push(s); piers++;
    }
    placed.sort((a, b) => a - b);
    // A girder span over 24 m takes one more pier where both its feet stand clear (searched from the span's middle outward).
    for (let guard = 0; guard < 6; guard++) {
      let gi = -1, gap = 24; for (let k = 1; k < placed.length; k++) if (placed[k]! - placed[k - 1]! > gap) { gap = placed[k]! - placed[k - 1]!; gi = k; }
      if (gi < 0) break;
      const a = placed[gi - 1]!, b = placed[gi]!, m = (a + b) / 2; let added = false;
      for (let d = 0; d <= (b - a) / 2 - 4 && !added; d += .5) for (const sgn of [1, -1]) { const s = m + sgn * d, q = L.at(s), feet = [-1, 1].map(sd => { const w = q.W(sd * B.pier_o); return [w[0], w[2]] as XY; });
        if (feet.some(xy => bedClearance(cuts, xy).d <= B.pier_bed_clear_m)) continue;
        const pp = get('piers', s, 'pier', 'concrete', 'support'), cross = get('crossbeams', s, 'capBeam', 'concrete', 'support'), cb = q.p[1] + gBottom;
        slab(cross, q.W(-2.8, gBottom), q.W(2.8, gBottom), .9, .62); for (const xy of feet) box(pp, xy, cb - .62, [B.pier_m, B.pier_m], Math.min(cb - 1, q.ground - .3));
        placed.push(s); placed.sort((x, y) => x - y); piers++; added = true; break; }
      if (!added) break;
    }
    let maxSpan = 0; for (let k = 1; k < placed.length; k++) maxSpan = Math.max(maxSpan, placed[k]! - placed[k - 1]!);
    spans.push({ bridge: br.id, maxSpan });
    cuts.diagnostics.push({ id: `structures.greenway.${br.id}.spans`, severity: maxSpan > 30.01 ? 'conflict' : 'info', message: `greenway ${br.label}: steel girders ${B.girders_m.join(' × ')} on ${placed.length - 2} concrete piers placed > ${B.pier_bed_clear_m} m off every bed; the longest girder span is ${maxSpan.toFixed(1)} m (≤ 30)`, at: plan(L.at((s0 + s1) / 2).p), measured: maxSpan, required: 30 });
    // Clearance contract: girder underside over every bed it crosses (3.6 m).
    for (const id of br.over) {
      const target = cuts.beds.find(b => b.id === id); if (!target) continue;
      for (let i = 1; i < line.length; i++) for (let j = 1; j < target.points.length; j++) {
        const a = line[i - 1]!, b = line[i]!, c = target.points[j - 1]!, d = target.points[j]!, r: XY = [b[0] - a[0], b[2] - a[2]], u: XY = [d[0] - c[0], d[2] - c[2]], den = r[0] * u[1] - r[1] * u[0]; if (Math.abs(den) < 1e-9) continue;
        const t = ((c[0] - a[0]) * u[1] - (c[2] - a[2]) * u[0]) / den, v = ((c[0] - a[0]) * r[1] - (c[2] - a[2]) * r[0]) / den; if (t < 0 || t > 1 || v < 0 || v > 1) continue;
        // The worst point over the lower bed's width: the deck falls ≤ 5 % either way of the centreline crossing.
        const deckY = a[1] + (b[1] - a[1]) * t, bedY = c[1] + (d[1] - c[1]) * v, half = target.width / 2, slope = Math.abs(b[1] - a[1]) / (Math.hypot(...r) || 1), sinA = Math.abs(den) / ((Math.hypot(...r) || 1) * (Math.hypot(...u) || 1));
        const measured = deckY + gBottom - bedY - slope * half / Math.max(.2, sinA), at: XY = [Number((a[0] + r[0] * t).toFixed(2)), Number((a[2] + r[1] * t).toFixed(2))];
        clear.push({ bridge: br.id, bed: id, at, measured, required: B.clear_m });
        cuts.diagnostics.push({ id: `structures.greenway.${br.id}.clear.${id}`, severity: measured < B.clear_m - 1e-6 ? 'conflict' : 'info', message: `greenway ${br.label} over ${id}: ${measured.toFixed(2)} m clear from ${id}'s surface (${bedY.toFixed(2)}) to the girders' underside (deck ${deckY.toFixed(2)} − ${(-gBottom).toFixed(2)}), the worst point across its ${target.width} m width (required ${B.clear_m})`, at, measured, required: B.clear_m });
      }
    }
  }
  for (const s of pool.values()) if (s.indices.length) cuts.solids.push(s);
  flushFine(cuts);
  // The Greenway's bed: its own structure (terrainCut false); profile greenway (a boardwalk-kind deck: feet, bicycles, boards).
  const deckBed = bed('structure.greenway', 'greenway', pts.map(p => [p[0], p[1], p[2]] as XYZ), false); deckBed.structureIds = ['greenway']; cuts.beds.push(deckBed);
  greenwayReport = { length: L.length, points: n, maxGrade, minOverGround: minOver, bents, piers, spans, clear };
  cuts.diagnostics.push({ id: 'structures.greenway.summary', severity: maxGrade > PRO.grade_max_pct / 100 + 1e-4 || minOver < PRO.deck_over_ground_min_m - .02 ? 'conflict' : 'info', message: `greenway: ${L.length.toFixed(1)} m deck (${n} drawn points), max grade ${(maxGrade * 100).toFixed(2)} % (≤ ${PRO.grade_max_pct}), ≥ ${minOver.toFixed(2)} over the ground or water (≥ ${PRO.deck_over_ground_min_m}), ${bents} bents, ${piers} bridge piers`, at: plan(L.at(0).p), measured: maxGrade, required: PRO.grade_max_pct / 100 });
  buildPlaces(cuts, base);
  flushFine(cuts);
}
/** The Greenway's rail: timber (posts every 2 m, top rail, bars 0.7 / 0.36) or the bridges' steel picket rail. */
function greenwayRail(out: StructureSolid, line: readonly XYZ[], offset: number, steel: boolean): void {
  const length = planLength(line); if (length < .3) return;
  const posts = Math.max(1, Math.ceil(length / 2));
  const fine = fineOf(out);
  for (let k = 0; k <= posts; k++) { const { p, dir } = pointAlong(line, length * k / posts); box(k % 6 === 0 || k === posts ? out : fine, [p[0] - dir[1] * offset, p[2] + dir[0] * offset], p[1] + OPEN_RAIL.height, [.11, .11], p[1] - OPEN_RAIL.embed); }
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!, b = line[i]!; slab(out, a, b, .14, .07, offset, OPEN_RAIL.height);
    if (!steel) { for (const at of PRO.rail_bars) railBar(fine, a, b, offset, at); continue; }
    slab(fine, a, b, .05, .04, offset, .2);
    const run = distance(plan(a), plan(b)), m = Math.max(1, Math.round(run / PRO.bridge.pickets.every_m)), d = run || 1, dir: XY = [(b[0] - a[0]) / d, (b[2] - a[2]) / d];
    for (let j = 1; j < m; j++) { const t = j / m, q: XYZ = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; box(fine, [q[0] - dir[1] * offset, q[2] + dir[0] * offset], q[1] + OPEN_RAIL.height - .07, [PRO.bridge.pickets.size_m, PRO.bridge.pickets.size_m], q[1] + PRO.bridge.pickets.from_m); }
  }
}
/** A side bed from the Greenway's centreline at s through its rail gap along `pts` (the path graph's junction). */
function sideBed(cuts: LandCuts, id: string, s: number, path: readonly XYZ[], width: number): BedCut {
  const L = greenwayLine(), b = bed(`structure.greenway.${id}`, 'walk', [L.at(s).p, ...path.map(p => [p[0], p[1], p[2]] as XYZ)], false);
  b.width = width; b.structureIds = [`greenway.${id}`]; cuts.beds.push(b); return b;
}
function lowWalkHeights(xy: readonly XY[], base: HeightQuery, lift: number): number[] {
  let Y = xy.map(p => base(p[0], p[1]) + lift);
  for (let it = 0; it < 4; it++) Y = Y.map((y, i) => Math.max(base(xy[i]![0], xy[i]![1]) + lift, (Y[Math.max(0, i - 1)]! + y + Y[Math.min(Y.length - 1, i + 1)]!) / 3));
  return Y;
}
/** A low boardwalk (B): 0.12 boards on a 0.22 fascia, 0.12 kerbs, posts every second point; no rail (≤ 0.6 over the ground). */
export function lowWalk(cuts: LandCuts, id: string, xy: readonly XY[], base: HeightQuery, width: number, lift: number, startY?: number): XYZ[] {
  const D: XY[] = []; for (let i = 1; i < xy.length; i++) D.push(...sample(xy[i - 1]!, xy[i]!, 1.5).slice(i > 1 ? 1 : 0));
  const Y = lowWalkHeights(D, base, lift); if (startY !== undefined) Y[0] = startY;
  const P3: XYZ[] = D.map((p, i) => [p[0], Y[i]!, p[1]]), district = districtAt(...D[0]!), ids = [`greenway.${id}`];
  const deck = solid(`greenway.${id}.deck`, 'lowBoardwalk', 'boardwalk', 'deck', ids, district), frame = solid(`greenway.${id}.frame`, 'beam', 'timber', 'support', ids, district), kerbs = solid(`greenway.${id}.kerbs`, 'kerb', 'timber', 'wall', ids, district), posts = solid(`greenway.${id}.posts`, 'pile', 'timber', 'support', ids, district);
  for (let i = 1; i < P3.length; i++) { mitredSlab(deck, P3, i, width, .12); mitredSlab(frame, P3, i, width + .1, .22, 0, -.1); for (const sd of [-1, 1]) mitredSlab(kerbs, P3, i, .12, .2, sd * (width / 2 - .06), .12); }
  P3.forEach((p, i) => { if (i % 2) return; const a = P3[Math.max(0, i - 1)]!, b = P3[Math.min(P3.length - 1, i + 1)]!, l = distance(plan(a), plan(b)) || 1, r: XY = [-(b[2] - a[2]) / l, (b[0] - a[0]) / l];
    for (const sd of [-1, 1]) { const q: XY = [p[0] + r[0] * sd * (width / 2 - .2), p[2] + r[1] * sd * (width / 2 - .2)]; pile(posts, q, p[1] - .32, base(q[0], q[1]), .16); } });
  cuts.solids.push(deck, frame, kerbs, posts);
  const b = bed(`structure.greenway.${id}`, 'walk', P3, false); b.width = width; b.structureIds = [`greenway.${id}`]; cuts.beds.push(b);
  return P3;
}
function buildPlaces(cuts: LandCuts, base: HeightQuery): void {
  const L = greenwayLine(), P = GREENWAY.places;
  // A · Reach Gate: the terrace 12 × 14 behind s 0 at the deck, 12 piles, open rails; the Gate Bridge to the Landing quay.
  { const q = L.at(0), y = q.p[1], T = (off: number, fwd: number, dy = 0) => q.W(off, dy, fwd), hw = P.A.terrace_m[0]! / 2, len = P.A.terrace_m[1]!, d = districtAt(q.p[0], q.p[2]), ids = ['greenway.terrace'];
    const deck = solid('greenway.terrace.deck', 'greenwayDeck', 'boardwalk', 'deck', ids, d), piles = solid('greenway.terrace.piles', 'pile', 'timber', 'support', ids, d), rails = solid('greenway.terrace.rails', OPEN_RAIL_KIND, 'timber', 'rail', ids, d);
    quad(deck, [T(-hw, 0), T(hw, 0), T(hw, -len), T(-hw, -len)].map(p => [p[0], p[2]] as XY), y, y - .4);
    // The east pile row stays out of the Reach west channel's ribbon (fwd −11, not the prototype's −12.5).
    for (const off of [-5.4, -1.8, 1.8, 5.4]) for (const fwd of [-1.5, -6.5, -11]) { const w = T(off, fwd); pile(piles, [w[0], w[2]], y - .4, Math.min(base(w[0], w[2]), y - 1.5)); }
    const bw = P.A.bridge.width_m, bo = -1.4;
    for (const line of [[T(PRO.rail_o, 0), T(hw - .1, 0), T(hw - .1, -len + .1), T(bo + bw / 2 + .02, -len + .1)], [T(-PRO.rail_o, 0), T(-hw + .1, 0), T(-hw + .1, -len + .1), T(bo - bw / 2 - .02, -len + .1)]]) for (let i = 1; i < line.length; i++) railAlong(rails, [line[i - 1]!, line[i]!], 0);
    cuts.solids.push(deck, piles, rails);
    const A0 = T(bo, -len), A1: XYZ = [P.A.bridge.to[0]!, P.A.bridge.to_h, P.A.bridge.to[1]!], fp: XYZ[] = [];
    // Profile: up at 7 % off the terrace to the crest over the channel mouth (its centreline ~2.9 m out; water.reach.1 stands
    // 1.75 there and the register's rowing headroom ≥ 4 is proved against deck − 0.6), held to 5 m, then one even fall to the quay.
    const span = distance(plan(A0), plan(A1)), crest = Math.max(y, P.A.bridge.crest_h), up = (crest - y) / .07, hold = Math.max(up, 5);
    const lift = (s: number) => s <= up ? y + .07 * s : s <= hold ? crest : crest + (A1[1] - crest) * (s - hold) / Math.max(1e-6, span - hold);
    for (let j = 0; j <= 16; j++) { const t = j / 16; fp.push([A0[0] + (A1[0] - A0[0]) * t, lift(t * span), A0[2] + (A1[2] - A0[2]) * t]); }
    for (const s of [up, hold]) if (s > 0 && s < span) { const t = s / span; fp.push([A0[0] + (A1[0] - A0[0]) * t, lift(s), A0[2] + (A1[2] - A0[2]) * t]); }
    fp.sort((a, b) => distance(plan(a), plan(A0)) - distance(plan(b), plan(A0)));
    const bd = solid('greenway.gateBridge.deck', 'footbridge', 'boardwalk', 'deck', ['greenway.gateBridge'], d), bp = solid('greenway.gateBridge.piles', 'pile', 'timber', 'support', ['greenway.gateBridge'], d), br = solid('greenway.gateBridge.rails', OPEN_RAIL_KIND, 'timber', 'rail', ['greenway.gateBridge'], d);
    ribbon(bd, fp, bw, .25);
    for (const sd of [-1, 1]) railAlong(br, fp.slice(0, -1), sd * (bw / 2 + .02), [OPEN_RAIL.mid.at]);
    // Piles every fourth sample, never in the west channel's ribbon (MANIFEST water.reachChannels[0], 7 m wide).
    const channel = (M.water.reachChannels[0]! as unknown as XY[]).map(q => [q[0], 0, q[1]] as XYZ);
    fp.forEach((p, j) => { if (j % 4 !== 2 || j + 1 >= fp.length) return; const a = fp[j - 1]!, b = fp[j + 1]!, l = distance(plan(a), plan(b)) || 1, r: XY = [-(b[2] - a[2]) / l, (b[0] - a[0]) / l];
      for (const sd of [-1, 1]) { const xy: XY = [p[0] + r[0] * sd * 1.3, p[2] + r[1] * sd * 1.3]; if (nearestOnPath(xy, channel).distance < 3.5 + 1) continue; pile(bp, xy, p[1] - .25, Math.min(base(xy[0], xy[1]), p[1] - 1.5), .28); } });
    cuts.solids.push(bd, bp, br);
    const terrace = sideBed(cuts, 'terrace', 0, [T(bo, -len)], 3.2); terrace.width = 3.2;
    const gb = bed('structure.greenway.gateBridge', 'walk', fp, false); gb.width = bw; gb.structureIds = ['greenway.gateBridge']; gb.maxGrade = .08; cuts.beds.push(gb);
  }
  // B · the Reed Maze trail: the ramp off the left rail at 130 m, two low boardwalks, the Dune Overlook (6 piles, open rail).
  { const B = P.B, q = L.at(B.s), lift = B.trail_lift_m, t1 = B.trails[0]! as unknown as XY[], t2 = B.trails[1]! as unknown as XY[], rampEnd = B.ramp.at(-1)! as unknown as XY;
    const endY = base(rampEnd[0], rampEnd[1]) + lift, ramp: XYZ[] = [q.W(-PRO.rail_o), [B.ramp[0]![0]!, (q.p[1] + endY) / 2, B.ramp[0]![1]!], [rampEnd[0], endY, rampEnd[1]]];
    const d = districtAt(q.p[0], q.p[2]), ids = ['greenway.reedTrail'], rd = solid('greenway.reedTrail.deck', 'lowBoardwalk', 'boardwalk', 'deck', ids, d), rp = solid('greenway.reedTrail.posts', 'pile', 'timber', 'support', ids, d), rk = solid('greenway.reedTrail.kerbs', 'kerb', 'timber', 'wall', ids, d);
    const R: XYZ[] = []; for (let i = 1; i < ramp.length; i++) for (const p of sample(plan(ramp[i - 1]!), plan(ramp[i]!), 1.5).slice(i > 1 ? 1 : 0)) { const tt = (() => { const a = plan(ramp[i - 1]!), b = plan(ramp[i]!); return distance(a, p) / (distance(a, b) || 1); })(); R.push([p[0], ramp[i - 1]![1] + (ramp[i]![1] - ramp[i - 1]![1]) * tt, p[1]]); }
    ribbon(rd, R, 2.4, .3); for (let i = 1; i < R.length; i++) for (const sd of [-1, 1]) mitredSlab(rk, R, i, .12, .2, sd * 1.14, .12);
    R.forEach((p, i) => { if (i % 2 || i === 0) return; for (const sd of [-1, 1]) { const a = R[i - 1]!, l = distance(plan(a), plan(p)) || 1, r: XY = [-(p[2] - a[2]) / l, (p[0] - a[0]) / l], xy: XY = [p[0] + r[0] * sd * 1.0, p[2] + r[1] * sd * 1.0]; pile(rp, xy, p[1] - .3, base(xy[0], xy[1]), .2); } });
    cuts.solids.push(rd, rp, rk);
    sideBed(cuts, 'reedTrail', B.s, R, 2.4);
    const w1 = lowWalk(cuts, 'reedTrail.maze', t1, base, B.trail_m, lift, endY);
    const branch = nearestOnPath(t2[0]!, w1), w2 = lowWalk(cuts, 'reedTrail.dunes', t2, base, B.trail_m, lift, branch.at[1]);
    // The Dune Overlook: a timber deck 7.4 × 5.8 facing the osprey pole, top = max ground + 0.55; six piles; an open rail.
    const O = B.overlook, at = O.c as unknown as XY, yaw = Math.atan2(O.face[0]! - at[0], O.face[1]! - at[1]), f: XY = [Math.sin(yaw), Math.cos(yaw)], r: XY = [-f[1], f[0]], Wd = (u: number, v: number): XY => [at[0] + r[0] * u + f[0] * v, at[1] + r[1] * u + f[1] * v];
    let gmax = -Infinity, gmin = Infinity; for (let u = -3.5; u <= 3.5; u += 1) for (let v = -2.8; v <= 2.8; v += 1) { const w = Wd(u, v), g = base(w[0], w[1]); gmax = Math.max(gmax, g); gmin = Math.min(gmin, g); }
    const top = gmax + O.lift_m, od = districtAt(...at), oids = ['greenway.overlook'];
    const deck = solid('greenway.overlook.deck', 'lookoutDeck', 'boardwalk', 'deck', oids, od), piles = solid('greenway.overlook.piles', 'pile', 'timber', 'support', oids, od), rails = solid('greenway.overlook.rails', OPEN_RAIL_KIND, 'timber', 'rail', oids, od);
    quad(deck, [Wd(-3.7, -2.9), Wd(-3.7, 2.9), Wd(3.7, 2.9), Wd(3.7, -2.9)], top, top - .32);
    for (const u of [-3.4, 0, 3.4]) for (const v of [-2.6, 2.6]) { const w = Wd(u, v); pile(piles, w, top - .32, gmin, .26); }
    // The ramp meets the deck where the line from the dune walk's end to the deck's centre crosses its edge; the rail runs
    // round the deck and opens 1.2 either side of that mouth (the prototype's fixed corner gap missed the ramp's line).
    const rEnd = w2.at(-1)!, local = (x: number, z: number): XY => [(x - at[0]) * r[0] + (z - at[1]) * r[1], (x - at[0]) * f[0] + (z - at[1]) * f[1]];
    const [eu, ev] = local(rEnd[0], rEnd[2]), k = 1 / Math.max(Math.abs(eu) / 3.7, Math.abs(ev) / 2.9), r0 = Wd(eu * k, ev * k), mouth = Wd(eu * k * 3.6 / 3.7, ev * k * 2.8 / 2.9);
    { const loop: XY[] = [[-3.6, -2.8], [-3.6, 2.8], [3.6, 2.8], [3.6, -2.8], [-3.6, -2.8]]; let run: XYZ[] = [];
      const flush = () => { if (run.length > 1) railAlong(rails, run, 0); run = []; };
      for (let i = 1; i < loop.length; i++) { const [a, b] = [loop[i - 1]!, loop[i]!], n = Math.ceil(distance(a, b) / .2);
        for (let j = i > 1 ? 1 : 0; j <= n; j++) { const w = Wd(a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n); if (distance(w, mouth) < 1.2) flush(); else run.push([w[0], top, w[1]]); } }
      flush(); }
    const ovRamp: XYZ[] = [[r0[0], top, r0[1]], rEnd], ovDeck = solid('greenway.overlook.ramp', 'lowBoardwalk', 'boardwalk', 'deck', oids, od);
    ribbon(ovDeck, ovRamp, 2.0, .28); cuts.solids.push(deck, piles, rails, ovDeck);
    { const pp = solid('greenway.overlook.rampPosts', 'pile', 'timber', 'support', oids, od), mid: XYZ = [(ovRamp[0]![0] + ovRamp[1]![0]) / 2, (ovRamp[0]![1] + ovRamp[1]![1]) / 2, (ovRamp[0]![2] + ovRamp[1]![2]) / 2]; pile(pp, plan(mid), mid[1] - .28, base(mid[0], mid[2]), .2); cuts.solids.push(pp); }
    const ob = bed('structure.greenway.overlook', 'walk', [rEnd, [r0[0], top, r0[1]], [at[0], top, at[1]]], false); ob.width = 2.0; ob.structureIds = ['greenway.overlook']; cuts.beds.push(ob);
    const ovRail = Math.max(...ovRamp.map(p => p[1])) - Math.min(...ovRamp.map(p => p[1])); void ovRail;
  }
  // The Marsh Hide (s 400, left): a bay 5.7 × 6.2 on six piles, a 2.3 blind (slotted outer and back walls, solid front wall), a roof.
  { const H = P.hide, q = L.at(H.s), y = q.p[1], hw = H.size_m[0]! / 2, hl = H.size_m[1]! / 2, Wh = (off: number, fwd: number): XY => { const w = q.W(off, 0, fwd); return [w[0], w[2]]; }, d = districtAt(q.p[0], q.p[2]), ids = ['greenway.marshHide'];
    const floor = solid('greenway.marshHide.floor', 'hideFloor', 'boardwalk', 'deck', ids, d), piles = solid('greenway.marshHide.piles', 'pile', 'timber', 'support', ids, d), walls = solid('greenway.marshHide.blind', 'hideWall', 'timber', 'wall', ids, d), roof = solid('greenway.marshHide.roof', 'roof', 'timber', 'roof', ids, d);
    const o = -H.o; quad(floor, [Wh(o + hw, -hl), Wh(o + hw, hl), Wh(o - hw, hl), Wh(o - hw, -hl)], y, y - .36);
    for (const off of [-3.4, -6.0, -8.5]) for (const fw of [-2.8, 2.8]) { const w = Wh(off, fw); pile(piles, w, y - .36, Math.min(q.ground, base(w[0], w[1])), .26); }
    const wall = (a: XY, b: XY, from: number, to: number) => { const l = distance(a, b) || 1, nx = -(b[1] - a[1]) / l * .05, nz = (b[0] - a[0]) / l * .05; quad(walls, [[a[0] - nx, a[1] - nz], [a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz]], y + to, y + from); };
    const slotted = (a: XY, b: XY) => { wall(a, b, 0, .78); wall(a, b, 1.24, 2.3); };
    slotted(Wh(-8.7, -3.05), Wh(-8.7, 3.05)); slotted(Wh(-3.4, -3.05), Wh(-8.7, -3.05)); wall(Wh(-3.4, 3.05), Wh(-8.7, 3.05), 0, 2.3);
    { const a = Wh(-8.45, -3.0), b = Wh(-8.45, 3.0), l = distance(a, b) || 1, nx = -(b[1] - a[1]) / l * .21, nz = (b[0] - a[0]) / l * .21; quad(walls, [[a[0] - nx, a[1] - nz], [a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz]], y + .78, y + .74); }
    for (const fw of [-3.05, 3.05]) box(walls, Wh(-3.25, fw), y + 2.3 + .2, [.14, .14], y);
    { const a = q.W(-3.0, 2.3 + .4), b = q.W(-9.0, 2.3); slab(roof, a, b, 6.8, .12); }
    cuts.solids.push(floor, piles, walls, roof);
    sideBed(cuts, 'marshHide', H.s, [q.W(o)], 2.4);
  }
  // E · the Arch Pier: off the left rail at 690 m, 3.0 wide, descending to 4.2; piles every other sample; a 12 × 5 T-head.
  { const E = P.E, q = L.at(E.s), y0 = q.p[1], y1 = E.end_h, path: XY[] = [plan(q.W(-PRO.rail_o)), ...(E.path as unknown as XY[])], arc = [0];
    for (let i = 1; i < path.length; i++) arc.push(arc[i - 1]! + distance(path[i - 1]!, path[i]!));
    const pts: XYZ[] = []; for (let i = 1; i < path.length; i++) for (const p of sample(path[i - 1]!, path[i]!, 2.5).slice(i > 1 ? 1 : 0)) { const s = arc[i - 1]! + distance(path[i - 1]!, p); pts.push([p[0], y0 + (y1 - y0) * s / arc.at(-1)!, p[1]]); }
    const d = districtAt(...path.at(-1)!), ids = ['greenway.archPier'], deck = solid('greenway.archPier.deck', 'pier', 'boardwalk', 'deck', ids, d), piles = solid('greenway.archPier.piles', 'pile', 'timber', 'support', ids, d), rails = solid('greenway.archPier.rails', OPEN_RAIL_KIND, 'timber', 'rail', ids, d);
    ribbon(deck, pts, E.width_m, .3);
    pts.forEach((p, j) => { if (j % 2 || j === 0) return; const a = pts[j - 1]!, l = distance(plan(a), plan(p)) || 1, r: XY = [-(p[2] - a[2]) / l, (p[0] - a[0]) / l]; for (const sd of [-1, 1]) { const xy: XY = [p[0] + r[0] * sd * 1.25, p[2] + r[1] * sd * 1.25]; pile(j % 4 ? fineOf(piles) : piles, xy, p[1] - .3, base(xy[0], xy[1]), .26); } });
    const c = path.at(-1)!, pr = path.at(-2)!, yaw = Math.atan2(c[0] - pr[0], c[1] - pr[1]), f: XY = [Math.sin(yaw), Math.cos(yaw)], r: XY = [-f[1], f[0]], Wt = (u: number, v: number): XY => [c[0] + r[0] * u + f[0] * v, c[1] + r[1] * u + f[1] * v];
    const hw = E.head_m[0]! / 2, hd = E.head_m[1]!;
    for (const sd of [-1, 1]) railAlong(rails, pts, sd * 1.55);
    quad(deck, [Wt(-hw, 0), Wt(-hw, hd), Wt(hw, hd), Wt(hw, 0)], y1, y1 - .36);
    for (const u of [-5.6, -2, 2, 5.6]) for (const v of [.3, 4.7]) { const w = Wt(u, v); pile(piles, w, y1 - .36, base(w[0], w[1]), .3); }
    const tr = ([[-1.55, 0], [-hw + .1, 0], [-hw + .1, hd - .1], [hw - .1, hd - .1], [hw - .1, 0], [1.55, 0]] as const).map(([u, v]) => { const w = Wt(u, v); return [w[0], y1, w[1]] as XYZ; });
    for (let i = 1; i < tr.length; i++) railAlong(rails, [tr[i - 1]!, tr[i]!], 0);
    cuts.solids.push(deck, piles, rails);
    const head = Wt(0, hd / 2); sideBed(cuts, 'archPier', E.s, [...pts, [head[0], y1, head[1]]], E.width_m);
  }
  // F · the Paddle Dock: a 1.6 steel gangway from the left rail's gap diagonally down to a floating dock 3.6 × 16, 0.55 over the sea, 4 piles.
  { const F = P.F, q = L.at(F.s), D = (off: number, fwd: number, h: number): XYZ => { const w = q.W(off, 0, fwd); return [w[0], h, w[2]]; }, d = districtAt(q.p[0], q.p[2]), ids = ['greenway.paddleDock'];
    const gang = [D(-PRO.rail_o, F.gangway_fwd_m[0]!, L.at(F.s + F.gangway_fwd_m[0]!).p[1]), D(-F.gangway_to_o, F.gangway_fwd_m[1]!, F.dock_h + .02)], gd = solid('greenway.paddleDock.gangway', 'gangway', 'metal', 'deck', ids, d), gr = solid('greenway.paddleDock.rails', OPEN_RAIL_KIND, 'metal', 'rail', ids, d);
    ribbon(gd, gang, F.gangway_m, .18); for (const sd of [-1, 1]) railAlong(gr, gang, sd * (F.gangway_m / 2), [OPEN_RAIL.mid.at]);
    const dock = solid('greenway.paddleDock.deck', 'floatingDock', 'boardwalk', 'deck', ids, d), piles = solid('greenway.paddleDock.piles', 'pile', 'timber', 'support', ids, d), hw = F.dock_m[0]! / 2, hl = F.dock_m[1]! / 2;
    quad(dock, [D(-F.dock_o + hw, -hl, 0), D(-F.dock_o + hw, hl, 0), D(-F.dock_o - hw, hl, 0), D(-F.dock_o - hw, -hl, 0)].map(p => [p[0], p[2]] as XY), F.dock_h, F.dock_h - .62);
    for (const fw of [-7.6, 7.6]) for (const off of [-7.3, -10.9]) { const w = D(off, fw, 0); pile(piles, [w[0], w[2]], 2.4, base(w[0], w[2]), .32); }
    cuts.solids.push(gd, gr, dock, piles);
    // The walk carries on straight off the gangway's foot onto the dock (turning back to the dock's centre crossed the gangway's rail).
    { const [g0, g1] = [gang[0]!, gang[1]!], l = distance(plan(g0), plan(g1)) || 1, on: XYZ = [g1[0] + (g1[0] - g0[0]) / l * 1.6, F.dock_h, g1[2] + (g1[2] - g0[2]) / l * 1.6];
      sideBed(cuts, 'paddleDock', F.s, [...gang, on], F.gangway_m); }
  }
  // G · the Sunset Balcony: a half-disc R 6.2 off the left rail at 962 m, following the deck's grade, an open rail, three struts.
  { const G = P.G, q = L.at(G.s), R = G.r_m, grade = (L.at(G.s + 1).p[1] - L.at(G.s - 1).p[1]) / 2, c = q.W(-3.0), Wg = (out: number, along: number): XYZ => { const w = q.W(-3.0 - out, along * grade, along); return [w[0], w[1], w[2]]; };
    const d = districtAt(q.p[0], q.p[2]), ids = ['greenway.sunsetBalcony'], deck = solid('greenway.sunsetBalcony.deck', 'balcony', 'boardwalk', 'deck', ids, d), rails = solid('greenway.sunsetBalcony.rails', OPEN_RAIL_KIND, 'timber', 'rail', ids, d), struts = solid('greenway.sunsetBalcony.struts', 'beam', 'timber', 'support', ids, d);
    const bands = 7; for (let k = 0; k < bands; k++) { const d0 = R * k / bands, d1 = R * (k + 1) / bands, h0 = Math.sqrt(R * R - d0 * d0), h1 = Math.sqrt(Math.max(0, R * R - d1 * d1)) || .05;
      const corners0 = [Wg(d0, -h0), Wg(d0, h0), Wg(d1, h1), Wg(d1, -h1)], corners = windCorners(corners0, p => [p[0], p[2]] as XY).map(i => corners0[i]!); prism(deck, corners, corners.map(p => p[1] - .4)); }
    const arc: XYZ[] = []; for (let a = -90; a <= 90; a += 10) { const t = a * Math.PI / 180; arc.push(Wg((R - .12) * Math.cos(t), (R - .12) * Math.sin(t))); }
    railAlong(rails, arc, 0);
    for (const u of [-3.5, 0, 3.5]) slab(struts, Wg(4.5, u), q.W(-PRO.pile_o, -2.6 + u * grade, u * .4), .22, .22);
    cuts.solids.push(deck, rails, struts); void c;
    sideBed(cuts, 'sunsetBalcony', G.s, [Wg(3.1, 0)], 3.0);
  }
  // H · Bluff End: the round terrace R 8.2 at the deck's end level on a stone drum to the ground; the rail on its open sides.
  { const H = P.H, end = L.at(L.length), y = end.p[1], c = H.centre as unknown as XY, R = H.r_m, d = districtAt(...c), ids = ['greenway.bluffEnd'];
    const deck = solid('greenway.bluffEnd.deck', 'terrace', 'stone', 'deck', ids, d), drum = solid('greenway.bluffEnd.drum', 'abutment', 'stone', 'support', ids, d), rails = solid('greenway.bluffEnd.rails', OPEN_RAIL_KIND, 'timber', 'rail', ids, d);
    const bands = 10; for (let k = 0; k < bands; k++) { const z0 = -R + 2 * R * k / bands, z1 = -R + 2 * R * (k + 1) / bands, h0 = Math.sqrt(Math.max(0, R * R - z0 * z0)) || .05, h1 = Math.sqrt(Math.max(0, R * R - z1 * z1)) || .05;
      const corners: XY[] = [[c[0] - h0, c[1] + z0], [c[0] + h0, c[1] + z0], [c[0] + h1, c[1] + z1], [c[0] - h1, c[1] + z1]];
      quad(deck, corners, y, y - .4); quad(drum, corners, y - .4, corners.map(p => Math.min(y - 1, base(p[0], p[1]) - .4))); }
    // Rail: round the circle wherever it stands off the deck's own footprint (the deck's end and left edge are its mouth).
    const onDeck = (p: XY) => { const n = nearestOnPath(p, L.pts); return n.distance <= 3.1 && n.along <= L.length + .2; };
    // The deck's end: the terrace's circle meets the end line only west of the centreline, and the deck's own end stands ≈ 0.7
    // over the ground; a stone apron 1.6 deep carries the deck past its end to the circle, so no rail crosses the walk's line.
    const AP = 1.6, ao = PRO.rail_o + .06, Wa = (o: number, fw: number): XY => { const w = end.W(o, 0, fw); return [w[0], w[2]]; };
    const ux = plan(end.W(1, 0, 0)), uf = plan(end.W(0, 0, 1)), ox: XY = [ux[0] - end.p[0], ux[1] - end.p[2]], of: XY = [uf[0] - end.p[0], uf[1] - end.p[2]];
    const inApron = (p: XY) => { const dx = p[0] - end.p[0], dz = p[1] - end.p[2], o = dx * ox[0] + dz * ox[1], fw = dx * of[0] + dz * of[1]; return fw >= -.2 && fw <= AP + .2 && o >= -2.6 && o <= ao + .2; };
    { const corners = [Wa(-2.4, 0), Wa(ao, 0), Wa(ao, AP), Wa(-2.4, AP)]; quad(deck, corners, y, y - .4); quad(drum, corners, y - .4, corners.map(p => Math.min(y - 1, base(p[0], p[1]) - .4))); }
    let run: XYZ[] = []; const flush = () => { if (run.length > 1) railAlong(rails, run, 0); run = []; };
    for (let a = 0; a <= 360; a += 6) { const t = a * Math.PI / 180, p: XY = [c[0] + Math.cos(t) * (R - .12), c[1] + Math.sin(t) * (R - .12)]; if (onDeck(p) || inApron(p)) flush(); else run.push([p[0], y, p[1]]); }
    flush();
    // The apron's rail: down the right side from the deck's right rail, then across its far edge to the circle.
    { const pts: XYZ[] = [end.W(PRO.rail_o, 0, 0), end.W(PRO.rail_o, 0, AP - .1)]; for (let o = PRO.rail_o - .25; o >= -2.4; o -= .25) { const w = end.W(o, 0, AP - .1); if (Math.hypot(w[0] - c[0], w[2] - c[1]) <= R - .2) break; pts.push(w); } railAlong(rails, pts, 0); }
    cuts.solids.push(deck, drum, rails);
    const hb = bed('structure.greenway.bluffEnd', 'walk', [end.p, [c[0], y, c[1]]], false); hb.width = 4; hb.structureIds = ['greenway.bluffEnd']; cuts.beds.push(hb);
  }
}
