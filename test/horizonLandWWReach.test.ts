// The Water's Way, PR 2 land, L2a — the Reach and the Greenway (D-WW18…D-WW24; D-WW60…D-WW69). Unit proofs of the one open-rail
// rule, then the land on the committed bake: the Reach's open rails and lookouts, the Channel Hide's skate guard, page I, the
// Greenway (profile, keep-offs, bridges and their clearances, places, joins, thresholds, modes) and the scraped marsh pools.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BedCut, StructureSolid, TerrainField, WaterCut } from '../src/harbour/horizon/land/interfaces.ts';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset.ts';
import { createRayCaster } from '../src/harbour/horizon/world/raycast.ts';
import { closestOnPolyline, solidBounds, solidVerticalRangeAt, terrainHeight } from '../src/harbour/horizon/world/geometry.ts';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest.ts';
import { box, solid } from '../src/harbour/horizon/land/structures/mesh.ts';
import { isOpenRail, OPEN_RAIL_KIND, openRail } from '../src/harbour/horizon/land/structures/openRail.ts';
import { greenwayLine } from '../src/harbour/horizon/land/structures/greenway.ts';
import { bedClass } from '../src/harbour/horizon/movers/shared/ground/contact.ts';
import { BOARD_PROFILE } from '../src/harbour/horizon/movers/board/profile.ts';
import { BICYCLE_PROFILE } from '../src/harbour/horizon/movers/bicycle/profile.ts';
import { mulberry32 } from '../src/harbour/horizon/land/water/marsh.ts';
import { parseHorizonDefinition } from '../src/house/world/horizonAssets.ts';
import { sampleTerrain } from '../src/harbour/horizon/land/terrain/index.ts';
import { createHorizonGeography, HORIZON_WALKABLE_DEGREES } from '../src/harbour/horizon/runtime/geography.ts';
import { createMountainV2Region, mouthExclusion, terraceBedExclusion } from '../src/harbour/horizon/regions/mountainV2/index.ts';
import { createWalkState, horizonWalkWorld, walkMove, walkTick, WALK_FIXED_DT, type WalkBody } from '../src/harbour/horizon/runtime/walkSim.ts';
import { createCruiserState, cruiserSpeed, stepCruiser, validCruiserPosition } from '../src/harbour/horizon/movers/cruiser/sim.ts';
import { CRUISER } from '../src/harbour/horizon/movers/cruiser/tuning.ts';
import { createBoardController } from '../src/harbour/horizon/movers/board/controller.ts';
import { bedPath, moverInputOf, progressOf, runLine } from '../src/harbour/horizon/movers/board/situations.ts';
import { groundSpeed } from '../src/harbour/horizon/movers/shared/ground/kernel.ts';
import type { MoverDeps } from '../src/harbour/horizon/movers/shared/registry.ts';

describe('the open rail is seen through under one rule (world/raycast.ts, land/structures/openRail.ts)', () => {
  const field: TerrainField = { revision: 'horizon-geo-1', width: 100, depth: 100, step: 10, columns: 11, rows: 11, heights: new Float32Array(121).fill(1), surfaces: new Uint8Array(121) };
  const wall = solid('target.wall', 'wall', 'stone', 'wall'); box(wall, [60, 50], 6, [2, 20], 0);
  const cast = (between: StructureSolid) => createRayCaster(field, { solids: [between, wall], waters: [], mouths: [] }).first([20, 2, 50], [1, 0, 0], 100);
  it('names open rails by kind (and the road main\'s timber guard collider), never a parapet', () => {
    expect(isOpenRail({ kind: OPEN_RAIL_KIND, surface: 'timber' })).toBe(true);
    expect(isOpenRail({ kind: OPEN_RAIL_KIND, surface: 'metal' })).toBe(true);
    expect(isOpenRail({ kind: 'corridorGuard', surface: 'timber' })).toBe(true);
    expect(isOpenRail({ kind: 'corridorGuard', surface: 'stone' })).toBe(false);
    expect(isOpenRail({ kind: 'parapet', surface: 'stone' })).toBe(false);
  });
  it('sees the wall through an open rail and stops at a solid rail on the same line', () => {
    const open = solid('test.rail', OPEN_RAIL_KIND, 'timber', 'rail'), parapet = solid('test.parapet', 'parapet', 'stone', 'rail');
    openRail(open, [[40, 1, 40], [40, 1, 60]]); box(parapet, [40, 50], 2.15, [.4, 20], 1);
    expect(cast(open)).toMatchObject({ kind: 'solid', id: 'target.wall' });
    expect(cast(parapet)).toMatchObject({ kind: 'solid', id: 'test.parapet' });
  });
  it('draws an open rail as posts ≤ 2 m apart and bars, 1.05 high (collision is what is drawn)', () => {
    const r = solid('test.rail', OPEN_RAIL_KIND, 'timber', 'rail'); openRail(r, [[0, 5, 0], [0, 5, 10]]);
    const b = solidBounds(r); expect(b.max[1]).toBeCloseTo(6.05, 6); expect(r.positions.length % 24).toBe(0);
    expect(r.indices.length / 36).toBe(6 + 5 * 3);   // six posts; per bay a top rail, a mid rail and a kicker
  });
});

