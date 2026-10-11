import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { addFlatPad, bed } from '../beds/profiles';
import { sampleSpline } from '../beds/solver';
import { GLASSHOUSE_RAMP, GLASSHOUSE_STAIR, glasshouseRampPlan, glasshouseStairFlights, glasshouseStairLine } from '../terrain/glasshouseScarp';
import { buildStair, laneGuard } from './build';
import { FOOTING_SINK } from './foundations';
import { box, distance, plan, prism, slab, solid } from './mesh';
import { OPEN_RAIL_KIND, openRail, openRailLoop } from './openRail';

/**
 * The Water's Way, PR 2 land, L2b (docs/horizon/DECISIONS.md D-WW70…79): Long Sands' pier and skate bowl, and the Glasshouse
 * stair-and-ramp down the Green's north scarp. Land only (decks, piles, rails, ramps, stairs, landings, the bowl's shell):
 * the pier lamps, the arch, the shack and the wheel are PR 3/4 dressing standing on what is built here.
 * Numbers: MANIFEST structures.longSandsPier / tidelineBowl (make_manifest.py) and land/terrain/glasshouseScarp.ts.
 */
type PierSpec = { axis_x: number; from_z: number; ramp_to_z: number; slab_h: number; deck_h: number; deck_thick: number; width_m: number; to_z: number; platform: { x: [number, number]; z: [number, number]; h: number }; rail_h: number; pileSpacing: number; pileFrom: number; headroom_min: number; ferryMargin_min: number; wheel: { hub: [number, number, number]; r: number; footing: [number, number][]; planReach: number } };
type BowlSpec = { xy: [number, number]; rim_h: number; floor_h: number; floor_r: number; lip_r: number; coping_r: number; mask: [[number, number], [number, number]]; base_h: number };
export const pierSpec = (): PierSpec => (M.structures as unknown as Record<string, PierSpec>).longSandsPier!;
export const bowlSpec = (): BowlSpec => (M.structures as unknown as Record<string, BowlSpec>).tidelineBowl!;


/** Plan distance from a point to a polyline (and the polyline's z there). */
function polylineDistance(p: XY, line: readonly XY[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) { const a = line[i - 1]!, b = line[i]!, dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1))); best = Math.min(best, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t)); }
  return best;
}
/** The ferry's own line (the runtime's polyline, world/build.ts) and the bake's sampled spline (structures' hull check): the
 * pier is held clear of both. */
export function ferryLines(): XY[][] { const pts = M.water_routes.FERRY.pts as unknown as XY[]; return [pts, sampleSpline(pts, 1)]; }

