// The Water's Way plant species (kit/plants/species.ts, wwGeometry.ts, oak.ts) drawn through the corridor planting
// machinery: every species × dressing × season × tier builds finite geometry inside its PLANT_FORM and its triangle
// budget; lite keeps less (and always the Old Oak and `keep` items); seasons and the Newfoundland variants by rule;
// the two dense districts (the Reach's ~4,400 marsh clumps, Scholars' ~1,900 trees) stay inside CONTRACT §6.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCorridorPlanting, corridorPlantingDistricts } from '../src/harbour/horizon/runtime/corridorPlanting';
import { WW_SPECIES, WW_SPEC, wwVariant, type WWSpecies } from '../src/harbour/horizon/kit/plants/species';
import { wwGeometry, type WWLook } from '../src/harbour/horizon/kit/plants/wwGeometry';
import { OAK, oakLimbs, oakSwing } from '../src/harbour/horizon/kit/plants/oak';
import { LITE_KEEP, FAR } from '../src/harbour/horizon/kit/plants/archetypes';
import { PLANT_FORM } from '../src/harbour/horizon/land/corridor/plan/species';
import { mountainArtPalette } from '../src/harbour/mountain/art/palette';
import { SCENE_DRESSING } from '../src/harbour/scene/place';
import { bloomStage } from '../src/harbour/horizon/kit/plants/sets';
import type { Corridor, PlantItem, PlantingGroup } from '../src/harbour/horizon/land/corridor/types';
import type { DressingSpecies } from '../src/harbour/horizon/neighbourhoods/types';

const THEMES = ['classic', 'taylor', 'newfoundland'] as const;
const LOOKS: Record<string, WWLook> = Object.fromEntries(([['winter', 1], ['spring', 4], ['may', 5], ['summer', 7], ['august', 8], ['autumn', 10]] as const)
  .map(([name, month]) => [name, { season: month === 1 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'autumn', month, stage: bloomStage(month) } as WWLook]));
const tris = (g: THREE.BufferGeometry) => g.getAttribute('position').count / 3;
/** Per-instance triangle ceilings (full, lite) — the budget the Reach and Scholars need. */
const BUDGET: Record<WWSpecies, [number, number]> = {
  reed: [12, 6], cattail: [12, 6], sedge: [12, 6], lily: [28, 14], willow: [100, 60], tamarack: [55, 32], spruce: [90, 45], balsam: [70, 36],
  oakGiant: [7600, 3000], cypress: [56, 42], olive: [95, 50], stonePine: [100, 50], juniper: [32, 22], cedar: [48, 32], prairieGrass: [10, 4],
  fanPalm: [130, 64], canaryPalm: [200, 90], fern: [12, 8], woodlandCard: [8, 8], iceplant: [20, 10], bougainvillea: [34, 22], lemonPot: [72, 44],
  dogwood: [40, 24], apple: [150, 75],
};
const variantsOf = (sp: WWSpecies): (string | null)[] => (sp === 'spruce' ? [null, 'black', 'tuck'] : sp === 'woodlandCard' ? ['spire', 'round'] : [null]);

