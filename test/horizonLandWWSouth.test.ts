// The Water's Way, PR 2 land, L2b (docs/horizon/DECISIONS.md D-WW70…79): Little Harbour's Town Weave 3B move and page A,
// Long Sands' pier, bowl, promenade and Strand, the Glasshouse stair-and-ramp, the Green's scarp batter, Green Road's bollards,
// the baskets and the Drop Zone, on the committed bake.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BedCut, LandCuts, StructureSolid, TerrainField, XY, XYZ } from '../src/harbour/horizon/land/interfaces.ts';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset.ts';
import { GLASSHOUSE_RAMP, glasshouseRampPlan, glasshouseStairFlights } from '../src/harbour/horizon/land/terrain/glasshouseScarp.ts';
import { bowlSurface, glideApproach } from '../src/harbour/horizon/land/structures/waterwaySouth.ts';
import { createRayCaster, isOpenRail } from '../src/harbour/horizon/world/raycast.ts';
import { solidBounds, terrainHeight } from '../src/harbour/horizon/world/geometry.ts';
import { buildViews } from '../src/harbour/horizon/world/views.ts';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest.ts';

type World = { collision: { beds: BedCut[]; pads: LandCuts['pads']; mouths: LandCuts['mouths']; waters: LandCuts['waters'] }; geometry: { solids: StructureSolid[] }; diagnostics: { id: string; severity: string; measured?: number; required?: number; message: string }[]; lights: { id: string; kind: string; at: XYZ; head: XYZ }[]; corridors?: { id: string; lamps: { id: string; kind: string; at: XYZ; head: XYZ }[] }[] };
let world: World, field: TerrainField, cuts: LandCuts;
const bed = (id: string) => world.collision.beds.find(b => b.id === id)!;
const diag = (id: string) => world.diagnostics.find(d => d.id === id)!;
const source = (s: StructureSolid) => (s as StructureSolid & { sourceId?: string }).sourceId ?? s.id.split('@')[0]!;
const solidsOf = (prefix: string) => world.geometry.solids.filter(s => source(s).startsWith(prefix));
function nearest(p: XY, pts: readonly XYZ[]): { d: number; y: number } {
  let best = { d: Infinity, y: 0 };
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1]!, b = pts[i]!, dx = b[0] - a[0], dz = b[2] - a[2], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[2]) * dz) / (dx * dx + dz * dz || 1))), d = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[2] - dz * t); if (d < best.d) best = { d, y: a[1] + (b[1] - a[1]) * t }; }
  return best;
}
beforeAll(() => {
  world = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')) as World;
  const t = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  field = decodeTerrainAsset(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength) as ArrayBuffer, 'full');
  cuts = { beds: world.collision.beds, pads: world.collision.pads, mouths: world.collision.mouths, waters: world.collision.waters, solids: world.geometry.solids, diagnostics: [] };
}, 120000);

