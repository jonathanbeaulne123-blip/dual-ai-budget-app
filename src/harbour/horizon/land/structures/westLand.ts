import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { BedCut, HeightQuery, LandCuts, StructureSolid, XY, XYZ } from '../interfaces';
import { addFlatPad, bed } from '../beds/profiles';
import { bightBatterAt, bightGreenwayDistance, bightPlotFrames, bightPlotToWorld } from '../terrain/bightBatter';
import { FOOTING_SINK, pier } from './foundations';
import { box, clamp, distance, districtAt, mitredSlab, mix, nearestOnPath, plan, slab, solid } from './mesh';
import { OPEN_RAIL, OPEN_RAIL_KIND, openRail } from './openRail';

/**
 * The Water's Way · PR 2 land, builder L3 (D-WW80…89): Scholars' Edge, the Flats and the Bight's land. Every number is read from
 * MANIFEST (docs/horizon/make_manifest_ww_west.py): the Bight lookout's ramp and deck, the courtyard terrace's battered pads, the
 * stargazing pad and deck, the Wash Arch over S2 with its clearance contract, the hoodoo footings, and the Bight Shore batter's
 * report (the batter itself is terrain's: land/terrain/bightBatter.ts). Dressing (buildings, plants, props, lights) is PR 3/4's.
 */

const planLength = (path: readonly XYZ[]) => path.slice(1).reduce((n, p, i) => n + distance(plan(path[i]!), plan(p)), 0);
function along(path: readonly XYZ[], s: number): { p: XYZ; dir: XY } {
  let run = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!, len = distance(plan(a), plan(b)); if (len < 1e-9) continue;
    if (run + len >= s || i === path.length - 1) { const t = clamp((s - run) / len, 0, 1); return { p: [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)], dir: [(b[0] - a[0]) / len, (b[2] - a[2]) / len] }; }
    run += len;
  }
  return { p: path[0]!, dir: [1, 0] };
}
/** Open rails through the one builder and the one marker (land/structures/openRail.ts: kind OPEN_RAIL_KIND, seen through by
 * world/raycast.ts; posts ≤ 2 m, the top rail at 1.05, the guard bar at 0.65 and the kicker through the 0.2 band). */
const railSolid = (id: string, bedIds: string[], district: string): StructureSolid => solid(id, OPEN_RAIL_KIND, 'timber', 'rail', bedIds, district);
const info = (cuts: LandCuts, id: string, message: string, at: XY, measured?: number, required?: number, conflict = false) =>
  cuts.diagnostics.push({ id, severity: conflict ? 'conflict' : 'info', message, at: [Number(at[0].toFixed(2)), Number(at[1].toFixed(2))], ...(measured === undefined ? {} : { measured: Number(measured.toFixed(3)) }), ...(required === undefined ? {} : { required }) });

/* ---------------------------------------------------------------- Scholars' Edge */

/** D-WW87: the Bight lookout — a timber ramp on posts from the spur's end up to the raised deck, the deck on posts that reach the
 * ground, pulled back to the cliff lip; open rails all round except where the ramp arrives. */
