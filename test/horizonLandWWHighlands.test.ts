// The Water's Way PR 2 · L1 (D-WW50…59): the Highlands V3.1 landform and the second stream, on the definition and on the
// committed bake. The landform is land/mountainV3/{landform,water}.ts; the manifest owns Fallswatch, the lift and the crossings.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GLACIER, GLACIER_PEAK, HORN, V3_BENCHES, V3_CEILING, V3_KEEP_OUT, V3_PLACES, V3_RIDGES, V3_RILLS, V3_SPURS, V3_STRATA, VEIL,
  benchLevel, glacierSurface, insideV3Reach, strataStep,
} from '../src/harbour/horizon/land/mountainV3/landform';
import { V3_BASINS, V3_FLOW, V3_REACHES } from '../src/harbour/horizon/land/mountainV3/water';
import { baseHeight } from '../src/harbour/horizon/land/terrain/index';
import { mountainV2Rule } from '../src/harbour/horizon/land/mountainV2/ground';
import { contains, polygonDistance, segmentPoint } from '../src/harbour/horizon/land/terrain/geometry';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';

const m = M as unknown as Record<string, any>;
type XY = readonly [number, number];
const slopeAt = (x: number, z: number, e = 1.25) => Math.hypot(baseHeight(x + e, z) - baseHeight(x - e, z), baseHeight(x, z + e) - baseHeight(x, z - e)) / (2 * e);
const onV2Footprint = (x: number, z: number) => ['land', 'island', 'foot'].includes(mountainV2Rule(x, z).kind);
let world: any = null;
const baked = () => (world ??= JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')));
const segDistance = (x: number, z: number, pts: readonly (readonly number[])[], yIndex = 2) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segmentPoint(x, z, [pts[i - 1]![0]!, pts[i - 1]![yIndex]!], [pts[i]![0]!, pts[i]![yIndex]!]).distance); return d; };

