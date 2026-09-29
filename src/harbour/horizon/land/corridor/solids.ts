/**
 * The corridor's solids (ROAD.md §1; collision = what you see). From a corridor's stations and guard runs:
 * - `corridorDeck` (role deck, walkable, 'paved'): ONE continuous ribbon per run of stations between owned stretches. Each
 *   station contributes one cross-section (4 shared vertices: top left, top right, bottom right, bottom left); consecutive
 *   sections share them, so there is no prism seam or crack. The top IS the stations' surface (flat across, at `at[1]`),
 *   shoulders included; it widens to carry a guard's base or meet a retaining wall or the Year Walk. The sides skirt down to
 *   the final ground (an embankment face, never a floating edge) except over water, a span exclusion or a lower route.
 *   A run laps one station onto each structure deck that bounds it.
 * - `corridorKerb` (role wall, walkable top, 'stone'): 0.25 wide, CORRIDOR.kerbRise above the road (dropped flush where the
 *   footway is), on kerb and sidewalk sides.
 * - `corridorWalk` (role deck, walkable, 'plaza'): the sidewalk, at its footway height (dropped kerbs, ramps ≤ 8 %).
 * - `corridorRetaining` (role wall, 'rock'): the wall of a cutting side, from below the road to the bank + coping.
 * - `corridorGuard` (role rail, 'stone' | 'timber'): the guard collider built from `GuardRun.line` — a thin continuous panel
 *   (GUARD_PANEL.thickness, inside every rail kit's volume) from below the rail's base to the run's height. Drawn by the art
 *   track from the same run (cards.ts skips it).
 * - New sidewalk beds (kind 'walk', `<road>.walk.<L|R>.<n>`): the sidewalk's centreline at its footway height, with a
 *   dropped-kerb connector onto the carriageway at both ends so the path graph joins them to the road (a tee).
 *
 * Every solid is split by district (the emitters' rectangles, `structures/mesh.ts districtAt`) station segment by station
 * segment, as `<road>.corridor.<piece>.<n>.<district>`; pieces of one ribbon in two districts meet at identical vertices.
 */
import type { BedCut, HeightQuery, StructureSolid, XY, XYZ } from '../interfaces';
import { districtAt, prism, solid } from '../structures/mesh';
import { CORRIDOR, type CorridorStation, type GuardRun } from './types';
import { lateralLine, onSegment, type CorridorCore, type CorridorEnv, type SideName } from './stations';
import { RETAINING, retainingTop, runStations } from './guards';
import { isCorridorRoad, round3 } from './reaches';

/** Deck thickness, and how far below the ground a fill wall reaches. */
export const DECK = Object.freeze({ thickness: .6, sink: .1 });
/** Guard collider panel: thickness (inside every rail kit's volume) and how far below the rail's base it starts. */
export const GUARD_PANEL = Object.freeze({ thickness: .12, below: .3 });
/** The deck carries a guard's base this far past the rail's centre line (just past the collider's outer face). */
export const GUARD_VERGE = .1;
/** A lower route this far under the road at a station keeps the space under the deck open (no skirt). */
export const LOWER_ROUTE = 1.25;

/** Fill wall under a deck edge: thickness (inside the deck's footprint), the clearance under the deck's bottom that needs
 * one, and how far past the edge the ground it stands down to is read (a steep bank falling away just past the edge). */
export const FILL = Object.freeze({ thickness: .5, clear: .05, reach: .5 });
/** A route more than a body's step and at most a guard's drop below the road keeps its corridor under the shoulder (the
 * shoulder steps back to the lanes there; deeper, the shoulder stays and the side's drop is guarded). */
export const SHOULDER_LIP = .48, SHOULDER_CLEAR = CORRIDOR.guardDrop;

/** Junction aprons (a joining road's mouth): inside the through road's carriageway the joining deck lies MOUTH_UNDER under
 * the through road's surface; over the next APRON stations beyond it the joining deck blends from the through road's surface
 * (extended into it) back to its own profile, built in APRON_STRIPS lateral strips so each strip edge takes its own height. */
