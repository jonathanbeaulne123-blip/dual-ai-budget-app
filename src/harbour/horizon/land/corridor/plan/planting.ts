/**
 * Corridor planting (ROAD.md §5, brief §5): composed groups per reach, never a spline scatter. Every item is checked
 * against one rule set (`fits`): inside the station's planting band, crown clear of the carriageway (+ setback) and of
 * low footways, out of gaps, sight triangles, scenic-stop views, water and occupied ground, under the Green's height
 * limit, on ground that can hold it, and apart from its neighbours. A group that cannot place enough items is dropped
 * rather than left as a stray.
 */
import type { CorridorStation, PlantItem, PlantSpecies, PlantingGroup, PlantingKind } from '../types.ts';
import { CORRIDOR } from '../types.ts';
import type { Analysis, Style } from './context.ts';
import { landSide, seaSide, type Env } from './env.ts';
import { SIDES, sign, type SideName } from './frame.ts';
import { lerp, pick, r3, smooth, stream } from './rng.ts';
import { canopyOf, flowerTint, heightOf, HEDGE_LENGTH, PLANT_FORM } from './species.ts';
import type { StopSpan } from './stops.ts';

export const PLANT = Object.freeze({
  /** Trees in mountain reaches stand at least this far behind the paved edge (ROAD brief: mountain framing only). */
  mountainSetback: 6,
  /** A crown whose underside is below this may not overhang a footway (ROAD.md §5). */
  footwayHeadroom: CORRIDOR.headroom,
  /** Extra along-road clearance beyond a gap's end for anything planted. */
  gapClear: 1,
  /** Trees keep this far along the road from a scenic stop's outline on its side (the view stays open). */
  stopClear: 12,
  /** Ground slope limits (rise/run over ±1 eu), Mountain v2's `tryTree` values: conifers hold steeper ground. */
  conSlope: 1.2,
  treeSlope: 1.0,
  palmSlope: 0.35,
  lowSlope: 0.35,
  /** A trunk's foot must meet the ground within this on every side (Mountain v2: no tree on a carved step or bench lip). */
  trunkFoot: 0.37,
  /** A tree whose crown top stays this far below the road is not seen from it: it frames nothing, so it is not planted. */
  hidden: 2,
  /** Low items within 4 eu of the paved edge sit within this of the road height (no bed down a batter). */
  lowStep: 1.5,
  crownPack: 0.72,
  lowPack: 0.9,
});

interface Placed { x: number; z: number; r: number }
interface Ctx { A: Analysis; env: Env; stops: readonly { span: StopSpan; s: number }[]; grid: Map<string, Placed[]>; groups: PlantingGroup[]; groupS: number[]; counts: Map<string, number> }

/** Everything a candidate needs: along-road s, signed offset o (median: |o| ≤ median half), species, scale. */
interface Cand { s: number; o: number; species: PlantSpecies; scale: number; yaw?: number; tint: number; median?: boolean }

const cellKey = (x: number, z: number) => `${Math.floor(x / 6)}:${Math.floor(z / 6)}`;

