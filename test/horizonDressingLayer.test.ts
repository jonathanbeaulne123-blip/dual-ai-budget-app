import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createDressingLayer, dressingCorridor, drapePolygon, DRESSING_DETAIL, DRESSING_INK, DRESSING_NIGHT, LITE_DROP_PROPS, measureDistrictDressing} from '../src/harbour/horizon/runtime/dressingLayer.ts';
import {buildDistrictCards, isDressingArtOwned, redressedHostSolids} from '../src/harbour/horizon/runtime/cards.ts';
import type {DistrictDressing, PlantRecord, PropRecord, WorldDressing} from '../src/harbour/horizon/neighbourhoods/types.ts';
import type {StructureSolid, TerrainField} from '../src/harbour/horizon/land/interfaces.ts';
import type {District, WorldDefinition} from '../src/harbour/horizon/world/definition.ts';
import {districtAt} from '../src/harbour/horizon/world/districts.ts';

/** Two Long Sands-ish districts' worth of records (the layer only reads `world.dressing`). */
function district(districtId: string, x0: number, z0: number): DistrictDressing {
  return {
    districtId,
    buildings: [0, 1, 2].map(i => ({id: `${districtId}.b${i}`, districtId, kind: 'shack' as const, style: 'test', at: [x0 + i * 14, 2, z0] as const, yaw: 0.2 * i, size: {w: 8, d: 6, h: 4 + i * 3}, roof: {form: 'gable' as const, pitch: 30, overhang: 0.3, material: 'tile'}, collide: true})),
    plants: [{species: 'round', at: [x0, 2, z0 + 20], scale: 1, yaw: 0}, {species: 'shrub', at: [x0 + 4, 2, z0 + 20], scale: 1, yaw: 0}, {species: 'round', at: [x0 + 9, 2, z0 + 20], scale: 1.2, yaw: 0, keep: true}],
    props: [{id: `${districtId}.bench`, kind: 'bench', at: [x0, 2, z0 + 10], yaw: 0, collide: true}, {kind: 'towel', at: [x0 + 2, 2, z0 + 10], yaw: 0}, {kind: 'umbrella', at: [x0 + 3, 2, z0 + 10], yaw: 0, fixture: 'beach'}],
    ground: [{polygon: [[x0, z0 + 30], [x0 + 20, z0 + 30], [x0 + 20, z0 + 40], [x0, z0 + 40]], surface: 'sand'}],
    pools: [{id: `${districtId}.pool`, outline: [[x0 + 30, z0 + 30], [x0 + 36, z0 + 30], [x0 + 36, z0 + 36]], level: 1.6}],
    life: [],
  };
}
const world = (): Pick<WorldDefinition, 'dressing'> => ({dressing: {districts: [district('landing', 1000, 1400), district('reach', 1280, 1260)], landmarks: [], lookouts: []} satisfies WorldDressing});
const camera = (x: number, z: number) => { const c = new THREE.PerspectiveCamera(58, 1.6, 0.3, 900); c.position.set(x, 5, z); c.lookAt(x + 10, 5, z); c.updateMatrixWorld(); return c; };
const ground = () => 2;
let now = 0;
afterEach(() => { vi.restoreAllMocks(); now = 0; });
const clock = () => vi.spyOn(performance, 'now').mockImplementation(() => now);