describe('Little Harbour: Town Weave 3B and page A (D-WW70, D-WW71)', () => {
  // LAND-ASKS §1 (the prototype's transform of the baked centreline): new points on the full-shift span and both ramps.
  const moved: XY[] = [[1464.64, 1254.08], [1461.92, 1260.53], [1455.83, 1267.82], [1449.84, 1273.5], [1443.3, 1279.1], [1436.76, 1284.37], [1430.76, 1289.09], [1425.32, 1294.83], [1462.26, 1242.5], [1420.8, 1303.16]];
  it('lays S3 ~8 m inland along the quay (within 1.5 eu of the transformed line), a 4 eu skate bed as before', () => {
    const s3 = bed('S3');
    expect([s3.kind, s3.width]).toEqual(['skate', 4]);
    for (const p of moved) expect(nearest(p, s3.points).d).toBeLessThan(1.5);
    // The square's floor and the river-mouth stretch do not move.
    expect(nearest([1440, 1200], s3.points).d).toBeLessThan(.5);
    expect(nearest([1390, 1330], s3.points).d).toBeLessThan(.5);
  });
  it('moves the quayWest board→feet mark with the line and keeps it on the line', () => {
    const t = M.thresholds.find(q => q.id === 'quayWest')!.xy as unknown as XY;
    expect(t).toEqual([1447.64, 1271.08]);
    expect(world.collision.pads.some(p => p.id === 'threshold.quayWest' && Math.hypot(p.centre[0] - t[0], p.centre[2] - t[1]) < .01)).toBe(true);
    expect(nearest(t, bed('S3').points).d).toBeLessThan(4);
  });
  it('retargets page A to the glass dam and proves it from the porch pose', () => {
    const a = buildViews(field, cuts).find(v => v.id === 'A')!;
    expect([a.eye[0], a.eye[2], a.target[0], a.target[2], a.target[1], a.fovDegrees]).toEqual([1432, 1166, 1318, 560, 108, 50]);
    expect(a.proof!.subjects.map(s => [s.id, s.pass])).toEqual([['the glass dam', true], ['the Shoulder', true]]);
    expect(a.proof!.pass).toBe(true);
  }, 180_000);
  it('keeps the dam line clear: nothing baked in the town stands over 6 eu inside its 14 m corridor', () => {
    const line = (M.views.find(v => v.id === 'A') as unknown as { damLine: { from: XY; to: XY; halfWidth_m: number; maxHeight_eu: number } }).damLine;
    const [a, b] = [line.from, line.to], len = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len] as const;
    let worst = 0, at = '';
    for (const s of world.geometry.solids) {
      // Land only: overhead ropes are not 'standing', and the bank is the brief's named exception ("bank stays; belfry is the dam
      // view": harbour LAND-ASKS §5); buildings are PR 3's and carry the rule there.
      if (s.districtId !== 'harbour' || s.role === 'marker' || s.kind === 'cable' || source(s).startsWith('host.')) continue;
      const p = s.positions;
      for (let i = 0; i < p.length; i += 3) {
        const dx = p[i]! - a[0], dz = p[i + 2]! - a[1], along = dx * u[0] + dz * u[1], across = Math.abs(dx * u[1] - dz * u[0]);
        if (along < 0 || along > len || across > line.halfWidth_m) continue;
        const h = p[i + 1]! - terrainHeight(field, p[i]!, p[i + 2]!);
        if (h > worst) { worst = h; at = source(s); }
      }
    }
    expect(worst, `tallest: ${at}`).toBeLessThanOrEqual(line.maxHeight_eu);
  });
});