export function buildLongSandsPier(cuts: LandCuts, base: HeightQuery): void {
  const P = pierSpec(), x = P.axis_x, w = P.width_m, h = P.deck_h, district = 'landing', own = ['structure.longSandsPier'];
  const deck = solid('longSandsPier.deck', 'pier', 'boardwalk', 'deck', ['longSandsPier'], district);
  const piles = solid('longSandsPier.piles', 'pile', 'timber', 'support', ['longSandsPier'], district);
  const rails = solid('longSandsPier.rails', OPEN_RAIL_KIND, 'metal', 'rail', ['longSandsPier'], district);
  // The ramp (RULINGS 9: ≤ 5 %): from the Tideline slab (slab_h at from_z) up to the deck (deck_h at ramp_to_z); its underside
  // runs into the slab, so its foot is flush with the park's paving.
  const r0: XYZ = [x, P.slab_h, P.from_z], r1: XYZ = [x, h, P.ramp_to_z], d1: XYZ = [x, h, P.platform.z[0]];
  slab(deck, r0, r1, w, P.deck_thick); slab(deck, r1, d1, w, P.deck_thick);
  const [px0, px1] = P.platform.x, [pz0, pz1] = P.platform.z, pc: XY = [(px0 + px1) / 2, (pz0 + pz1) / 2];
  box(deck, pc, P.platform.h, [px1 - px0, pz1 - pz0], P.platform.h - P.deck_thick);
  // Piles every pileSpacing from pileFrom under both deck edges, and a grid under the platform; none in a lower route's
  // corridor (the dune trail passes under the deck) or a boat lane (laneGuard).
  const guard = laneGuard(cuts), pile = (xy: XY): boolean => { if (guard(xy, h - P.deck_thick, own)) return false; box(piles, xy, h - P.deck_thick, [.7, .7], Math.min(base(...xy), -1) - FOOTING_SINK); return true; };
  let skipped = 0;
  for (let z = P.pileFrom; z < pz0 - 1; z += P.pileSpacing) for (const o of [-(w / 2 - .8), w / 2 - .8]) if (!pile([x + o, z])) skipped++;
  for (let z = pz0 + 3; z <= pz1 - 2.9; z += 12) for (let px = px0 + 2; px <= px1 - 1.9; px += 15) pile([px, z]);
  // Open rails (posts + bars, 1.05): both deck edges from the slab's edge, where the deck first stands over the sand, to the
  // platform; round the platform, open where the deck comes on.
  const slabEdge = M.skate.park.xy[1]! + M.skate.park.size[1]! / 2, railFrom = Math.max(slabEdge, P.from_z);
  const deckZ = (z: number) => z <= P.ramp_to_z ? P.slab_h + (h - P.slab_h) * (z - P.from_z) / (P.ramp_to_z - P.from_z) : h;
  for (const side of [-1, 1]) openRail(rails, [[x, deckZ(railFrom), railFrom], [x, h, P.ramp_to_z], [x, h, pz0]], side * (w / 2 - .05), { height: P.rail_h });
  const c = (px: number, pz: number): XYZ => [px, h, pz];
  // Round the platform corner to corner (a post on every corner), open where the deck comes on.
  openRailLoop(rails, [c(x - w / 2, pz0 + .05), c(px0 + .05, pz0 + .05), c(px0 + .05, pz1 - .05), c(px1 - .05, pz1 - .05), c(px1 - .05, pz0 + .05), c(x + w / 2, pz0 + .05)], false, { height: P.rail_h });
  cuts.solids.push(deck, piles, rails);
  // One bed for the walk out (structure.* : the deck above is its surface; no second bed deck is emitted).
  const b = bed('structure.longSandsPier', 'boardwalk', [r0, r1, d1, [pc[0], h, pc[1]]], false); b.width = w; b.structureIds = ['longSandsPier']; b.maxGrade = .05; cuts.beds.push(b);
  // Clearances (contracts with tests, test/horizonLandWWSouth): the dune trail under the deck; the ferry hull; the wheel's
  // footing level on the platform; the glider's approach to the sands field.
  const trail = cuts.beds.find(q => q.id === 'walk dune');
  if (trail) {
    let worst = Infinity, at: XY = [x, 0];
    for (let i = 1; i < trail.points.length; i++) {
      const a = trail.points[i - 1]!, q = trail.points[i]!;
      if ((a[0] - x) * (q[0] - x) > 0) continue;
      const t = (x - a[0]) / (q[0] - a[0] || 1), zz = a[2] + (q[2] - a[2]) * t, yy = a[1] + (q[1] - a[1]) * t;
      if (zz < P.from_z || zz > pz1) continue;
      const head = deckZ(zz) - P.deck_thick - yy; if (head < worst) { worst = head; at = [x, zz]; }
    }
    cuts.diagnostics.push({ id: 'structures.longSandsPier.duneHeadroom', severity: worst < P.headroom_min ? 'conflict' : 'info', message: `longSandsPier: the deck's underside stands ${worst.toFixed(2)} eu over the dune trail where it passes under the pier (walk headroom ${P.headroom_min})`, at, measured: worst, required: P.headroom_min });
  }
  // Ferry: the nearest plan approach of the pier's footprint (deck, platform and the wheel's swept plan) to either ferry line,
  // less half the hull's beam.
  const beam = (M.water_routes.FERRY as unknown as { beam_m?: number }).beam_m ?? 8, foot: XY[] = [[px0, pz0], [px1, pz0], [px1, pz1], [px0, pz1], [x - w / 2, P.from_z], [x + w / 2, P.from_z]];
  // The wheel's swept plan: its vertical plane (facing NE) projects to the segment hub ± u·planReach (u = NW–SE), ±1.5 across.
  const hub = P.wheel.hub, reach = P.wheel.planReach, u: XY = [Math.SQRT1_2, Math.SQRT1_2], n: XY = [Math.SQRT1_2, -Math.SQRT1_2];
  for (const s of [-1, 0, 1]) for (const o of [-1.5, 1.5]) foot.push([hub[0] + u[0] * s * reach + n[0] * o, hub[2] + u[1] * s * reach + n[1] * o]);
  let ferry = Infinity, fAt: XY = [x, pz1];
  for (const line of ferryLines()) for (const p of foot) { const d = polylineDistance(p, line) - beam / 2; if (d < ferry) { ferry = d; fAt = p; } }
  // A point inside the footprint on the far side of the line would be a crossing: the line's z at the pier axis must lie south.
  cuts.diagnostics.push({ id: 'structures.longSandsPier.ferryHull', severity: ferry < P.ferryMargin_min ? 'conflict' : 'info', message: `longSandsPier: an ${beam} m ferry hull on the FERRY line passes ${ferry.toFixed(2)} eu clear of the pier, its platform and the wheel's swept plan (required ${P.ferryMargin_min})`, at: [Number(fAt[0].toFixed(2)), Number(fAt[1].toFixed(2))], measured: ferry, required: P.ferryMargin_min });
  const level = P.wheel.footing.every(f => f[0] >= px0 + .5 && f[0] <= px1 - .5 && f[1] >= pz0 + .5 && f[1] <= pz1 - .5);
  cuts.diagnostics.push({ id: 'structures.longSandsPier.wheelFooting', severity: level ? 'info' : 'conflict', message: `longSandsPier: the wheel's A-frame feet [${P.wheel.footing.map(f => f.join(',')).join('] [')}] ${level ? 'stand on' : 'leave'} the level platform (x ${px0}–${px1}, z ${pz0}–${pz1}, deck ${P.platform.h})`, at: [hub[0], hub[2]], measured: level ? 1 : 0, required: 1 });
  glideApproach(cuts);
  if (skipped) cuts.diagnostics.push({ id: 'structures.longSandsPier.pilesOmitted', severity: 'info', message: `longSandsPier: ${skipped} deck piles omitted (they would stand in a lower route's corridor: the dune trail under the deck); the deck spans that bay`, measured: skipped });
}
/** The glider's approach to sky.landings.sands: every straight launch → field line and the field's own circle keep the
 * wheel's swept plan (hub ± planReach) at least `clear` away, or pass over its top (32.6) with `overTop` to spare at the
 * trim glide from the launch height. */
