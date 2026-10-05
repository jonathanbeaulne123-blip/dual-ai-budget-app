import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createDressingLayer, dressingCorridor, drapePolygon, DRESSING_DETAIL, LITE_DROP_PROPS, measureDistrictDressing} from '../src/harbour/horizon/runtime/dressingLayer.ts';
import {buildDistrictCards, isDressingArtOwned, redressedHostSolids} from '../src/harbour/horizon/runtime/cards.ts';
import type {DistrictDressing, WorldDressing} from '../src/harbour/horizon/neighbourhoods/types.ts';
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
  it('budget: a district measured on both tiers, plants at capacity; a heavy district stays inside 150k / 60k with the baked land', () => {
    const d = district('landing', 1000, 1400);
    const full = measureDistrictDressing(d, ground, 'full'), lite = measureDistrictDressing(d, ground, 'lite');
    expect(full.triangles).toBeGreaterThan(0); expect(full.drawCalls).toBeGreaterThan(0);
    expect(lite.triangles).toBeLessThanOrEqual(full.triangles);
    // A neighbourhood-sized load: 60 buildings, 400 plants, 150 props in one district.
    const heavy: DistrictDressing = {...d, buildings: Array.from({length: 60}, (_, i) => ({...d.buildings[0]!, id: `h${i}`, at: [1000 + (i % 10) * 12, 2, 1400 + Math.floor(i / 10) * 12] as const})), plants: Array.from({length: 400}, (_, i) => ({species: (['round', 'shrub', 'pine', 'grassTuft'] as const)[i % 4]!, at: [900 + (i % 40) * 5, 2, 1300 + Math.floor(i / 40) * 5] as const, scale: 1, yaw: i})), props: Array.from({length: 150}, (_, i) => ({kind: 'bench' as const, at: [950 + i, 2, 1350] as const, yaw: 0}))};
    const hf = measureDistrictDressing(heavy, ground, 'full'), hl = measureDistrictDressing(heavy, ground, 'lite');
    // The baked Long Sands (landing) district: terrain + drawn solids, as the index reports it.
    const index = JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.index.json.gz')).toString()) as {districts: District[]};
    const baked = index.districts.find(x => x.id === 'landing')!.triangles!;
    expect(baked.full + hf.triangles, `full ${hf.triangles}`).toBeLessThanOrEqual(150_000);
    expect(baked.lite + hl.triangles, `lite ${hl.triangles}`).toBeLessThanOrEqual(60_000);
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