describe('V3.1 one ridge system (D-WW50)', () => {
  it('runs one crest from Westwatch to the horn: the crest ridges chain end to end and reach the east arête\'s shoulder', () => {
    const id = (k: string) => V3_RIDGES.find(r => r.id === k)!;
    const chain = [id('rim.north'), id('rim.col'), id('glacierPeak.north')];
    expect(Math.hypot(chain[0]!.spine[0]![0] - 1036, chain[0]!.spine[0]![1] - 318)).toBeLessThan(20);   // Westwatch [1036,318]
    for (let i = 1; i < chain.length; i++) { const a = chain[i - 1]!.spine.at(-1)!, b = chain[i]!.spine[0]!; expect(Math.hypot(a[0] - b[0], a[1] - b[1]), chain[i]!.id).toBeLessThan(.01); }
    const shoulder = chain.at(-1)!.spine.at(-1)!, arete = id('glacierPeak.arete');
    expect(arete.spine.some(p => Math.hypot(p[0] - shoulder[0], p[1] - shoulder[1]) < .01)).toBe(true);
    // Along the crest the ground never falls more than 9 m under the spine between Westwatch and the horn (a ridge, not a dome).
    for (const r of chain) for (let i = 1; i < r.spine.length; i++) for (let t = 0; t <= 1; t += .25) {
      const a = r.spine[i - 1]!, b = r.spine[i]!, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (!insideV3Reach(x, z) || V3_KEEP_OUT.some(k => polygonDistance(k.poly, x, z) > -k.feather)) continue;
      expect(baseHeight(x, z), `${r.id} at ${x.toFixed(0)},${z.toFixed(0)}`).toBeGreaterThan(a[2] + (b[2] - a[2]) * t - 9);
    }
  });
  it('hangs spurs off the crest with the benches as shelves on them, and cuts rill gullies between them', () => {
    const crest = V3_RIDGES.filter(r => ['rim.north', 'rim.col'].includes(r.id)).flatMap(r => r.spine);
    for (const s of V3_SPURS) expect(Math.min(...crest.map(p => Math.hypot(p[0] - s.spine[0]![0], p[1] - s.spine[0]![1]))), s.id).toBeLessThan(25);
    const onSpur = (id: string) => { const b = V3_BENCHES.find(q => q.id === id)!; return Math.min(...V3_SPURS.map(s => segDistance(b.at[0], b.at[1], s.spine.map(p => [p[0], 0, p[1]])))); };
    for (const id of ['bench.westwatch', 'bench.hamlet', 'bench.orchard', 'bench.spurCrown']) expect(onSpur(id), id).toBeLessThan(12);
    expect(onSpur('bench.tarns')).toBeLessThan(50);   // the Twin Tarns shelf sits on the hamlet spur's east flank
    // A rill gully is a real cut: at its middle floor point the ground stands under its banks 5 m to either side.
    for (const g of V3_RILLS) {
      const i = Math.floor(g.floor.length / 2), [x, z] = g.floor[i]!, [nx, nz] = g.floor[i + 1] ?? g.floor[i - 1]!, len = Math.hypot(nx - x, nz - z), ux = -(nz - z) / len, uz = (nx - x) / len;
      const mid = baseHeight(x, z), banks = Math.min(baseHeight(x + ux * 5, z + uz * 5), baseHeight(x - ux * 5, z - uz * 5));
      expect(banks - mid, g.id).toBeGreaterThan(1.5);
    }
  });
  it('steps every V3 cliff in 3.2 m strata in the definition (STYLE §2.7), never on v2\'s footprint', () => {
    expect(V3_STRATA.band).toBe(3.2);
    expect(strataStep(32)).toBeCloseTo(32, 6); expect(strataStep(32 + 3.2 * .1)).toBeCloseTo(32, 6); expect(strataStep(32 + 3.2 * .95)).toBeCloseTo(35.2, 6);
    // The hamlet shelf's west edge down to the west ledge (V3's own ground, x 1054 → 1046): the riser's local slope alternates
    // (ledges and risers), not one smooth slab.
    const slopes: number[] = [];
    for (let x = 1054; x >= 1046; x -= .25) slopes.push(Math.abs(baseHeight(x + .125, 430) - baseHeight(x - .125, 430)) / .25);
    const steep = slopes.filter(s => s > .55);
    expect(steep.length).toBeGreaterThan(10);
    expect(Math.max(...steep) / Math.min(...steep)).toBeGreaterThan(1.6);
    // v2's footprint is never terraced: its ground is the v2 rule's own (D-M1/D-M2), checked here south of the summit line.
    for (const [x, z] of [[1300, 520], [1260, 600], [1200, 560]] as const) if (onV2Footprint(x, z) && !mountainV2Rule(x, z).north) expect(slopeAt(x, z)).toBeGreaterThanOrEqual(0);
  });
});

describe('V3.1 the horn (D-WW52)', () => {
  it('keeps its summit at 156 under the ceiling, the top 30 m of its faces at ~55°, two arêtes and a ~20 m headwall over the ice', () => {
    const [px, pz] = GLACIER_PEAK.at, top = baseHeight(px, pz);
    expect(top).toBeGreaterThan(155.5); expect(top).toBeLessThanOrEqual(Math.min(V3_CEILING, GLACIER_PEAK.top) + .01);
    expect(HORN.band).toBe(30); expect(HORN.face).toBeGreaterThanOrEqual(1.43);
    // Fall-line slope of the 126–154 band within 30 m, on the north, north-east and east faces (the faces that fall the full 30 m).
    const faces: number[] = [];
    for (let x = px - 30; x <= px + 30; x += 2.5) for (let z = pz - 30; z <= pz + 30; z += 2.5) {
      const r = Math.hypot(x - px, z - pz), a = (Math.atan2(z - pz, x - px) * 180 / Math.PI + 360) % 360, h = baseHeight(x, z);
      if (r < 30 && h >= top - 30 && h <= top - 2 && (a >= 270 || a < 45)) faces.push(slopeAt(x, z));
    }
    faces.sort((a, b) => a - b);
    expect(faces[Math.floor(faces.length * .5)]!).toBeGreaterThan(1.1);
    expect(faces[Math.floor(faces.length * .75)]!).toBeGreaterThan(1.3);   // ≈ 55° (1 : 0.7)
    const aretes = V3_RIDGES.filter(r => Math.hypot(r.spine[0]![0] - px, r.spine[0]![1] - pz) < .01);
    expect(aretes.map(r => r.id).sort()).toEqual(['glacierPeak.arete', 'glacierPeak.southWest']);
    // The second arête stands across the line of sight from the Rim Walk's east end and from Rim Lookout (|cos| ≤ 0.5).
    const sw = V3_RIDGES.find(r => r.id === 'glacierPeak.southWest')!, d = [sw.spine.at(-1)![0] - px, sw.spine.at(-1)![1] - pz], dl = Math.hypot(d[0]!, d[1]!);
    for (const eye of [[1376, 356], V3_PLACES.rimLookout] as const) { const l = [px - eye[0], pz - eye[1]], ll = Math.hypot(l[0]!, l[1]!); expect(Math.abs((d[0]! * l[0]! + d[1]! * l[1]!) / (dl * ll)), `from ${eye}`).toBeLessThan(.5); }
    // Headwall: from the ice at the cirque's horn-side edge to the summit.
    let foot = Infinity; for (let x = px - 30; x < px - 8; x += 1) { const ice = glacierSurface(x, pz); if (ice !== null) foot = Math.min(foot, ice); }
    expect(Number.isFinite(foot)).toBe(true);
    expect(top - (glacierSurface(px - 18, pz) ?? GLACIER.crown)).toBeGreaterThan(17);
  });
});