/** Checks one candidate; returns the item (grounded) or null. `why` receives the reason for refusals (tests). */
export function fits(c: Ctx, k: Cand, why?: (reason: string) => void): PlantItem | null {
  const { A, env } = c, F = A.frame, S = A.stations;
  const no = (r: string) => { why?.(r); return null; };
  const i = F.nearestIndex(k.s), st = S[i]!, form = PLANT_FORM[k.species];
  const canopy = canopyOf(k.species, k.scale), height = heightOf(k.species, k.scale), base = form.base * k.scale;
  const lat = k.species === 'hedge' ? Math.max(canopy, 0.3) : canopy;
  const p = F.point(k.s, k.o), x = p[0], z = p[2];
  // Where the road actually is (a point on the inside of a bend is measured against the nearest centreline).
  const pr = F.project(x, z, i, 12);
  const o = pr.o, side: SideName = o >= 0 ? 'right' : 'left', sd = S[F.nearestIndex(pr.s)]![side];
  if (k.median) {
    if (!st.median) return no('median');
    if (Math.abs(o) + lat > st.median.half - 0.3) return no('median-edge');
    for (const d of [-canopy, canopy]) if (!S[F.nearestIndex(k.s + d)]!.median) return no('median-end');
  } else {
    if (!sd.planting) return no('band');
    const ao = Math.abs(o);
    if (ao < sd.planting.inner - 1e-6 || ao > sd.planting.outer + 1e-6) return no('band');
    if (ao - lat < sd.paved + CORRIDOR.plantingSetback) return no('carriageway');
    if (sd.footway && base < PLANT.footwayHeadroom && ao - lat < sd.footway.outer && ao + lat > sd.footway.inner) return no('footway');
    if (form.tree && (st.context === 'mountain' || A.style(st) === 'V03') && ao - sd.paved < PLANT.mountainSetback) return no('mountain-setback');
    // A crown over any station's carriageway nearby (tight bends): check neighbouring stations.
    for (const d of [-4, -2, 2, 4]) { const q = F.project(x, z, F.nearestIndex(k.s + d), 3); const qs = S[F.nearestIndex(q.s)]!; if (Math.abs(q.o) - lat < qs[q.o >= 0 ? 'right' : 'left'].paved + CORRIDOR.plantingSetback - 1e-6 && q.d < pr.d + 6) return no('carriageway'); }
  }
  // Gaps (entrances, crossings, junctions, views) stay open on their side, and a crossing on both.
  if (!k.median) {
    for (const m of A.mouths) {
      if (m.side !== side && m.kind !== 'crossing') continue;
      if (Math.abs(F.delta(m.s, pr.s)) <= m.half + canopy + PLANT.gapClear) return no(`gap:${m.kind}`);
    }
  }
  if (height > CORRIDOR.sightlineMaxHeight && A.inSight(pr.s, k.median ? 0 : o, canopy)) return no('sight');
  // Median noses: nothing over 0.6 within the sight reach of a median end.
  if (k.median && height > CORRIDOR.sightlineMaxHeight) {
    for (const d of [-CORRIDOR.sightlineReach, CORRIDOR.sightlineReach]) if (!S[F.nearestIndex(k.s + d)]!.median) return no('sight');
  }
  for (const zone of env.lowZones) if (height > zone.maxHeight && Math.hypot(x - zone.centre[0], z - zone.centre[1]) < zone.radius + canopy) return no('low-zone');
  for (const t of c.stops) {
    if (!form.tree && height <= 1.2) continue;
    if (t.span.side !== side || k.median) continue;
    if (Math.abs(F.delta(t.s, pr.s)) <= Math.abs(F.delta(t.span.from, t.span.to)) / 2 + PLANT.stopClear + canopy) return no('stop');
  }
  // Ground: dry, unoccupied, holdable.
  const foot = form.tree ? 0.6 : Math.min(canopy, 1);
  for (const [dx, dz] of [[0, 0], [foot, 0], [-foot, 0], [0, foot], [0, -foot]] as const) {
    if (env.wet(x + dx, z + dz)) return no('water');
    if (env.occupied(x + dx, z + dz)) return no('occupied');
  }
  const y = env.ground(x, z);
  const g1 = env.ground(x + 1, z), g2 = env.ground(x - 1, z), g3 = env.ground(x, z + 1), g4 = env.ground(x, z - 1);
  const slope = Math.hypot(g1 - g2, g3 - g4) / 2;
  const limit = k.species === 'palm' ? PLANT.palmSlope : k.species === 'pine' || k.species === 'alpine' ? PLANT.conSlope : form.tree ? PLANT.treeSlope : PLANT.lowSlope;
  if (slope > limit) return no('slope');
  if (form.tree) {
    const tr = 0.2 * k.scale;
    for (const [dx, dz] of [[tr, 0], [-tr, 0], [0, tr], [0, -tr]] as const) if (Math.abs(env.ground(x + dx, z + dz) - y) > PLANT.trunkFoot) return no('trunk-foot');
    if (y + height < st.at[1] - PLANT.hidden) return no('hidden');
  }
  if (!k.median && !form.tree && Math.abs(o) - sd.paved < 4 && Math.abs(y - st.at[1]) > PLANT.lowStep) return no('step');
  // Neighbours.
  const r = canopy * (form.tree ? PLANT.crownPack : PLANT.lowPack);
  const gx = Math.floor(x / 6), gz = Math.floor(z / 6);
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (const q of c.grid.get(`${gx + a}:${gz + b}`) ?? []) if (Math.hypot(x - q.x, z - q.z) < r + q.r) return no('crowded');
  const f = F.frameAt(pr.s);
  const yaw = k.species === 'hedge' ? Math.atan2(-f.tangent[1], f.tangent[0]) : (k.yaw ?? 0);
  const gy = k.median ? st.at[1] + CORRIDOR.kerbRise : y;
  return { species: k.species, at: [r3(x), r3(gy), r3(z)], scale: r3(k.scale), yaw: r3(yaw), tint: r3(k.tint) };
}