export const MOUTH_UNDER = .01, APRON = 4, APRON_STRIPS = 6;
export const CORRIDOR_SOLID_KINDS = ['corridorDeck', 'corridorKerb', 'corridorWalk', 'corridorRetaining', 'corridorGuard'] as const;

/** One station's cross-section of a band: signed offsets a < b (> 0 right), top heights at a and b, a flat bottom. */
interface Section { a: number; b: number; ya: number; yb: number; bottom: number; bottomB?: number }
/**
 * A band over station indices `ks` (in order; `loop` joins the last to the first): one canonical 8-vertex prism per station
 * segment (the land's prism convention, `structures/mesh.ts prism`, which every later pass reads), each section computed
 * ONCE and used verbatim by both prisms that meet there — so neighbouring prisms share their end faces exactly (no crack,
 * no seam, no mitre gap) and `removeInternalFaces` drops those coincident faces when the world is partitioned.
 * `segs` receives each prism's segment index (its district owner).
 */
function band(out: StructureSolid, segs: number[], core: CorridorCore, ks: readonly number[], loop: boolean, section: (k: number) => Section, segOffset = 0): void {
  if (ks.length < 2) return;
  const cs = ks.map(k => { const s = section(k), A = lateralLine(core, round3(s.a))[k]!, B = lateralLine(core, round3(s.b))[k]!;
    return { A: [A[0], s.ya, A[2]] as XYZ, B: [B[0], s.yb, B[2]] as XYZ, bA: Math.min(s.bottom, s.ya - .01), bB: Math.min(s.bottomB ?? s.bottom, s.yb - .01) }; });
  const count = ks.length, n = loop ? count : count - 1;
  for (let i = 0; i < n; i++) { const p = cs[i]!, q = cs[(i + 1) % count]!; prism(out, [p.A, p.B, q.B, q.A], [p.bA, p.bB, q.bB, q.bA]); segs.push(i + segOffset); }
}
/** A panel along a polyline (a guard line or a wall line): `half` either side of the line, top and bottom per point; one
 * prism per segment, mitred sections shared exactly between neighbours like `band`. */
function panel(out: StructureSolid, segs: number[], line: readonly XYZ[], half: number, top: (i: number) => number, bottom: (i: number) => number): void {
  const n = line.length; if (n < 2) return;
  const cs = line.map((p, i) => { const a = line[Math.max(0, i - 1)]!, b = line[Math.min(n - 1, i + 1)]!, dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, r: XY = [-dz / l, dx / l], t = top(i), bt = Math.min(bottom(i), t - .01);
    return { A: [p[0] - r[0] * half, t, p[2] - r[1] * half] as XYZ, B: [p[0] + r[0] * half, t, p[2] + r[1] * half] as XYZ, b: bt }; });
  for (let i = 0; i + 1 < n; i++) { const p = cs[i]!, q = cs[i + 1]!; prism(out, [p.A, p.B, q.B, q.A], [p.b, p.b, q.b, q.b]); segs.push(i); }
}
/** Splits a band or panel solid by district, prism by prism (prism j belongs to segment segs[j]). */
function splitBand(whole: StructureSolid, segs: readonly number[], segDistrict: readonly string[], idFor: (district: string) => string): StructureSolid[] {
  const parts = new Map<string, StructureSolid>();
  segs.forEach((seg, j) => {
    const d = segDistrict[Math.min(segDistrict.length - 1, seg)]!;
    let part = parts.get(d); if (!part) { part = { ...whole, id: idFor(d), districtId: d, positions: [], indices: [] }; parts.set(d, part); }
    const offset = part.positions.length / 3; for (let k = 0; k < 24; k++) part.positions.push(whole.positions[j * 24 + k]!);
    for (let k = 0; k < 36; k++) part.indices.push(whole.indices[j * 36 + k]! - j * 8 + offset);
  });
  return [...parts.values()];
}
const sideSign = (side: SideName) => side === 'left' ? -1 : 1;
const ownedAt = (st: CorridorStation) => !!st.structureId || st.left.edge === 'structure' && st.right.edge === 'structure';