describe('V3.1 the Veil amphitheatre and Fallswatch (D-WW54)', () => {
  it('pulls the spur crown north, clears one U under the lip and stands Fallswatch on the west buttress', () => {
    const crown = V3_BENCHES.find(b => b.id === 'bench.spurCrown')!;
    expect(crown.at[1]).toBe(635);
    expect(V3_BASINS.some(b => b.id === 'water.v3.spurTarn' && Math.hypot((b.at[0] - crown.at[0]) / crown.radii[0], (b.at[1] - crown.at[1]) / crown.radii[1]) < 1)).toBe(true);
    // Inside the U south of the back wall the ground is down at the pool's rim; the lip line keeps its height.
    for (const x of [1095, 1111, 1127]) { expect(baseHeight(x, 706), `U floor at ${x}`).toBeLessThan(60); expect(baseHeight(x, 697), `lip ground at ${x}`).toBeGreaterThan(92); }
    // The west buttress is a flat-topped block west of the lip; Fallswatch's place, its walk's end and V3_PLACES agree.
    const place = m.places.find((p: any) => p.id === 'fallswatch'), walk = m.walks.fallswatch;
    expect(place.xy).toEqual([...V3_PLACES.fallswatch]);
    expect(walk.pts.at(-1)).toEqual(place.xy);
    expect(place.xy[0]).toBeLessThan(VEIL.lip.x[0]);
    expect(Math.abs(baseHeight(place.xy[0], place.xy[1]) - VEIL.west.top)).toBeLessThan(1.5);
    // The Lip Footbridge carries the Fallswatch lane over the Veil outlet (the register row and the structure agree).
    expect(m.structures.lipFootbridge).toMatchObject({ route: 'walk fallswatch', xy: [1111, 686] });
    expect(m.crossings.some((c: any) => c.structure === 'lipFootbridge' && c.b === 'water.v3.veilOutlet')).toBe(true);
  });
});