function commit(c: Ctx, item: PlantItem): void {
  const form = PLANT_FORM[item.species], canopy = canopyOf(item.species, item.scale);
  const key = cellKey(item.at[0], item.at[2]), list = c.grid.get(key) ?? [];
  list.push({ x: item.at[0], z: item.at[2], r: canopy * (form.tree ? PLANT.crownPack : PLANT.lowPack) });
  c.grid.set(key, list);
}

function uncommit(c: Ctx, item: PlantItem): void {
  const key = cellKey(item.at[0], item.at[2]), list = c.grid.get(key);
  if (!list) return;
  const k = list.findIndex(q => q.x === item.at[0] && q.z === item.at[2]);
  if (k >= 0) list.splice(k, 1);
}

/** Records a group (≥ min items) or drops it. `committed`: its items are already in the grid (removed again when dropped). */
function addGroup(c: Ctx, kind: PlantingKind, st: CorridorStation, side: SideName | 'median', items: PlantItem[], min: number, committed = false): boolean {
  if (items.length < min) { if (committed) for (const it of items) uncommit(c, it); return false; }
  if (!committed) for (const it of items) commit(c, it);
  const n = c.counts.get(kind) ?? 0; c.counts.set(kind, n + 1);
  c.groups.push({ id: `${c.A.id}.plant.${kind}.${n}`, kind, reachId: st.reachId, side, items });
  c.groupS.push(st.s);
  return true;
}

/** Tries candidates in order and keeps the ones that fit (and fit each other), up to `max`. */
function gather(c: Ctx, cands: readonly Cand[], max: number): PlantItem[] {
  const out: PlantItem[] = [], local: Placed[] = [];
  for (const k of cands) {
    if (out.length >= max) break;
    const it = fits(c, k); if (!it) continue;
    const form = PLANT_FORM[it.species], r = canopyOf(it.species, it.scale) * (form.tree ? PLANT.crownPack : PLANT.lowPack);
    if (local.some(q => Math.hypot(it.at[0] - q.x, it.at[2] - q.z) < r + q.r)) continue;
    local.push({ x: it.at[0], z: it.at[2], r }); out.push(it);
  }
  return out;
}

/** Offset of a band's usable start for an item of this canopy (the nearer of band inner and the setback line). */
function inner(st: CorridorStation, side: SideName, species: PlantSpecies, scale: number): number | null {
  const sd = st[side]; if (!sd.planting) return null;
  const lat = canopyOf(species, scale);
  let o = Math.max(sd.planting.inner, sd.paved + CORRIDOR.plantingSetback + lat + 0.05);
  if (sd.footway && PLANT_FORM[species].base * scale < PLANT.footwayHeadroom) o = Math.max(o, sd.footway.outer + lat + 0.05);
  if (PLANT_FORM[species].tree && st.context === 'mountain') o = Math.max(o, sd.paved + PLANT.mountainSetback);
  return o <= sd.planting.outer ? o : null;
}