export function glideApproach(cuts?: LandCuts): { plan: number; field: number; worstLaunch: string } {
  const P = pierSpec(), hub: XY = [P.wheel.hub[0], P.wheel.hub[2]], top = P.wheel.hub[1] + P.wheel.r, field = M.sky.landings.sands as unknown as { xy: XY; r: number };
  const launches = Object.entries(M.sky.launches).filter(([, l]) => typeof l === 'object') as unknown as [string, { xy: XY; h: number }][];
  let plan = Infinity, worstLaunch = '';
  for (const [id, l] of launches) { const d = polylineDistance(hub, [l.xy, field.xy]) - P.wheel.planReach; if (d < plan) { plan = d; worstLaunch = id; } }
  const toField = distance(hub, field.xy) - field.r - P.wheel.planReach;
  cuts?.diagnostics.push({ id: 'structures.longSandsPier.glideApproach', severity: Math.min(plan, toField) < 30 ? 'conflict' : 'info', message: `longSandsPier: the wheel (top ${top}) stands ${plan.toFixed(1)} eu off the nearest straight launch → Long Sands line (${worstLaunch}) and ${toField.toFixed(1)} eu outside the sands field's ${field.r} m circle`, at: hub, measured: Math.min(plan, toField), required: 30 });
  return { plan, field: toField, worstLaunch };
}

/** The bowl's surface height at plan radius r (a flat floor, a parabolic transition to the lip, the coping and apron level). */
export function bowlSurface(r: number): number {
  const B = bowlSpec();
  if (r <= B.floor_r) return B.floor_h;
  if (r <= B.lip_r) { const u = (r - B.floor_r) / (B.lip_r - B.floor_r); return B.floor_h + (B.rim_h - B.floor_h) * u * u; }
  return B.rim_h;
}
/** RULINGS 9: the skate bowl beside the Tideline park (never on its slab): a sunken concrete bowl in a level apron at the park's
 * level. The apron's square is the terrain's own hole (a mouth mask on the 5 eu lattice: no ground triangle inside it), so the
 * shell is the floor there; a pad levels the ground round it to the rim and banks it down to the beach. PR 5 rides it. */