describe('V3.1 Bench Hamlet (D-WW53)', () => {
  it('is a real shelf: a 60 × 35 m rectangle at ≤ 8 % in the definition, ≥ 2100 m² of it, on the shelf\'s level', () => {
    const b = V3_BENCHES.find(q => q.id === 'bench.hamlet')!;
    expect(b.shape).toBe(4); expect(Math.abs(b.grade![0])).toBeLessThanOrEqual(.08);
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw), world = (u: number, v: number): XY => [b.at[0] + u * c + v * s, b.at[1] - u * s + v * c];
    let cells = 0, flat = 0, level = 0;
    for (let u = -30; u <= 30; u += 2.5) for (let v = -17.5; v <= 17.5; v += 2.5) {
      const [x, z] = world(u, v); cells++;
      if (slopeAt(x, z) <= .08) { flat++; if (Math.abs(baseHeight(x, z) - benchLevel(b, x, z)) <= 1.5) level++; }
    }
    expect(flat / cells).toBeGreaterThan(.95);
    expect(level * 6.25).toBeGreaterThanOrEqual(2100);
    // The hamlet place stands on the shelf at 104 (the lane's pin).
    expect(Math.abs(benchLevel(b, 1086, 418) - 104)).toBeLessThan(.3);
  });
  it('fits nine crofts beside the hamlet lane on the bake (the prototype\'s site rule: h 99–107, slope ≤ 0.14, 4.5–16 m off the lane, ≥ 6 m from water, ≥ 11 m apart)', () => {
    const w = baked(), lane = w.beds.find((q: any) => q.id === 'walk hamletLane').points as number[][];
    const beds = (w.beds as any[]).filter(q => !['cave', 'cable', 'rail'].includes(q.kind) && q.points.some((p: number[]) => p[0]! > 1000 && p[0]! < 1180 && p[2]! > 330 && p[2]! < 500));
    const waters = (w.collision.waters as any[]).filter(q => q.id.startsWith('water.v3.'));
    const bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
    return import('../src/harbour/horizon/land/terrain/asset').then(({ decodeTerrainAsset }) => import('../src/harbour/horizon/land/terrain/index').then(({ sampleTerrain }) => {
      const field = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'full'), h = (x: number, z: number) => sampleTerrain(field, x, z);
      const water = (x: number, z: number) => Math.min(...waters.map(q => q.points.length ? segDistance(x, z, q.points) - q.width / 2 : -polygonDistance(q.outline, x, z)));
      const sites: { x: number; z: number; score: number }[] = [];
      for (let x = 1036; x <= 1136; x += 3) for (let z = 370; z <= 470; z += 3) {
        const y = h(x, z), sl = Math.hypot(h(x + 1.5, z) - h(x - 1.5, z), h(x, z + 1.5) - h(x, z - 1.5)) / 3, ld = segDistance(x, z, lane), bd = Math.min(...beds.map(q => segDistance(x, z, q.points)));
        if (y < 99 || y > 107 || sl > .14 || bd < 4.5 || ld > 16 || water(x, z) < 6) continue;
        sites.push({ x, z, score: -sl * 10 - Math.abs(ld - 7) * .15 });
      }
      sites.sort((a, b) => b.score - a.score);
      const kept: typeof sites = [];
      for (const q of sites) if (kept.every(k => Math.hypot(k.x - q.x, k.z - q.z) >= 11)) kept.push(q);
      expect(kept.length).toBeGreaterThanOrEqual(9);
    }));
  }, 60_000);
});