// ─── Group recipes ────────────────────────────────────────────────────────────────────────────────────────────────────

type Rand = (i: number, k?: number) => number;

/** A cluster of `n` items around (s0, depth) on a side: a composed group, deeper items taller (trees behind shrubs). */
function cluster(c: Ctx, R: Rand, key: number, s0: number, side: SideName, spanAlong: number, depth: number,
  species: (u: number, j: number) => PlantSpecies, scale: (u: number, sp: PlantSpecies) => number, tint: (u: number, sp: PlantSpecies) => number, n: number): Cand[] {
  const F = c.A.frame, out: Cand[] = [];
  for (let j = 0; j < n * 6; j++) {
    const sp = species(R(key, j * 5), j), sc = scale(R(key, j * 5 + 1), sp), st = F.st(F.nearestIndex(s0));
    const o0 = inner(st, side, sp, sc); if (o0 === null) continue;
    const band = st[side].planting!, room = Math.max(0, Math.min(depth, band.outer - o0));
    // Low items in front (near the road), trees behind them; trees still reach the front half now and then.
    const tall = PLANT_FORM[sp].tree ? 0.15 + 0.75 * R(key, j * 5 + 2) : 0.55 * R(key, j * 5 + 2);
    const along = (R(key, j * 5 + 3) - 0.5) * spanAlong * (PLANT_FORM[sp].tree ? 1 : 1.15);
    out.push({ s: s0 + along, o: sign(side) * (o0 + room * tall), species: sp, scale: sc, tint: tint(R(key, j * 5 + 4), sp), yaw: R(key, j * 5 + 4) * 6.283 });
  }
  return out;
}

/** Maximal runs of stations satisfying `pred`. */
function runsOf(c: Ctx, pred: (st: CorridorStation) => boolean) { return c.A.frame.runs(st => pred(st)); }

/** R1 / developed: street trees in pits on the town (sidewalk) side every `spacing` eu; a new avenue group at each gap. */
function streetTrees(c: Ctx, R: Rand, pred: (st: CorridorStation) => boolean, spacing: number, species: PlantSpecies, bothSides: boolean, hedge: boolean, kind: PlantingKind) {
  const F = c.A.frame, S = c.A.stations;
  for (const run of runsOf(c, pred)) {
    const len = F.runLength(run); if (len < spacing * 1.5) continue;
    const mid = S[F.nearestIndex(F.runMid(run))]!;
    let sides: SideName[];
    if (bothSides) sides = ['left', 'right'];
    else {
      const walk = SIDES.filter(sd => mid[sd].edge === 'sidewalk');
      sides = [walk.length === 1 ? walk[0]! : landSide(mid)];
    }
    for (const side of sides) {
      let group: PlantItem[] = [], hedgeItems: PlantItem[] = [], gst = mid;
      const flush = () => {
        addGroup(c, kind, gst, side, group, 3, true);
        if (hedge) addGroup(c, 'hedgerow', gst, side, hedgeItems, 4, true);
        group = []; hedgeItems = [];
      };
      const phase = R(run.i0, side === 'left' ? 1 : 2) * spacing * 0.5;
      for (let d = spacing / 2 + phase; d < len - spacing / 4; d += spacing) {
        const s = F.wrapS(run.from + d), st = S[F.nearestIndex(s)]!;
        if (c.A.nearMouth(s, side, 4)) { flush(); continue; }
        const sc = 0.82 + 0.16 * R(Math.round(s), 3), o0 = inner(st, side, species, sc);
        if (o0 === null) continue;
        const it = fits(c, { s, o: sign(side) * o0, species, scale: sc, tint: R(Math.round(s), 4), yaw: R(Math.round(s), 5) * 6.283 });
        if (it) { if (!group.length) gst = st; group.push(it); commit(c, it); }
        if (hedge) {
          for (let h = -spacing / 2 + 1.4; h < spacing / 2 - 1.2; h += HEDGE_LENGTH * 0.9) {
            const hs = s + h, hst = S[F.nearestIndex(hs)]!, ho = inner(hst, side, 'hedge', 0.9);
            if (ho === null) continue;
            const hi = fits(c, { s: hs, o: sign(side) * Math.max(ho, o0 + canopyOf(species, sc) * 0.5), species: 'hedge', scale: 0.9, tint: R(Math.round(hs), 6) });
            if (hi) { hedgeItems.push(hi); commit(c, hi); }
          }
        }
      }
      flush();
    }
  }
}

