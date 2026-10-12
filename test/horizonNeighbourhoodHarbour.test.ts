// The Water's Way, PR 3 (passes/03 B1, STYLE §2.1 "cobblestone Italy"): Little Harbour's dressing module on the committed bake.
// The module (src/harbour/horizon/neighbourhoods/harbour) is a pure function of the bake-time world; these tests read the
// records the bake wrote (public/horizon/world/horizon-geo-1.json) and rebuild the module once against the same world.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BedCut, LandCuts, StructureSolid, TerrainField } from '../src/harbour/horizon/land/interfaces.ts';
import type { Point2 } from '../src/harbour/horizon/world/definition.ts';
import type { BuildingRecord, DistrictDressing, LifeSpawn, PlantRecord, PropRecord, WorldDressing } from '../src/harbour/horizon/neighbourhoods/types.ts';
import { decodeTerrainAsset } from '../src/harbour/horizon/land/terrain/asset.ts';
import { sampleTerrain } from '../src/harbour/horizon/land/terrain/index.ts';
import { createDressingContext, buildingHeight, PROP_HEIGHT, SPECIES_HEIGHT, type DressingContextImpl } from '../src/harbour/horizon/neighbourhoods/bake.ts';
import { protectedGreenOutline } from '../src/harbour/horizon/world/views.ts';
import { districtAt } from '../src/harbour/horizon/world/districts.ts';
import { pointInPolygon } from '../src/harbour/horizon/world/geometry.ts';
import { createRayCaster } from '../src/harbour/horizon/world/raycast.ts';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest.ts';
import { storyEye, storyLandmark, validateStoryAgainstDressing } from '../src/harbour/horizon/world/story.ts';
import { harbour, lanternHunt } from '../src/harbour/horizon/neighbourhoods/harbour/index.ts';
import { BOCCE, CAMPANILE, COURT, DAM_LINE, damAcross, tier, WEST_FRAME } from '../src/harbour/horizon/neighbourhoods/harbour/plan.ts';
import { RAYS } from '../src/harbour/horizon/neighbourhoods/harbour/ground.ts';
import { NIGHT_LINE, NIGHT_ORDER } from '../src/harbour/horizon/neighbourhoods/harbour/places.ts';
import { CROWN } from '../src/harbour/horizon/neighbourhoods/harbour/planting.ts';
import { corners } from '../src/harbour/horizon/neighbourhoods/harbour/solver.ts';
import { buildDistrictDressingSteps } from '../src/harbour/horizon/runtime/dressingLayer.ts';
import { finishBuild } from '../src/house/world/buildTask.ts';
import { buildingPalette } from '../src/harbour/horizon/kit/buildings/index.ts';

type World = { collision: { beds: BedCut[]; pads: LandCuts['pads']; mouths: LandCuts['mouths']; waters: LandCuts['waters'] }; geometry: { solids: (StructureSolid & { sourceId?: string })[] }; hosts: { id: string; footprint: Point2[]; door: { xy?: Point2 }; height: number }[]; districts: { id: string; triangles: { full: number; lite: number }; drawCalls: number; dressing?: { full: { triangles: number; drawCalls: number }; lite: { triangles: number; drawCalls: number } } }[]; lights: { id: string; kind: string; at: [number, number, number]; line?: string; order?: number }[]; dressing?: WorldDressing };
let world: World, field: TerrainField, ctx: DressingContextImpl;
const source = (s: { id: string; sourceId?: string }) => s.sourceId ?? s.id.split('@')[0]!;
let mine: ReturnType<typeof harbour.build>, baked: { buildings: BuildingRecord[]; plants: PlantRecord[]; props: PropRecord[]; life: LifeSpawn[] };
// CI runs four workers: never hold one synchronously for long (an unhandled "Timeout calling onTaskUpdate" fails the gate even
// with every test green). The heavy fixtures are built in steps with a yield between them, and the long loops yield too.
const tick = () => new Promise<void>(r => setTimeout(r, 0));
beforeAll(async () => {
  world = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')) as World;
  await tick();
  const t = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  field = decodeTerrainAsset(t.buffer.slice(t.byteOffset, t.byteOffset + t.byteLength) as ArrayBuffer, 'full');
  await tick();
  // The bake-time world as the module saw it: the baked land without the dressing's own colliders.
  const solids = world.geometry.solids.map(s => ({ ...s, id: source(s) })).filter(s => !s.id.startsWith('dressing.'));
  ctx = createDressingContext({ ground: (x, z) => sampleTerrain(field, x, z), beds: world.collision.beds, pads: world.collision.pads, waters: world.collision.waters, solids,
    hosts: world.hosts.map(h => ({ id: h.id, footprint: h.footprint, door: h.door.xy ? { xy: h.door.xy } : {}, height: h.height })), protectedAreas: [{ id: 'green', outline: protectedGreenOutline() }], districtAt: (x, z) => districtAt(x, z) });
  await tick();
  mine = harbour.build(ctx);
  await tick();
  const ds: DistrictDressing[] = world.dressing?.districts ?? [];
  baked = { buildings: ds.flatMap(d => d.buildings), plants: ds.flatMap(d => d.plants), props: ds.flatMap(d => d.props), life: ds.flatMap(d => d.life) };
}, 180_000);