describe('V3.1 the drag lift (D-WW56; structure data, the ride is PR 5)', () => {
  it('runs straight from the Twin Tarns shelf, all on V3 land, outside every keep-out, off beds and water, both stations on walks', () => {
    const lift = m.structures.glacierLift, pts: XY[] = [lift.from, ...lift.towers, lift.to];
    const tarns = V3_BENCHES.find(b => b.id === 'bench.tarns')!;
    expect(Math.hypot((lift.from[0] - tarns.at[0]) / tarns.radii[0], (lift.from[1] - tarns.at[1]) / tarns.radii[1])).toBeLessThan(1.2);
    const len = Math.hypot(lift.to[0] - lift.from[0], lift.to[1] - lift.from[1]);
    expect(Math.abs(len - lift.length_m)).toBeLessThan(.5);
    for (const p of lift.towers) expect(segmentPoint(p[0], p[1], lift.from, lift.to).distance, 'towers on the line').toBeLessThan(.2);
    for (let t = 0; t <= 1; t += .02) {
      const x = lift.from[0] + (lift.to[0] - lift.from[0]) * t, z = lift.from[1] + (lift.to[1] - lift.from[1]) * t;
      expect(insideV3Reach(x, z)).toBe(true);
      expect(onV2Footprint(x, z), `v2 footprint at ${x.toFixed(0)},${z.toFixed(0)}`).toBe(false);
      for (const k of V3_KEEP_OUT) expect(contains(k.poly, x, z), k.id).toBe(false);
    }
    const w = baked(), waters = (w.collision.waters as any[]).filter(q => !q.underground && q.kind !== 'sea' && q.kind !== 'lagoon');
    for (const p of lift.towers) {
      for (const q of waters) expect(q.points.length ? segDistance(p[0], p[1], q.points) - q.width / 2 : -polygonDistance(q.outline, p[0], p[1]), `${p} vs ${q.id}`).toBeGreaterThanOrEqual(5);
      for (const b of (w.beds as any[]).filter(q => !['cave', 'cable'].includes(q.kind))) expect(segDistance(p[0], p[1], b.points) - b.width / 2, `${p} vs ${b.id}`).toBeGreaterThanOrEqual(3);
    }
    for (const [key, id] of [['bottom', 'glacierLiftFoot'], ['top', 'glacierLiftHead']] as const) {
      const st = lift.stations[key], row = m.thresholds.find((r: any) => r.id === id);
      expect(row.xy).toEqual(st.xy);
      const walk = w.beds.find((b: any) => b.id === st.on);
      expect(segDistance(st.xy[0], st.xy[1], walk.points), `${id} on ${st.on}`).toBeLessThan(1);
      expect(w.geometry.solids.some((s: any) => (s.sourceId ?? s.id.split('@')[0]) === `threshold.${id}.slab` || (s.sourceId ?? s.id.split('@')[0]) === `threshold.${id}.marker`)).toBe(true);
    }
  });
});

describe('V3.1 the second stream (D-WW55)', () => {
  it('runs the Hollow Tarn into Orchard Brook downhill, crossed on spans ≥ 1.25 clear', () => {
    const beck = V3_REACHES.find(r => r.id === 'water.v3.hollowBeck')!, tarn = V3_BASINS.find(b => b.id === 'water.v3.hollowTarn')!;
    expect(V3_FLOW).toContainEqual(['water.v3.hollowTarn', 'water.v3.hollowBeck']);
    expect(V3_FLOW).toContainEqual(['water.v3.hollowBeck', 'water.brook']);
    expect(tarn.note).not.toMatch(/soaks away/);
    for (let i = 1; i < beck.pts.length; i++) expect(beck.pts[i]![2]).toBeLessThanOrEqual(beck.pts[i - 1]![2]);
    expect(Math.abs(beck.pts[0]![2] - tarn.level)).toBeLessThan(.5);
    expect(Math.hypot((beck.pts[0]![0] - tarn.at[0]) / tarn.radii[0], (beck.pts[0]![1] - tarn.at[1]) / tarn.radii[1])).toBeLessThanOrEqual(1);
    // It arrives inside Orchard Brook's ribbon within 1 m of the brook's level there.
    const w = baked(), brook = w.collision.waters.find((q: any) => q.id === 'water.brook'), end = beck.pts.at(-1)!;
    expect(segDistance(end[0], end[1], brook.points)).toBeLessThan(brook.width / 2);
    let level = 0, best = Infinity; for (const p of brook.points) { const d = Math.hypot(p[0] - end[0], p[2] - end[1]); if (d < best) { best = d; level = p[1]; } }
    expect(Math.abs(end[2] - level)).toBeLessThan(1);
    // Every bed it meets crosses it over a registered span with the clearance contract met on the bake.
    const proofs = (w.crossingProofs as any[]).filter(p => p.b === 'water.v3.hollowBeck' || p.a === 'water.v3.hollowBeck');
    expect(proofs.length).toBe(3);
    for (const p of proofs) { expect(p.registered, p.id).toBe(true); expect(p.built, p.id).toBe(true); expect(p.clearancePass, p.id).toBe(true); expect(p.clearHeight, p.id).toBeGreaterThanOrEqual(1.25); }
  });
});