/** A sequence of groups along a run: group length L, then an open stretch, repeating (clearings between groves). */
function groves(c: Ctx, R: Rand, tag: number, pred: (st: CorridorStation) => boolean, opt: {
  sides: (st: CorridorStation, j: number) => SideName[]; kind: PlantingKind; length: [number, number]; gapFactor: (s: number, u: number) => number | null;
  count: [number, number]; depth: number; species: (u: number, j: number, s: number) => PlantSpecies; scale: (u: number, sp: PlantSpecies) => number;
  tint?: (u: number, sp: PlantSpecies) => number; min: number; startGap?: number;
}) {
  const F = c.A.frame, S = c.A.stations;
  for (const run of runsOf(c, pred)) {
    const len = F.runLength(run);
    let d = (opt.startGap ?? 8) + R(run.i0, tag) * 10, j = 0;
    while (d < len - 6) {
      const L = lerp(opt.length[0], opt.length[1], R(run.i0 + j, tag + 1)), s0 = F.wrapS(run.from + d + L / 2), st = S[F.nearestIndex(s0)]!;
      const gf = opt.gapFactor(s0, R(run.i0 + j, tag + 2));
      if (gf === null) { d += L; j++; continue; }
      for (const side of opt.sides(st, j)) {
        const n = Math.round(lerp(opt.count[0], opt.count[1], R(run.i0 + j, tag + 3 + (side === 'left' ? 0 : 7))));
        const cands = cluster(c, R, (run.i0 + j) * 31 + tag + (side === 'left' ? 0 : 5), s0, side, L, opt.depth, (u, k) => opt.species(u, k, s0), opt.scale, opt.tint ?? ((u) => u), n);
        const items = gather(c, cands, n);
        addGroup(c, opt.kind, st, side, items, opt.min);
      }
      d += L + L * gf; j++;
    }
  }
}

/** Low drifts: rows of low items (flowerBed / grassTuft / flowering) following the verge, with gaps between. */
function drifts(c: Ctx, R: Rand, tag: number, pred: (st: CorridorStation) => boolean, opt: {
  sides: (st: CorridorStation, j: number, u: number) => SideName[]; kind: PlantingKind; length: [number, number]; gap: [number, number]; pitch: number;
  species: (u: number) => PlantSpecies; set: (u: number) => number; rows: number; min: number;
}) {
  const F = c.A.frame, S = c.A.stations;
  for (const run of runsOf(c, pred)) {
    const len = F.runLength(run);
    let d = 4 + R(run.i0, tag) * lerp(opt.gap[0], opt.gap[1], 0.5), j = 0;
    while (d < len - 4) {
      const L = lerp(opt.length[0], opt.length[1], R(run.i0 + j, tag + 1)), sMid = F.wrapS(run.from + d + L / 2), st = S[F.nearestIndex(sMid)]!;
      const set = opt.set(R(run.i0 + j, tag + 2));
      for (const side of opt.sides(st, j, R(run.i0 + j, tag + 10))) {
        const cands: Cand[] = [];
        for (let a = 0; a <= L; a += opt.pitch) for (let row = 0; row < opt.rows; row++) {
          const s = F.wrapS(run.from + d + a + (row % 2) * opt.pitch / 2), key = Math.round(s * 3) + row * 7919 + (side === 'left' ? 0 : 3571);
          const sp = opt.species(R(key, tag + 3)), sc = 0.8 + 0.3 * R(key, tag + 4), q = S[F.nearestIndex(s)]!, o0 = inner(q, side, sp, sc);
          if (o0 === null) continue;
          const o = o0 + row * 1.6 + R(key, tag + 5) * 0.5;
          cands.push({ s, o: sign(side) * o, species: sp, scale: sc, tint: sp === 'grassTuft' ? R(key, tag + 6) : flowerTint(set + (R(key, tag + 7) < 0.3 ? 1 : 0), R(key, tag + 6)), yaw: R(key, tag + 8) * 6.283 });
        }
        addGroup(c, opt.kind, st, side, gather(c, cands, 400), opt.min);
      }
      d += L + lerp(opt.gap[0], opt.gap[1], R(run.i0 + j, tag + 9)); j++;
    }
  }
}