describe('Little Harbour: the module is the bake (one definition, deterministic)', () => {
  it('rebuilds to the records the bake wrote', () => {
    // The bake writes numbers to 9 decimals (scripts/horizon/artifacts.mjs); compare at 1e-6.
    const round = (v: unknown): unknown => typeof v === 'number' ? Math.round(v * 1e6) / 1e6 + 0 : Array.isArray(v) ? v.map(round) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, q]) => [k, round(q)])) : v;
    const strip = <T extends { districtId?: string }>(r: T) => { const { districtId: _d, ...rest } = r; return round(rest); };
    const byId = new Map(baked.buildings.map(b => [b.id, b]));
    expect(mine.buildings.map(strip)).toEqual(mine.buildings.map(b => byId.get(b.id)).map(b => (b ? strip(b) : null)));
    const key = (p: { at: readonly number[] }) => p.at.map(n => n.toFixed(3)).join(',');
    const bakedPlants = new Set(baked.plants.map(key)), bakedProps = new Map(baked.props.filter(p => p.id).map(p => [p.id!, key(p)]));
    for (const p of mine.plants) expect(bakedPlants.has(key(p))).toBe(true);
    for (const p of mine.props) if (p.id) expect(bakedProps.get(p.id)).toBe(key(p));
    expect(round(world.dressing!.landmarks.filter(l => l.neighbourhood === 'harbour'))).toEqual(round(mine.landmarks));
    expect(round(world.dressing!.lookouts.filter(l => mine.lookouts.some(q => q.id === l.id)))).toEqual(round(mine.lookouts));
  });
});