describe('Long Sands: the pier, the bowl, the promenade and the Strand (D-WW74–76)', () => {
  it('builds the pier as land: deck at 3.6, a ≤ 5 % ramp from the Tideline slab, open rails, piles and the wheel\'s platform', () => {
    const P = (M.structures as unknown as { longSandsPier: { from_z: number; ramp_to_z: number; slab_h: number; deck_h: number; platform: { x: number[]; z: number[] } } }).longSandsPier;
    expect((P.deck_h - P.slab_h) / (P.ramp_to_z - P.from_z)).toBeLessThanOrEqual(.05);
    const b = bed('structure.longSandsPier'); expect(b.width).toBe(12);
    expect(b.points[0]![1]).toBeCloseTo(P.slab_h, 6); expect(b.points.at(-1)![1]).toBeCloseTo(P.deck_h, 6);
    const deck = solidsOf('longSandsPier.deck'), rails = solidsOf('longSandsPier.rails');
    expect(deck.length).toBeGreaterThan(0); expect(solidsOf('longSandsPier.piles').length).toBeGreaterThan(0);
    expect(rails.length).toBeGreaterThan(0); expect(rails.every(isOpenRail)).toBe(true);
    const top = Math.max(...deck.map(s => solidBounds(s).max[1])); expect(top).toBeCloseTo(P.deck_h, 6);
    const railTop = Math.max(...rails.map(s => solidBounds(s).max[1])); expect(railTop - P.deck_h).toBeCloseTo(1.05 + .045, 1);
  });
  it('holds every pier clearance contract: the dune trail under it, the ferry hull, the wheel\'s footing, the glider\'s approach', () => {
    expect(diag('structures.longSandsPier.duneHeadroom').measured!).toBeGreaterThanOrEqual(2.4);
    expect(diag('structures.longSandsPier.ferryHull').measured!).toBeGreaterThanOrEqual(6);
    expect(diag('structures.longSandsPier.wheelFooting').severity).toBe('info');
    const g = glideApproach(); expect(Math.min(g.plan, g.field)).toBeGreaterThanOrEqual(30);
    for (const id of ['duneHeadroom', 'ferryHull', 'wheelFooting', 'glideApproach']) expect(diag(`structures.longSandsPier.${id}`).severity).toBe('info');
  });
  it('sinks the skate bowl beside the Tideline park (never on its slab), rim and floor at their heights', () => {
    const B = (M.structures as unknown as { tidelineBowl: { xy: XY; rim_h: number; floor_h: number; coping_r: number } }).tidelineBowl;
    expect(world.collision.mouths.find(m => m.id === 'tidelineBowl')?.kind).toBe('bowl');
    const shell = solidsOf('tidelineBowl.shell'), park = world.collision.pads.find(p => p.id === 'tidelinePark')!;
    expect(shell.length).toBeGreaterThan(0);
    const slabSouth = park.centre[2] + park.size[1] / 2;
    for (const s of [...shell, ...solidsOf('tidelineBowl.apron')]) expect(solidBounds(s).min[2]).toBeGreaterThanOrEqual(slabSouth - 1e-6);
    expect(B.xy[1] - B.coping_r).toBeGreaterThan(slabSouth);
    expect(bowlSurface(0)).toBe(B.floor_h); expect(bowlSurface(B.coping_r)).toBe(B.rim_h);
    expect(Math.min(...shell.map(s => solidBounds(s).min[1]))).toBeLessThan(B.floor_h);
    expect(Math.max(...shell.map(s => solidBounds(s).max[1]))).toBeCloseTo(B.rim_h, 6);
  });
  it('lays the promenade (7.5 concrete) and the Strand (3.2, bicycles) along x 795–1245, level across the park, joined to the dune walk', () => {
    const prom = bed('walk promenade'), strand = bed('walk strand');
    expect([prom.width, prom.surface, strand.width, strand.surface, strand.kind]).toEqual([7.5, 'paved', 3.2, 'paved', 'trail']);
    expect(Math.min(...prom.points.map(p => p[0]))).toBeCloseTo(795, 0); expect(Math.max(...prom.points.map(p => p[0]))).toBeCloseTo(1245, 0);
    for (const p of prom.points) if (p[0] >= 991 && p[0] <= 1049) expect(p[1]).toBeCloseTo(3, 1);
    for (const id of ['walk tidelineBeach', 'walk strandDune']) { const b = bed(id), dune = bed('walk dune'); expect(nearest([b.points.at(-1)![0], b.points.at(-1)![2]], dune.points).d).toBeLessThan(1.5); }
    // The Year Walk crosses both at grade (x ≈ 948), registered.
    const yw = bed('yearWalk');
    for (const [id, at] of [['walk promenade', [948.6, 1428.1]], ['walk strand', [949.6, 1433.7]]] as const) {
      const a = nearest(at as unknown as XY, bed(id).points), b = nearest(at as unknown as XY, yw.points);
      expect(Math.abs(a.y - b.y)).toBeLessThan(.5);
      expect(M.crossings.some(r => r.a === id && r.b === 'yearWalk')).toBe(true);
    }
  });
});