// ---- Walk proofs: the runtime walker (runtime/walkSim.ts) follows each new or moved V3.1 walk and span end to end, both
// ways, over the committed bake with Mountain v2's region registered (as test/horizonWalkSim.test.ts does). ----
import { parseHorizonDefinition } from '../src/house/world/horizonAssets';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset';
import { sampleTerrain } from '../src/harbour/horizon/land/terrain';
import { createHorizonGeography, HORIZON_WALKABLE_DEGREES } from '../src/harbour/horizon/runtime/geography';
import { createMountainV2Region, mouthExclusion, terraceBedExclusion } from '../src/harbour/horizon/regions/mountainV2';
import { bedPath, pointAt, progressOf } from '../src/harbour/horizon/movers/board/situations';
import { createWalkState, horizonWalkWorld, WALK_FIXED_DT, walkMove, walkTick, type WalkBody, type WalkWorld } from '../src/harbour/horizon/runtime/walkSim';

describe('V3.1 walk proofs on the bake (D-WW53…56)', () => {
  const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  let runtime: { world: ReturnType<typeof parseHorizonDefinition>; geo: ReturnType<typeof createHorizonGeography>; ww: WalkWorld } | null = null;
  const load = () => {
    if (runtime) return runtime;
    const world = parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))), field = decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')), 'full');
    const geo = createHorizonGeography(field, { ...world.collision, solids: world.geometry.solids, diagnostics: [] } as never);
    geo.addDynamic(createMountainV2Region({ walkingJoinSolids: world.geometry.solids, horizonGround: (x, z) => sampleTerrain(field, x, z), yield: terraceBedExclusion(world.collision.beds), exclude: mouthExclusion(world.collision.mouths), terrainStep: field.step }).provider);
    return runtime = { world, geo, ww: horizonWalkWorld(geo, world.extent, () => true, HORIZON_WALKABLE_DEGREES) };
  };
  const follow = (id: string, reverse: boolean) => {
    const { world, geo, ww } = load(), b = world.collision.beds.find(q => q.id === id)!, path = bedPath({ ...b, points: reverse ? [...b.points].reverse() : b.points } as never), p = pointAt(path, .3);
    const s = geo.surface(p.x, p.z, p.y + .5, .48)!, body: WalkBody = { x: p.x, y: s.y, z: p.z, yaw: 0 }, state = createWalkState(body);
    const move = (dx: number, dz: number) => walkMove(ww, body, dx, dz, { swimming: false, grounded: true });
    let d = .3, last = .3, stall = 0, maxDy = 0;
    for (let t = 0; t < 300; t += WALK_FIXED_DT) {
      const pr = progressOf(path, body.x, body.z, d, 20); d = Math.max(d, pr.d); if (d >= path.length - .3) return { end: true, maxDy };
      if (d > last + .05) { last = d; stall = 0; } else if ((stall += WALK_FIXED_DT) > 3) return { end: false, at: [body.x, body.y, body.z], maxDy };
      const tg = pointAt(path, d + .8), dx = tg.x - body.x, dz = tg.z - body.z, l = Math.hypot(dx, dz), y0 = body.y;
      const r = walkTick(state, body, { wishX: dx / l, wishZ: dz / l, run: false, speeds: { walk: 2.4, run: 5 } }, WALK_FIXED_DT, move);
      maxDy = Math.max(maxDy, Math.abs(body.y - y0));
      const floor = geo.surface(body.x, body.z, body.y, .02);
      if (r.leftSupport || !floor || body.y - floor.y > .05) { const below = geo.surface(body.x, body.z, body.y, 0); if (!below || body.y - below.y > .48) return { end: false, air: true, at: [body.x, body.y, body.z], maxDy }; body.y = below.y; }
    }
    return { end: false, maxDy };
  };
  for (const id of ['walk fallswatch', 'walk liftFoot', 'structure.lipFootbridge', 'structure.hamletFootbridge', 'structure.hollowBeckFootbridge', 'walk hamletLane', 'walk rimWalk', 'colSteps', 'shielingSteps', 'rimSteps'])
    it(`walks ${id} end to end both ways`, () => { for (const reverse of [false, true]) expect(follow(id, reverse), `${id}${reverse ? ' reversed' : ''}`).toMatchObject({ end: true }); }, 240_000);
});