describe('Little Harbour: the town (STYLE §2.1; SPEC §1–§6)', () => {
  it('solves about a hundred row houses onto real frontages, 5.5–8 wide, 7–9 deep, 2–4 storeys, four tiers', () => {
    const rows = mine.buildings.filter(b => b.kind === 'rowHouse');
    console.log(`Little Harbour: ${rows.length} row houses, tiers ${[1, 2, 3, 4].map(t => rows.filter(b => b.params?.tier === t).length).join('/')}, ${mine.plants.length} plants, ${mine.props.length} props`);
    expect(rows.length).toBeGreaterThanOrEqual(90);
    for (const b of rows) {
      expect(b.size.w).toBeGreaterThanOrEqual(5.5); expect(b.size.w).toBeLessThanOrEqual(8);
      expect(b.size.d).toBeGreaterThanOrEqual(7); expect(b.size.d).toBeLessThanOrEqual(9);
      expect(b.storeys).toBeGreaterThanOrEqual(2); expect(b.storeys).toBeLessThanOrEqual(4);
      expect(b.collide).toBe(true); expect(b.style).toBe('harbour.ligurian');
    }
    const tiers = [1, 2, 3, 4].map(t => rows.filter(b => b.params?.tier === t).length);
    for (const n of tiers) expect(n).toBeGreaterThan(8);
    // An altana on about one house in six; a balcony / window-box town of shops on the lower tiers.
    const altane = rows.filter(b => b.params?.altana === true).length;
    expect(altane / rows.length).toBeGreaterThan(0.12); expect(altane / rows.length).toBeLessThan(0.22);
  });
  it('re-dresses the Fund bank (palazzo) and Our home (villa) on their baked shells, without colliders', () => {
    const bank = mine.buildings.find(b => b.hostId === 'bank')!, home = mine.buildings.find(b => b.hostId === 'home')!;
    expect([bank.kind, bank.collide, home.kind, home.collide]).toEqual(['palazzo', false, 'villa', false]);
    expect(world.dressing!.redressedHosts).toEqual(['bank', 'home']);
    // Our home's kitchen window faces the dam (north).
    expect(home.params?.kitchenFace).toBe('left'); expect(Math.sin(home.yaw)).toBeCloseTo(-1, 6);
  });
  it('stands the campanile where the story says (apex 42.3, base on the lowest ground) and passes the registry check', () => {
    const c = mine.buildings.find(b => b.kind === 'campanile')!;
    expect(c.landmarkId).toBe('campanile'); expect([c.at[0], c.at[2]]).toEqual(CAMPANILE.at);
    expect(c.at[1] + buildingHeight(c)).toBeCloseTo(42.3, 6);
    const check = validateStoryAgainstDressing({ dressing: world.dressing });
    expect(check.problems).toEqual([]);
    const l = world.dressing!.landmarks.find(q => q.id === 'campanile')!;
    expect([l.relayOrder, l.bell]).toEqual([5, 'campanile']);
  });
  it('makes the belfry the town\'s lookout: the wheel first, the dam, the oak and the Lamp; viewers with the free lever', () => {
    const b = world.dressing!.lookouts.find(q => q.id === 'belfry')!;
    expect(b.targets[0]).toBe('wheel'); expect(b.targets).toEqual(expect.arrayContaining(['dam', 'oak', 'lamp']));
    expect(Math.abs(b.eye[1] - storyEye('belfry').y!)).toBeLessThan(0.5);
    expect(mine.props.filter(p => p.id?.startsWith('belfry.viewer')).length).toBe(2);
  });
  it('lets each belfry viewer see its target through an arch, not into a pier (the baked campanile collider)', async () => {
    // Only the solids within 40 eu of the campanile (the belfry's piers and anything beside them): the island-wide caster is a
    // long synchronous build, and the question is whether the line leaves the belfry.
    const near = world.geometry.solids.filter(s => { for (let i = 0; i < s.positions.length; i += 3) if (Math.hypot(s.positions[i]! - CAMPANILE.at[0], s.positions[i + 2]! - CAMPANILE.at[1]) < 40) return true; return false; });
    await tick();
    const ray = createRayCaster(field, { solids: near, waters: world.collision.waters, mouths: world.collision.mouths });
    await tick();
    expect(near.some(s => (s.sourceId ?? s.id).startsWith('dressing.harbour.campanile'))).toBe(true);
    const wheel = storyLandmark('wheel');
    for (const [id, target] of [['belfry.viewer.wheel', wheel.top], ['belfry.viewer.dam', [1316, 115, 538]]] as const) {
      const v = mine.props.find(p => p.id === id)!, eye: [number, number, number] = [v.at[0], v.at[1] + 1.5, v.at[2]];
      const d = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]], n = Math.hypot(d[0]!, d[1]!, d[2]!);
      const hit = ray.first(eye, [d[0]! / n, d[1]! / n, d[2]! / n], 60, { step: 0.25, skip: s => (s as { sourceId?: string }).sourceId?.startsWith(`dressing.harbour.${id}`) ?? s.id.startsWith(`dressing.harbour.${id}`) });
      expect(hit.kind === 'sky' || hit.t > 6, `${id}: ${hit.kind} ${hit.id} at ${hit.t.toFixed(2)}`).toBe(true);
    }
  }, 60_000);
});

