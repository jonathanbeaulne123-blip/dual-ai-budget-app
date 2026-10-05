/**
 * Corridor planting drawn in the world (ROAD.md §4.6, §5, §6, §8): every `world.corridors[].planting` group's items as
 * card-kit plants, compatible bodies/shells packed into ordinary indexed draws, in Mountain v2's family (its tree and shrub geometry, colours,
 * wind and ink shells; `kit/plants/**` adds the palm, the flower bed and the grass tuft).
 *
 * Residency: an item belongs to the district containing it (`districtAt`, the definition's Voronoi partition, the same
 * one the runtime streams by); it is drawn only while that district is resident. When a district arrives while the
 * rider is near, its plants inside their radius scale in from the root over 0.6 s instead of appearing at once; a
 * released district's plants go with its ground (the stream releases only districts beyond its radius + 4 s reach).
 *
 * Distance: each instance has a far radius (per layer family and tier, thinned per item between `far × thin` and `far`,
 * never below NEAR_FLOOR). The shader scales an instance in from its root over the last 25 eu inside its far radius,
 * measured from the viewer (`uEye`), so nothing pops. On the CPU an instance joins its layer when it comes within
 * far + 10 and leaves beyond far + 30 (hysteresis), re-evaluated whenever the viewer has moved 8 eu or residency
 * changed: an instance is therefore always at scale 0 when it joins or leaves. Everything is at full size within
 * NEAR_FLOOR − 25 = 85 eu of the camera.
 *
 * Lite: fewer items per group (LITE_KEEP; each group keeps its first, last and largest item of every species, so the
 * group's silhouette stays), no ink shells, simpler palm and bed cards, nearer far radii.
 *
 * Seasons: the season value the region uses (`'spring' | 'summer' | 'autumn' | 'winter'`) plus, optionally, the month
 * (flowers bloom May–Sep, beds are mulched and snow-dusted Dec–Mar; STYLE §1.4.2). Trees follow v2's seasonal art
 * exactly (autumn tint on round, birch and poplar; blossom in spring and fruit in summer/autumn on fruit trees); palms
 * and Newfoundland's wind-bent pines stay green. `setSeason` is a no-op when nothing changes (the runtime calls its light
 * step every 60 s).
 *
 * Item conventions (for the plan track): `at` is the root on the final ground; `scale` is uniform (1 = the unit
 * archetype; v2's tree `size`); `yaw` is a rotation about +y (three.js). Hedges and flower beds run along local +x
 * (yaw = atan2(−t.z, t.x) for a verge tangent t); palms lean toward local +x and Newfoundland's pines stream toward
 * +x (set it downwind). `tint`: 0…1 variation; for `flowerBed` and `grassTuft` the integer part is the flower set
 * (`kit/plants/sets.ts` FLOWER_SET) and the fraction the variation; for `palm` a fraction ≥ 0.4 is the tall palm.
 *
 * The Water's Way species (`kit/plants/species.ts`: reeds to the Old Oak) draw through the same machinery: one layer per
 * species (and rule variant: Newfoundland black spruce, tuckamore; woodland spire/round cards), baked-colour unit
 * geometry per dressing, tier and season look (`kit/plants/wwGeometry.ts`), their own far family, lite share, wind,
 * ink shell and contact shadow. An item's `keep` forces it onto lite.
 */
import * as THREE from 'three';
import { packInstances, type PackedInstances } from './packedInstances';
import type { WorldDefinition } from '../world/definition.ts';
import type { PlantItem, PlantSpecies } from '../land/corridor/types.ts';
import { districtAt } from '../world/districts.ts';
import { SCENE_DRESSING } from '../../scene/place.ts';
import { mountainArtPalette, type MountainArtPalette } from '../../mountain/art/palette.ts';
import { crownGeometry, gradient } from '../../mountain/art/plantArt.ts';
import { crownOf } from '../../mountain/planting.ts';
import { mix, shade, type RGB } from '../../art/cardKit.ts';
import { FADE_BAND } from '../kit/plants/materials.ts';
import { FAR, HEDGE_STRETCH, LITE_KEEP, TREE_KINDS, farOf, isTree, leafColour, shrubColour, trunkColour, type LayerFamily, type PlantSeason } from '../kit/plants/archetypes.ts';
import { PALM, bentPineGeometry, bedGeometry, bloomGeometry, dotGeometry, palmGeometry, shadowGeometry, shrubGeometry, treeGeometry, tuftGeometry } from '../kit/plants/geometry.ts';
import { BORN_SECONDS, cardMaterial, contactMaterial, depthMaterial, fadeAt, rimMaterial, shellMaterial, type EyeUniform, type NowUniform, type PlantHook } from '../kit/plants/materials.ts';
import { FLOWER_SET, SEASON_MONTH, bloomStage, flowerSet, grassColour, setOf, variationOf, type BloomStage, type FlowerSetId, type PlantTheme } from '../kit/plants/sets.ts';
import { WW_SPECIES, WW_SPEC, isWW, wwStretch, wwVariant, type WWSpecies } from '../kit/plants/species.ts';
import { wwDrawn, wwGeometry, type WWGeometry, type WWLook } from '../kit/plants/wwGeometry.ts';