export function buildTidelineBowl(cuts: LandCuts): void {
  const B = bowlSpec(), [cx, cz] = B.xy, [[mx0, mz0], [mx1, mz1]] = B.mask, district = 'landing';
  cuts.mouths.push({ id: 'tidelineBowl', kind: 'bowl', floor: B.base_h, ceiling: B.rim_h, outline: [[mx0, mz0], [mx0, mz1], [mx1, mz1], [mx1, mz0]] });
  const pad = addFlatPad(cuts, 'tidelineBowl.apron', 'place', [(mx0 + mx1) / 2, (mz0 + mz1) / 2], B.rim_h, [mx1 - mx0, mz1 - mz0]); pad.blend = 6;
  cuts.solids = cuts.solids.filter(s => s.id !== 'tidelineBowl.apron.slab');
  // The shell: a heightfield block on a 0.75 eu grid over the bowl's square (±(coping_r + 0.5)), closed down to base_h; the rest
  // of the mask square is the apron, four level blocks at the rim.
  const shell = solid('tidelineBowl.shell', 'bowl', 'paved', 'deck', ['tidelineBowl'], district), half = B.coping_r + .5, step = (2 * half) / Math.ceil(2 * half / .75), n = Math.round(2 * half / step);
  const top = (px: number, pz: number) => bowlSurface(Math.hypot(px - cx, pz - cz));
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x0 = cx - half + i * step, z0 = cz - half + j * step, x1 = x0 + step, z1 = z0 + step;
    prism(shell, [[x0, top(x0, z0), z0], [x0, top(x0, z1), z1], [x1, top(x1, z1), z1], [x1, top(x1, z0), z0]], B.base_h);
  }
  const apron = solid('tidelineBowl.apron', 'pad', 'paved', 'deck', ['tidelineBowl'], district), bx0 = cx - half, bx1 = cx + half, bz0 = cz - half, bz1 = cz + half;
  const block = (x0: number, x1: number, z0: number, z1: number) => { if (x1 - x0 > .01 && z1 - z0 > .01) box(apron, [(x0 + x1) / 2, (z0 + z1) / 2], B.rim_h, [x1 - x0, z1 - z0], B.base_h); };
  // The park's slab (z ≤ its south edge) is the floor over the mask's first metre: the apron starts at the slab's edge, never on it.
  const slabEdge = M.skate.park.xy[1]! + M.skate.park.size[1]! / 2;
  block(mx0, mx1, Math.max(mz0, slabEdge), bz0); block(mx0, mx1, bz1, mz1); block(mx0, bx0, bz0, bz1); block(bx1, mx1, bz0, bz1);
  cuts.solids.push(apron);
  cuts.solids.push(shell);
  const coping = solid('tidelineBowl.coping', 'kerb', 'stone', 'deck', ['tidelineBowl'], district);
  for (let a = 0; a < 48; a++) { const t0 = a / 48 * Math.PI * 2, t1 = (a + 1) / 48 * Math.PI * 2, rm = (B.lip_r + B.coping_r) / 2;
    slab(coping, [cx + Math.cos(t0) * rm, B.rim_h + .02, cz + Math.sin(t0) * rm], [cx + Math.cos(t1) * rm, B.rim_h + .02, cz + Math.sin(t1) * rm], B.coping_r - B.lip_r, .3); }
  cuts.solids.push(coping);
  cuts.diagnostics.push({ id: 'structures.tidelineBowl', severity: 'info', message: `tidelineBowl: centre [${cx},${cz}], rim ${B.rim_h} (coping r ${B.lip_r}–${B.coping_r}), floor ${B.floor_h} (flat to r ${B.floor_r}), ${(B.rim_h - B.floor_h).toFixed(1)} deep; lip slope ${(2 * (B.rim_h - B.floor_h) / (B.lip_r - B.floor_r)).toFixed(2)}`, at: [cx, cz], measured: B.rim_h - B.floor_h, required: 0 });
}