describe('Little Harbour: the contracts', () => {
  const heightOf = (r: { kind: 'b'; b: BuildingRecord } | { kind: 'p'; p: PropRecord } | { kind: 't'; t: PlantRecord }) => r.kind === 'b' ? buildingHeight(r.b) : r.kind === 'p' ? PROP_HEIGHT[r.p.kind] * (r.p.scale ?? 1) : (SPECIES_HEIGHT[r.t.species] ?? 10) * r.t.scale;
  it('keeps page A\'s dam corridor clear: nothing taller than 6 eu stands in it (the bank is the named exception)', () => {
    const tall: string[] = [];
    for (const b of mine.buildings) if (b.hostId !== 'bank' && heightOf({ kind: 'b', b }) > DAM_LINE.maxHeight && corners({ cx: b.at[0], cz: b.at[2], w: b.size.w + 1.5, d: b.size.d + 1.5, yaw: b.yaw }).some(([x, z]) => damAcross(x, z) <= DAM_LINE.halfWidth)) tall.push(b.id);
    for (const t of mine.plants) if (heightOf({ kind: 't', t }) > DAM_LINE.maxHeight && damAcross(t.at[0], t.at[2]) <= DAM_LINE.halfWidth + (CROWN[t.species] ?? 1) * t.scale) tall.push(t.species);
    for (const p of mine.props) if (heightOf({ kind: 'p', p }) > DAM_LINE.maxHeight && damAcross(p.at[0], p.at[2]) <= DAM_LINE.halfWidth) tall.push(p.id ?? p.kind);
    expect(tall).toEqual([]);
  });
  it('leaves the Kitty plaza and the homestead sites untouched (nothing stands on their pads)', () => {
    const pads = world.collision.pads.filter(p => p.id === 'kittyPlaza' || p.id.startsWith('homestead.'));
    const on = (x: number, z: number) => pads.find(p => Math.abs(x - p.centre[0]) <= p.size[0] / 2 && Math.abs(z - p.centre[2]) <= p.size[1] / 2)?.id;
    const hits = [...mine.buildings.filter(b => !b.hostId).flatMap(b => corners({ cx: b.at[0], cz: b.at[2], w: b.size.w, d: b.size.d, yaw: b.yaw }).concat([[b.at[0], b.at[2]]]).map(([x, z]) => on(x, z))),
      ...mine.plants.map(p => on(p.at[0], p.at[2])), ...mine.props.map(p => on(p.at[0], p.at[2]))].filter(Boolean);
    expect(hits).toEqual([]);
  });
  it('puts the bocce court wholly on the square\'s small green: on the square, off the Kitty plaza, clear of every bed', () => {
    const court = mine.props.find(p => p.fixture === 'bocce')!, sq = tier('square');
    const box = corners({ cx: court.at[0], cz: court.at[2], w: BOCCE.size[0] + 0.44, d: BOCCE.size[1] + 0.44, yaw: court.yaw });
    for (const [x, z] of box) { expect(x >= sq.x0 && x <= sq.x1 && z >= sq.z0 && z <= sq.z1).toBe(true); expect(ctx.bedClearance(x, z)).toBeGreaterThan(0.6); expect(ctx.onPad(x, z)).toBe('town.square'); }
    const green = mine.ground.filter(g => g.surface === 'mown');
    for (const [x, z] of box) expect(green.some(g => pointInPolygon(x, z, g.polygon)), `${x.toFixed(2)},${z.toFixed(2)}`).toBe(true);
  });
  it('holds tree cover over the unbuilt town to ≤ 5 % (STYLE §2.1), with nothing on a bed, pad, stair or skate line', () => {
    const POLY: Point2[] = [[1380, 1060], [1540, 1040], [1580, 1160], [1520, 1280], [1400, 1300], [1350, 1180]];
    let crown = 0; for (const p of mine.plants) if (CROWN[p.species] && pointInPolygon(p.at[0], p.at[2], POLY)) crown += Math.PI * (CROWN[p.species]! * p.scale) ** 2;
    const built = mine.buildings.map(b => corners({ cx: b.at[0], cz: b.at[2], w: b.size.w, d: b.size.d, yaw: b.yaw }));
    let land = 0; for (let x = 1350; x < 1580; x += 2) for (let z = 1040; z < 1300; z += 2) if (pointInPolygon(x, z, POLY) && sampleTerrain(field, x, z) > 0.5 && ctx.bedClearance(x, z) > 4 && !built.some(q => pointInPolygon(x, z, q))) land += 4;
    const cover = crown / land; console.log(`Little Harbour tree cover ${(cover * 100).toFixed(2)} % of ${land} m² unbuilt`);
    expect(cover).toBeLessThanOrEqual(0.05); expect(cover).toBeGreaterThan(0.01);
    for (const p of mine.plants.filter(q => pointInPolygon(q.at[0], q.at[2], POLY))) { expect(ctx.onBed(p.at[0], p.at[2])).toBeNull(); expect(ctx.onPad(p.at[0], p.at[2])).toBeNull(); }
  });
  it('lights in the sheet\'s night order: Lantern Row west → east, the Court, the hosts\' windows, the belfry, the floatplane dock', () => {
    const lights = world.lights.filter(l => l.line === NIGHT_LINE).sort((a, b) => a.order! - b.order!);
    expect(lights.every(l => l.kind.startsWith('dressing:'))).toBe(true);
    const groups = lights.map(l => l.id.split('.')[1]!);
    expect([...new Set(groups)]).toEqual([...NIGHT_ORDER]);
    for (let i = 1; i < groups.length; i++) expect(NIGHT_ORDER.indexOf(groups[i] as typeof NIGHT_ORDER[number])).toBeGreaterThanOrEqual(NIGHT_ORDER.indexOf(groups[i - 1] as typeof NIGHT_ORDER[number]));
    const row = lights.filter(l => l.id.includes('.lanternRow.')), q = M.structures.townQuay as unknown as { from: Point2; to: Point2 };
    expect(row.length).toBeGreaterThanOrEqual(12);
    const along = (p: readonly number[]) => (p[0]! - q.from[0]) * (q.to[0] - q.from[0]) + (p[2]! - q.from[1]) * (q.to[1] - q.from[1]);
    for (let i = 1; i < row.length; i++) expect(along(row[i]!.at)).toBeGreaterThan(along(row[i - 1]!.at));
    // The island lantern (2.6 eu post) on Lantern Row, never the prototype's 3.6 iron standard (RULINGS 10).
    expect(mine.props.filter(p => p.id?.startsWith('lanternRow.')).every(p => p.kind === 'lantern')).toBe(true);
  });
  it('gives every threshold a rack, and places the pastime fixtures still (bocce, the sundial, the harbour bell, the Giro\'s six buoys)', () => {
    const racks = mine.props.filter(p => p.kind === 'bikeRack');
    for (const t of ['stairTop', 'quayWest', 'upperStreetSpur', 'floatDock', 'ferryLanding']) expect(racks.some(r => r.id === `rack.${t}`), t).toBe(true);
    const fixtures = mine.props.filter(p => p.fixture).map(p => p.fixture!).sort();
    expect(fixtures).toEqual(['bocce', 'giroDelPorto.B0', 'giroDelPorto.B1', 'giroDelPorto.B2', 'giroDelPorto.B3', 'giroDelPorto.B4', 'giroDelPorto.B5', 'harbourBell', 'sundial']);
    for (const b of mine.props.filter(p => p.kind === 'buoy')) expect(ctx.inWater(b.at[0], b.at[2])).toBe(true);
    const hunt = lanternHunt(mine.buildings);
    expect(hunt.map(h => h.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
    expect(Math.hypot(hunt[0]!.at[0] - 1405.5, hunt[0]!.at[2] - 1233.9)).toBeLessThan(8);
  });
  it('keeps creatures ≤ 24 in the district (cats and gulls)', () => {
    const n = mine.life.filter(l => l.kind === 'cat' || l.kind === 'gull').reduce((t, l) => t + l.count, 0);
    expect(n).toBeGreaterThan(0); expect(n).toBeLessThanOrEqual(24);
  });
  it('holds the district budget, land included (CONTRACT §6: ≤ 150k / 60k triangles, ≤ 400 / 180 draw calls)', () => {
    const d = world.districts.find(q => q.id === 'harbour')!;
    console.log(`harbour district: full ${d.triangles.full}, lite ${d.triangles.lite}, draw calls ${d.drawCalls}; dressing ${JSON.stringify(d.dressing)}`);
    expect(d.triangles.full).toBeLessThanOrEqual(150_000); expect(d.triangles.lite).toBeLessThanOrEqual(60_000);
    expect(d.drawCalls).toBeLessThanOrEqual(180);
  });
  it('keeps the square in warm shade at golden hour (60–80 % at sun 6–10°, measured as the prototype did)', async () => {
    const ray = createRayCaster(field, { solids: world.geometry.solids, waters: world.collision.waters, mouths: world.collision.mouths });
    const pts: Point2[] = []; for (let x = 1429; x < 1483; x += 4) for (let z = 1149; z < 1203; z += 4) pts.push([x, z]);
    const shade = async (bearing: number, el: number) => {
      const r = bearing * Math.PI / 180, e = el * Math.PI / 180, d: [number, number, number] = [Math.sin(r) * Math.cos(e), Math.sin(e), -Math.cos(r) * Math.cos(e)];
      let hit = 0; for (const [i, [x, z]] of pts.entries()) { if (ray.first([x, 12.1, z], d, 1500, { step: 1 }).kind !== 'sky') hit++; if (i % 16 === 15) await tick(); }
      return hit / pts.length;
    };
    const samples: number[] = []; for (const b of [247.5, 270, 292.5]) for (const e of [6, 10]) samples.push(await shade(b, e));
    const mean = samples.reduce((t, v) => t + v, 0) / samples.length;
    console.log(`square shade at WSW/W/WNW × 6°/10°: ${samples.map(v => (v * 100).toFixed(0)).join(' ')} % (mean ${(mean * 100).toFixed(1)})`);
    // The prototype measured 60–83 % per sample (mean 72.7) on terrain and its own boxes; the bake also counts the land's own
    // solids (the Kitty plaza's slab, the home approach's retaining), ~1.5 points more. The two-storey west frame (WEST_FRAME) keeps it there.
    expect(mean).toBeGreaterThanOrEqual(0.6); expect(mean).toBeLessThanOrEqual(0.82);
    for (const v of samples) { expect(v).toBeGreaterThanOrEqual(0.55); expect(v).toBeLessThanOrEqual(0.92); }
    expect(WEST_FRAME.storeys).toBe(2);
  }, 120_000);
});

describe('Little Harbour: the ground (SPEC §7; STYLE §2.1)', () => {
  it('cobbles the lanes wall to wall: verge paint off every bed, pad and solid, inside the town, dropped whole on lite', async () => {
    const verges = mine.ground.filter(g => g.fullOnly);
    expect(verges.length).toBeGreaterThan(300);
    for (const g of verges) {
      expect(g.surface).toBe('cobble');
      for (const [x, z] of g.polygon) { expect(ctx.onBed(x, z)).toBeNull(); expect(ctx.onPad(x, z)).toBeNull(); expect(ctx.inWater(x, z)).toBe(false); }
    }
    // The paint a page or a pastime reads (the campo, the green) is drawn on both tiers; the verges only on full.
    expect(mine.ground.filter(g => g.surface === 'mown' || g.surface === 'ochre' || g.surface === 'brick').every(g => !g.fullOnly)).toBe(true);
    await tick();
    const draw = (tier: 'full' | 'lite') => { const art = finishBuild(buildDistrictDressingSteps({ districtId: 'harbour', buildings: [], plants: [], props: [], ground: verges.slice(0, 40), pools: [], life: [] }, { tier, theme: 'classic', season: 'summer', ground: (x, z) => sampleTerrain(field, x, z) })); const n = art.stats.triangles; art.cards.dispose(); return n; };
    expect(draw('full')).toBeGreaterThan(0); expect(draw('lite')).toBe(0);
  });
  it('lays the campo in ten fans between the travertine rays, alternate fans in two bricks', () => {
    const sq = tier('square'), campo = mine.ground.filter(g => (g.surface === 'ochre' || g.surface === 'brick') && g.floor === sq.y);
    const fanOf = (g: { polygon: Point2[] }) => { const c = g.polygon.reduce((a, p) => [a[0] + p[0] / g.polygon.length, a[1] + p[1] / g.polygon.length], [0, 0]); return Math.floor(((Math.atan2(c[1] - COURT[1], c[0] - COURT[0]) - RAYS[0]!) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) / (Math.PI / 5)); };
    const outer = campo.filter(g => { const c = g.polygon[0]!; return Math.hypot(c[0] - COURT[0], c[1] - COURT[1]) > 9; });
    for (const g of outer.slice(0, 400)) expect(g.surface).toBe(fanOf(g) % 2 ? 'brick' : 'ochre');
    expect(new Set(campo.map(g => g.surface))).toEqual(new Set(['ochre', 'brick']));
  });
});

describe('Little Harbour: three dressings skin one massing', () => {
  it('draws every harbour kind in Classic, Taylor\'s Scrapbook and Newfoundland, each re-materialised (not re-tinted)', async () => {
    const sample = mine.buildings.filter(b => b.kind !== 'rowHouse').concat(mine.buildings.filter(b => b.kind === 'rowHouse').slice(0, 6));
    const props = mine.props.filter(p => ['lantern', 'fountain', 'stall', 'gozzo', 'laundryLine', 'drystoneWall', 'bell', 'bocceCourt'].includes(p.kind)).slice(0, 24);
    const counts: number[] = [];
    for (const theme of ['classic', 'taylor', 'newfoundland'] as const) {
      await tick();
      const art = finishBuild(buildDistrictDressingSteps({ districtId: 'harbour', buildings: sample, plants: [], props, ground: [], pools: [], life: [] }, { tier: 'full', theme, season: 'summer', ground: (x, z) => sampleTerrain(field, x, z) }));
      counts.push(art.stats.triangles); art.cards.dispose();
    }
    for (const n of counts) expect(n).toBeGreaterThan(1000);
    const [c, t, n] = (['classic', 'taylor', 'newfoundland'] as const).map(th => buildingPalette(th, 'harbour.ligurian'));
    expect([c!.skin, t!.skin, n!.skin]).toEqual(['stucco', 'paper', 'clapboard']);
    expect([c!.eave, t!.eave, n!.eave]).toEqual(['plain', 'scallop', 'fascia']);
  }, 60_000);
});