export type CorridorPlantingOptions = { tier: 'full' | 'lite'; theme: PlantTheme; season: PlantSeason; /** 1–12; refines the bloom stage within a season. */ month?: number };
export type CorridorPlantingStats = { items: number; drawn: number; drawCalls: number; triangles: number; layers: { key: string; count: number; capacity: number; triangles: number }[] };
export type CorridorPlanting = {
  group: THREE.Group;
  /** Call every frame (cheap): the viewer drives the fade; residency and distance re-evaluate after 8 eu or a residency change. */
  update(camera: THREE.Camera, resident: ReadonlySet<string>): void;
  setSeason(season: PlantSeason, month?: number): void;
  /** The stable material set (for the runtime's fog hook). */
  materials(): THREE.Material[];
  stats(): CorridorPlantingStats;
  /** Actual retained records and their submission owner, for capacity audits. */
  activeRecords(): { id: string; layer: string; batch: string; triangles: number }[];
  /** Test/diagnostic: is this item drawn in its body layer now, and at what shader scale for the current viewer. */
  probe(groupId: string, index: number): { district: string; kept: boolean; active: boolean; fade: number } | null;
  dispose(): void;
};

/** Sets drawn as wild drifts (no soil card or edging): the prairie, the Highlands' fell and the Reach's bog. */
const isWildSet = (set: FlowerSetId) => set === FLOWER_SET.prairie || set === FLOWER_SET.highland || set === FLOWER_SET.bog;
/** Hysteresis margins beyond an instance's far radius (eu), and the viewer travel that triggers re-evaluation. */
export const PLANT_JOIN = 10, PLANT_LEAVE = 30, PLANT_RECHECK = 8;
/** The far radius of the Water's Way trees' ink shells (the Old Oak's keeps FAR.shell). */
export const WW_SHELL_FAR = 120;
/** A `pine` item leaning at least this much (radians) is drawn wind-bent. */
export const BENT_PINE_LEAN = 0.15;

type Rec = { district: string; x: number; z: number; far: number; m: THREE.Matrix4; colour: RGB | null; stretch?: number; trunk?: RGB; on: boolean; /** Clock (s) it joined by residency while already inside its fade-free radius: it scales in from then. */ born: number };
type Layer = { key: string; family: LayerFamily; mesh: THREE.InstancedMesh; recs: Rec[]; tris: number; stretch: boolean; twoTone: boolean; dirty: boolean };
type Spec = { family: LayerFamily; geometry: () => THREE.BufferGeometry; material: THREE.Material; depth?: THREE.Material; cast: boolean; order?: number; stretch?: boolean; twoTone?: boolean };
type Item = { corridorId:string; groupId: string; index: number; item: PlantItem; district: string; kept: boolean; rank: number };

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 100000) / 100000; };
const finite = (p: PlantItem) => [p.at[0], p.at[1], p.at[2], p.scale, p.yaw].every(Number.isFinite) && p.scale > 0;

/** Lite keeps a share of each group's items of each species; always the first, last and largest (the silhouette). */
function liteKeep(items: readonly PlantItem[], groupId: string): boolean[] {
  const keep = items.map(() => false), by = new Map<PlantSpecies, number[]>();
  items.forEach((it, i) => { const l = by.get(it.species) ?? []; l.push(i); by.set(it.species, l); });
  for (const [species, idx] of by) {
    const n = idx.length, want = Math.max(Math.min(n, 2), Math.round(n * LITE_KEEP[species])), largest = idx.reduce((a, b) => (items[b]!.scale > items[a]!.scale ? b : a), idx[0]!);
    const must = new Set([idx[0]!, idx[n - 1]!, largest, ...idx.filter(i => items[i]!.keep)]);
    const rest = idx.filter(i => !must.has(i)).sort((a, b) => hash(`${groupId}:${a}`) - hash(`${groupId}:${b}`));
    for (const i of [...must, ...rest].slice(0, Math.max(want, must.size))) keep[i] = true;
  }
  return keep;
}