/** The Glasshouse stair-and-ramp (D-WW72): landings, the ramp's four legs, the stair's four flights and the terrace walk. */
export function buildGlasshouseDescent(cuts: LandCuts, base: HeightQuery): void {
  const plan0 = glasshouseRampPlan(), R = GLASSHOUSE_RAMP, S = GLASSHOUSE_STAIR, stair = glasshouseStairLine();
  for (const p of plan0.pads) { const pad = addFlatPad(cuts, p.id, 'landing', p.at, p.h, p.size); pad.blend = 3; }
  for (const leg of plan0.legs) { const b = bed(`glasshouseRamp.leg.${leg.index}`, 'walk', leg.points, true); b.width = R.width; b.maxGrade = R.grade + .001; b.blend = R.legBlend; cuts.beds.push(b); }
  // Joins across each landing (the arriving leg's end, the landing's centre, the leaving leg's start): the path graph walks round.
  plan0.pads.forEach((p, i) => {
    const centre: XYZ = [p.at[0], p.h, p.at[1]], ends = [plan0.legs[i - 1]?.to, plan0.legs[i]?.from].filter((q): q is XYZ => !!q && distance(plan(q), p.at) > .05);
    const pts = ends.length === 2 ? [ends[0]!, centre, ends[1]!] : ends.length === 1 ? [centre, ends[0]!] : [];
    if (pts.length) cuts.beds.push(bed(`${p.id}.walk`, 'walk', pts, false));
  });
  // The stair: a level landing at each level (S.landing along the fall), and at the head, the middle turn and the foot (the ramp's
  // west landings) a landing reaching across to the ramp's own; the flights between.
  stair.levels.forEach(([h, z], i) => {
    const ramp = i % 2 === 0 ? plan0.pads[i] : undefined, x0 = stair.x - S.width / 2, east = ramp ? ramp.at[0] - ramp.size[0] / 2 : stair.x + S.width / 2;
    const pad = addFlatPad(cuts, `glasshouseStair.landing.${i}`, 'landing', [(x0 + east) / 2, z], h, [east - x0, S.landing]); pad.blend = 2;
    const along: XYZ[] = [[stair.x, h, z - (i ? S.landing / 2 : 0)], [stair.x, h, z + (i < stair.levels.length - 1 ? S.landing / 2 : 0)]];
    cuts.beds.push(bed(`glasshouseStair.landingWalk.${i}`, 'walk', along, false));
    // The join to the ramp's landing lies inside the stair landing's 2 eu (its edges never cross the stair's own line).
    if (ramp) { const j = bed(`glasshouseStair.join.${i}`, 'walk', [[stair.x, h, z], [ramp.at[0], ramp.h, ramp.at[1]]], false); j.width = S.landing - .2; cuts.beds.push(j); }
  });
  glasshouseStairFlights().forEach((f, i) => buildStair(`glasshouseStair.flight.${i}`, f.from, f.to, S.width, cuts, base, [`glasshouseStair.landingWalk.${i}`, `glasshouseStair.landingWalk.${i + 1}`]));
  // The terrace walk (MANIFEST walks.glasshouseTerrace, on the Glasshouse Footbridge over the spur's end) reaches the head landing.
  const terrace = cuts.beds.find(b => b.id === 'walk glasshouseTerrace'), head = plan0.pads[0]!;
  if (!terrace || distance(plan(terrace.points.at(-1)!), head.at) > .5) cuts.diagnostics.push({ id: 'structures.glasshouseDescent.terrace', severity: 'conflict', message: 'glasshouseDescent: walk glasshouseTerrace does not end on the head landing', at: head.at, measured: terrace ? distance(plan(terrace.points.at(-1)!), head.at) : Infinity, required: .5 });
  const legGrade = Math.max(...plan0.legs.flatMap(l => l.points.slice(1).map((p, i) => Math.abs(p[1] - l.points[i]![1]) / (distance(plan(p), plan(l.points[i]!)) || 1))));
  const flights = glasshouseStairFlights(), pitch = Math.max(...flights.map(f => (f.from[1] - f.to[1]) / distance(plan(f.from), plan(f.to))));
  cuts.diagnostics.push({ id: 'structures.glasshouseDescent', severity: legGrade > R.grade + .002 ? 'conflict' : 'info', message: `glasshouseDescent: the stair (${flights.length} flights, pitch ${pitch.toFixed(3)}, rise ${(R.top - R.foot).toFixed(1)}) and its step-free twin (${R.legs} legs, ${plan0.length.toFixed(0)} eu, steepest ${(legGrade * 100).toFixed(2)} %) from the Lakeside terrace (${R.top}) to the Green (${R.foot})`, at: head.at, measured: legGrade, required: R.grade });
}

/** Called from buildStructures (before the named kinds and the rail flush). */
export function buildWaterwaySouth(cuts: LandCuts, base: HeightQuery): void {
  buildLongSandsPier(cuts, base);
  buildTidelineBowl(cuts);
  buildGlasshouseDescent(cuts, base);
}