describe('runtime dressing layer (runtime/dressingLayer.ts)', () => {
  it('builds at most one district per frame, lazily, only resident districts, and reports its budget', () => {
    clock();
    const materials: THREE.Material[] = [], changed = vi.fn();
    const layer = createDressingLayer(world(), {tier: 'full', theme: 'classic', season: 'summer', ground, material: m => materials.push(m), changed});
    const resident = new Set(['landing', 'reach', 'green']);
    let frames = 0;
    while (Object.keys(layer.stats().districts).length < 2 && frames < 200) { const before = Object.keys(layer.stats().districts).length; layer.update(camera(1000, 1400), resident); frames++; expect(Object.keys(layer.stats().districts).length - before).toBeLessThanOrEqual(1); }
    expect(Object.keys(layer.stats().districts).sort()).toEqual(['landing', 'reach']);
    expect(layer.building()).toBe(false);
    expect(changed).toHaveBeenCalledTimes(2);
    expect(materials.length).toBeGreaterThan(0); // every material went through the fog stage
    const s = layer.stats().districts.landing!;
    expect(s.buildings).toBe(3); expect(s.props).toBe(3); expect(s.plants).toBe(3);
    expect(s.triangles).toBeGreaterThan(0); expect(s.drawCalls).toBeGreaterThan(0);
    expect(layer.group.children.every(g => g.visible)).toBe(true);
    layer.dispose();
  });
  it('a district that leaves residency hides at once and is released 20 s later (the corridor art pattern)', () => {
    clock();
    const layer = createDressingLayer(world(), {tier: 'full', theme: 'taylor', season: 'autumn', ground});
    layer.prebuild(['landing']);
    layer.update(camera(1000, 1400), new Set(['landing']));
    expect(layer.group.children.length).toBe(1);
    now = 1000; layer.update(camera(1000, 1400), new Set());
    expect(layer.group.children[0]!.visible).toBe(false);
    // Counted from the last frame the district was resident (t = 0).
    now = DRESSING_DETAIL.releaseMs - 1; layer.update(camera(1000, 1400), new Set());
    expect(layer.group.children.length).toBe(1);
    now = DRESSING_DETAIL.releaseMs + 5; layer.update(camera(1000, 1400), new Set());
    expect(layer.group.children.length).toBe(0);
    expect(layer.stats().districts).toEqual({});
    layer.dispose();
  });
  it('night lights the glow cards (emissive, no point lights); seasons reach the planting', () => {
    const layer = createDressingLayer(world(), {tier: 'full', theme: 'newfoundland', season: 'summer', ground});
    layer.prebuild(['landing']);
    const glow = () => { let m: THREE.Material | null = null; layer.group.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh && / glow$/.test(mesh.name)) m = mesh.material as THREE.Material; }); return m as THREE.Material | null; };
    expect(glow()).not.toBeNull();
    expect(glow()!.opacity).toBeCloseTo(DRESSING_DETAIL.glowDay, 6);
    layer.setNight(1); expect(glow()!.opacity).toBeCloseTo(1, 6);
    layer.setNight(0.5); expect(glow()!.opacity).toBeCloseTo(DRESSING_DETAIL.glowDay + (1 - DRESSING_DETAIL.glowDay) * 0.5, 6);
    // STYLE §1.3.3: the ink goes to #1a1a24 at 0.8 of its day opacity; the sun's contact shade fades.
    const ink = (() => { let m: THREE.LineBasicMaterial | null = null; layer.group.traverse(o => { if (o instanceof THREE.LineSegments) m = o.material as THREE.LineBasicMaterial; }); return m as THREE.LineBasicMaterial | null; })();
    expect(ink).not.toBeNull();
    layer.setNight(0); const dayOpacity = ink!.opacity; expect(ink!.color.r).toBeCloseTo(1, 6);
    layer.setNight(1);
    const day = new THREE.Color(DRESSING_INK), target = new THREE.Color(DRESSING_NIGHT.ink);
    expect(ink!.color.r * day.r).toBeCloseTo(target.r, 5); expect(ink!.color.b * day.b).toBeCloseTo(target.b, 5);
    expect(ink!.opacity).toBeCloseTo(dayOpacity * DRESSING_NIGHT.inkOpacity, 6);
    let lights = 0; layer.group.traverse(o => { if ((o as THREE.Light).isLight) lights++; }); expect(lights).toBe(0);
    expect(() => layer.setSeason('winter', 1)).not.toThrow();
    layer.dispose();
  });
  it('lite drops non-essential props (never a collider or a fixture) and thins plants by the planting rules', () => {
    const full = createDressingLayer(world(), {tier: 'full', theme: 'classic', season: 'summer', ground}), lite = createDressingLayer(world(), {tier: 'lite', theme: 'classic', season: 'summer', ground});
    full.prebuild(['landing']); lite.prebuild(['landing']);
    expect(LITE_DROP_PROPS.has('towel') && LITE_DROP_PROPS.has('umbrella')).toBe(true);
    expect(full.stats().districts.landing!.props).toBe(3);
    expect(lite.stats().districts.landing!.props).toBe(2); // the towel goes; the colliding bench and the fixture umbrella stay
    full.dispose(); lite.dispose();
  });
  it('plants become one synthetic corridor; keep plants get groups of their own (lite never drops them)', () => {
    const c = dressingCorridor(district('landing', 1000, 1400));
    expect(c.id).toBe('dressing.landing');
    expect(c.planting.map(g => [g.id, g.items.length])).toEqual([['dressing.landing', 2], ['dressing.landing.keep.2', 1]]);
    expect(c.planting.every(g => g.kind === 'framingTrees' && g.reachId === 'dressing')).toBe(true);
  });
  it('ground paint is draped in ≤ 2.5 eu triangles over the whole polygon', () => {
    const tris = drapePolygon([[0, 0], [20, 0], [20, 10], [0, 10]], DRESSING_DETAIL.paintEdge);
    let area = 0;
    for (const [a, b, c] of tris) { area += Math.abs((b![0] - a![0]) * (c![1] - a![1]) - (c![0] - a![0]) * (b![1] - a![1])) / 2; for (const [p, q] of [[a, b], [b, c], [c, a]]) expect(Math.hypot(q![0] - p![0], q![1] - p![1])).toBeLessThanOrEqual(DRESSING_DETAIL.paintEdge + 1e-9); }
    expect(area).toBeCloseTo(200, 6);
  });
  it('budget: a district measured on both tiers, plants at capacity', () => {
    const d = district('landing', 1000, 1400);
    const full = measureDistrictDressing(d, ground, 'full'), lite = measureDistrictDressing(d, ground, 'lite');
    expect(full.triangles).toBeGreaterThan(0); expect(full.drawCalls).toBeGreaterThan(0);
    expect(lite.triangles).toBeLessThanOrEqual(full.triangles);
  });
  it('budget: the prototypes’ real loads fit 150k / 60k with their baked districts (Little Harbour, the Reach)', () => {
    // The baked districts' terrain + drawn solids, as the index reports them.
    const index = JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.index.json.gz')).toString()) as {districts: District[]};
    const baked = (id: string) => index.districts.find(x => x.id === id)!.triangles!;
    const grid = (n: number, x0: number, z0: number, step: number, cols: number) => Array.from({length: n}, (_, i) => [x0 + (i % cols) * step, 4, z0 + Math.floor(i / cols) * step] as const);
    const plants = (species: PlantRecord['species'], n: number, x0: number, z0: number, step = 4, cols = 40): PlantRecord[] => grid(n, x0, z0, step, cols).map((at, i) => ({species, at, scale: 1, yaw: i}));
    const props = (kind: PropRecord['kind'], n: number, x0: number, z0: number): PropRecord[] => grid(n, x0, z0, 3, 20).map(at => ({kind, at, yaw: 0}));
    // Little Harbour (protos/harbour SPEC: the solver's 100 row houses, 3B) with its lanterns, benches and planting.
    const harbour: DistrictDressing = {districtId: 'harbour', life: [], ground: [], pools: [],
      buildings: grid(100, 1420, 1120, 9, 12).map((at, i) => ({id: `row${i}`, districtId: 'harbour', kind: 'rowHouse' as const, style: 'harbour.ligurian', at, yaw: 0, size: {w: 7, d: 8, h: 9}, roof: {form: 'hip' as const, pitch: 25, overhang: 0.4, material: 'tile'}, storeys: 3, collide: true})),
      props: [...props('lantern', 40, 1430, 1210), ...props('bench', 20, 1440, 1220)],
      plants: [...plants('cypress', 20, 1500, 1150), ...plants('lemonPot', 30, 1450, 1230), ...plants('bougainvillea', 20, 1470, 1240)]};
    // The Reach (protos/reach SPEC: about 2,470 reed clumps, willow and tamarack groves, dogwood) with the lookout furniture.
    const reach: DistrictDressing = {districtId: 'reach', life: [], ground: [], pools: [], buildings: [],
      props: [...props('lantern', 30, 1250, 1240), ...props('viewer', 8, 1260, 1250), ...props('bench', 12, 1270, 1255)],
      plants: [...plants('reed', 2470, 1215, 1225, 2, 70), ...plants('willow', 30, 1230, 1300), ...plants('tamarack', 40, 1300, 1290), ...plants('dogwood', 7, 1240, 1295)]};
    for (const d of [harbour, reach]) {
      const f = measureDistrictDressing(d, ground, 'full'), l = measureDistrictDressing(d, ground, 'lite'), b = baked(d.districtId);
      console.info(`[dressing-budget] ${d.districtId}: dressing full ${f.triangles} / lite ${l.triangles}; with the district ${b.full + f.triangles} / ${b.lite + l.triangles}`);
      expect(b.full + f.triangles, `${d.districtId} full`).toBeLessThanOrEqual(150_000);
      expect(b.lite + l.triangles, `${d.districtId} lite`).toBeLessThanOrEqual(60_000);
    }
  });
});

