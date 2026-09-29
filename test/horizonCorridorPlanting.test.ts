import * as THREE from 'three';
import {describe, expect, it} from 'vitest';
import {createCorridorPlanting, corridorPlantingDistricts, PLANT_JOIN} from '../src/harbour/horizon/runtime/corridorPlanting.ts';
import {sampleCorridor, samplePlanting, SAMPLE_ORIGIN, SAMPLE_Y} from '../src/harbour/horizon/kit/plants/sample.ts';
import {FAR, NEAR_FLOOR, farOf} from '../src/harbour/horizon/kit/plants/archetypes.ts';
import {FADE_BAND, fadeAt} from '../src/harbour/horizon/kit/plants/materials.ts';
import {bloomStage, flowerSet, FLOWER_SET, setOf} from '../src/harbour/horizon/kit/plants/sets.ts';
import {bedGeometry, bloomGeometry, palmGeometry} from '../src/harbour/horizon/kit/plants/geometry.ts';
import {mountainArtPalette} from '../src/harbour/mountain/art/palette.ts';
import {SCENE_DRESSING} from '../src/harbour/scene/place.ts';
import {districtAt} from '../src/harbour/horizon/world/districts.ts';
import type {Corridor, PlantItem, PlantSpecies, PlantingGroup} from '../src/harbour/horizon/land/corridor/types.ts';

const THEMES = ['classic', 'taylor', 'newfoundland'] as const, SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const, TIERS = ['full', 'lite'] as const;
const ALL: PlantSpecies[] = ['round', 'fruit', 'birch', 'pine', 'poplar', 'alpine', 'shrub', 'flowering', 'hedge', 'heath', 'palm', 'flowerBed', 'grassTuft'];
const corridor = (planting: PlantingGroup[]): Corridor => ({id: 'T', closed: false, step: 2, stations: [], reaches: [], markings: [], guards: [], lamps: [], planting, stops: []});
/** One of every species (and a wind-bent pine, a tall palm, a prairie drift), 3 eu apart along x at Long Sands. */
function everySpecies(): PlantingGroup[] {
  const items: PlantItem[] = ALL.map((species, i) => ({species, at: [1000 + i * 3, SAMPLE_Y, 1400], scale: 1, yaw: i * 0.4, tint: species === 'flowerBed' || species === 'grassTuft' ? FLOWER_SET.shore + 0.3 : 0.55}));
  items.push({species: 'pine', at: [1060, SAMPLE_Y, 1400], scale: 1, yaw: 1, tint: 0.2, lean: 0.34}, {species: 'flowerBed', at: [1066, SAMPLE_Y, 1400], scale: 1, yaw: 0, tint: FLOWER_SET.prairie + 0.5});
  return [{id: 'all', kind: 'shrubCluster', reachId: 'r', side: 'right', items}];
}
const camAt = (x: number, z: number, y = SAMPLE_Y + 3) => { const c = new THREE.PerspectiveCamera(58, 1.6, 0.3, 900); c.position.set(x, y, z); c.lookAt(x + 10, y, z); c.updateMatrixWorld(); return c; };
const finiteMesh = (mesh: THREE.InstancedMesh) => {
  const a = mesh.instanceMatrix.array as Float32Array; for (let i = 0; i < mesh.count * 16; i++) if (!Number.isFinite(a[i]!)) return false;
  const p = mesh.geometry.getAttribute('position').array as Float32Array; for (const v of p) if (!Number.isFinite(v)) return false;
  return true;
};
const instanced = (g: THREE.Object3D) => g.children.filter((c): c is THREE.InstancedMesh => (c as THREE.InstancedMesh).isInstancedMesh);