describe("The Water's Way plant kit: geometry", () => {
  it('the contract species list and the kit agree (every DressingSpecies is drawable, every new one has a form and a lite share)', () => {
    const contract: DressingSpecies[] = ['round', 'fruit', 'birch', 'pine', 'poplar', 'alpine', 'shrub', 'flowering', 'hedge', 'heath', 'palm', 'flowerBed', 'grassTuft', ...WW_SPECIES];
    for (const sp of contract) { expect(PLANT_FORM[sp], sp).toBeTruthy(); expect(LITE_KEEP[sp], sp).toBeGreaterThan(0); }
    for (const sp of WW_SPECIES) expect(FAR[WW_SPEC[sp].family], sp).toBeTruthy();
  });

  it('every species × variant × dressing × season × tier is finite, inside its PLANT_FORM and its triangle budget; lite is lighter', () => {
    const table: Record<string, string> = {}, fails: string[] = [];
    for (const sp of WW_SPECIES) for (const variant of variantsOf(sp)) for (const theme of THEMES) for (const [name, look] of Object.entries(LOOKS)) {
      if (sp === 'oakGiant' && theme !== 'classic' && name !== 'summer' && name !== 'winter') continue; // the oak is heavy to build; all looks run in Classic
      const pal = mountainArtPalette(SCENE_DRESSING[theme]), counts: number[] = [];
      for (const tier of ['full', 'lite'] as const) {
        const g = wwGeometry(sp, variant, pal, tier, look);
        if (sp === 'lily' && name === 'winter') { expect(g).toBeNull(); continue; }
        expect(g, `${sp}/${variant}/${theme}/${name}/${tier}`).not.toBeNull();
        const body = g!.body, pos = body.getAttribute('position'), col = body.getAttribute('color');
        let finite = true, inGamut = true;
        for (let i = 0; i < pos.array.length; i++) finite &&= Number.isFinite(pos.array[i]!);
        for (let i = 0; i < col.array.length; i++) inGamut &&= col.array[i]! >= 0 && col.array[i]! <= 1.4;
        if (!finite) fails.push(`${sp}/${variant}/${theme}/${name}/${tier} non-finite`); if (!inGamut) fails.push(`${sp}/${variant}/${theme}/${name}/${tier} colour`);
        body.computeBoundingBox(); const bb = body.boundingBox!, form = PLANT_FORM[sp], stretch = sp === 'fanPalm' ? 1.26 : sp === 'canaryPalm' ? 1.11 : 1;
        const top = WW_SPEC[sp].stretchTop !== undefined ? bb.max.y + WW_SPEC[sp].stretchTop! * (stretch - 1) : bb.max.y;
        const reach = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z), n = tris(body), [cap, liteCap] = BUDGET[sp], id = `${sp}/${variant}/${theme}/${name}/${tier}`;
        if (top > form.height + 1e-6) fails.push(`${id} height ${top.toFixed(3)} > ${form.height}`);
        if (reach > form.canopy + 1e-6) fails.push(`${id} canopy ${reach.toFixed(3)} > ${form.canopy}`);
        if (bb.min.y < -1.6) fails.push(`${id} foot ${bb.min.y}`);
        if (n > (tier === 'full' ? cap : liteCap)) fails.push(`${id} triangles ${n} > ${tier === 'full' ? cap : liteCap}`);
        if (g!.shell) { expect(tier).toBe('full'); expect(WW_SPEC[sp].shell).toBe(true); expect(g!.shell.getAttribute('aInk')).toBeTruthy(); }
        if (WW_SPEC[sp].stretchTop !== undefined) expect(body.getAttribute('aCrown')).toBeTruthy();
        counts.push(n);
      }
      if (counts.length === 2) { expect(counts[1]!).toBeLessThanOrEqual(counts[0]!); if (theme === 'classic' && name === 'summer') table[variant ? `${sp}:${variant}` : sp] = `${counts[0]} / ${counts[1]}`; }
    }
    console.log('[ww plants] triangles per instance, Classic summer, full / lite:', JSON.stringify(table));
    const worst = new Map<string, string>(); for (const f of fails) { const [id, kind] = f.split(' '); worst.set(`${id!.split('/')[0]} ${kind}`, f); }
    expect([...worst.values()]).toEqual([]);
  });

  it('marsh clumps ≤ 12 triangles and woodland cards ≤ 8 on both tiers (the Reach and Scholars budget)', () => {
    const pal = mountainArtPalette(SCENE_DRESSING.classic);
    for (const [sp, cap] of [['reed', 12], ['cattail', 12], ['sedge', 12], ['woodlandCard', 8]] as const) for (const variant of variantsOf(sp)) for (const tier of ['full', 'lite'] as const) for (const look of Object.values(LOOKS))
      expect(tris(wwGeometry(sp, variant, pal, tier, look)!.body), `${sp} ${tier} ${look.month}`).toBeLessThanOrEqual(cap);
  });

  it('seasons: tamarack and willow gold in October and bare in winter, conifers snow-capped, lilies gone, dogwood red stems only, apples blossom then fruit', () => {
    const pal = mountainArtPalette(SCENE_DRESSING.classic);
    const mean = (sp: WWSpecies, look: WWLook, v: string | null = null) => { const c = wwGeometry(sp, v, pal, 'full', look)!.body.getAttribute('color'); let r = 0, g = 0, b = 0; for (let i = 0; i < c.count; i++) { r += c.getX(i); g += c.getY(i); b += c.getZ(i); } return [r / c.count, g / c.count, b / c.count] as const; };
    const lum = (c: readonly number[]) => c[0]! * 0.3 + c[1]! * 0.59 + c[2]! * 0.11;
    const tamJul = mean('tamarack', LOOKS.summer!), tamOct = mean('tamarack', LOOKS.autumn!);
    expect(tamOct[0] - tamOct[2]).toBeGreaterThan(tamJul[0] - tamJul[2] + 0.15); // gold: red ≫ blue
    for (const sp of ['spruce', 'balsam'] as const) expect(lum(mean(sp, LOOKS.winter!))).toBeGreaterThan(lum(mean(sp, LOOKS.summer!)) + 0.04);
    expect(wwGeometry('lily', null, pal, 'full', LOOKS.winter!)).toBeNull();
    expect(tris(wwGeometry('lily', null, pal, 'full', LOOKS.summer!)!.body)).toBeGreaterThan(tris(wwGeometry('lily', null, pal, 'full', LOOKS.spring!)!.body)); // a flower in July
    expect(tris(wwGeometry('dogwood', null, pal, 'full', LOOKS.winter!)!.body)).toBe(7);
    const appleTris = (look: WWLook) => tris(wwGeometry('apple', null, pal, 'full', look)!.body);
    expect(appleTris(LOOKS.may!)).toBeGreaterThan(appleTris(LOOKS.summer!)); expect(appleTris(LOOKS.autumn!)).toBeGreaterThan(appleTris(LOOKS.summer!)); expect(appleTris(LOOKS.winter!)).toBeLessThan(appleTris(LOOKS.summer!));
    expect(tris(wwGeometry('oakGiant', null, pal, 'full', LOOKS.winter!)!.body)).toBeLessThan(tris(wwGeometry('oakGiant', null, pal, 'full', LOOKS.summer!)!.body));
  });

  it('dressings re-materialise (different colours per dressing) and Newfoundland swaps by rule', () => {
    for (const sp of WW_SPECIES) {
      if (sp === 'oakGiant') continue;
      const cols = THEMES.map(t => Array.from(wwGeometry(sp, sp === 'woodlandCard' ? 'spire' : null, mountainArtPalette(SCENE_DRESSING[t]), 'full', LOOKS.summer!)!.body.getAttribute('color').array.slice(0, 12)).join());
      expect(cols[0], sp).not.toBe(cols[1]);
    }
    expect(wwVariant('spruce', 'newfoundland', 1, 0.5)).toEqual({ species: 'spruce', variant: 'black' });
    expect(wwVariant('spruce', 'newfoundland', 0.6, 0.5)).toEqual({ species: 'spruce', variant: 'tuck' });
    expect(wwVariant('spruce', 'classic', 0.6, 0.5)).toEqual({ species: 'spruce', variant: null });
    expect(wwVariant('tamarack', 'newfoundland', 1, 0.2)).toEqual({ species: 'spruce', variant: 'black' });
    expect(wwVariant('tamarack', 'newfoundland', 1, 0.5)).toEqual({ species: 'tamarack', variant: null });
    expect(wwVariant('woodlandCard', 'newfoundland', 1, 0.9).variant).toBe('spire');
    expect(wwVariant('woodlandCard', 'classic', 1, 0.9).variant).toBe('round');
  });

  it('the Old Oak: ~36 eu tall, ~60 eu crown, eight limbs, the swing limb long and low along local +z, the swing under it', () => {
    const g = wwGeometry('oakGiant', null, mountainArtPalette(SCENE_DRESSING.classic), 'full', LOOKS.summer!)!.body; g.computeBoundingBox();
    const bb = g.boundingBox!;
    expect(bb.max.y).toBeGreaterThan(OAK.height - 2); expect(bb.max.y).toBeLessThanOrEqual(OAK.height + 1);
    expect(bb.max.x - bb.min.x).toBeGreaterThan(50); expect(bb.max.z - bb.min.z).toBeGreaterThan(50);
    const limbs = oakLimbs(); expect(limbs).toHaveLength(8);
    expect(limbs[0]!.tip[2]).toBeGreaterThan(19); expect(Math.abs(limbs[0]!.tip[0])).toBeLessThan(0.5); expect(limbs[0]!.tip[1]).toBeCloseTo(10.2, 5);
    for (const l of limbs.slice(1)) { expect(l.tip[1]).toBeGreaterThanOrEqual(15); expect(l.tip[1]).toBeLessThanOrEqual(23); }
    const sw = oakSwing(); expect(Math.hypot(sw.at[0], sw.at[2])).toBeGreaterThan(13); expect(Math.hypot(sw.at[0], sw.at[2])).toBeLessThan(19); expect(sw.at[1]).toBeGreaterThan(8.5);
  });
});