describe('the Greenway definition (MANIFEST profiles.greenway, structures.greenway)', () => {
  const L = greenwayLine(), P = M.profiles.greenway;
  it('is a 6 m, ≤ 5 % deck at least 0.6 over the ground or water, 1.13 km from Reach Gate to Bluff End', () => {
    expect(P.surface_m).toBe(6); expect(P.grade_max_pct).toBe(5); expect(P.rail_h).toBe(1.05); expect(P.modes).toEqual(['feet', 'bicycle', 'board']);
    expect(L.length).toBeGreaterThan(1125); expect(L.length).toBeLessThan(1135);
    expect(L.full[0]![0]).toBeCloseTo(1215, 1); expect(L.full[0]![2]).toBeCloseTo(1317.5, 1);
    expect(L.full.at(-1)![0]).toBeCloseTo(870.1, 1); expect(L.full.at(-1)![2]).toBeCloseTo(705.3, 1);
    for (let i = 1; i < L.pts.length; i++) { const a = L.pts[i - 1]!, b = L.pts[i]!; expect(Math.abs(b[1] - a[1]) / Math.hypot(b[0] - a[0], b[2] - a[2])).toBeLessThanOrEqual(.05 + 1e-9); }
    L.full.forEach((p, i) => expect(p[1] - Math.max(L.ground[i]!, 0)).toBeGreaterThanOrEqual(.6 - .005));
    // The drawn line's lowest deck is 1.43 (over the sea by the Paddle Dock), its highest Bluff End's 18.53.
    const deck = L.full.map(p => p[1]); expect(Math.min(...deck)).toBeGreaterThan(1.4); expect(Math.max(...deck)).toBeCloseTo(18.53, 1);
  });
  it('is legal for feet, bicycles and boards (a boardwalk-kind bed of class greenway); no cars', () => {
    expect(bedClass({ kind: 'boardwalk', profile: 'greenway' })).toBe('greenway');
    expect(BOARD_PROFILE.beds).toContain('greenway'); expect(BICYCLE_PROFILE.beds).toContain('greenway');
    expect(P.cars).toBe(false);
  });
  it('regenerates the marsh pools with the prototype\'s generator (mulberry32 seed 4242)', () => {
    const r = mulberry32(4242); expect([r(), r(), r()].map(v => Number(v.toFixed(6)))).toEqual([0.546706, 0.278609, 0.931237]);
  });
});

// ---- the committed bake (one load: the definition, the terrain and the runtime geography the movers use) ----
interface Baked { field: TerrainField; solids: StructureSolid[]; beds: BedCut[]; waters: WaterCut[]; json: Record<string, any>; world: ReturnType<typeof parseHorizonDefinition>; geo: ReturnType<typeof createHorizonGeography>; deps: MoverDeps }
let W: Baked;
const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
beforeAll(() => {
  const world = parseHorizonDefinition(ab(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))), field = decodeTerrainAsset(ab(readFileSync('public/horizon/terrain/horizon-geo-1.bin')), 'full');
  const geo = createHorizonGeography(field, { ...world.collision, solids: world.geometry.solids, diagnostics: world.diagnostics ?? [] } as never);
  geo.addDynamic(createMountainV2Region({ walkingJoinSolids: world.geometry.solids, horizonGround: (x, z) => sampleTerrain(field, x, z), yield: terraceBedExclusion(world.collision.beds), exclude: mouthExclusion(world.collision.mouths), terrainStep: field.step }).provider);
  const solids = world.geometry.solids.map(q => ({ ...q, id: (q as { sourceId?: string }).sourceId ?? q.id.split('@')[0]! })) as StructureSolid[];
  W = { field, solids, beds: world.collision.beds as BedCut[], waters: world.collision.waters as WaterCut[], json: world as unknown as Record<string, any>, world, geo, deps: { world, geography: geo, manifest: M, reducedMotion: false, calm: false, tier: 'full' } as MoverDeps };
}, 180_000);
const of = (prefix: string) => W.solids.filter(s => s.id === prefix || s.id.startsWith(`${prefix}.`));
const bedOf = (id: string) => W.beds.find(b => b.id === id)!;
const diag = (id: string) => (W.json.diagnostics as { id: string; severity: string; measured?: number; required?: number }[]).filter(d => d.id === id);