describe('cards skip what the dressing draws (runtime/cards.ts)', () => {
  const cube = (id: string, kind: string, x: number, z: number, role: StructureSolid['role'] = 'wall'): StructureSolid => ({id, sourceId: id.split('@')[0], kind, positions: [x, 0, z, x + 4, 0, z, x + 4, 0, z + 4, x, 0, z + 4, x, 4, z, x + 4, 4, z, x + 4, 4, z + 4, x, 4, z + 4], indices: [4, 6, 5, 4, 7, 6, 0, 1, 2, 0, 2, 3, 0, 4, 5, 0, 5, 1], surface: 'stone', districtId: 'green', bedIds: [], walkable: false, role});
  it('dressing colliders and a re-dressed host’s walls/roof are not drawn; its slab and other hosts are', () => {
    const redressed = redressedHostSolids({dressing: {districts: [], landmarks: [], lookouts: [], redressedHosts: ['glasshouse']}});
    expect(isDressingArtOwned({id: 'dressing.lakeside.x.0@green', kind: 'dressing'}, redressed)).toBe(true);
    expect(isDressingArtOwned({id: 'host.glasshouse.walls@green', sourceId: 'host.glasshouse.walls', kind: 'host'}, redressed)).toBe(true);
    expect(isDressingArtOwned({id: 'host.glasshouse.roof@lakeside', kind: 'host'}, redressed)).toBe(true);
    expect(isDressingArtOwned({id: 'host.glasshouse.slab@green', sourceId: 'host.glasshouse.slab', kind: 'pad'}, redressed)).toBe(false);
    expect(isDressingArtOwned({id: 'host.home.walls@harbour', sourceId: 'host.home.walls', kind: 'host'}, redressed)).toBe(false);
    // Through the real district card build: only the kept solid's triangles reach the cards.
    const solids = [cube('dressing.lakeside.x.0@green', 'dressing', 1000, 1000), cube('host.glasshouse.walls@green', 'host', 1010, 1000), cube('host.glasshouse.slab@green', 'pad', 1020, 1000, 'floor')];
    const field: TerrainField = {revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 100, columns: 21, rows: 19, heights: new Float32Array(21 * 19), surfaces: new Uint8Array(21 * 19)};
    const d: District = {id: 'green', neighbourhood: 'lakeside', outline: [], solidIds: solids.map(s => s.id), childOf: 'none'};
    const w = {geometry: {solids}, dressing: {districts: [], landmarks: [], lookouts: [], redressedHosts: ['glasshouse']}} as unknown as WorldDefinition;
    const count = (world: WorldDefinition) => { const cards = buildDistrictCards(world, field, {beds: [], pads: [], mouths: [], waters: [], solids, diagnostics: []}, d, 'full'); let n = 0; cards.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !(o instanceof THREE.LineSegments)) n += m.geometry.getAttribute('position').count / 3; }); cards.dispose(); return n; };
    expect(count(w)).toBe(6); // the slab's 6 triangles only
    expect(count({...w, dressing: undefined} as WorldDefinition)).toBe(12); // without re-dressing the host walls draw (the dressing collider never does)
    expect(districtAt(1000, 1000)).toBeTypeOf('string');
  });
});