describe('corridor planting kit (ROAD §4.6): every archetype, every dressing, season and tier', () => {
  it('builds every archetype for 3 dressings × 4 seasons × 2 tiers with finite geometry and matrices', () => {
    const world = {corridors: [corridor(everySpecies())]}, resident = corridorPlantingDistricts(world);
    for (const theme of THEMES) for (const season of SEASONS) for (const tier of TIERS) {
      const p = createCorridorPlanting(world, {tier, theme, season});
      p.update(camAt(1020, 1400), resident);
      const meshes = instanced(p.group), keys = new Set(p.stats().layers.filter(l => l.count > 0).map(l => l.key));
      for (const m of meshes) expect(finiteMesh(m), `${theme}/${season}/${tier} ${m.name}`).toBe(true);
      for (const k of ['tree:round', 'tree:fruit', 'tree:birch', 'tree:pine', 'tree:poplar', 'tree:alpine', 'bush', 'hedge', 'heath', 'palm', 'bed', 'bed:wild', 'tuft', 'bentPine', 'contact']) expect(keys, `${theme}/${season}/${tier} ${k}`).toContain(k);
      // Ink shells on the full tier only (STYLE §1.2 rule 7).
      expect([...keys].some(k => k.startsWith('shell:') || k === 'palmShell')).toBe(tier === 'full');
      // Flowers: blooms in spring (bud), summer; none under winter mulch; autumn (the Oct stage) fades.
      expect([...keys].some(k => k.startsWith('bloom:'))).toBe(season !== 'winter');
      // v2's seasonal fruit-tree dots: blossom in spring, fruit in summer and autumn, bare in winter.
      expect([...keys].some(k => k.startsWith('dots:0.2') || k.startsWith('dots:0.17'))).toBe(season !== 'winter');
      p.dispose();
    }
  });
  it('the new archetypes are distinct per dressing (re-materialised, not re-tinted) and Newfoundland swaps the palm', () => {
    const tri = (g: THREE.BufferGeometry | null) => (g ? g.getAttribute('position').count / 3 : 0);
    const [c, t, n] = THEMES.map(theme => palmGeometry(mountainArtPalette(SCENE_DRESSING[theme]), 'full'));
    expect(tri(c!.body)).not.toBe(tri(t!.body));
    expect(tri(n!.body)).toBeLessThan(tri(c!.body)); // the wind-bent pine, not a palm
    for (const theme of THEMES) {
      const pal = mountainArtPalette(SCENE_DRESSING[theme]);
      expect(tri(bedGeometry(pal, 'full', 'bloom'))).toBeGreaterThan(0);
      expect(tri(bedGeometry(pal, 'full', 'mulch'))).toBeGreaterThan(0);
      expect(bloomGeometry(pal, 'full', flowerSet(theme, FLOWER_SET.shore), 'mulch')).toBeNull();
      expect(tri(bloomGeometry(pal, 'full', flowerSet(theme, FLOWER_SET.shore), 'bloom'))).toBeGreaterThan(tri(bloomGeometry(pal, 'full', flowerSet(theme, FLOWER_SET.shore), 'bud')));
    }
    // STYLE §1.4.4: Newfoundland's meadow set swaps clover for lupine.
    expect(flowerSet('classic', FLOWER_SET.meadow).map(f => f.name)).toContain('red clover');
    expect(flowerSet('newfoundland', FLOWER_SET.meadow).map(f => f.name)).toContain('lupine');
    expect(setOf(FLOWER_SET.prairie + 0.9)).toBe(FLOWER_SET.prairie);
  });
  it('flowers bloom May–Sep and beds are mulched Dec–Mar (STYLE §1.4.2)', () => {
    expect([1, 2, 3, 12].map(bloomStage)).toEqual(['mulch', 'mulch', 'mulch', 'mulch']);
    expect([5, 6, 7, 8, 9].every(m => bloomStage(m) === 'bloom')).toBe(true);
    expect(bloomStage(4)).toBe('bud'); expect(bloomStage(10)).toBe('fade'); expect(bloomStage(11)).toBe('leaf');
  });
});