/** The outer extents a corridor builds on one side of one station (absolute offsets). */
export interface SideLayout { deck: number; kerb?: { inner: number; outer: number; rise: number }; walk?: { inner: number; outer: number; height: number }; base: number }
export function sideLayout(st: CorridorStation, side: SideName, guard: GuardRun | undefined): SideLayout {
  const s = st[side], h = st.at[1], paved = s.paved;
  const verge = guard ? guard.kind === 'retaining' ? guard.offset : guard.offset + GUARD_VERGE : 0;
  if (s.edge === 'structure') return { deck: paved, base: h };
  if (s.edge === 'sidewalk' && s.footway) {
    const rise = round3(Math.max(0, s.footway.height - h)), inner = paved + CORRIDOR.kerbWidth;
    return { deck: paved, kerb: { inner: paved, outer: inner, rise }, walk: { inner, outer: Math.max(s.footway.outer, verge), height: s.footway.height }, base: s.footway.height };
  }
  if (s.edge === 'kerb') return { deck: paved, kerb: { inner: paved, outer: Math.max(paved + CORRIDOR.kerbWidth, verge), rise: CORRIDOR.kerbRise }, base: h + CORRIDOR.kerbRise };
  return { deck: Math.max(paved, verge), base: h };
}
export interface CorridorSolids { solids: StructureSolid[]; walks: BedCut[]; unsupported: { at: XY; depth: number }[] }
/** Builds a corridor's solids and sidewalk beds from its stations and guard runs. */
export function buildCorridorSolids(core: CorridorCore, guards: readonly GuardRun[], env: Pick<CorridorEnv, 'ground' | 'wet' | 'segments' | 'otherRoadHeight'>): CorridorSolids {
  const { stations, closed, bed } = core, n = stations.length, id = bed.id, out: StructureSolid[] = [], walks: BedCut[] = [], unsupported: { at: XY; depth: number }[] = [];
  if (n < 2) return { solids: out, walks, unsupported };
  function lowerRouteIn(k: number, side: SideName, from: number, to: number): boolean {
    const st = stations[k]!, h = st.at[1], sign = sideSign(side);
    for (const o of [from + .1, (from + to) / 2, to - .05]) {
      const p = lateralLine(core, round3(sign * o))[k]!;
      for (const seg of env.segments(p[0], p[2], 3)) {
        const b = seg.bed; if (b === bed || b.id.startsWith('structure.') || bed.structureIds.includes(b.id) || ['cable', 'cave', 'rail'].includes(b.kind)) continue;
        const q = onSegment(seg.a, seg.b, p[0], p[2]); if (q.d <= b.width / 2 + .75 && q.y < h - SHOULDER_LIP && q.y > h - SHOULDER_CLEAR) return true;
      }
    }
    return false;
  }
  // Which run covers each station side.
  const cover = { left: new Map<number, GuardRun>(), right: new Map<number, GuardRun>() };
  for (const run of guards) for (const k of runStations(core, run)) cover[run.side].set(k, run);
  const layout = stations.map((st, k) => ({ left: sideLayout(st, 'left', cover.left.get(k)), right: sideLayout(st, 'right', cover.right.get(k)) }));
  // A guard run that continues onto a structure reaches the structure's first station (guards.ts); its kerb or verge laps
  // that station too (as the deck does), so no slot opens between the last kerb and the structure's deck under the rail
  // (the Quay Bridge's ends dropped 1.6–5 eu between them).
  for (const run of guards) {
    if (run.kind === 'retaining') continue;
    const ks = runStations(core, run);
    ks.forEach((k, i) => { if (!ownedAt(stations[k]!)) return; const nb = ks[i + 1] !== undefined && !ownedAt(stations[ks[i + 1]!]!) ? ks[i + 1]! : ks[i - 1] !== undefined && !ownedAt(stations[ks[i - 1]!]!) ? ks[i - 1]! : undefined; if (nb === undefined) return; const src = layout[nb]![run.side]; layout[k]![run.side] = { deck: src.deck, base: stations[k]!.at[1] + (src.base - stations[nb]!.at[1]), ...(src.kerb ? { kerb: { ...src.kerb } } : {}) }; });
  }
  // A run carried on past its last station toward an opening (guards.ts: to the opening's true edge) stands on the deck: the
  // opening's station carries the rail's verge too, so the deck under that last half step is as wide as the rail needs.
  for (const run of guards) {
    if (run.kind === 'retaining') continue;
    const ks = runStations(core, run), verge = run.offset + GUARD_VERGE;
    for (const [i, j] of [[0, 1], [ks.length - 1, ks.length - 2]] as const) {
      if (ks.length < 2 || ks[i] !== ks[j]) continue;
      const k0 = ks[i]!, dir = i === 0 ? -1 : 1, k = closed ? (k0 + dir + n) % n : k0 + dir;
      if (k < 0 || k >= n || ownedAt(stations[k]!)) continue;
      const lay = layout[k]![run.side]; lay.deck = Math.max(lay.deck, verge);
      // Under a kerb at the run's end station the deck reaches the verge too (just inside the kerb's back), so the half step
      // to the opening has no hole between the kerb's end and the rail.
      const end = layout[k0]![run.side]; if (end.kerb) end.deck = Math.max(end.deck, Math.min(verge, end.kerb.outer) - .02);
    }
  }
  // Another route passing BELOW the shoulder (a spur leaving the mouth on its grade, a footway lane beside the road at a
  // lower level) keeps its corridor: the deck's shoulder steps back to the carriageway there, as the land's own shoulders
  // did (junctions.ts clearRouteCorridors). A guard or a kerb there keeps the deck (it stands on it).
  for (let k = 0; k < n; k++) for (const side of ['left', 'right'] as const) {
    const lay = layout[k]![side], st = stations[k]!; if (lay.deck <= st.half + 1e-6 || lay.kerb || cover[side].has(k) || st[side].edge === 'structure') continue;
    if (lowerRouteIn(k, side, st.half, lay.deck)) lay.deck = st.half;
  }
  const ground: HeightQuery = env.ground, pieces: { whole: StructureSolid; segs: number[]; ks: number[]; loop: boolean; name: string }[] = [];
  // ---- deck: runs between owned stretches, lapping one owned station at each end. A road that starts or ends on another
  // corridor road's carriageway (a spur's mouth) starts its deck one station inside that road's (no double deck).
  const owned = stations.map(ownedAt), runs: { ks: number[]; loop: boolean }[] = [];
  // Junction aprons: `apron[k]` is the weight (1 inside the through road's carriageway, easing to 0 over APRON stations
  // beyond it) with which station k's deck takes the through road's surface; `under[k]` is set inside the carriageway.
  const apron = new Array<number>(n).fill(0), under = new Array<boolean>(n).fill(false);
  if (!closed) for (const dir of [1, -1] as const) {
    const on = (k: number) => env.otherRoadHeight(stations[k]!.at[0], stations[k]!.at[2], stations[k]!.at[1], id, CORRIDOR.guardDrop);
    let k = dir > 0 ? 0 : n - 1; const last = dir > 0 ? n - 1 : 0;
    if (on(k) === null) continue;
    while (on(k) !== null) { apron[k] = 1; under[k] = true; if (k === last) break; k += dir; }
    for (let j = 1; j <= APRON && k >= 0 && k < n && !under[k]; j++, k += dir) { const t = j / (APRON + 1); apron[k] = Math.max(apron[k]!, 1 - t * t * (3 - 2 * t)); }
  }
  // The through road's surface extended to (x, z): its centreline height at the nearest point of the nearest other corridor
  // road within reach (the through road's deck is flat across, so this is its surface and its plane beyond its edge).
  const throughHeight = (x: number, z: number, y: number): number | null => {
    let best: { d: number; y: number } | null = null;
    for (const seg of env.segments(x, z, 14)) { if (seg.bed === bed || !isCorridorRoad(seg.bed)) continue; const q = onSegment(seg.a, seg.b, x, z); if (q.d <= seg.bed.width / 2 + seg.bed.shoulder + 8 && Math.abs(q.y - y) <= CORRIDOR.guardDrop && (!best || q.d < best.d)) best = { d: q.d, y: q.y }; }
    return best?.y ?? null;
  };
  // Inside the through road the joining road is bare deck: no kerb, sidewalk, verge or fill of its own in the other's lanes.
  for (let k = 0; k < n; k++) if (under[k]) for (const side of ['left', 'right'] as const) layout[k]![side] = { deck: stations[k]![side].paved, base: stations[k]!.at[1] };
  if (!owned.some(Boolean)) runs.push({ ks: stations.map((_, k) => k), loop: closed });
  else {
    const start = owned.findIndex(Boolean), order = Array.from({ length: n }, (_, i) => closed ? (start + i) % n : i);
    let cur: number[] = [];
    const flush = () => { if (cur.length > 1 || cur.length === 1 && !owned[cur[0]!]) runs.push({ ks: cur, loop: false }); cur = []; };
    for (let i = 0; i < n; i++) {
      const k = order[i]!;
      if (owned[k]) { if (cur.length) { cur.push(k); flush(); } continue; }
      if (!cur.length) { const prev = closed ? order[(i - 1 + n) % n]! : i > 0 ? order[i - 1]! : undefined; if (prev !== undefined && owned[prev]) cur.push(prev); }
      cur.push(k);
    }
    if (cur.length) { if (closed && owned[order[0]!]) cur.push(order[0]!); flush(); }
  }
  /** Another route passes under this side of the deck (its corridor overlaps the side's footprint, more than a body below). */
  const lowerUnder = (k: number, side: SideName, from: number, to: number): boolean => {
    const st = stations[k]!, h = st.at[1], sign = sideSign(side), a = lateralLine(core, round3(sign * Math.max(from, .01)))[k]!, b = lateralLine(core, round3(sign * to))[k]!;
    for (const seg of env.segments((a[0] + b[0]) / 2, (a[2] + b[2]) / 2, (to - from) / 2 + 6)) {
      if (seg.bed === bed || ['cable', 'cave', 'rail'].includes(seg.bed.kind)) continue;
      for (const p of [a, b, [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2] as XYZ]) { const q = onSegment(seg.a, seg.b, p[0], p[2]); if (q.d <= seg.bed.width / 2 + .3 && q.y < h - LOWER_ROUTE && q.y > ground(q.p[0], q.p[1]) - 1) return true; }
    }
    return false;
  };
  // Each side of the deck stands on a fill wall (`corridorRetaining`, the embankment face) down to the final ground where the
  // ground falls away under its edge — except where a structure owns the station, the side stands over water, or another
  // route passes under it (reported: the deck overhangs it).
  const fill = stations.map((st, k) => {
    const h = st.at[1], bottom = h - DECK.thickness, out: { left: number | null; right: number | null } = { left: null, right: null };
    if (ownedAt(st) || under[k]) return out;
    for (const side of ['left', 'right'] as const) {
      const w = layout[k]![side].deck, edge = lateralLine(core, round3(sideSign(side) * w))[k]!, inner = lateralLine(core, round3(sideSign(side) * Math.max(0, w - FILL.thickness)))[k]!, past = lateralLine(core, round3(sideSign(side) * (w + FILL.reach)))[k]!;
      const g = Math.min(ground(edge[0], edge[2]), ground(inner[0], inner[2]), ground(past[0], past[2]));
      if (g >= bottom - FILL.clear) continue;
      if ([edge, inner].some(p => env.wet(p[0], p[2])) || lowerUnder(k, side, Math.max(0, w - FILL.thickness - 1), w + .5)) { if (bottom - g > .3) unsupported.push({ at: [round3(edge[0]), round3(edge[2])], depth: round3(bottom - g) }); continue; }
      out[side] = round3(g - DECK.sink);
    }
    return out;
  });
  runs.forEach((run, i) => {
    const whole = solid(`${id}.corridor.deck.${i + 1}`, 'corridorDeck', 'paved', 'deck', [id], districtAt(stations[run.ks[0]!]!.at[0], stations[run.ks[0]!]!.at[2]));
    const segs: number[] = [];
    // A lapped (owned) end station takes its neighbour's widths: the deck never tapers inside its last prism.
    const widthOf = (k: number) => { if (!owned[k] || run.loop) return k; const i = run.ks.indexOf(k), j = i === 0 ? run.ks[1] : run.ks[run.ks.length - 2]; return j !== undefined && !owned[j] ? j : k; };
    const plain = (k: number): Section => { const own = stations[k]!.at[1], w = widthOf(k); return { a: -layout[w]!.left.deck, b: layout[w]!.right.deck, ya: own, yb: own, bottom: own - DECK.thickness }; };
    // Apron stations (and one plain station either side, where the apron's strips meet the plain deck on the same straight
    // section) are built in strips; the rest of the run is one band. Both push their prisms' segment index in run.ks order.
    const inApron = run.ks.map(k => apron[k]! > 0);
    if (!inApron.some(Boolean)) band(whole, segs, core, run.ks, run.loop, plain);
    else {
      let i0 = 0;
      while (i0 < run.ks.length - 1) {
        const apronSeg = inApron[i0]! || inApron[i0 + 1]!;
        let i1 = i0 + 1; while (i1 < run.ks.length - 1 && (inApron[i1]! || inApron[i1 + 1]!) === apronSeg) i1++;
        const sub = run.ks.slice(i0, i1 + 1);
        if (!apronSeg) band(whole, segs, core, sub, false, plain, i0);
        else for (let j = 0; j < APRON_STRIPS; j++) band(whole, segs, core, sub, false, k => {
          const base = plain(k), wgt = apron[k]!, own = stations[k]!.at[1];
          const o0 = base.a + (base.b - base.a) * j / APRON_STRIPS, o1 = base.a + (base.b - base.a) * (j + 1) / APRON_STRIPS;
          // Inside the through road: its surface (just under it). Beyond it: the joining road keeps its own centreline profile
          // and takes only the through road's cross-fall, fading over the apron (a steep spur's grade is never steepened).
          const centre = (() => { const q = stations[k]!.at; return throughHeight(q[0], q[2], own); })();
          const at = (o: number) => { if (wgt <= 0) return own; const q = lateralLine(core, round3(o))[k]!, t = throughHeight(q[0], q[2], own); if (t === null) return own;
            if (under[k]) return round3(t - (env.otherRoadHeight(q[0], q[2], t, id, .05) !== null ? MOUTH_UNDER : 0));
            return round3(own + (t - (centre ?? t)) * wgt); };
          const ya = at(o0), yb = at(o1); return { a: o0, b: o1, ya, yb, bottom: Math.min(ya, yb) - DECK.thickness };
        }, i0);
        i0 = i1;
      }
    }
    pieces.push({ whole, segs, ks: run.ks, loop: run.loop, name: `deck.${i + 1}` });
  });
  // ---- fill walls: runs of stations whose side needs one, closed one station beyond each end (a flush end face there).
  const lapped = new Map<string, number>();
  for (const side of ['left', 'right'] as const) {
    const sign = sideSign(side), need = (k: number) => fill[k]![side] !== null;
    const runs2: number[][] = []; let cur: number[] = [];
    for (let k = 0; k < n; k++) { if (need(k)) cur.push(k); else if (cur.length) { runs2.push(cur); cur = []; } } if (cur.length) runs2.push(cur);
    if (closed && runs2.length > 1 && runs2[0]![0] === 0 && runs2.at(-1)!.at(-1) === n - 1) { const first = runs2.shift()!; runs2[runs2.length - 1] = [...runs2.at(-1)!, ...first]; }
    runs2.forEach((ks0, i) => {
      const ks = [...ks0]; const before = closed ? (ks[0]! - 1 + n) % n : ks[0]! - 1, after = closed ? (ks.at(-1)! + 1) % n : ks.at(-1)! + 1;
      // The flush end face stands one station beyond each end; next to a structure it stands under the deck's lap station (the
      // deck laps the structure's first station), carried at the neighbour's footing, so the lapped deck never hangs free.
      if (before >= 0 && !ks.includes(before)) { ks.unshift(before); if (ownedAt(stations[before]!)) lapped.set(`${side}:${before}`, ks[1]!); }
      if (after < n && !ks.includes(after)) { ks.push(after); if (ownedAt(stations[after]!)) lapped.set(`${side}:${after}`, ks[ks.length - 2]!); }
      if (ks.length < 2) return;
      const whole = solid(`${id}.corridor.fill.${side === 'left' ? 'L' : 'R'}.${i + 1}`, 'corridorRetaining', 'rock', 'wall', [id], districtAt(stations[ks[0]!]!.at[0], stations[ks[0]!]!.at[2])), segs: number[] = [];
      band(whole, segs, core, ks, false, k => { const nb = lapped.get(`${side}:${k}`), w = layout[nb ?? k]![side].deck, [a, b] = sign < 0 ? [-w, -(w - FILL.thickness)] : [w - FILL.thickness, w], top = stations[k]!.at[1] - DECK.thickness; return { a, b, ya: top, yb: top, bottom: fill[k]![side] ?? (nb !== undefined ? fill[nb]![side] : null) ?? top - .01 }; });
      pieces.push({ whole, segs, ks, loop: false, name: `fill.${side === 'left' ? 'L' : 'R'}.${i + 1}` });
    });
  }
  // ---- kerbs and sidewalks: runs of stations carrying one on a side.
  for (const side of ['left', 'right'] as const) {
    const sign = sideSign(side);
    const spans = (has: (k: number) => boolean) => { const out: number[][] = []; let cur: number[] = []; for (let k = 0; k < n; k++) { if (has(k)) cur.push(k); else if (cur.length) { out.push(cur); cur = []; } } if (cur.length) out.push(cur);
      // A closed loop's run through the seam is one run.
      if (closed && out.length > 1 && out[0]![0] === 0 && out.at(-1)!.at(-1) === n - 1) { const first = out.shift()!; out[out.length - 1] = [...out.at(-1)!, ...first]; }
      return out; };
    const edges = (lo: number, hi: number) => sign < 0 ? [-hi, -lo] as const : [lo, hi] as const;
    spans(k => !!layout[k]![side].kerb).forEach((ks, i) => {
      const whole = solid(`${id}.corridor.kerb.${side === 'left' ? 'L' : 'R'}.${i + 1}`, 'corridorKerb', 'stone', 'wall', [id], districtAt(stations[ks[0]!]!.at[0], stations[ks[0]!]!.at[2]));
      whole.walkable = true;
      const segs: number[] = [];
      band(whole, segs, core, ks, closed && ks.length === n, k => { const kb = layout[k]![side].kerb!, [a, b] = edges(kb.inner, kb.outer), y = stations[k]!.at[1] + kb.rise; return { a, b, ya: y, yb: y, bottom: stations[k]!.at[1] - DECK.thickness }; });
      pieces.push({ whole, segs, ks, loop: closed && ks.length === n, name: `kerb.${side === 'left' ? 'L' : 'R'}.${i + 1}` });
    });
    const walkRuns = new Map<string, number[]>();
    for (let k = 0; k < n; k++) { const bedId = stations[k]![side].footway?.bedId; if (layout[k]![side].walk && bedId) { const l = walkRuns.get(bedId); if (l) l.push(k); else walkRuns.set(bedId, [k]); } }
    for (const [bedId, ks0] of walkRuns) {
      // Order a run through a loop's seam.
      let ks = ks0; const gapAt = ks0.findIndex((k, i) => i > 0 && k !== ks0[i - 1]! + 1); if (gapAt > 0) ks = [...ks0.slice(gapAt), ...ks0.slice(0, gapAt)];
      const tag = bedId.slice(`${id}.walk.`.length), whole = solid(`${id}.corridor.walk.${tag}`, 'corridorWalk', 'plaza', 'deck', [id, bedId], districtAt(stations[ks[0]!]!.at[0], stations[ks[0]!]!.at[2]));
      const segs: number[] = [];
      band(whole, segs, core, ks, false, k => { const w = layout[k]![side].walk!, [a, b] = edges(w.inner, w.outer), st = stations[k]!, pa = lateralLine(core, round3(sign * w.inner))[k]!, pb = lateralLine(core, round3(sign * w.outer))[k]!;
        return { a, b, ya: w.height, yb: w.height, bottom: round3(Math.min(st.at[1] - .3, ground(pa[0], pa[2]) - DECK.sink, ground(pb[0], pb[2]) - DECK.sink)) }; });
      pieces.push({ whole, segs, ks, loop: false, name: `walk.${tag}` });
      walks.push(sidewalkBed(core, bedId, ks, side, layout.map(l => l[side])));
    }
  }
  // ---- guard colliders and retaining walls from each run's line.
  for (const run of guards) {
    const ks = runStations(core, run), retaining = run.kind === 'retaining';
    const whole = solid(run.colliderId, retaining ? 'corridorRetaining' : 'corridorGuard', retaining ? 'rock' : run.kind === 'postRail' ? 'timber' : 'stone', retaining ? 'wall' : 'rail', [id], districtAt(run.line[0]![0], run.line[0]![2]));
    const base = ks.map((k, i) => retaining ? run.line[i]![1] : layout[k]![run.side].base), segs: number[] = [];
    // A wall stands to the bank it retains (guards.ts retainingTop, the same number as the run's height).
    if (retaining) panel(whole, segs, run.line, RETAINING.thickness / 2, i => retainingTop(core, run.side, run.offset, ks[i]!, run.line[i]!, ground), i => base[i]! - RETAINING.foot);
    else panel(whole, segs, run.line, GUARD_PANEL.thickness / 2, i => base[i]! + run.height, i => base[i]! - GUARD_PANEL.below);
    pieces.push({ whole, segs, ks, loop: false, name: run.colliderId.slice(`${id}.corridor.`.length) });
  }
  // ---- district split, station segment by station segment.
  for (const p of pieces) {
    if (!p.whole.indices.length) continue;
    const segs = p.loop ? p.ks.length : p.ks.length - 1;
    const segDistrict = Array.from({ length: Math.max(1, segs) }, (_, i) => { const a = stations[p.ks[i]!]!.at, b = stations[p.ks[(i + 1) % p.ks.length]!]!.at; return districtAt((a[0] + b[0]) / 2, (a[2] + b[2]) / 2); });
    out.push(...splitBand(p.whole, p.segs, segDistrict, d => `${p.whole.id}.${d}`));
  }
  return { solids: out, walks, unsupported };
}
/** A sidewalk bed: the sidewalk's centreline at its footway height, plus a dropped-kerb connector onto the carriageway at each
 * end (a tee the path graph joins to the road). terrainCut false: the terrain is final. */
function sidewalkBed(core: CorridorCore, bedId: string, ks: readonly number[], side: SideName, lay: readonly SideLayout[]): BedCut {
  const sign = sideSign(side), stations = core.stations, points: XYZ[] = [];
  const connector = (k: number): XYZ => { const st = stations[k]!, p = lateralLine(core, round3(sign * Math.max(.5, st.half - 1)))[k]!; return [round3(p[0]), round3(st.at[1]), round3(p[2])]; };
  points.push(connector(ks[0]!));
  for (const k of ks) { const w = lay[k]!.walk!, p = lateralLine(core, round3(sign * (w.inner + w.outer) / 2))[k]!; points.push([round3(p[0]), round3(w.height), round3(p[2])]); }
  points.push(connector(ks.at(-1)!));
  const width = round3(CORRIDOR.sidewalkWidth);
  return { id: bedId, kind: 'walk', profile: 'walk', surface: 'plaza', points, width, shoulder: 0, blend: 0, clearHeight: 2.4, maxGrade: .12, terrainCut: false, structureIds: [], districtIds: [...new Set(points.map(p => districtAt(p[0], p[2])))] };
}