describe('the Reach on the bake (reach LAND-ASKS R1–R5, D-WW18, D-WW20)', () => {
  it('rails the boardwalk (S1\'s deck), the Reach Footbridge, Spring Bay, Harbour Bell Landing and the High Span Overlook open, 1.05 over their decks', () => {
    for (const [id, deck] of [['reachBoardwalk.rails', 5], ['reachFootbridge.rails', 9.5], ['reachBoardwalk.meetingRail', 5], ['quayBridge.meetingRail', 9], ['highSpan.overlook.rails', 10]] as const) {
      const parts = W.solids.filter(s => s.id === id); expect(parts.length, id).toBeGreaterThan(0);
      for (const s of parts) { expect(s.kind, id).toBe(OPEN_RAIL_KIND); expect(isOpenRail(s)).toBe(true); expect(solidBounds(s).max[1], id).toBeLessThanOrEqual(deck + 1.05 + .02); }
    }
    // The footbridge's 1.15 stone parapet is gone (it cut Spring Bay → the campanile, world/story.ts).
    expect(W.solids.some(s => s.id.startsWith('reachFootbridge.') && s.kind === 'parapet')).toBe(false);
  });
  it('stands Notch Bluff and Sunset Rail on stone pads at their measured tops, kerbed and railed, with step-free stubs to the road', () => {
    for (const [id, top, road] of [['notchBluff', 23.5, 'VG'], ['sunsetRail', 11.09, 'V01']] as const) {
      const pad = of(`${id}.pad`)[0]!; expect(solidBounds(pad).max[1]).toBeCloseTo(top, 3);
      expect(of(`${id}.kerbs`).length).toBeGreaterThan(0); expect(solidBounds(of(`${id}.rails`)[0]!).max[1]).toBeCloseTo(top + 1.05, 2);
      // A plain walk bed (gravel drawn by the bed geometry), so the corridor opens the road's kerb for it; it ends on the
      // road's paved edge at the road's height (a register junction row, source: The Water's Way L2a).
      const stub = bedOf(`${id}.stub`); expect(stub).toMatchObject({ kind: 'walk', width: 1.8 });
      for (let i = 1; i < stub.points.length; i++) { const a = stub.points[i - 1]!, b = stub.points[i]!; expect(Math.abs(b[1] - a[1]) / Math.hypot(b[0] - a[0], b[2] - a[2]), id).toBeLessThanOrEqual(.08); }
      const end = stub.points.at(-1)!, r = closestOnPolyline(bedOf(road).points, end[0], end[2]); expect(r.distance).toBeLessThanOrEqual(bedOf(road).width / 2); expect(Math.abs(end[1] - r.point[1])).toBeLessThan(.15);
      expect(M.crossings.some(row => row.a === `${id}.stub` && row.b === road && row.resolution === 'threshold')).toBe(true);
      const d = diag(`structures.${id}.stub`)[0]!; expect(d.severity).toBe('info'); expect(d.measured!).toBeLessThanOrEqual(.08);
    }
  });
  it('builds the Channel Hide off S1\'s deck: the west rail open over s 54.4–58.0, a 0.2 sill on the rail line that stops a wheel and not a walker', () => {
    const board = bedOf('structure.reachBoardwalk'), a = board.points[0]!, b = board.points.at(-1)!, len = Math.hypot(b[0] - a[0], b[2] - a[2]), f = [(b[0] - a[0]) / len, (b[2] - a[2]) / len], n = [-f[1]!, f[0]!];
    const P = (s: number, o: number) => [a[0] + f[0]! * s + n[0]! * o, a[2] + f[1]! * s + n[1]! * o] as const;
    const railAt = (s: number) => { const [x, z] = P(s, 1.875); return W.solids.filter(q => q.id === 'reachBoardwalk.rails').some(q => { const r = solidVerticalRangeAt(q, x, z); return !!r && r.top > 5.5; }); };
    for (const s of [55, 56.2, 57.4]) expect(railAt(s), `rail at s ${s}`).toBe(false);
    for (const s of [50, 53, 59.5, 62]) expect(railAt(s), `rail at s ${s}`).toBe(true);
    const sill = of('channelHide.sill')[0]!, [sx, sz] = P(56.2, 1.875), r = solidVerticalRangeAt(sill, sx, sz)!;
    expect(r.top - 5).toBeGreaterThan(BOARD_PROFILE.contact.stepMax); expect(r.top - 5).toBeLessThanOrEqual(.48);
    expect(sill.role).toBe('floor');
    const floor = of('channelHide.floor')[0]!; expect(solidBounds(floor).max[1]).toBeCloseTo(5, 3);
    expect(of('channelHide.blind').length).toBeGreaterThan(0);
    // The hide's own bed starts inside S1's west deck edge (never on S1's centreline, where the west channel's crossing under
    // the deck is proved): the join is a documented register junction (no marker), the sill is its physical guard.
    const hide = bedOf('structure.channelHide'); expect(hide).toBeTruthy();
    const [ex, ez] = P(56.2, 1.6); expect(Math.hypot(hide.points[0]![0] - ex, hide.points[0]![2] - ez)).toBeLessThan(.3);
    expect(M.crossings.some(row => row.a === 'S1' && row.b === 'channelHide' && row.resolution === 'threshold')).toBe(true);
  });
  it('moves page I to the boardwalk\'s north end (night line: the High Span\'s lights) and calls the Quay Bridge "the drawbridge"', () => {
    const I = M.views.find(v => v.id === 'I')! as typeof M.views[number] & { nightLine?: string; eyeH?: number };
    expect(I.xy).toEqual([1247.5, 1218]); expect(I.eyeH).toBe(5.98); expect(I.target).toEqual([1250, 1184]); expect(I.target_h).toBe(5.7); expect(I.fov_deg).toBe(55);
    expect(I.bestHour).toBe('morning'); expect(I.also).toBe('dusk'); expect(I.nightLine).toMatch(/High Span/);
    expect((M.structures.quayBridge as { label?: string }).label).toBe('the drawbridge');
    expect(M.names.structures).toContain('the drawbridge'); expect(M.names.structures).not.toContain('Quay Bridge');
  });
  it('reserves the osprey pole\'s footing: no bed, pad or pool within 9 m of [1292,1268]', () => {
    const at = M.structures.ospreyPole.xy;
    for (const b of W.beds) if (b.points.length > 1) expect(closestOnPolyline(b.points, at[0]!, at[1]!).distance, b.id).toBeGreaterThan(9 - b.width / 2);
    for (const w of W.waters.filter(q => q.id.startsWith('water.marsh.'))) expect(Math.min(...w.outline.map(p => Math.hypot(p[0] - at[0]!, p[1] - at[1]!)))).toBeGreaterThan(9);
  });
});