describe('createCorridorPlanting on a synthetic corridors fixture', () => {
  const world = {corridors: [sampleCorridor()]}, resident = corridorPlantingDistricts(world);
  it('renders every group: instance counts match the fixture (full) and lite keeps each group\'s silhouette', () => {
    const items = world.corridors[0]!.planting.flatMap(g => g.items), count = (sp: PlantSpecies) => items.filter(i => i.species === sp).length;
    const full = createCorridorPlanting(world, {tier: 'full', theme: 'classic', season: 'summer'});
    // Stand in the middle of each sample strip in turn: every item within reach is drawn exactly once in its body layer.
    const drawn = new Map<string, number>();
    // The four strips are ≥ 400 eu apart (beyond every far radius), so the per-strip counts add up.
    for (const [x, z] of Object.values(SAMPLE_ORIGIN)) { full.update(camAt(x + 40, z), resident); for (const l of full.stats().layers) drawn.set(l.key, (drawn.get(l.key) ?? 0) + l.count); }
    expect(drawn.get('palm')).toBe(count('palm'));
    expect(drawn.get('tree:round')).toBe(count('round'));
    expect(drawn.get('hedge')).toBe(count('hedge'));
    expect((drawn.get('bentPine') ?? 0) + (drawn.get('tree:pine') ?? 0)).toBe(count('pine'));
    expect(drawn.get('heath')).toBe(count('heath'));
    expect((drawn.get('bed') ?? 0) + (drawn.get('bed:wild') ?? 0)).toBe(count('flowerBed'));
    expect(full.stats().items).toBe(items.length);
    full.dispose();
    // Lite: fewer items, but every group keeps its first, last and largest item of every species.
    const lite = createCorridorPlanting(world, {tier: 'lite', theme: 'classic', season: 'summer'});
    let liteTotal = 0;
    for (const g of world.corridors[0]!.planting) for (const sp of new Set(g.items.map(i => i.species))) {
      const idx = g.items.map((it, i) => (it.species === sp ? i : -1)).filter(i => i >= 0), largest = idx.reduce((a, b) => (g.items[b]!.scale > g.items[a]!.scale ? b : a), idx[0]!);
      for (const i of new Set([idx[0]!, idx.at(-1)!, largest])) expect(lite.probe(g.id, i)?.kept, `${g.id}#${i}`).toBe(true);
      liteTotal += idx.filter(i => lite.probe(g.id, i)!.kept).length;
    }
    expect(liteTotal).toBeLessThan(items.length);
    expect(liteTotal).toBeGreaterThan(items.length * 0.4);
    lite.dispose();
  });
  it('residency: items of a non-resident district are not drawn; they appear when it becomes resident', () => {
    const p = createCorridorPlanting(world, {tier: 'full', theme: 'taylor', season: 'summer'});
    const g = world.corridors[0]!.planting.find(q => q.id.endsWith('grove.right'))!, district = districtAt(g.items[0]!.at[0], g.items[0]!.at[2], 1);
    const cam = camAt(SAMPLE_ORIGIN.palms[0] + 10, SAMPLE_ORIGIN.palms[1]);
    p.update(cam, new Set([...resident].filter(id => id !== district)));
    expect(p.probe(g.id, 0)!.active).toBe(false);
    expect(p.stats().layers.find(l => l.key === 'palm')?.count ?? 0).toBe(0);
    p.update(cam, resident);
    expect(p.probe(g.id, 0)!.active).toBe(true);
    expect(p.probe(g.id, 0)!.district).toBe(district);
    // It arrived while the rider was near: it scales in from its root (no pop), rather than appearing at full size.
    expect(p.probe(g.id, 0)!.fade).toBeLessThan(0.5);
    p.dispose();
    // At the world's opening (the first evaluation) nothing scales in.
    const q = createCorridorPlanting(world, {tier: 'full', theme: 'taylor', season: 'summer'});
    q.update(cam, resident); expect(q.probe(g.id, 0)!.fade).toBe(1); q.dispose();
  });
  it('hysteresis: nothing 60 eu ahead of a moving rider is hidden or shrunk, at any speed and on either tier', () => {
    // A straight avenue 2 km long: a tree every 12 eu on the verge, flower beds and tufts between.
    const items: PlantItem[] = [];
    for (let a = 0; a < 2000; a += 12) { items.push({species: 'round', at: [300 + a, 10, 700 + 8], scale: 1, yaw: a, tint: 0.4}); items.push({species: 'flowerBed', at: [306 + a, 10, 700 + 7], scale: 1, yaw: 0, tint: FLOWER_SET.meadow + 0.2}); items.push({species: 'grassTuft', at: [303 + a, 10, 700 + 6.4], scale: 1, yaw: a, tint: FLOWER_SET.meadow + 0.6}); }
    const groups: PlantingGroup[] = [{id: 'long', kind: 'avenue', reachId: 'r', side: 'right', items}], w = {corridors: [corridor(groups)]}, res = corridorPlantingDistricts(w);
    for (const tier of TIERS) {
      const p = createCorridorPlanting(w, {tier, theme: 'classic', season: 'summer'});
      // Ride at 16 m/s (cruiser top speed) at 60 fps, the activity camera 5.4 behind the rider.
      for (let x = 300; x < 2150; x += 16 / 60) {
        p.update(camAt(x - 5.4, 700), res);
        if (Math.round(x * 60 / 16) % 30) continue;
        for (let i = 0; i < items.length; i++) {
          const it = items[i]!, ahead = it.at[0] - x;
          if (ahead < 0 || ahead > 60) continue;
          const pr = p.probe('long', i)!;
          if (!pr.kept) continue;
          expect(pr.active, `${tier} x=${x.toFixed(1)} item ${i} ${it.species} ${ahead.toFixed(1)} ahead`).toBe(true);
          expect(pr.fade, `${tier} x=${x.toFixed(1)} item ${i} fade`).toBe(1);
        }
      }
      p.dispose();
    }
  }, 60000);
  it('an instance is at scale 0 whenever it joins or leaves its layer (no pop), and every far radius clears 85 eu', () => {
    for (const family of Object.keys(FAR) as (keyof typeof FAR)[]) for (const tier of TIERS) for (const rank of [0, 0.5, 1]) {
      const far = farOf(family, tier, rank);
      if (far === 0) continue;
      expect(far).toBeGreaterThanOrEqual(NEAR_FLOOR);
      expect(fadeAt(far + PLANT_JOIN, far)).toBe(0);
      expect(fadeAt(NEAR_FLOOR - FADE_BAND, far)).toBe(1);
    }
  });
  it('setSeason rebuilds only when the drawn stage changes; dispose is idempotent', () => {
    const p = createCorridorPlanting(world, {tier: 'full', theme: 'newfoundland', season: 'summer', month: 7});
    const cam = camAt(SAMPLE_ORIGIN.palms[0] + 20, SAMPLE_ORIGIN.palms[1]);
    p.update(cam, resident);
    const before = instanced(p.group)[0];
    p.setSeason('summer', 8); expect(instanced(p.group)[0]).toBe(before);
    p.setSeason('winter', 1); expect(instanced(p.group)[0]).not.toBe(before);
    expect(p.stats().layers.some(l => l.key.startsWith('bloom:'))).toBe(false);
    p.setSeason('summer', 7); p.update(cam, resident);
    expect(p.stats().layers.find(l => l.key.startsWith('bloom:'))!.count).toBeGreaterThan(0);
    p.dispose(); p.dispose();
    expect(p.group.children.length).toBe(0);
  });
  it('skips non-finite items instead of drawing NaN', () => {
    const bad: PlantingGroup[] = [{id: 'bad', kind: 'shrubCluster', reachId: 'r', side: 'left', items: [{species: 'round', at: [NaN, 0, 0], scale: 1, yaw: 0}, {species: 'palm', at: [1000, 10, 1400], scale: 0, yaw: 0}, {species: 'heath', at: [1000, 10, 1400], scale: 1, yaw: 0}]}];
    const p = createCorridorPlanting({corridors: [corridor(bad)]}, {tier: 'full', theme: 'classic', season: 'summer'});
    p.update(camAt(1000, 1400), new Set([districtAt(1000, 1400, 1)]));
    expect(p.stats().items).toBe(1);
    for (const m of instanced(p.group)) expect(finiteMesh(m)).toBe(true);
    p.dispose();
  });
});