export function bightLookout(cuts: LandCuts, base: HeightQuery): void {
  const S = M.structures.bightLookout as unknown as { ramp: number[][]; rampWidth_m: number; deck: { from: number[]; to: number[]; top: number }; eye: number[] };
  const spur = M.walks.bightLookout as unknown as { levels: { xy: number[]; h: number }[] };
  const foot = spur.levels.at(-1)!.h, top = S.deck.top, w = S.rampWidth_m, district = districtAt(744, 500);
  // The ramp: one grade from the spur's end to the deck's north edge (heights by arc length).
  const ctrl = S.ramp.map(p => [p[0]!, 0, p[1]!] as XYZ), total = planLength(ctrl);
  let run = 0; const ramp: XYZ[] = ctrl.map((p, i) => { if (i) run += distance(plan(ctrl[i - 1]!), plan(p)); return [p[0], mix(foot, top, run / total), p[2]]; });
  const deck = solid('bightLookout.deck', 'lookoutDeck', 'boardwalk', 'deck', ['structure.bightLookout.ramp', 'structure.bightLookout.deck'], district);
  const posts = solid('bightLookout.supports', 'pier', 'timber', 'support', ['structure.bightLookout.ramp', 'structure.bightLookout.deck'], district);
  const rails = railSolid('bightLookout.rails', ['structure.bightLookout.ramp', 'structure.bightLookout.deck'], district);
  for (let i = 1; i < ramp.length; i++) mitredSlab(deck, ramp, i, w, .35);
  // Ramp posts every ≤ 3 eu under both edges, each to the ground (pier: shaft + footing, settled to the final ground).
  const n = Math.max(1, Math.ceil(total / 3));
  for (let k = 1; k <= n; k++) { const { p, dir } = along(ramp, total * k / n); for (const side of [-1, 1]) pier(posts, [p[0] - dir[1] * side * (w / 2 - .25), p[2] + dir[0] * side * (w / 2 - .25)], p[1] - .35, base, [.25, .25], [.7, .7]); }
  for (const side of [-1, 1]) openRail(rails, ramp, side * (w / 2 - .05));
  // The deck: a slab at `top`, six posts to the ground (the south row stands on the lip, none over the cliff face).
  const [x0, z0] = S.deck.from as [number, number], [x1, z1] = S.deck.to as [number, number], c: XY = [(x0 + x1) / 2, (z0 + z1) / 2];
  box(deck, c, top, [x1 - x0, z1 - z0], top - .35);
  let deepest = 0;
  for (const x of [x0 + .3, c[0], x1 - .3]) for (const z of [z0 + .3, z1 - .3]) { const r = pier(posts, [x, z], top - .35, base, [.3, .3], [.8, .8]); deepest = Math.max(deepest, r.height); }
  const P = (x: number, z: number): XYZ => [x, top, z], ex = ramp.at(-1)!;
  openRail(rails, [P(x1, z0), P(x1, z1)], .05); openRail(rails, [P(x1, z1), P(x0, z1)], .05); openRail(rails, [P(x0, z1), P(x0, z0)], .05);
  openRail(rails, [P(x0, z0), P(ex[0] - w / 2, z0)], -.05); openRail(rails, [P(ex[0] + w / 2, z0), P(x1, z0)], -.05);
  cuts.solids.push(deck, posts, rails);
  // The ramp's and the deck's beds are the structure's own (no bed deck or edge is emitted for a `structure.` bed: the slab and the
  // open rails above are the drawing). No `structureIds`: they cross no lower route, so the ground under them is not capped as an
  // open span's (that cap, deck − 0.65, would lower the spur's last metres under the ramp's foot and leave a wall at the handover).
  const rb = bed('structure.bightLookout.ramp', 'walk', ramp, false); rb.width = w; rb.maxGrade = .07; cuts.beds.push(rb);
  const db = bed('structure.bightLookout.deck', 'walk', [P(c[0], z0), P(c[0], S.eye[1]!)], false); db.width = x1 - x0; cuts.beds.push(db);
  const grade = (top - foot) / total, lip = base(c[0], z1);
  info(cuts, 'structures.bightLookout.ramp', `bightLookout: the ramp climbs ${(top - foot).toFixed(2)} eu over ${total.toFixed(1)} eu at ${(grade * 100).toFixed(2)} % to the deck at ${top} (eye ${top + 1.6}); open rails ${OPEN_RAIL.height}`, plan(ramp[0]!), grade, .07, grade > .07 + 1e-9);
  info(cuts, 'structures.bightLookout.deck', `bightLookout: deck ${(x1 - x0)} × ${(z1 - z0)} at ${top}, its south edge on the lip (ground ${lip.toFixed(2)}); six posts reach the ground, the tallest ${deepest.toFixed(2)} eu`, c, deepest);
}

/** D-WW88: courtyard B's terrace — three battered pads level with the Library (48), joined to its gable and its apron. */
export function scholarsTerrace(cuts: LandCuts): void {
  const T = M.structures.scholarsTerrace as unknown as { h: number; batter: number; pads: Record<string, { xy: number[]; size_m: number[]; rot_deg: number }> };
  for (const [k, p] of Object.entries(T.pads)) { const pad = addFlatPad(cuts, `scholarsTerrace.${k}`, 'landing', p.xy as unknown as XY, T.h, p.size_m as unknown as XY, p.rot_deg); pad.batter = T.batter; pad.blend = 6; }
}