describe('the Greenway on the bake (D-WW22)', () => {
  const L = () => greenwayLine();
  it('is one structure bed of profile greenway on the drawn line, cutting no terrain; the terrain stays under its deck', () => {
    const b = bedOf('structure.greenway'); expect(b).toMatchObject({ kind: 'boardwalk', profile: 'greenway', width: 6, terrainCut: false });
    for (let s = 0; s < L().length; s += 4) { const p = L().at(s).p; expect(terrainHeight(W.field, p[0], p[2]), `s ${s}`).toBeLessThan(p[1] - .3); }
    expect((W.json.lines as { id: string; mode: string }[]).find(l => l.id === 'greenway')).toMatchObject({ mode: 'walk' });
  });
  it('keeps off: ≥ 6.8 m + half-width off every walk, skate, road or trail bed except where it bridges one; outside the Green and the Reach meadow', () => {
    const own = /^(structure\.greenway|structure\.(notchBluff|sunsetRail|channelHide))/, ko = M.structures.greenway.keepOff, bridges = M.structures.greenway.bridges;
    for (let s = 0; s <= L().length; s += 2) {
      const q = L().at(s).p;
      expect(Math.hypot(q[0] - ko.green[0]!, q[2] - ko.green[1]!)).toBeGreaterThan(ko.green[2]!);
      expect(Math.hypot(q[0] - ko.reachMeadow[0]!, q[2] - ko.reachMeadow[1]!)).toBeGreaterThan(ko.reachMeadow[2]!);
      if (bridges.some(br => s >= br.s[0]! - 20 && s <= br.s[1]! + 20)) continue;
      for (const b of W.beds) {
        if (own.test(b.id) || !['walk', 'skate', 'road', 'trail'].includes(b.kind) || b.points.length < 2 || b.id.startsWith('structure.')) continue;
        expect(closestOnPolyline(b.points, q[0], q[2]).distance - b.width / 2, `${b.id} at s ${s}`).toBeGreaterThanOrEqual(ko.beds_m - 2.5);
      }
    }
  });
  it('bridges S4 and the Year Walk twice: registered, built, ≥ 3.6 clear under the girders (the baked clearance diagnostics)', () => {
    const proofs = (W.json.crossingProofs as { a: string; b: string; registered: boolean; built: boolean; resolution: string; clearHeight: number }[]).filter(p => p.a === 'greenway' || p.b === 'greenway');
    // A proof's resolution reads from its `a` (the register row is flipped when the intersection names the lower bed first).
    const over = (other: string) => proofs.filter(p => p.a === 'greenway' && p.b === other && p.resolution === 'over' || p.b === 'greenway' && p.a === other && p.resolution === 'under');
    expect(over('S4')).toHaveLength(1); expect(over('yearWalk')).toHaveLength(2);
    for (const p of [...over('S4'), ...over('yearWalk')]) expect(p).toMatchObject({ registered: true, built: true });
    const clear = (W.json.diagnostics as { id: string; severity: string; measured: number; required: number }[]).filter(d => /^structures\.greenway\.(twinCrossing|calendarBridge)\.clear\./.test(d.id));
    expect(clear.length).toBeGreaterThanOrEqual(3);
    for (const d of clear) { expect(d.severity, d.id).toBe('info'); expect(d.measured, d.id).toBeGreaterThanOrEqual(3.6); }
    // Measured on the baked solids: the girders' underside over the lower beds' surfaces where the Greenway crosses them.
    const girders = W.solids.filter(s => s.id.startsWith('greenway.girders.'));
    for (const [bed, at] of [['S4', [986.2, 1320.3]], ['yearWalk', [950.8, 1324.8]], ['yearWalk', [732.2, 1180.7]]] as const) {
      const low = closestOnPolyline(bedOf(bed).points, at[0], at[1]).point[1];
      let under = Infinity; for (const g of girders) for (const off of [-2.1, 2.1]) for (const dz of [-1, 0, 1]) { const r = solidVerticalRangeAt(g, at[0] + off * .2, at[1] + dz); if (r) under = Math.min(under, r.bottom); }
      if (Number.isFinite(under)) expect(under - low, `${bed} at ${at}`).toBeGreaterThanOrEqual(3.6);
    }
  });
  it('carries open timber rails at ±3.05 (1.05 high) and steel pickets on the two bridges, open where the side places join', () => {
    const rails = W.solids.filter(s => s.id.startsWith('greenway.rails')); expect(rails.length).toBeGreaterThan(0);
    for (const r of rails) expect(r.kind).toBe(OPEN_RAIL_KIND);
    expect(rails.some(r => r.surface === 'metal')).toBe(true);
    const at = (s: number, o: number) => { const p = L().at(s).W(o); return rails.some(r => { const v = solidVerticalRangeAt(r, p[0], p[2]); return !!v && v.top > p[1] + .9; }); };
    for (const s of [130, 400, 690, 790, 962]) expect(at(s, -3.05), `left gap at ${s}`).toBe(false);
    for (const s of [100, 300, 600, 900]) { expect(at(s, -3.05), `left rail at ${s}`).toBe(true); expect(at(s, 3.05), `right rail at ${s}`).toBe(true); }
  });
  it('builds the places: Reach Gate and its bridge to the quay, the Reed Maze trail and the Dune Overlook, the Twin Crossing bays, the Marsh Hide, the Arch Pier, the Paddle Dock, the Sunset Balcony, Bluff End', () => {
    for (const id of ['greenway.terrace.deck', 'greenway.gateBridge.deck', 'greenway.reedTrail.deck', 'greenway.reedTrail.maze.deck', 'greenway.reedTrail.dunes.deck', 'greenway.overlook.deck', 'greenway.marshHide.floor', 'greenway.archPier.deck', 'greenway.paddleDock.deck', 'greenway.sunsetBalcony.deck', 'greenway.bluffEnd.deck'])
      expect(W.solids.some(s => s.id === id), id).toBe(true);
    expect(W.solids.some(s => s.id.startsWith('greenway.bays.'))).toBe(true);
    // The Gate Bridge lands on the Landing quay at its level; the dock floats 0.55 over the sea (the register's 0.5 rule); Bluff End is the deck's end level.
    const gb = bedOf('structure.greenway.gateBridge'), q = gb.points.at(-1)!; expect(q[1]).toBeCloseTo(4.7, 2);
    for (let i = 1; i < gb.points.length; i++) { const a = gb.points[i - 1]!, b = gb.points[i]!; expect(Math.abs(b[1] - a[1]) / Math.hypot(b[0] - a[0], b[2] - a[2])).toBeLessThanOrEqual(.08); }
    // Over the Reach west channel's mouth with rowing headroom (registered over, built on its piles, ≥ 4 clear).
    const gate = (W.json.crossingProofs as { id: string; built: boolean; clearHeight: number }[]).find(p => p.id === 'cross.greenwayGateBridge.reachChannel1.1')!;
    expect(gate).toMatchObject({ built: true }); expect(gate.clearHeight).toBeGreaterThanOrEqual(4);
    expect(closestOnPolyline(bedOf('landingQuay').points, q[0], q[2]).distance).toBeLessThan(7);
    expect(solidBounds(of('greenway.paddleDock.deck')[0]!).max[1]).toBeCloseTo(.55, 3);
    expect(solidBounds(of('greenway.bluffEnd.deck')[0]!).max[1]).toBeCloseTo(L().full.at(-1)![1], 2);
  });
  it('joins the path graph: one connected walk from the Landing quay along the deck to Bluff End and out to the Arch Pier\'s head', () => {
    const g = W.json.pathGraph as { nodes: { id: string; at: number[] }[]; edges: { from: string; to: string; bedId: string }[] };
    const adj = new Map<string, string[]>(); for (const e of g.edges) { (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)!).push(e.to); (adj.get(e.to) ?? adj.set(e.to, []).get(e.to)!).push(e.from); }
    const near = (x: number, z: number) => g.nodes.reduce((best, n) => Math.hypot(n.at[0]! - x, n.at[2]! - z) < Math.hypot(best.at[0]! - x, best.at[2]! - z) ? n : best);
    const start = near(1270, 1340), seen = new Set([start.id]), queue = [start.id];
    while (queue.length) { const id = queue.shift()!; for (const n of adj.get(id) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n); } }
    for (const [x, z, what] of [[870.1, 705.3, 'the deck end'], [861.2, 706.9, 'Bluff End'], [613, 1092, 'the Arch Pier'], [1049, 1356, 'the Dune Overlook']] as const) {
      const n = near(x, z); expect(Math.hypot(n.at[0]! - x, n.at[2]! - z), what).toBeLessThan(6); expect(seen.has(n.id), `${what} reachable from the Landing quay`).toBe(true);
    }
    expect(g.edges.some(e => e.bedId === 'structure.greenway')).toBe(true);
  });
  it('marks both ends with built thresholds (pick up / park: feet, bicycles, boards)', () => {
    for (const id of ['greenwayGate', 'greenwayBluff']) {
      const t = (W.json.thresholds as { id: string; built: boolean; modes: string[] }[]).find(q => q.id === id)!;
      expect(t, id).toBeTruthy(); expect(t.built, id).toBe(true); expect(t.modes).toEqual(expect.arrayContaining(['feet→board', 'feet→bicycle', 'board→feet']));
    }
  });
});