describe('performance: a 40-group reach (ROAD §8: ≤ 25k triangles full / 10k lite, ≤ 12 draw calls per district)', () => {
  it('measures a Long Sands boulevard reach of 40 groups', () => {
    // 10 repeats of the palms verge (4 groups each) laid 100 eu apart along one reach, all in view distance.
    const groups: PlantingGroup[] = [];
    for (let k = 0; k < 10; k++) for (const g of samplePlanting('palms', `reach.${k}`)) groups.push({...g, items: g.items.map(it => ({...it, at: [it.at[0] + k * 100 - 400, it.at[1], it.at[2]]}))});
    expect(groups.length).toBe(40);
    const w = {corridors: [corridor(groups)]}, res = corridorPlantingDistricts(w), out: Record<string, unknown> = {};
    for (const theme of THEMES) for (const tier of TIERS) {
      const p = createCorridorPlanting(w, {tier, theme, season: 'summer'});
      p.update(camAt(SAMPLE_ORIGIN.palms[0] + 50, SAMPLE_ORIGIN.palms[1]), res);
      const s = p.stats(); out[`${theme}/${tier}`] = {items: s.items, drawCalls: s.drawCalls, triangles: s.triangles, layers: Object.fromEntries(s.layers.map(l => [l.key, `${l.count}×${l.count ? l.triangles / l.count : 0}`]))};
      expect(s.drawCalls).toBeLessThanOrEqual(12);
      expect(s.triangles).toBeLessThanOrEqual(tier === 'full' ? 25000 : 10000);
      p.dispose();
    }
    console.log('40-group reach', JSON.stringify(out));
  });
  it('measures a Harbour Avenue reach of 40 groups (v2 maples with ink shells, hedges, beds)', () => {
    const groups: PlantingGroup[] = [];
    for (let k = 0; k < 8; k++) for (const g of samplePlanting('avenue', `ave.${k}`)) groups.push({...g, items: g.items.map(it => ({...it, at: [it.at[0] + k * 90 - 360, it.at[1], it.at[2]]}))});
    expect(groups.length).toBe(40);
    const w = {corridors: [corridor(groups)]}, res = corridorPlantingDistricts(w), out: Record<string, unknown> = {};
    for (const theme of THEMES) for (const tier of TIERS) {
      const p = createCorridorPlanting(w, {tier, theme, season: 'summer'});
      p.update(camAt(SAMPLE_ORIGIN.avenue[0] + 45, SAMPLE_ORIGIN.avenue[1]), res);
      const s = p.stats(); out[`${theme}/${tier}`] = {items: s.items, drawCalls: s.drawCalls, triangles: s.triangles, layers: Object.fromEntries(s.layers.map(l => [l.key, `${l.count}×${l.count ? l.triangles / l.count : 0}`]))};
      expect(s.drawCalls).toBeLessThanOrEqual(12);
      expect(s.triangles).toBeLessThanOrEqual(tier === 'full' ? 25000 : 10000);
      p.dispose();
    }
    console.log('40-group avenue', JSON.stringify(out));
  });
});