export function createCorridorPlanting(world: Pick<WorldDefinition, 'corridors'>, opts: CorridorPlantingOptions): CorridorPlanting {
  const tier = opts.tier, full = tier === 'full', pal: MountainArtPalette = mountainArtPalette(SCENE_DRESSING[opts.theme]);
  const group = new THREE.Group(); group.name = 'Corridor planting';
  const eye: EyeUniform = { value: new THREE.Vector3(1e9, 0, 1e9) }, now: NowUniform = { value: 0 };
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  // Items, with their district and lite selection. Non-finite items are skipped (never NaN in a matrix).
  const items: Item[] = [];
  for (const c of world.corridors ?? []) for (const g of c.planting) {
    // The carried mountain already draws its native forest on both tiers. Lite
    // omits alternate additional framing groves, retaining the complete shapes
    // of those it draws and all of the native trees. Full keeps every new grove.
    const extraGrove = c.id === 'mountainV2.road' ? /\.framingTrees\.(\d+)$/.exec(g.id) : null;
    if (!full && extraGrove && Number(extraGrove[1]) % 2 === 1) continue;
    const keep = full ? g.items.map(() => true) : liteKeep(g.items, g.id);
    g.items.forEach((item, index) => { if (finite(item)) items.push({ corridorId:c.id, groupId: g.id, index, item, district: districtAt(item.at[0], item.at[2], 1), kept: keep[index]!, rank: hash(`${g.id}#${index}`) }); });
  }
  // Materials: built once, stable across seasons (so the runtime can fog-hook them once).
  const mats: THREE.Material[] = [], own = <M extends THREE.Material>(m: M) => { mats.push(m); return m; };
  const hook = (h: Omit<PlantHook, 'eye' | 'now'>): PlantHook => ({ ...h, eye, now });
  const treeHook = (amp: number) => hook({ wind: amp, key: `tree${amp}`, twoTone: true });
  const M = {
    packedBody: own(cardMaterial(hook({ wind: 0, key: 'packedBody', packed: true, twoTone: true }))),
    packedDepth: own(depthMaterial(hook({ wind: 0, key: 'packedBody', packed: true, twoTone: true }))),
    packedShell: own(shellMaterial(pal.ink, hook({ wind: 0, key: 'packedShell', packed: true, farCap: FAR.shell.full }))),
    tree: { 0.022: own(cardMaterial(treeHook(0.022))), 0.012: own(cardMaterial(treeHook(0.012))) } as Record<number, THREE.Material>,
    treeDepth: { 0.022: own(depthMaterial(treeHook(0.022))), 0.012: own(depthMaterial(treeHook(0.012))) } as Record<number, THREE.Material>,
    shell: { 0.022: own(shellMaterial(pal.ink, hook({ wind: 0.022, key: 'shell', farCap: FAR.shell.full }))), 0.012: own(shellMaterial(pal.ink, hook({ wind: 0.012, key: 'shell', farCap: FAR.shell.full }))) } as Record<number, THREE.Material>,
    palm: own(cardMaterial(hook({ wind: 0.012, key: 'palm', stretchTop: PALM.top, backFace: opts.theme === 'taylor' ? { mul: 1, tint: pal.paperEdge, mix: 0.5 } : { mul: 0.62 } }), { side: THREE.DoubleSide })),
    palmDepth: own(depthMaterial(hook({ wind: 0.012, key: 'palm', stretchTop: PALM.top }))),
    // Palms: ink rims on the fronds (a card has no inside for a back-face shell); the Newfoundland pine's tiers are
    // closed cones and keep v2's back-face shell.
    palmShell: own(opts.theme === 'newfoundland' ? shellMaterial(pal.ink, hook({ wind: 0.012, key: 'palmShell', stretchTop: PALM.top, ink: 'attr', farCap: FAR.shell.full })) : rimMaterial(pal.ink, hook({ wind: 0.012, key: 'palmRim', stretchTop: PALM.top, farCap: FAR.shell.full }))),
    pineShell: own(shellMaterial(pal.ink, hook({ wind: 0.012, key: 'pineShell', stretchTop: PALM.top, ink: 'attr', farCap: FAR.shell.full }))),
    bed: own(cardMaterial(hook({ wind: 0, key: 'bed' }))),
    bloom: own(cardMaterial(hook({ wind: 0.05, key: 'bloom' }), { side: THREE.DoubleSide })),
    tuft: own(cardMaterial(hook({ wind: 0.08, key: 'tuft' }), { side: THREE.DoubleSide })),
    bush: own(cardMaterial(hook({ wind: 0.012, key: 'bush' }))),
    bushDepth: own(depthMaterial(hook({ wind: 0.012, key: 'bush' }))),
    hedge: own(cardMaterial(hook({ wind: 0.004, key: 'hedge' }))),
    hedgeDepth: own(depthMaterial(hook({ wind: 0.004, key: 'hedge' }))),
    heath: own(cardMaterial(hook({ wind: 0.012, key: 'heath' }))),
    dots: own(cardMaterial(hook({ wind: 0, key: 'dots' }), { roughness: 0.6 })),
    contact: own(contactMaterial(eye, now)),
  };
  // The Water's Way species: one material set each, built once (stable for the fog hook).
  const wwMats = new Map<WWSpecies, { body: THREE.Material; depth?: THREE.Material; shell?: THREE.Material }>();
  for (const sp of WW_SPECIES) {
    const spec = WW_SPEC[sp], shape = { wind: spec.wind, key: `ww:${sp}`, ...(spec.stretchTop !== undefined ? { stretchTop: spec.stretchTop } : {}) };
    const depth = spec.cast ? own(depthMaterial(hook(shape))) : undefined; if (depth && spec.double) depth.side = THREE.DoubleSide;
    // Taylor's cards show a paler paper backing; woodland cards (seen from both sides as canopy) keep their colour.
    const back = opts.theme === 'taylor' ? (sp === 'woodlandCard' ? { mul: 0.9 } : { mul: 1, tint: pal.paperEdge, mix: 0.28 }) : { mul: spec.back ?? 0.62 };
    wwMats.set(sp, { body: own(cardMaterial(hook({ ...shape, ...(spec.double ? { backFace: back } : {}) }), spec.double ? { side: THREE.DoubleSide } : {})), depth,
      shell: spec.shell ? own(shellMaterial(pal.ink, hook({ ...shape, key: `ww:${sp}:shell`, ink: 'attr', farCap: FAR.shell.full }))) : undefined });
  }

  let season = opts.season, month = opts.month ?? SEASON_MONTH[opts.season], layers: Layer[] = [];
  /** The layer a Water's Way item draws in (its species or rule variant, kit/plants/species.ts `wwVariant`). */
  const wwKey = (p: PlantItem, v: number) => { const r = wwVariant(p.species as WWSpecies, opts.theme, p.scale, v); return { ...r, key: `ww:${r.species}${r.variant ? `:${r.variant}` : ''}` }; };
  let packed: { key: string; layers: Layer[]; batch: PackedInstances }[] = [];
  /** A Water's Way layer joins the packed batches when it draws like a v2 tree: single-sided, unstretched, casting, not
   * the landmark (the oak keeps its own layer and its wide pushed-out shell); its shell then takes v2's radial rim. */
  const wwSpeciesOf = (key: string) => key.split(':')[1] as WWSpecies;
  const wwPackable = (key: string) => { if (!key.startsWith('ww:')) return false; const sp = WW_SPEC[wwSpeciesOf(key)]; return !!sp && !sp.double && sp.stretchTop === undefined && sp.cast && sp.family !== 'landmark'; };
  const packedKey = (key: string) => key.startsWith('tree:') || key === 'bush' || key === 'hedge' || (wwPackable(key) && !key.endsWith(':shell')) ? 'body' : key.startsWith('shell:') || (wwPackable(key) && key.endsWith(':shell')) ? 'shell' : null;
  const dummy = new THREE.Object3D();
  const matrix = (at: readonly [number, number, number], rx: number, yaw: number, rz: number, sx: number, sy = sx, sz = sx, dy = 0) => { dummy.position.set(at[0], at[1] + dy, at[2]); dummy.rotation.set(rx, yaw, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); return dummy.matrix.clone(); };
  const trisOf = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

  function build() {
    const stage: BloomStage = bloomStage(month);
    const buckets = new Map<string, Spec & { recs: Rec[] }>();
    // Unit geometries shared by several layers are built once per build (the palm body and its shell come together).
    let palmPair: ReturnType<typeof palmGeometry> | null = null; const palm = () => (palmPair ??= palmGeometry(pal, tier));
    const look: WWLook = { season, month, stage }, wwPairs = new Map<string, WWGeometry | null>();
    const wwPair = (key: string, sp: WWSpecies, variant: string | null) => { if (!wwPairs.has(key)) wwPairs.set(key, wwGeometry(sp, variant, pal, tier, look)); return wwPairs.get(key)!; };
    const add = (key: string, spec: Spec, rec: Omit<Rec, 'on' | 'far' | 'born'>, it: Item) => {
      // Lite keeps the authored mountain silhouettes and bend lights; subtract only secondary ground shadows.
      if(!full&&it.corridorId==='mountainV2.road'&&spec.family==='contact')return;
      let b = buckets.get(key); if (!b) { b = { ...spec, recs: [] }; buckets.set(key, b); }
      // Water's Way tree shells stop at WW_SHELL_FAR (dense woods: a 1 px rim beyond it is noise and costs the district).
      const far = farOf(spec.family, tier, it.rank), cap = key.startsWith('ww:') && key.endsWith(':shell') && !key.startsWith('ww:oakGiant') ? WW_SHELL_FAR : Infinity;
      b.recs.push({ ...rec, far: Math.min(far, cap), on: false, born: -1e9 });
    };
    const base = (it: Item) => ({ district: it.district, x: it.item.at[0], z: it.item.at[2] });
    for (const it of items) {
      if (!it.kept) continue;
      const p = it.item, v = variationOf(p.tint, p.at[0], p.at[2]), s = p.scale, at = p.at;
      if (isWW(p.species)) {
        const { key, species: sp, variant } = wwKey(p, v);
        if (!wwDrawn(sp, look)) continue;
        const spec = WW_SPEC[sp], mats = wwMats.get(sp)!, pair = wwPair(key, sp, variant); if (!pair) continue;
        const lean = p.lean !== undefined && Number.isFinite(p.lean) ? Math.min(p.lean, 0.3) : 0, dy = sp === 'lily' ? 0 : spec.family === 'tree' || spec.family === 'palm' || spec.family === 'landmark' ? -0.05 : -0.02;
        const m = matrix(at, 0, p.yaw, -lean, s, s, s, dy), stretch = spec.stretchTop !== undefined;
        // Value ±4 % with a hint of warm/cool (STYLE §1.4.1 rule 5); the species' colours are baked in the unit.
        const tone: RGB = [0.96 + v * 0.08, 0.965 + v * 0.07, 0.95 + (1 - v) * 0.06];
        add(key, { family: spec.family, geometry: () => pair.body, material: mats.body, depth: mats.depth, cast: full && spec.cast, stretch }, { ...base(it), m, colour: tone, stretch: wwStretch(sp, v) }, it);
        if (full && pair.shell && mats.shell) add(`${key}:shell`, { family: 'shell', geometry: () => pair.shell!, material: mats.shell, cast: false, stretch }, { ...base(it), m, colour: null, stretch: wwStretch(sp, v) }, it);
        if (spec.contact) add('contact', { family: 'contact', geometry: shadowGeometry, material: M.contact, cast: false, order: 1 }, { ...base(it), m: matrix([at[0] + 0.25 * spec.contact * s, at[1], at[2] - 0.12 * spec.contact * s], 0, 0, 0, spec.contact * s, 1, spec.contact * s * 0.92, 0.06), colour: null }, it);
        continue;
      }
      if (isTree(p.species)) {
        const kind = p.species, lean = p.lean !== undefined && Number.isFinite(p.lean) ? p.lean : 0;
        if (kind === 'pine' && lean >= BENT_PINE_LEAN) {
          // A wind-bent pine (the Newfoundland palm's shape, in this dressing's pine greens), streaming toward local +x.
          add('bentPine', { family: 'tree', geometry: () => bentPineGeometry(pal, tier).body, material: M.palm, depth: M.palmDepth, cast: full, stretch: true }, { ...base(it), m: matrix(at, 0, p.yaw, 0, s, s, s, -0.05), colour: shade([1, 1, 1], 0.95 + v * 0.1), stretch: 1 }, it);
          if (full) add('bentPineShell', { family: 'shell', geometry: () => bentPineGeometry(pal, tier).shell!, material: M.pineShell, cast: false, stretch: true }, { ...base(it), m: matrix(at, 0, p.yaw, 0, s, s, s, -0.05), colour: null, stretch: 1 }, it);
          add('contact', { family: 'contact', geometry: shadowGeometry, material: M.contact, cast: false, order: 1 }, { ...base(it), m: matrix([at[0] + Math.cos(p.yaw) * 0.8 * s, at[1], at[2] - Math.sin(p.yaw) * 0.8 * s], 0, 0, 0, 1.6 * s, 1, 1.3 * s, 0.06), colour: null }, it);
          continue;
        }
        const amp = kind === 'pine' || kind === 'alpine' ? 0.012 : 0.022, tilt = lean || (v - 0.5) * 0.12;
        // v2 tilts a tree about x by half its lean after its spin; a stated lean tilts toward local +x (about z, negative).
        const m = lean ? matrix(at, 0, p.yaw, -Math.min(lean, 0.3), s) : matrix(at, tilt * 0.5, p.yaw, 0, s);
        add(`tree:${kind}`, { family: 'tree', geometry: () => treeGeometry(kind), material: M.tree[amp]!, depth: M.treeDepth[amp], cast: full, twoTone: true }, { ...base(it), m, colour: leafColour(pal, kind, v, season), trunk: trunkColour(pal, kind, v) }, it);
        if (full) add(`shell:${kind}`, { family: 'shell', geometry: () => crownGeometry(kind), material: M.shell[amp]!, cast: false }, { ...base(it), m, colour: null }, it);
        const c = crownOf({ kind, size: s });
        add('contact', { family: 'contact', geometry: shadowGeometry, material: M.contact, cast: false, order: 1 }, { ...base(it), m: matrix(at, 0, 0, 0, c.radius * 1.05, 1, c.radius * 0.95, 0.06), colour: null }, it);
        if (kind === 'fruit' && season !== 'winter') {
          const dots = season === 'spring' ? 16 : 9;
          for (let k = 0; k < dots; k++) { const a = (k * 2.399 + it.index) % 6.283, h = (k * 0.37 + it.index * 0.13) % 1, r = (1.05 + h * 0.35) * s, sp = p.yaw;
            const col = season === 'spring' ? pal.blossom[k % pal.blossom.length]! : k % 4 === 0 ? mix(pal.fruit, [0.9, 0.75, 0.3], 0.4) : pal.fruit;
            add(`dots:${season === 'spring' ? 0.2 : 0.17}`, { family: 'dots', geometry: () => gradient(dotGeometry(season === 'spring' ? 0.2 : 0.17), 0.95, 1.05, -0.2, 0.2), material: M.dots, cast: false },
              { ...base(it), m: matrix([at[0] + Math.cos(a + sp) * r, at[1] + (1.9 + h * 1.1) * s, at[2] + Math.sin(a + sp) * r], 0, 0, 0, 1), colour: col }, it); }
        }
        continue;
      }
      switch (p.species) {
        case 'palm': {
          const tall = v >= 0.4 ? PALM.tall : 1, m = matrix(at, 0, p.yaw, 0, s, s, s, -0.05);
          add('palm', { family: 'palm', geometry: () => palm().body, material: M.palm, depth: M.palmDepth, cast: full, stretch: true }, { ...base(it), m, colour: shade([1, 1, 1], 0.96 + v * 0.08), stretch: tall }, it);
          if (full) add('palmShell', { family: 'shell', geometry: () => palm().shell!, material: M.palmShell, cast: false, stretch: true }, { ...base(it), m, colour: null, stretch: tall }, it);
          const r = (opts.theme === 'newfoundland' ? 1.5 : 1.0) * s;
          add('contact', { family: 'contact', geometry: shadowGeometry, material: M.contact, cast: false, order: 1 }, { ...base(it), m: matrix(at, 0, 0, 0, r, 1, r * 0.9, 0.06), colour: null }, it);
          break;
        }
        case 'flowerBed': {
          const m = matrix(at, 0, p.yaw, 0, s, 1, s, 0), set = setOf(p.tint), wild = isWildSet(set);
          add(wild ? 'bed:wild' : 'bed', { family: 'bed', geometry: () => bedGeometry(pal, tier, stage, wild), material: M.bed, cast: false }, { ...base(it), m, colour: shade([1, 1, 1], 0.97 + v * 0.06) }, it);
          // Blooms draw in bud, bloom and fade; none in leaf (Nov) or under the winter mulch (bloomGeometry → null).
          if (stage !== 'leaf' && stage !== 'mulch') add(`bloom:${set}`, { family: 'bloom', geometry: () => bloomGeometry(pal, tier, flowerSet(opts.theme, set), stage)!, material: M.bloom, cast: false }, { ...base(it), m, colour: shade([1, 1, 1], 0.96 + v * 0.08) }, it);
          break;
        }
        case 'grassTuft': {
          const set: FlowerSetId = p.tint === undefined ? FLOWER_SET.meadow : setOf(p.tint), m = matrix(at, 0, p.yaw, 0, s, s * (1.1 + v * 0.5), s, -0.02);
          add('tuft', { family: 'tuft', geometry: tuftGeometry, material: M.tuft, cast: false }, { ...base(it), m, colour: shade(grassColour(set, stage, pal.leaf[v > 0.5 ? 1 : 2]!, v), 0.85 + v * 0.15) }, it);
          break;
        }
        case 'hedge': {
          const m = matrix(at, 0, p.yaw, 0, s * HEDGE_STRETCH, s * 1.25, s * 0.9, -0.05);
          add('hedge', { family: 'shrub', geometry: () => shrubGeometry('hedge'), material: M.hedge, depth: M.hedgeDepth, cast: full }, { ...base(it), m, colour: shrubColour(pal, 'hedge', v) }, it);
          break;
        }
        case 'heath': {
          add('heath', { family: 'shrub', geometry: () => shrubGeometry('heath'), material: M.heath, cast: false }, { ...base(it), m: matrix(at, 0, p.yaw, 0, s, s, s, -0.05), colour: shrubColour(pal, 'heath', v) }, it);
          break;
        }
        default: { // shrub, flowering: v2's bush; a flowering shrub carries bloom dots in its bloom months
          const kind = p.species as 'shrub' | 'flowering';
          add('bush', { family: 'shrub', geometry: () => shrubGeometry('bush'), material: M.bush, depth: M.bushDepth, cast: full }, { ...base(it), m: matrix(at, 0, p.yaw, 0, s, s, s, -0.05), colour: shrubColour(pal, kind, v) }, it);
          if (kind === 'flowering' && (stage === 'bloom' || stage === 'fade')) {
            const col = pal.flowers[Math.floor(v * pal.flowers.length) % pal.flowers.length]!, n = stage === 'bloom' ? 8 : 3;
            for (let k = 0; k < n; k++) { const a = k * 2.399 + v * 6, r = (0.55 + (k % 3) * 0.2) * s;
              add('dots:0.12', { family: 'dots', geometry: () => gradient(dotGeometry(0.12), 0.95, 1.05, -0.2, 0.2), material: M.dots, cast: false }, { ...base(it), m: matrix([at[0] + Math.cos(a + p.yaw) * r, at[1] + (0.55 + (k % 4) * 0.12) * s, at[2] + Math.sin(a + p.yaw) * r], 0, 0, 0, 1), colour: shade(col, 0.92 + (k % 3) * 0.06) }, it); }
          }
        }
      }
    }
    // One InstancedMesh per layer; per-instance attributes live on the layer's own geometry.
    const shared = new Set<THREE.BufferGeometry>();
    layers = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, b]) => {
      // Each layer owns its geometry (its per-instance attributes live there): a shared unit geometry is cloned.
      let geometry = b.geometry(); if (shared.has(geometry)) geometry = geometry.clone(); shared.add(geometry);
      const n = b.recs.length;
      geometry.setAttribute('aFar', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
      geometry.setAttribute('aBorn', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
      if (b.stretch) geometry.setAttribute('aStretch', new THREE.InstancedBufferAttribute(new Float32Array(n).fill(1), 1));
      if (b.twoTone) geometry.setAttribute('aTrunk', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
      const mesh = new THREE.InstancedMesh(geometry, b.material, n); mesh.count = 0; mesh.name = `Corridor ${key}`;
      mesh.castShadow = b.cast; mesh.receiveShadow = true; if (b.depth) mesh.customDepthMaterial = b.depth; if (b.order) mesh.renderOrder = b.order;
      if (b.recs.some(r => r.colour)) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      mesh.visible = false; if (!packedKey(key)) group.add(mesh);
      return { key, family: b.family, mesh, recs: b.recs, tris: trisOf(geometry), stretch: !!b.stretch, twoTone: !!b.twoTone, dirty: true };
    });
    packed = [];
    for (const key of ['body', 'shell']) {
      const selected = layers.filter(l => packedKey(l.key) === key); if (!selected.length) continue;
      const source = selected.map(l => ({key:l.key, mesh:l.mesh, wind:l.key.startsWith('ww:') ? WW_SPEC[wwSpeciesOf(l.key)].wind : l.key === 'hedge' ? .004 : l.key === 'bush' || /:(pine|alpine)$/.test(l.key) ? .012 : .022}));
      const batch = packInstances(source, key === 'body' ? M.packedBody : M.packedShell, {name:`Corridor packed:${key}`, plant:true, depth:key === 'body' ? M.packedDepth : undefined});
      packed.push({key, layers:selected, batch}); group.add(batch.mesh);
    }
  }
  function write(layer: Layer) {
    const { mesh } = layer, g = mesh.geometry, far = g.getAttribute('aFar') as THREE.InstancedBufferAttribute, born = g.getAttribute('aBorn') as THREE.InstancedBufferAttribute, st = g.getAttribute('aStretch') as THREE.InstancedBufferAttribute | undefined, tr = g.getAttribute('aTrunk') as THREE.InstancedBufferAttribute | undefined;
    let n = 0;
    for (const r of layer.recs) {
      if (!r.on) continue;
      mesh.instanceMatrix.array.set(r.m.elements, n * 16); (far.array as Float32Array)[n] = r.far; (born.array as Float32Array)[n] = r.born - clockBase;
      if (mesh.instanceColor && r.colour) (mesh.instanceColor.array as Float32Array).set(r.colour, n * 3);
      if (st) (st.array as Float32Array)[n] = r.stretch ?? 1;
      if (tr && r.trunk) (tr.array as Float32Array).set(r.trunk, n * 3);
      n++;
    }
    mesh.count = n; mesh.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true; far.needsUpdate = true; born.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; if (st) st.needsUpdate = true; if (tr) tr.needsUpdate = true;
    if (n) mesh.computeBoundingSphere(); layer.dirty = false;
  }
  let lastAt: { x: number; z: number } | null = null, lastResident = new Set<string>();
  // uNow and aBorn are relative to this base so float32 keeps millisecond precision.
  const clockBase = clock();
  function evaluate(x: number, z: number, resident: ReadonlySet<string>) {
    // The first evaluation is the world opening (drawn under the loading veil): nothing scales in.
    const first = lastAt === null, at = clock();
    let packedChanged = false;
    for (const layer of layers) {
      let changed = layer.dirty;
      for (const r of layer.recs) {
        const d = Math.hypot(r.x - x, r.z - z), on = resident.has(r.district) && (r.on ? d <= r.far + PLANT_LEAVE : d < r.far + PLANT_JOIN);
        if (on !== r.on) {
          // A join inside the fade band's outer edge would pop (its district just arrived): it scales in over BORN_SECONDS.
          if (on) r.born = first || d >= r.far - FADE_BAND * 0.1 ? -1e9 : at; r.on = on; changed = true;
        }
      }
      if (changed) { write(layer); if (packedKey(layer.key)) packedChanged = true; }
    }
    if (packedChanged) for (const p of packed) p.batch.sync();
    lastAt = { x, z }; lastResident = new Set(resident);
  }
  build();
  let dead = false;
  return {
    group,
    update(camera, resident) {
      if (dead) return;
      camera.getWorldPosition(eye.value); now.value = clock() - clockBase;
      const x = eye.value.x, z = eye.value.z;
      let residencyChanged = resident.size !== lastResident.size;
      if (!residencyChanged) for (const id of resident) if (!lastResident.has(id)) { residencyChanged = true; break; }
      if (!lastAt || residencyChanged || Math.hypot(x - lastAt.x, z - lastAt.z) >= PLANT_RECHECK || layers.some(l => l.dirty)) evaluate(x, z, resident);
    },
    setSeason(next, nextMonth) {
      const m = nextMonth ?? SEASON_MONTH[next];
      if (dead || (next === season && bloomStage(m) === bloomStage(month) && m === month)) return;
      const stageChanged = bloomStage(m) !== bloomStage(month) || next !== season; season = next; month = m;
      if (!stageChanged) return;
      for (const p of packed) p.batch.dispose(); packed = [];
      for (const l of layers) { group.remove(l.mesh); l.mesh.geometry.dispose(); l.mesh.dispose(); }
      build(); if (lastAt) evaluate(lastAt.x, lastAt.z, lastResident);
    },
    materials: () => [...mats],
    stats() {
      const ls = layers.map(l => ({ key: l.key, count: l.mesh.count, capacity: l.recs.length, triangles: l.mesh.count * l.tris }));
      return { items: items.length, drawn: layers.filter(l => l.family !== 'shell' && l.family !== 'contact' && l.family !== 'dots').reduce((a, l) => a + l.mesh.count, 0), drawCalls: layers.filter(l => !packedKey(l.key) && l.mesh.count > 0).length + packed.filter(p => p.batch.mesh.visible).length, triangles: ls.reduce((a, l) => a + l.triangles, 0), layers: ls };
    },
    activeRecords() {
      return layers.flatMap(l => l.recs.flatMap((r, i) => r.on ? [{id:`${l.key}:${i}`, layer:l.key, batch:packedKey(l.key) ?? l.key, triangles:l.tris}] : []));
    },
    probe(groupId, index) {
      const it = items.find(i => i.groupId === groupId && i.index === index); if (!it) return null;
      const p = it.item, key = isWW(p.species) ? wwKey(p, variationOf(p.tint, p.at[0], p.at[2])).key : p.species === 'pine' && (p.lean ?? 0) >= BENT_PINE_LEAN ? 'bentPine' : isTree(p.species) ? `tree:${p.species}` : p.species === 'flowering' || p.species === 'shrub' ? 'bush' : p.species === 'flowerBed' ? (isWildSet(setOf(p.tint)) ? 'bed:wild' : 'bed') : p.species === 'grassTuft' ? 'tuft' : p.species;
      const layer = layers.find(l => l.key === key), rec = layer?.recs.find(r => r.x === p.at[0] && r.z === p.at[2] && r.district === it.district);
      if (!rec) return { district: it.district, kept: it.kept, active: false, fade: 0 };
      const born = Math.max(0, Math.min(1, (clock() - rec.born) / BORN_SECONDS)), grown = born * born * (3 - 2 * born);
      return { district: it.district, kept: it.kept, active: rec.on, fade: rec.on ? fadeAt(Math.hypot(rec.x - eye.value.x, rec.z - eye.value.z), rec.far) * grown : 0 };
    },
    dispose() {
      if (dead) return; dead = true; group.removeFromParent();
      for (const p of packed) p.batch.dispose(); packed = [];
      for (const l of layers) { l.mesh.geometry.dispose(); l.mesh.dispose(); }
      for (const m of mats) m.dispose(); layers = []; group.clear();
    },
  };
}
/** The districts a world's corridor planting touches (e.g. to build a resident set for a sheet or a test). */
export function corridorPlantingDistricts(world: Pick<WorldDefinition, 'corridors'>): Set<string> {
  const out = new Set<string>();
  for (const c of world.corridors ?? []) for (const g of c.planting) for (const it of g.items) if (finite(it)) out.add(districtAt(it.at[0], it.at[2], 1));
  return out;
}
export { TREE_KINDS };