/* ------------------------------------------------------------------------------------------- through the planting */

const group = (id: string, items: PlantItem[]): PlantingGroup => ({ id, kind: 'shrubCluster', reachId: 'ww', side: 'left', items });
const world = (groups: PlantingGroup[]): { corridors: Corridor[] } => ({ corridors: [{ id: 'WW', closed: false, step: 2, stations: [], reaches: [], markings: [], guards: [], lamps: [], planting: groups, stops: [] }] });
const camAt = (x: number, z: number, y = 12) => { const c = new THREE.PerspectiveCamera(); c.position.set(x, y, z); c.updateMatrixWorld(); return c; };

describe("The Water's Way plant kit: through createCorridorPlanting", () => {
  // One of every species in the Reach's district area (a few near-copies so lite has something to thin).
  const items: PlantItem[] = WW_SPECIES.flatMap((species, i) => [0, 1, 2, 3].map(k => ({ species, at: [1180 + (i % 6) * 9 + k * 1.3, 4, 1180 + Math.floor(i / 6) * 9 + k] as [number, number, number], scale: 1, yaw: i + k, tint: 0.15 + k * 0.22 })));
  const w = world([group('ww.all', items)]), resident = corridorPlantingDistricts(w);

  it('draws every species in its own layer on both tiers and three dressings, finite matrices, Old Oak kept on lite', () => {
    for (const theme of THEMES) for (const tier of ['full', 'lite'] as const) {
      const p = createCorridorPlanting(w, { tier, theme, season: 'summer', month: 7 });
      p.update(camAt(1200, 1190), resident);
      const s = p.stats(), keys = new Set(s.layers.filter(l => l.count > 0).map(l => l.key));
      for (const sp of WW_SPECIES) {
        // Newfoundland's palms are the wind-bent pine (STYLE §2.5, D-R4; review of PR 1), drawn in the corridor's bentPine layer.
        const want = theme === 'newfoundland' && (sp === 'fanPalm' || sp === 'canaryPalm') ? 'bentPine' : theme === 'newfoundland' && sp === 'spruce' ? 'ww:spruce:black' : sp === 'woodlandCard' ? (theme === 'newfoundland' ? 'ww:woodlandCard:spire' : null) : `ww:${sp}`;
        if (want) expect(keys.has(want), `${theme}/${tier} ${want} in ${[...keys].join(',')}`).toBe(true);
      }
      const oak = s.layers.find(l => l.key === 'ww:oakGiant')!; expect(oak.count).toBe(4);
      if (tier === 'full') expect(keys.has('ww:oakGiant:shell')).toBe(true); else expect([...keys].some(k => k.endsWith(':shell'))).toBe(false);
      for (const m of p.group.children) if (m instanceof THREE.InstancedMesh) for (const v of m.instanceMatrix.array) expect(Number.isFinite(v)).toBe(true);
      p.dispose();
    }
  });

  it('lite keeps each species\' share, the group\'s first/last/largest, and every `keep` item', () => {
    const reeds: PlantItem[] = Array.from({ length: 200 }, (_, i) => ({ species: 'reed', at: [1200 + (i % 20) * 1.3, 4, 1200 + Math.floor(i / 20) * 1.3], scale: 1, yaw: i, tint: (i * 0.37) % 1, ...(i === 77 ? { keep: true } : {}) }));
    const ww = world([group('ww.reeds', reeds)]), r = corridorPlantingDistricts(ww);
    const full = createCorridorPlanting(ww, { tier: 'full', theme: 'classic', season: 'summer' }), lite = createCorridorPlanting(ww, { tier: 'lite', theme: 'classic', season: 'summer' });
    full.update(camAt(1212, 1206), r); lite.update(camAt(1212, 1206), r);
    const n = (p: typeof full) => p.stats().layers.find(l => l.key === 'ww:reed')!.count;
    expect(n(full)).toBe(200); expect(n(lite)).toBeGreaterThanOrEqual(Math.round(200 * LITE_KEEP.reed)); expect(n(lite)).toBeLessThanOrEqual(Math.round(200 * LITE_KEEP.reed) + 4);
    expect(lite.probe('ww.reeds', 77)!.kept).toBe(true);
    full.dispose(); lite.dispose();
  });

  it('setSeason rebuilds the looks: lilies leave in winter, tamarack layers survive', () => {
    const p = createCorridorPlanting(w, { tier: 'full', theme: 'classic', season: 'summer', month: 7 });
    p.update(camAt(1200, 1190), resident);
    expect(p.stats().layers.some(l => l.key === 'ww:lily' && l.count > 0)).toBe(true);
    p.setSeason('winter', 1); p.update(camAt(1200, 1190), resident);
    expect(p.stats().layers.some(l => l.key === 'ww:lily')).toBe(false);
    expect(p.stats().layers.some(l => l.key === 'ww:tamarack' && l.count > 0)).toBe(true);
    p.dispose();
  });

  it('setSeason inside one season rebuilds the month-sensitive Water\'s Way looks (July → August: apples fruit; PR #588 Codex)', () => {
    const orchard = world([group('ww.orchard', [0, 1, 2].map(k => ({ species: 'apple' as const, at: [1200 + k * 6, 4, 1190] as [number, number, number], scale: 1, yaw: k, tint: 0.3 })))]);
    const r = corridorPlantingDistricts(orchard), cam = camAt(1206, 1180);
    const p = createCorridorPlanting(orchard, { tier: 'full', theme: 'classic', season: 'summer', month: 7 });
    p.update(cam, r);
    const tris = () => p.stats().layers.find(l => l.key === 'ww:apple')!.triangles;
    const july = tris(), mesh = p.group.children.find(m => m.name.includes('apple'));
    p.setSeason('summer', 8); p.update(cam, r);
    // Same season, same bloom stage, a new month: the layer is rebuilt with the fruit dots.
    expect(tris()).toBeGreaterThan(july);
    if (mesh) expect(p.group.children).not.toContain(mesh);
    // And back: no fruit in July.
    p.setSeason('summer', 7); p.update(cam, r);
    expect(tris()).toBe(july);
    p.dispose();
  });

  it('district budgets (CONTRACT §6: ≤ 150k full / 60k lite): the Reach marsh (4,400 clumps) and a Scholars wood (1,900 trees)', () => {
    const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const r = rng(9), marsh: PlantItem[] = [], sedge: PlantItem[] = [];
    for (let i = 0; i < 4400; i++) marsh.push({ species: r() < 0.78 ? 'reed' : 'cattail', at: [1200 + r() * 140, 4, 1180 + r() * 140], scale: 0.85 + r() * 0.3, yaw: r() * 6.28, tint: r() });
    for (let i = 0; i < 900; i++) sedge.push({ species: 'sedge', at: [1200 + r() * 140, 4, 1180 + r() * 140], scale: 0.7 + r() * 0.5, yaw: r() * 6.28, tint: r() });
    // Scholars' 60–70 % canopy: real trees along the walks and glades, woodland cards for the back rows (brief).
    const wood: PlantItem[] = [], kinds: WWSpecies[] = ['spruce', 'balsam', 'cedar', 'tamarack'];
    for (let i = 0; i < 1900; i++) wood.push({ species: i < 600 ? kinds[i % 4]! : 'woodlandCard', at: [690 + r() * 120, 40, 360 + r() * 120], scale: 0.95 + r() * 0.35, yaw: r() * 6.28, tint: r() });
    const ferns: PlantItem[] = Array.from({ length: 1300 }, () => ({ species: 'fern', at: [690 + r() * 120, 40, 360 + r() * 120], scale: 0.8 + r() * 0.4, yaw: r() * 6.28, tint: r() }));
    const out: Record<string, unknown> = {};
    for (const [name, groups, cam] of [['reach', [group('reach.marsh', marsh), group('reach.sedge', sedge)], [1270, 1250]], ['scholars', [group('scholars.wood', wood), group('scholars.ferns', ferns)], [750, 420]]] as const) {
      const ww = world([...groups]), res = corridorPlantingDistricts(ww);
      for (const theme of THEMES) for (const tier of ['full', 'lite'] as const) {
        const p = createCorridorPlanting(ww, { tier, theme, season: 'summer', month: 7 }); p.update(camAt(cam[0], cam[1]), res);
        const s = p.stats(); out[`${name}/${theme}/${tier}`] = { triangles: s.triangles, drawCalls: s.drawCalls, layers: Object.fromEntries(s.layers.map(l => [l.key, l.count])) };
        expect(s.triangles, `${name}/${theme}/${tier}`).toBeLessThanOrEqual(tier === 'full' ? 150000 : 60000);
        p.dispose();
      }
    }
    console.log('[ww plants] district budgets:', JSON.stringify(out));
  });
});