describe('The Green: the stair-and-ramp, the scarp, the bollards, the baskets (D-WW72, D-WW73, D-WW77)', () => {
  it('lays the ramp twin at ≤ 8 % and the stair at ≤ 0.7 pitch from the terrace to the Green, joined to the Glasshouse steps', () => {
    const plan0 = glasshouseRampPlan();
    for (const leg of plan0.legs) { const b = bed(`glasshouseRamp.leg.${leg.index}`); for (let i = 1; i < b.points.length; i++) { const p = b.points[i - 1]!, q = b.points[i]!; expect(Math.abs(q[1] - p[1]) / Math.hypot(q[0] - p[0], q[2] - p[2])).toBeLessThanOrEqual(GLASSHOUSE_RAMP.grade + .002); } }
    for (const f of glasshouseStairFlights()) expect((f.from[1] - f.to[1]) / Math.hypot(f.to[0] - f.from[0], f.to[2] - f.from[2])).toBeLessThanOrEqual(.7);
    expect(plan0.legs[0]!.from[1]).toBe(GLASSHOUSE_RAMP.top); expect(plan0.legs.at(-1)!.to[1]).toBe(GLASSHOUSE_RAMP.foot);
    const terrace = bed('walk glasshouseTerrace'), steps = bed('walk glasshouseSteps'), s0 = terrace.points[0]!;
    const join = nearest([s0[0], s0[2]], steps.points); expect(join.d).toBeLessThan(.5); expect(Math.abs(join.y - s0[1])).toBeLessThan(.05);
    expect(terrace.points.at(-1)![1]).toBeCloseTo(GLASSHOUSE_RAMP.top, 2);
    expect(diag('structures.glasshouseDescent').severity).toBe('info');
  });
  it('turns Green Road\'s lanterns inside the protected circle into 0.8 eu bollards, and only those', () => {
    const g = M.protected.green, lamps = world.lights.filter(l => l.id.startsWith('VG.lamp.'));
    for (const l of lamps) {
      const inside = Math.hypot(l.at[0] - g.cx, l.at[2] - g.cy) < g.r;
      expect(l.kind === 'bollard', l.id).toBe(inside);
      if (inside) expect(l.head[1] - l.at[1]).toBeLessThanOrEqual(.85);
    }
    expect(['VG.lamp.9', 'VG.lamp.10', 'VG.lamp.11', 'VG.lamp.12', 'VG.lamp.13', 'VG.lamp.14'].every(id => lamps.find(l => l.id === id)?.kind === 'bollard')).toBe(true);
  });
  it('places baskets 4, 6, 7 and 8 on the 172–190 m ring, ≥ 6 m off every bed (#8 on ground within 4 m of the Green\'s level)', () => {
    const g = M.protected.green, baskets = (M.pastimeData as unknown as { nineBaskets: XY[] }).nineBaskets, level = terrainHeight(field, g.cx, g.cy);
    for (const n of [4, 6, 7, 8]) {
      const b = baskets[n - 1]!, r = Math.hypot(b[0] - g.cx, b[1] - g.cy);
      expect(r, `#${n}`).toBeGreaterThanOrEqual(172); expect(r, `#${n}`).toBeLessThanOrEqual(190);
      if (n === 8) expect(Math.abs(terrainHeight(field, b[0], b[1]) - level), `#${n}`).toBeLessThanOrEqual(4);   // RULINGS 1: #8 leaves the terrace
      for (const bd of world.collision.beds) { if (['cable', 'cave', 'rail'].includes(bd.kind) || bd.points.length < 2) continue; expect(nearest(b, bd.points).d - bd.width / 2, `#${n} vs ${bd.id}`).toBeGreaterThanOrEqual(6); }
    }
    expect(M.sky.dropZone.xy).toEqual([1037.2, 1115.8]); expect(M.sky.landings.green.xy).toEqual([1037.2, 1115.8]);
  });
  it('sees through an open rail with the one ray caster (view proofs and the story sight chain alike)', () => {
    const rails = solidsOf('longSandsPier.rails'), ray = createRayCaster(field, { solids: rails, waters: [], mouths: [] });
    const b = solidBounds(rails[0]!), mid: XYZ = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    const hit = ray.first([mid[0] + 20, mid[1], mid[2]], [-1, 0, 0], 40);
    expect(hit.kind === 'solid' && rails.includes(world.geometry.solids.find(s => s.id === hit.id)!)).toBe(false);
  });
});