/* ---------------------------------------------------------------- the Flats */

/** D-WW84: the stargazing pad in the dark tip, its low timber deck and the observatory's pad. */
export function stargazing(cuts: LandCuts): void {
  const S = M.structures.stargazing as unknown as { xy: number[]; h: number; size_m: number[]; deck: { xy: number[]; size_m: number[]; top: number }; observatory: { xy: number[]; size_m: number[]; top: number } };
  addFlatPad(cuts, 'stargazing', 'place', S.xy as unknown as XY, S.h, S.size_m as unknown as XY);
  const deck = solid('stargazing.deck', 'lookoutDeck', 'boardwalk', 'deck', ['walk stargazing'], 'flats'); box(deck, S.deck.xy as unknown as XY, S.deck.top, S.deck.size_m as unknown as XY, S.h - .05);
  const obs = solid('stargazing.observatory', 'pad', 'stone', 'floor', ['walk stargazing'], 'flats'); box(obs, S.observatory.xy as unknown as XY, S.observatory.top, S.observatory.size_m as unknown as XY, S.h - .05);
  cuts.solids.push(deck, obs);
}

/** The strip frame (MANIFEST structures.strip): s along from the north threshold, o offset (+ east). */
export function stripLocal(x: number, z: number): { s: number; o: number; length: number } {
  const st = M.structures.strip, a = st.from as unknown as XY, b = st.to as unknown as XY, L = distance(a, b), u: XY = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], dx = x - a[0], dz = z - a[1];
  return { s: dx * u[0] + dz * u[1], o: dx * u[1] - dz * u[0], length: L };
}
/** D-WW81: an obstacle taller than 1 m at (x, z) with plan half-extent `r` breaks the strip's clearance contract (approach box or side). */
export function stripClearanceBreach(x: number, z: number, r = 0): string | null {
  const c = (M.structures.strip as unknown as { clearances: { approach: { halfWidth_m: number; length_m: number }; side: { fromCentreline_m: number } } }).clearances, { s, o, length } = stripLocal(x, z);
  const inApproach = (s > -c.approach.length_m - r && s < r) || (s > length - r && s < length + c.approach.length_m + r);
  if (inApproach && Math.abs(o) - r < c.approach.halfWidth_m) return `approach box (|o| ${(Math.abs(o) - r).toFixed(2)} < ${c.approach.halfWidth_m})`;
  if (s >= -r && s <= length + r && Math.abs(o) - r < c.side.fromCentreline_m) return `side (|o| ${(Math.abs(o) - r).toFixed(2)} < ${c.side.fromCentreline_m})`;
  return null;
}
function bedEdgeDistance(cuts: LandCuts, xy: XY, skip: (b: BedCut) => boolean = () => false): { d: number; id: string } {
  let best = { d: Infinity, id: '' };
  for (const b of cuts.beds) { if (['cable', 'cave'].includes(b.kind) || skip(b) || b.points.length < 2) continue; const n = nearestOnPath(xy, b.points), d = n.distance - b.width / 2 - b.shoulder; if (d < best.d) best = { d, id: b.id }; }
  return best;
}