describe('the scraped marsh pools on the bake (D-WW23)', () => {
  const pools = () => W.waters.filter(w => w.id.startsWith('water.marsh.'));
  it('lays the prototype\'s 34 pools, each a shallow scrape (≤ 0.3 deep on the baked terrain) with its own water body', () => {
    expect(pools()).toHaveLength(M.structures.greenway.pools.count);
    for (const w of pools()) {
      expect(w).toMatchObject({ kind: 'lake', scrape: true }); expect(w.depth).toBeLessThanOrEqual(.3);
      const cx = w.outline.reduce((n, p) => n + p[0], 0) / w.outline.length, cz = w.outline.reduce((n, p) => n + p[1], 0) / w.outline.length;
      for (let k = 0; k < 9; k++) { const t = k / 9 * Math.PI * 2, x = cx + Math.cos(t) * 1.5, z = cz + Math.sin(t) * 1.5; expect(w.level - terrainHeight(W.field, x, z), `${w.id} at [${x.toFixed(1)},${z.toFixed(1)}]`).toBeLessThanOrEqual(.3 + .02); }
      expect(w.level - terrainHeight(W.field, cx, cz), w.id).toBeGreaterThan(0);
    }
  });
  it('keeps every pool off the beds (a route\'s surface never runs in a pool) and off the pads', () => {
    const wet = (W.json.crossingProofs as { kind?: string; waterBodyIds?: string[] }[]).filter(p => p.kind === 'waterBody' && p.waterBodyIds?.some(id => id.startsWith('water.marsh.')));
    expect(wet).toEqual([]);
    const pads = (W.json.collision.pads as { id: string; centre: number[]; size: number[]; rotationDegrees: number; underground?: boolean }[]).filter(p => !p.underground);
    const inPad = (p: typeof pads[number], x: number, z: number) => { const a = p.rotationDegrees * Math.PI / 180, dx = x - p.centre[0]!, dz = z - p.centre[2]!; return Math.abs(dx * Math.cos(a) + dz * Math.sin(a)) <= p.size[0]! / 2 && Math.abs(-dx * Math.sin(a) + dz * Math.cos(a)) <= p.size[1]! / 2; };
    for (const w of pools()) for (const p of pads) for (const q of w.outline) expect(inPad(p, q[0], q[1]), `${w.id} in ${p.id}`).toBe(false);
  });
});