// Walk-proof (the runtime walker over the committed bake, as test/horizonWalkSim.test.ts follows a bed): every new walk, stair,
// ramp leg and the pier, both ways, end to end.
import { parseHorizonDefinition } from '../src/house/world/horizonAssets.ts';
import { sampleTerrain } from '../src/harbour/horizon/land/terrain/index.ts';
import { createHorizonGeography, HORIZON_WALKABLE_DEGREES } from '../src/harbour/horizon/runtime/geography.ts';
import { createMountainV2Region, mouthExclusion, terraceBedExclusion } from '../src/harbour/horizon/regions/mountainV2/index.ts';
import { bedPath, pointAt, progressOf } from '../src/harbour/horizon/movers/board/situations.ts';
import { createWalkState, horizonWalkWorld, walkMove, walkTick, WALK_FIXED_DT, type WalkWorld } from '../src/harbour/horizon/runtime/walkSim.ts';
describe('walk-proof: the new walks, stairs, ramp and pier on foot (both ways)', () => {
  const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  let baked: { world: ReturnType<typeof parseHorizonDefinition>; geo: ReturnType<typeof createHorizonGeography>; ww: WalkWorld } | null = null;
  const load = () => {
    if (baked) return baked;
    const w = parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))), f = decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')), 'full');
    const geo = createHorizonGeography(f, { ...w.collision, solids: w.geometry.solids, diagnostics: [] } as never);
    geo.addDynamic(createMountainV2Region({ walkingJoinSolids: w.geometry.solids, horizonGround: (x, z) => sampleTerrain(f, x, z), yield: terraceBedExclusion(w.collision.beds), exclude: mouthExclusion(w.collision.mouths), terrainStep: f.step }).provider);
    return baked = { world: w, geo, ww: horizonWalkWorld(geo, w.extent, () => true, HORIZON_WALKABLE_DEGREES) };
  };
  function followBed(id: string, reverse: boolean): { end: boolean; at?: number[]; air?: boolean } {
    const { world: w, geo, ww } = load(), b = w.collision.beds.find(q => q.id === id)!, path = bedPath({ ...b, points: reverse ? [...b.points].reverse() : b.points } as never), p0 = pointAt(path, .3);
    const s = geo.surface(p0.x, p0.z, p0.y + .5, .48)!, body = { x: p0.x, y: s.y, z: p0.z, yaw: 0 }, state = createWalkState(body);
    const move = (dx: number, dz: number) => walkMove(ww, body, dx, dz, { swimming: false, grounded: true });
    let d = .3, last = .3, stall = 0;
    for (let t = 0; t < 400; t += WALK_FIXED_DT) {
      const pr = progressOf(path, body.x, body.z, d, 20); d = Math.max(d, pr.d); if (d >= path.length - .3) return { end: true };
      if (d > last + .05) { last = d; stall = 0; } else if ((stall += WALK_FIXED_DT) > 3) return { end: false, at: [body.x, body.y, body.z] };
      const tg = pointAt(path, d + .8), dx = tg.x - body.x, dz = tg.z - body.z, l = Math.hypot(dx, dz);
      const r = walkTick(state, body, { wishX: dx / l, wishZ: dz / l, run: false, speeds: { walk: 2.4, run: 5 } } as never, WALK_FIXED_DT, move);
      const floor = geo.surface(body.x, body.z, body.y, .02);
      if ((r as { leftSupport?: boolean }).leftSupport || !floor || body.y - floor.y > .05) { const below = geo.surface(body.x, body.z, body.y, 0); if (!below || body.y - below.y > 1.2) return { end: false, air: true, at: [body.x, body.y, body.z] }; body.y = below.y; }
    }
    return { end: false, at: [body.x, body.y, body.z] };
  }
  const ids = ['structure.longSandsPier', 'walk promenade', 'walk strand', 'walk tidelineBeach', 'walk strandDune', 'walk glasshouseTerrace',
    'glasshouseRamp.leg.0', 'glasshouseRamp.leg.1', 'glasshouseRamp.leg.2', 'glasshouseRamp.leg.3', 'glasshouseStair.flight.0', 'glasshouseStair.flight.1', 'glasshouseStair.flight.2', 'glasshouseStair.flight.3'];
  for (const id of ids) it(`walks ${id} end to end, both ways`, () => { for (const reverse of [false, true]) expect(followBed(id, reverse), `${id}${reverse ? ' reversed' : ''}`).toMatchObject({ end: true }); }, 120_000);
});