// ─── The plan ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function planPlanting(A: Analysis, env: Env, stops: readonly { span: StopSpan; s: number }[]): PlantingGroup[] {
  const c: Ctx = { A, env, stops, grid: new Map(), groups: [], groupS: [], counts: new Map() };
  const F = A.frame, S = A.stations;
  if (!A.main) return [];
  const R = stream(env.seed, 11);
  const styleIs = (...ss: Style[]) => (st: CorridorStation) => !st.structureId && ss.includes(A.style(st));
  const ctxIs = (...cs: CorridorStation['context'][]) => (st: CorridorStation) => cs.includes(st.context);
  const and = (...ps: ((st: CorridorStation) => boolean)[]) => (st: CorridorStation) => ps.every(p => p(st));
  const not = (p: (st: CorridorStation) => boolean) => (st: CorridorStation) => !p(st);
  const inland = (st: CorridorStation): SideName[] => { const sea = seaSide(st); return sea ? [sea === 'left' ? 'right' : 'left'] : [landSide(st)]; };
  const lowScale = (u: number, sp: PlantSpecies) => (PLANT_FORM[sp].tree ? lerp(0.8, 1.1, u) : lerp(0.75, 1.1, u));

  // R1 Harbour Gate (developed): street trees in pits on the town side, 12 apart.
  streetTrees(c, R, and(styleIs('R1'), not(ctxIs('structure'))), 12, 'round', false, false, 'avenue');
  // R13 Harbour Avenue: a maple avenue both sides every 14 + a hedge behind, then the town (developed) end keeps street trees only.
  streetTrees(c, R, and(styleIs('R13'), ctxIs('boulevard', 'open', 'coastal')), 14, 'round', true, true, 'avenue');
  streetTrees(c, R, and(styleIs('R13'), ctxIs('developed')), 12, 'round', false, false, 'avenue');
  // Developed stretches elsewhere on the main roads (fallback, e.g. R11's park frontage handled below).
  streetTrees(c, R, and(ctxIs('developed'), (st: CorridorStation) => { const s = A.style(st); return s.startsWith('ctx:') || s === 'VG' || s === 'V03'; }), 12, 'round', false, false, 'avenue');

  // R3 / R8 / mountain: only a few framing groups, inland, set back ≥ 6 (fits enforces the setback).
  groves(c, R, 100, and(styleIs('R3', 'R8', 'V03', 'ctx:mountain'), not(ctxIs('structure', 'developed'))), {
    sides: inland, kind: 'framingTrees', length: [12, 18], gapFactor: (_s, u) => 7 + u * 5, count: [4, 7], depth: 9, min: 3, startGap: 30,
    species: (u) => pick([['pine', 6], ['birch', 1], ['heath', 3]] as const, u), scale: lowScale,
  });

  // R4 Crown Coast: wind-bent pine + heath inland only, 5–9 per group, groups ≥ 1.5 × their length apart; the sea side open.
  groves(c, R, 200, and(styleIs('R4', 'ctx:coastal'), ctxIs('coastal', 'open')), {
    sides: inland, kind: 'framingTrees', length: [12, 20], gapFactor: (_s, u) => 1.5 + u * 1.5, count: [5, 9], depth: 16, min: 4,
    species: (u, j) => (j % 3 === 2 ? 'heath' : pick([['pine', 7], ['heath', 4]] as const, u)), scale: lowScale,
  });

  // R5 → R6: woodland groves both sides closing into a wooded section, then thinning out through R6 so the west sea
  // opens ahead (the reveal). The density follows the position u along R5 ∪ R6: dense until 0.62, thinning to 0.85,
  // open after. Where the Crest runs on its causeway (ground far below the road) the groves simply do not take: the
  // `hidden` and slope rules keep trees off the batters.
  const r56 = S.filter(st => A.style(st) === 'R5' || A.style(st) === 'R6');
  if (r56.length > 2) {
    const a0 = r56[0]!.s, total = Math.max(1, F.delta(a0, r56[r56.length - 1]!.s) < 0 ? F.length + F.delta(a0, r56[r56.length - 1]!.s) : F.delta(a0, r56[r56.length - 1]!.s));
    const u = (s: number) => { let d = F.delta(a0, s); if (d < 0) d += F.length; return d / total; };
    groves(c, R, 300, and(styleIs('R5', 'R6'), not(ctxIs('developed', 'structure'))), {
      sides: (st, j) => (u(st.s) > 0.62 ? (seaSide(st) ? inland(st) : [j % 2 ? 'left' : 'right']) : ['left', 'right']),
      kind: 'framingTrees', length: [14, 26], count: [6, 11], depth: 12, min: 4, startGap: 6,
      gapFactor: (s, w) => { const x = u(s); if (x > 0.85) return null; return (x < 0.62 ? 0.18 : lerp(0.18, 5, smooth(0.62, 0.85, x))) * (0.8 + 0.4 * w); },
      species: (w) => pick([['pine', 4], ['birch', 3], ['round', 2], ['shrub', 1]] as const, w), scale: lowScale,
    });
  }

  // R7 Flats Coast: prairie drifts (coneflower / bluestem / yarrow) with gaps; low, both sides.
  drifts(c, R, 400, styleIs('R7'), {
    // Drifts alternate across the road (now and then facing each other), never a mirrored pair of ribbons.
    sides: (_st, j, u) => (u < 0.25 ? ['left', 'right'] : [j % 2 ? 'left' : 'right']), kind: 'flowerBed', length: [10, 24], gap: [16, 40], pitch: 2.2, rows: 2, min: 4,
    species: u => pick([['flowerBed', 3], ['grassTuft', 4], ['flowering', 2]] as const, u), set: u => 3 + Math.floor(u * 3),
  });

  // R10 Long Sands Boulevard: palm groves (3–7, varied heights) + flower-bed runs on the verges; the median planted.
  groves(c, R, 500, and(styleIs('R10'), not(ctxIs('developed'))), {
    sides: (_st, j) => [j % 2 ? 'left' : 'right'], kind: 'palmGrove', length: [10, 16], gapFactor: (_s, u) => 2.2 + u * 1.8, count: [3, 7], depth: 7, min: 3,
    species: () => 'palm', scale: (u) => lerp(0.75, 1.3, u),
  });
  drifts(c, R, 600, and(styleIs('R10'), ctxIs('boulevard')), {
    // Formal pairs either side of the planted median; staggered across the road elsewhere.
    sides: (st, j, u) => (st.median || u < 0.2 ? ['left', 'right'] : [j % 2 ? 'left' : 'right']), kind: 'flowerBed', length: [12, 22], gap: [18, 34], pitch: 2.6, rows: 1, min: 4,
    species: u => pick([['flowerBed', 6], ['grassTuft', 1]] as const, u), set: u => Math.floor(u * 3),
  });
  // The planted median: flower beds down its centre, shrubs where it is wide enough; nothing over 0.6 near its noses.
  for (const run of F.runs(st => !!st.median)) {
    const len = F.runLength(run), items: PlantItem[] = [], st0 = S[F.nearestIndex(F.runMid(run))]!;
    for (let d = 3; d < len - 3; d += 2.8) {
      const s = F.wrapS(run.from + d), key = Math.round(s * 3), shrub = R(key, 700) < 0.25 && (S[F.nearestIndex(s)]!.median?.half ?? 0) >= 1.3;
      const it = fits(c, { s, o: 0, median: true, species: shrub ? 'shrub' : 'flowerBed', scale: shrub ? 0.8 : lerp(0.75, 0.95, R(key, 701)), tint: shrub ? R(key, 702) : flowerTint(Math.floor(R(key, 703) * 3), R(key, 704)), yaw: R(key, 705) * 6.283 });
      if (it) { items.push(it); commit(c, it); }
    }
    addGroup(c, 'median', st0, 'median', items, 3, true);
  }

  // R11 Tideline: low beds by the park (the developed stations at Tideline Park, which lies at the R10/R11 seam);
  // a small palm grove on the park side; then open to the water toward the campfire.
  drifts(c, R, 800, and(styleIs('R10', 'R11'), ctxIs('developed')), {
    sides: st => [landSide(st)], kind: 'flowerBed', length: [8, 14], gap: [10, 20], pitch: 2.6, rows: 1, min: 3,
    species: () => 'flowerBed', set: u => Math.floor(u * 3),
  });
  groves(c, R, 850, and(styleIs('R10', 'R11'), ctxIs('developed')), {
    sides: st => [landSide(st)], kind: 'palmGrove', length: [10, 14], gapFactor: () => 6, count: [3, 4], depth: 6, min: 3, startGap: 20,
    species: () => 'palm', scale: (u) => lerp(0.8, 1.2, u),
  });

  // VG Green Road: low flower verges inside the Green's protected centre; sparse framing groups outside it.
  const inLow = (st: CorridorStation) => env.lowZones.some(zn => Math.hypot(st.at[0] - zn.centre[0], st.at[2] - zn.centre[1]) < zn.radius + 12);
  drifts(c, R, 900, and(styleIs('VG'), inLow), {
    sides: (_st, j, u) => (u < 0.35 ? ['left', 'right'] : [j % 2 ? 'left' : 'right']), kind: 'flowerBed', length: [10, 20], gap: [14, 30], pitch: 2.4, rows: 1, min: 4,
    species: u => pick([['flowerBed', 3], ['grassTuft', 2]] as const, u), set: u => [0, 2, 5][Math.floor(u * 3)]!,
  });
  groves(c, R, 950, and(styleIs('VG', 'ctx:open'), not(inLow), ctxIs('open', 'coastal')), {
    sides: (_st, j) => [j % 2 ? 'left' : 'right'], kind: 'framingTrees', length: [12, 18], gapFactor: (_s, u) => 5 + u * 4, count: [5, 8], depth: 10, min: 4,
    species: (u) => pick([['round', 3], ['birch', 3], ['pine', 1], ['shrub', 2]] as const, u), scale: lowScale,
  });
  // Boulevard fallback on other main roads: planted verges.
  drifts(c, R, 1000, styleIs('ctx:boulevard'), {
    sides: () => ['left', 'right'], kind: 'flowerBed', length: [12, 22], gap: [18, 34], pitch: 2.6, rows: 1, min: 4,
    species: () => 'flowerBed', set: u => Math.floor(u * 6),
  });

  // Order along the road by each group's recorded station, then id (stable across runs).
  return c.groups.map((g, k) => ({ g, s: c.groupS[k]! })).sort((a, b) => a.s - b.s || a.g.id.localeCompare(b.g.id)).map(x => x.g);
}