// ---- the movers on the bake: walking the Greenway both ways, the bicycle on its wheel lane, the board on S1 by the Channel Hide ----
/** Plan points every 0.5 m along a line offset `off` (+ = the line's own right, r = (−f.z, f.x)). */
function laneLine(points: readonly (readonly number[])[], off: number, reverse: boolean) {
  const pts = reverse ? [...points].reverse() : [...points], out: { x: number; y: number; z: number }[] = [];
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1]!, b = pts[i]!, l = Math.hypot(b[0]! - a[0]!, b[2]! - a[2]!), n = Math.max(1, Math.ceil(l / .5)), r = [-(b[2]! - a[2]!) / l, (b[0]! - a[0]!) / l];
    for (let k = i > 1 ? 1 : 0; k <= n; k++) { const t = k / n; out.push({ x: a[0]! + (b[0]! - a[0]!) * t + r[0]! * off, y: a[1]! + (b[1]! - a[1]!) * t, z: a[2]! + (b[2]! - a[2]!) * t + r[1]! * off }); } }
  return out;
}
const nearestK = (Q: { x: number; z: number }[], x: number, z: number, k: number) => { let best = k, d = Infinity; for (let j = Math.max(0, k - 6); j < Math.min(Q.length, k + 60); j++) { const e = (Q[j]!.x - x) ** 2 + (Q[j]!.z - z) ** 2; if (e < d) { d = e; best = j; } } return best; };
describe('the movers on the Greenway and the Reach boardwalk (the bake\'s runtime geography)', () => {
  // The long mover runs yield to the event loop now and then, so the worker answers vitest's RPC (no onTaskUpdate timeout).
  const breathe = () => new Promise(r => setTimeout(r, 0));
  it('walks (runs) the Greenway end to end in both directions without a stall or a fall', async () => {
    const ww = horizonWalkWorld(W.geo, W.world.extent, () => true, HORIZON_WALKABLE_DEGREES), speeds = { walk: 2.4, run: 5 };
    for (const reverse of [false, true]) {
      const Q = laneLine(bedOf('structure.greenway').points, -1.6, reverse), s0 = Q[4]!, surf = W.geo.surface(s0.x, s0.z, s0.y + .5, .48)!;
      const body: WalkBody = { x: s0.x, y: surf.y, z: s0.z, yaw: 0 }, state = createWalkState(body), move = (dx: number, dz: number) => walkMove(ww, body, dx, dz, { swimming: false, grounded: true });
      let k = 4, last = 4, stall = 0, t = 0, maxDrop = 0;
      for (let n = 0; t < 600 && k < Q.length - 6; t += WALK_FIXED_DT) {
        if (++n % 600 === 0) await breathe();
        k = nearestK(Q, body.x, body.z, k); if (k > last) { last = k; stall = 0; } else if ((stall += WALK_FIXED_DT) > 3) break;
        const tg = Q[Math.min(Q.length - 1, k + 3)]!, dx = tg.x - body.x, dz = tg.z - body.z, l = Math.hypot(dx, dz) || 1;
        walkTick(state, body, { wishX: dx / l, wishZ: dz / l, run: true, speeds }, WALK_FIXED_DT, move);
        maxDrop = Math.max(maxDrop, Q[k]!.y - body.y);
      }
      expect(k, `${reverse ? 'Bluff End → Reach Gate' : 'Reach Gate → Bluff End'}: stopped at [${body.x.toFixed(1)},${body.y.toFixed(1)},${body.z.toFixed(1)}]`).toBeGreaterThanOrEqual(Q.length - 6);
      expect(maxDrop).toBeLessThan(.3);
    }
  }, 180_000);
  it('rides a bicycle (the cruiser sim) along the wheel lane in both directions: no stall, no restart, never off the deck', async () => {
    for (const reverse of [false, true]) {
      // The wheel lane is on the Greenway's + side (its own right walking toward Bluff End): +1.27, and −1.27 when reversed.
      const Q = laneLine(bedOf('structure.greenway').points, reverse ? -1.27 : 1.27, reverse), s0 = Q[6]!, yaw = Math.atan2(Q[8]!.x - s0.x, Q[8]!.z - s0.z), surf = W.geo.surface(s0.x, s0.z, s0.y + .3, .8)!;
      let s = createCruiserState(validCruiserPosition(W.geo, { x: s0.x, y: surf.y, z: s0.z, yaw })!), k = 6, last = 6, stall = 0, t = 0, maxDrop = 0, off = 0;
      for (let n = 0; t < 400 && k < Q.length - 8; t += CRUISER.dt) {
        if (++n % 300 === 0) await breathe();
        k = nearestK(Q, s.x, s.z, k); if (k > last) { last = k; stall = 0; } else if ((stall += CRUISER.dt) > 2) break;
        const v = cruiserSpeed(s), tg = Q[Math.min(Q.length - 1, k + Math.round(Math.max(6, Math.min(8, 6 + v * .125)) / .5))]!;
        const alpha = Math.atan2(Math.sin(Math.atan2(tg.x - s.x, tg.z - s.z) - s.yaw), Math.cos(Math.atan2(tg.x - s.x, tg.z - s.z) - s.yaw)), D = Math.max(1, Math.hypot(tg.x - s.x, tg.z - s.z));
        const rate = CRUISER.steerLow + (CRUISER.steerHigh - CRUISER.steerLow) * Math.max(0, Math.min(1, v / CRUISER.speed)), steer = Math.max(-1, Math.min(1, -2 * Math.sin(alpha) / D * Math.max(v, 2) / rate));
        s = stepCruiser(s, { forward: v > 9 ? 0 : .6, steer, jump: false }, W.geo);
        maxDrop = Math.max(maxDrop, Q[k]!.y - s.y); off = Math.max(off, Math.hypot(s.x - Q[k]!.x, s.z - Q[k]!.z));
      }
      expect(k, `${reverse ? 'reverse' : 'forward'}: stopped at [${s.x.toFixed(1)},${s.y.toFixed(1)},${s.z.toFixed(1)}] after ${t.toFixed(1)} s`).toBeGreaterThanOrEqual(Q.length - 8);
      expect(maxDrop).toBeLessThan(.5); expect(off).toBeLessThan(1.6);
    }
  }, 180_000);
  it('rides the board down S1 over the open-rail boardwalk without a bail, and a skater aimed at the Channel Hide never gets past its sill', () => {
    const s1 = bedPath(bedOf('S1') as never), board = bedOf('structure.reachBoardwalk'), A = board.points[0]!, B = board.points.at(-1)!;
    const from = progressOf(s1, A[0], A[2], 0, 4000).d - 15, to = progressOf(s1, B[0], B[2], from, 400).d + 12;
    const run = runLine(W.deps, 'S1', { from, to, speed: 7, restart: true });
    expect(run.bails, `S1 over the boardwalk: ${run.reason}${run.blockedBy ? ` (${run.blockedBy})` : ''}`).toBe(0); expect(run.reason).toBe('end');
    // The skate guard: from the deck's centre near s 50–56, heading 20–70° toward the hide at 4–10 m/s, steering either way.
    const len = Math.hypot(B[0] - A[0], B[2] - A[2]), f = [(B[0] - A[0]) / len, (B[2] - A[2]) / len], n = [-f[1]!, f[0]!];
    const at = (sAlong: number, o: number) => [A[0] + f[0]! * sAlong + n[0]! * o, A[2] + f[1]! * sAlong + n[1]! * o] as const;
    let worst = -Infinity;
    for (const s0 of [50, 53, 56]) for (const deg of [20, 45, 70]) for (const v of [4, 7, 10]) for (const steer of [-1, 0, 1]) {
      const c = createBoardController(W.deps), [x, z] = at(s0, .2), th = deg * Math.PI / 180, dir = [f[0]! * Math.cos(th) + n[0]! * Math.sin(th), f[1]! * Math.cos(th) + n[1]! * Math.sin(th)];
      c.place({ x, z, y: 5, heading: Math.atan2(dir[0]!, dir[1]!), speed: v });
      for (let t = 0; t < 2.5 && (t === 0 || groundSpeed(c.state()) > .05); t += 1 / 120) {
        c.update(1 / 120, moverInputOf({ steer }), t); const p = c.state().p, along = (p[0] - A[0]) * f[0]! + (p[2] - A[2]) * f[1]!, west = (p[0] - A[0]) * n[0]! + (p[2] - A[2]) * n[1]!;
        if (along > 52 && along < 61) worst = Math.max(worst, west);
      }
    }
    expect(worst, 'the board\'s furthest reach west of the deck\'s centreline beside the hide').toBeLessThan(2.05);
  }, 180_000);
});