/** D-WW85: the Wash Arch over S2 (two leaning drum stacks and a lintel), its clearance a contract, and the hoodoo footings. */
export function washArch(cuts: LandCuts, base: HeightQuery): void {
  const A = M.structures.washArch as unknown as { at: number[]; legOffset_m: number; legRadius_m: number[]; lean_m: number; lintel: { underside: number; thickness_m: number; width_m: number }; clear_eu: number };
  const s2 = cuts.beds.find(b => b.id === 'S2'); if (!s2) return;
  const at = A.at as unknown as XY, near = nearestOnPath(at, s2.points), a = s2.points[near.segment]!, b = s2.points[Math.min(s2.points.length - 1, near.segment + 1)]!, l = distance(plan(a), plan(b)) || 1;
  const u: XY = [(b[0] - a[0]) / l, (b[2] - a[2]) / l], nrm: XY = [u[1], -u[0]], centre: XY = plan(near.at), district = districtAt(...centre);
  const legs = solid('washArch.legs', 'rockArch', 'ochre', 'support', ['S2'], district), lintel = solid('washArch.lintel', 'rockArch', 'ochre', 'wall', ['S2'], district);
  const tops: XY[] = [];
  for (const side of [-1, 1]) {
    const foot: XY = [centre[0] + nrm[0] * side * A.legOffset_m, centre[1] + nrm[1] * side * A.legOffset_m], r0 = A.legRadius_m[0]!;
    const low = Math.min(...[[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => base(foot[0] + i! * r0, foot[1] + j! * r0)));
    const count = A.legRadius_m.length, drum = (A.lintel.underside + .3 - low) / count;
    A.legRadius_m.forEach((r, i) => {
      const inward = A.lean_m * i, c: XY = [foot[0] - nrm[0] * side * inward, foot[1] - nrm[1] * side * inward];
      box(legs, c, low + drum * (i + 1), [2 * r * .9, 2 * r * .9], i === 0 ? low - FOOTING_SINK : low + drum * i - .05, 22.5 * i);
      if (i === count - 1) tops.push(c);
    });
  }
  // The lintel: from leg top to leg top and one top radius past each, along the arch's axis (square to S2).
  const rTop = A.legRadius_m.at(-1)!, [w0, e0] = tops as [XY, XY], d = distance(w0, e0), k = rTop / d;
  const w: XY = [w0[0] - (e0[0] - w0[0]) * k, w0[1] - (e0[1] - w0[1]) * k], e: XY = [e0[0] + (e0[0] - w0[0]) * k, e0[1] + (e0[1] - w0[1]) * k], topY = A.lintel.underside + A.lintel.thickness_m;
  slab(lintel, [w[0], topY, w[1]], [e[0], topY, e[1]], A.lintel.width_m, A.lintel.thickness_m);
  cuts.solids.push(legs, lintel);
  // The contract: the lintel's underside over S2's surface within its plan footprint (S2 ± its half-width, the lintel ± half its width).
  let deckMax = -Infinity;
  for (let t = -A.lintel.width_m / 2 - .5; t <= A.lintel.width_m / 2 + .5; t += .25) for (let o = -s2.width / 2; o <= s2.width / 2; o += .5) { const q: XY = [centre[0] + u[0] * t + nrm[0] * o, centre[1] + u[1] * t + nrm[1] * o]; deckMax = Math.max(deckMax, nearestOnPath(q, s2.points).at[1]); }
  const clear = A.lintel.underside - deckMax, edge = A.legOffset_m - A.legRadius_m[0]! - s2.width / 2;
  info(cuts, 'structures.washArch.clear', `washArch: the lintel's underside (${A.lintel.underside}) clears S2's surface (${deckMax.toFixed(2)}) by ${clear.toFixed(2)} eu (rider envelope ≥ ${A.clear_eu}); its legs stand ${edge.toFixed(2)} eu off S2's edge`, centre, clear, A.clear_eu, clear < A.clear_eu);
  for (const side of [-1, 1]) { const f: XY = [centre[0] + nrm[0] * side * A.legOffset_m, centre[1] + nrm[1] * side * A.legOffset_m], breach = stripClearanceBreach(f[0], f[1], A.legRadius_m[0]!); if (breach) info(cuts, 'structures.washArch.strip', `washArch: a leg stands inside the strip's ${breach}`, f, undefined, undefined, true); }
  // Hoodoo footings: low ochre plinths (the drums are dressing), each ≥ 6 eu off every bed edge (plus its own half-size).
  const H = M.structures.washHoodoos as unknown as { xy: number[][]; footing_m: number; rise_m: number };
  const foot = solid('washHoodoos.footings', 'hoodooFooting', 'ochre', 'rock', [], 'flats');
  let worst = { d: Infinity, id: '' };
  for (const p of H.xy) {
    const xy = p as unknown as XY, h = H.footing_m / 2, g = [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => base(xy[0] + i! * h, xy[1] + j! * h));
    box(foot, xy, Math.max(...g) + H.rise_m, [H.footing_m, H.footing_m], Math.min(...g) - FOOTING_SINK);
    const e = bedEdgeDistance(cuts, xy); if (e.d - h < worst.d) worst = { d: e.d - h, id: e.id };
  }
  cuts.solids.push(foot);
  info(cuts, 'structures.washHoodoos.offBeds', `washHoodoos: ${H.xy.length} footings; the nearest stands ${worst.d.toFixed(2)} eu off ${worst.id}'s edge (≥ 6)`, H.xy[0] as unknown as XY, worst.d, 6, worst.d < 6);
}

/* ---------------------------------------------------------------- the Bight */

/** D-WW89: the Bight Shore batter's report — per plot, along its faces that fall to the lagoon: the run the keep-off leaves, how
 * much of the face is one batter, the wall left above the batter (before → after), and the batter's nearest approach to the
 * Greenway line (≥ 6). The batter itself is the terrain's (bightBatterAt); this reads the same function. */
export interface BightBatterReport { plot: string; faceSamples: number; fullShare: number; wallBefore: number; wallAfter: number; minRun: number; maxRun: number; greenwayMin: number }
export function bightBatterReport(cuts: Pick<LandCuts, 'pads'>, base: HeightQuery): BightBatterReport[] {
  const out: BightBatterReport[] = [];
  for (const f of bightPlotFrames(cuts.pads)) {
    let samples = 0, full = 0, before = 0, after = 0, minRun = Infinity, maxRun = 0;
    for (const [lx0, lz0, nx, nz, span] of [[-f.a, 0, -1, 0, f.b], [f.a, 0, 1, 0, f.b], [0, -f.b, 0, -1, f.a], [0, f.b, 0, 1, f.a]] as const)
      for (let t = -span; t <= span; t += 1) {
        const lx = nx ? lx0 : t, lz = nz ? lz0 : t, out1 = bightPlotToWorld(f, lx + nx * 1, lz + nz * 1), ground = base(...out1);
        if (f.h - ground < 3) continue;   // a face on grade (the batter is for the faces that fall away)
        const s = bightBatterAt(cuts.pads, base, ...bightPlotToWorld(f, lx + nx * .3, lz + nz * .3)); samples++;
        before = Math.max(before, f.h - ground);
        if (!s) { after = Math.max(after, f.h - ground); continue; }
        if (s.full) full++; after = Math.max(after, f.h - s.crestFill); minRun = Math.min(minRun, s.run); maxRun = Math.max(maxRun, s.run);
      }
    // The batter's nearest approach to the Greenway line: every 1 eu over the plot's surroundings where it raises the ground.
    let gmin = Infinity;
    const reach = Math.max(f.a, f.b) + 46;
    for (let x = f.centre[0] - reach; x <= f.centre[0] + reach; x += 1) for (let z = f.centre[1] - reach; z <= f.centre[1] + reach; z += 1) {
      const s = bightBatterAt(cuts.pads, base, x, z); if (!s || s.d <= 0 || s.fill <= base(x, z) + .05) continue;
      gmin = Math.min(gmin, bightGreenwayDistance(cuts.pads, [x, z]));
    }
    out.push({ plot: f.id, faceSamples: samples, fullShare: samples ? full / samples : 1, wallBefore: before, wallAfter: after, minRun: Number.isFinite(minRun) ? minRun : 0, maxRun, greenwayMin: gmin });
  }
  return out;
}
export function bightShoreBatter(cuts: LandCuts, base: HeightQuery): void {
  for (const r of bightBatterReport(cuts, base)) {
    const f = bightPlotFrames(cuts.pads).find(p => p.id === r.plot)!;
    info(cuts, `structures.bightShore.batter.${r.plot}`, `${r.plot}: lagoon faces battered 1 : 1.5 over ${r.faceSamples} m of crest (${(r.fullShare * 100).toFixed(0)} % one batter to the natural ground; runs ${r.minRun.toFixed(1)}–${r.maxRun.toFixed(1)} eu before the Greenway keep-off); the retaining wall above the batter ${r.wallBefore.toFixed(1)} → ${r.wallAfter.toFixed(1)} eu; the batter comes ${r.greenwayMin.toFixed(2)} eu from the Greenway line (≥ 6)`, f.centre, r.greenwayMin, 6, r.greenwayMin < 6);
  }
}

/** All of L3's land, in build order (structures stage, after the beds, reserves and spans). */
export function buildWestLand(cuts: LandCuts, base: HeightQuery): void {
  bightLookout(cuts, base);
  scholarsTerrace(cuts);
  stargazing(cuts);
  washArch(cuts, base);
  bightShoreBatter(cuts, base);
}
