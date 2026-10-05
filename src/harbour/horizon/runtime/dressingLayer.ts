/**
 * The Water's Way (STORY.md): the neighbourhood dressing drawn in the world, from the baked `world.dressing` records
 * (neighbourhoods/bake.ts). Built per RESIDENT district, lazily — one district at a time, a few ms per frame
 * (`createBuildTask`, like the district cards and the corridor art) — and released `DRESSING_DETAIL.releaseMs` after the
 * district leaves residency (the corridorArt pattern). A district's records arrive with its chunk (the index carries none;
 * `appendChunkDressing` adds them), and the district stream only makes a district resident once its chunk is here.
 *
 * Per district:
 * - buildings with the building grammar (`kit/buildings drawBuilding`) and props with the prop kit (`kit/props drawProp`)
 *   into ONE CardBuilder (a single card cell) → a handful of merged draws per material (card, steel, paint, glass, glow,
 *   flat, shade, ink, water);
 * - ground paint (`GroundPaint`) as terrain-conformed decal triangles in the builder's polygon-offset `flat` bucket (one
 *   mesh), coloured by `neighbourhoods/paint.ts`; pools (`PoolRecord`) as flat water in the builder's water bucket (the card
 *   kit's own water material);
 * - plants through the corridor planting machinery (`createCorridorPlanting`): the district's `PlantRecord`s become one
 *   synthetic corridor `dressing.<district>` with a `framingTrees` group (and a one-item group per `keep` plant, so lite's
 *   per-group share never drops it). The plant kit renders every `DressingSpecies`.
 *
 * Collision is NOT built here: the bake emitted it as `dressing` solids (cards never draw them). Night: windows and lamps
 * the kits put in the `glow` bucket are emissive cards (no point lights; the light pool is untouched) whose opacity follows
 * the night level exactly as the bridge art's glow (`0.12 + 0.88 k`). Lite: the planting machinery's lite share, and props of
 * a non-essential kind (`LITE_DROP_PROPS`) are dropped unless they collide or carry a pastime fixture (lite drops, never
 * substitutes; collision stays what is drawn).
 */
import * as THREE from 'three';
import {createBuildTask, finishBuild} from '../../../house/world/buildTask.ts';
import {CardBuilder, rgb, shade, type CardBuild, type V3} from '../../art/cardScene.ts';
import type {WorldDefinition} from '../world/definition.ts';
import type {Corridor, PlantItem, PlantSpecies, PlantingGroup} from '../land/corridor/types.ts';
import type {DistrictDressing, DressingTheme, PlantRecord, PropKind} from '../neighbourhoods/types.ts';
import {drawBuilding} from '../kit/buildings/index.ts';
import {drawProp} from '../kit/props/index.ts';
import {groundPaintHex, groundPaintTone} from '../neighbourhoods/paint.ts';
import {createCorridorPlanting, type CorridorPlanting} from './corridorPlanting.ts';
import type {PlantSeason} from '../kit/plants/archetypes.ts';

export const DRESSING_DETAIL = {releaseMs: 20_000, paintLift: 0.04, paintEdge: 2.5, glowDay: 0.12} as const;
/** Props lite drops (decoration, never a collider or a pastime fixture). */
export const LITE_DROP_PROPS: ReadonlySet<PropKind> = new Set(['towel', 'umbrella', 'crate', 'net', 'laundryLine', 'festoon', 'flag', 'hayBale', 'hive', 'birdFeeder', 'duckBox', 'kite', 'bookCart', 'buoy', 'lifeRing', 'rodHolder', 'planter']);

export type DressingLayerOptions = {
  tier: 'full' | 'lite'; theme: DressingTheme; season: PlantSeason; month?: number;
  /** The final ground (plinths, paint, props on the ground): the runtime passes `geography.ground`. */
  ground: (x: number, z: number) => number;
  /** Each material the layer creates, once (the runtime's fog stage). */
  material?: (m: THREE.Material) => void;
  /** A district's art landed or left (the runtime requests a shadow update). */
  changed?: () => void;
  /** `?hideBuildings`: buildings are not drawn (props, plants and paint still are). */
  hideBuildings?: boolean;
};
export type DressingDistrictStats = {triangles: number; drawCalls: number; buildings: number; props: number; plants: number};
export type DressingLayer = {
  group: THREE.Group;
  update(camera: THREE.Camera, resident: ReadonlySet<string>): void;
  /** 0 day → 1 night: the glow cards (windows, lanterns) light. */
  setNight(k: number): void;
  setSeason(season: PlantSeason, month?: number): void;
  /** True while a resident district's dressing is still being built. */
  building(): boolean;
  /** Build every listed district now (tests, captures). */
  prebuild(ids: Iterable<string>): void;
  stats(): {districts: Record<string, DressingDistrictStats>};
  dispose(): void;
};

type DistrictArt = {id: string; group: THREE.Group; cards: CardBuild; planting: CorridorPlanting | null; lastResident: number; stats: DressingDistrictStats};

/** A plant record as the corridor planting machinery's item (the kit's species union covers every `DressingSpecies`). */
export function plantItem(p: PlantRecord): PlantItem {
  return {species: p.species as PlantSpecies, at: [p.at[0], p.at[1], p.at[2]], scale: p.scale, yaw: p.yaw, ...(p.tint !== undefined ? {tint: p.tint} : {}), ...(p.lean !== undefined ? {lean: p.lean} : {})};
}
/** The district's plants as one synthetic corridor (`dressing.<district>`), `keep` plants in groups of their own. */
export function dressingCorridor(d: Pick<DistrictDressing, 'districtId' | 'plants'>): Corridor {
  const id = `dressing.${d.districtId}`, rest = d.plants.filter(p => !p.keep).map(plantItem);
  const planting: PlantingGroup[] = [];
  if (rest.length) planting.push({id, kind: 'framingTrees', reachId: 'dressing', side: 'left', items: rest});
  d.plants.forEach((p, i) => { if (p.keep) planting.push({id: `${id}.keep.${i}`, kind: 'framingTrees', reachId: 'dressing', side: 'left', items: [plantItem(p)]}); });
  return {id, closed: false, step: 2, stations: [], reaches: [], markings: [], guards: [], lamps: [], planting, stops: []};
}

/** Triangulate a polygon (x, z) and subdivide until every edge is ≤ `edge` eu, so the decal follows the ground. */
export function drapePolygon(polygon: readonly (readonly [number, number])[], edge: number): [number, number][][] {
  const contour = polygon.map(p => new THREE.Vector2(p[0], p[1])), out: [number, number][][] = [];
  if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
  const split = (a: [number, number], b: [number, number], c: [number, number], depth: number) => {
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]), m = Math.max(ab, bc, ca);
    if (m <= edge || depth > 12) { out.push([a, b, c]); return; }
    // Split the longest edge (keeps neighbours conforming enough at 2–3 eu; the decal is offset, never z-fighting).
    if (m === ab) { const p: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; split(a, p, c, depth + 1); split(p, b, c, depth + 1); }
    else if (m === bc) { const p: [number, number] = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2]; split(a, b, p, depth + 1); split(a, p, c, depth + 1); }
    else { const p: [number, number] = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2]; split(a, b, p, depth + 1); split(p, b, c, depth + 1); }
  };
  for (const t of THREE.ShapeUtils.triangulateShape(contour, [])) { const P = (i: number): [number, number] => [contour[i]!.x, contour[i]!.y]; split(P(t[0]!), P(t[1]!), P(t[2]!), 0); }
  return out;
}

/** Build one district's dressing (pure of the scene: returns the group; the caller adds it). */
export function* buildDistrictDressingSteps(d: DistrictDressing, opts: Omit<DressingLayerOptions, 'changed' | 'material'>): Generator<void, Omit<DistrictArt, 'lastResident'>, void> {
  const {tier, theme, ground} = opts;
  const b = new CardBuilder(`horizon.dressing.${d.districtId}`, tier, {ink: '#5b5447', cell: 8192, shadows: tier === 'full'});
  let buildings = 0, props = 0;
  if (!opts.hideBuildings) for (const rec of d.buildings) { drawBuilding(b, rec, theme, ground, tier); buildings++; yield; }
  for (let i = 0; i < d.props.length; i++) {
    const rec = d.props[i]!;
    if (tier === 'lite' && LITE_DROP_PROPS.has(rec.kind) && !rec.collide && !rec.fixture) continue;
    drawProp(b, rec, theme, ground, tier); props++; if (i % 8 === 7) yield;
  }
  for (const g of d.ground) {
    const col = shade(rgb(groundPaintHex(theme, g.surface)), groundPaintTone(g.tone)), y = (p: readonly [number, number]): V3 => [p[0], ground(p[0], p[1]) + DRESSING_DETAIL.paintLift, p[1]];
    for (const [p0, p1, p2] of drapePolygon(g.polygon, DRESSING_DETAIL.paintEdge)) b.tri(y(p0!), y(p2!), y(p1!), col, 'flat');
    yield;
  }
  for (const pool of d.pools) {
    const contour = pool.outline.map(p => new THREE.Vector2(p[0], p[1])), color = rgb('#608b87');
    for (const t of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const P = (i: number): V3 => [contour[i]!.x, pool.level, contour[i]!.y];
      b.water(P(t[0]!), P(t[1]!), P(t[2]!), [contour[t[0]!]!.x * 0.02, 0], [contour[t[1]!]!.x * 0.02, 1], [contour[t[2]!]!.x * 0.02, 0.5], color);
    }
  }
  const cards = yield* b.finishSteps();
  const group = new THREE.Group(); group.name = `horizon.dressing.${d.districtId}`; group.add(cards.group);
  let planting: CorridorPlanting | null = null;
  if (d.plants.length) { planting = createCorridorPlanting({corridors: [dressingCorridor(d)]}, {tier, theme, season: opts.season, ...(opts.month !== undefined ? {month: opts.month} : {})}); group.add(planting.group); }
  const {triangles, drawCalls} = countDraws(cards.group);
  return {id: d.districtId, group, cards, planting, stats: {triangles, drawCalls, buildings, props, plants: d.plants.length}};
}

/** Triangles and draw calls of a group (a transparent double-sided material draws twice; ink lines are draws, not triangles). */
export function countDraws(root: THREE.Object3D): {triangles: number; drawCalls: number} {
  let triangles = 0, drawCalls = 0;
  root.traverse(o => {
    const mesh = o as THREE.Mesh; if (!mesh.geometry) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    drawCalls += mats.reduce((n, m) => n + (m.transparent && m.side === THREE.DoubleSide && !m.forceSinglePass ? 2 : 1), 0);
    if (o instanceof THREE.LineSegments) return;
    const g = mesh.geometry, total = g.index ? g.index.count : g.getAttribute('position').count, n = Math.min(total - g.drawRange.start, g.drawRange.count);
    triangles += n / 3 * ((o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1);
  });
  return {triangles: Math.round(triangles), drawCalls};
}

/**
 * The district's dressing art budget (the bake writes it into `District.dressing` and the district's triangle/draw counts):
 * the worst of the three dressings, every plant layer at capacity (the viewer at the plants' centroid; each active layer's
 * per-instance triangles × its full item count).
 */
export function measureDistrictDressing(d: DistrictDressing, ground: (x: number, z: number) => number, tier: 'full' | 'lite'): {triangles: number; drawCalls: number} {
  let worst = {triangles: 0, drawCalls: 0};
  for (const theme of ['classic', 'taylor', 'newfoundland'] as const) {
    const art = finishBuild(buildDistrictDressingSteps(d, {tier, theme, season: 'summer', ground}));
    let triangles = art.stats.triangles, drawCalls = art.stats.drawCalls;
    if (art.planting && d.plants.length) {
      const c = d.plants.reduce((s, p) => [s[0] + p.at[0] / d.plants.length, s[1] + p.at[1] / d.plants.length, s[2] + p.at[2] / d.plants.length], [0, 0, 0]);
      const camera = new THREE.PerspectiveCamera(58, 1.6, 0.3, 900); camera.position.set(c[0]!, c[1]! + 3, c[2]!); camera.updateMatrixWorld();
      art.planting.update(camera, new Set([d.districtId]));
      const s = art.planting.stats();
      for (const l of s.layers) if (l.count > 0) triangles += Math.round(l.triangles / l.count * l.capacity);
      drawCalls += s.drawCalls;
    }
    art.planting?.dispose(); art.cards.dispose();
    if (triangles > worst.triangles || (triangles === worst.triangles && drawCalls > worst.drawCalls)) worst = {triangles, drawCalls};
  }
  return worst;
}

export function createDressingLayer(world: Pick<WorldDefinition, 'dressing'>, opts: DressingLayerOptions): DressingLayer {
  const group = new THREE.Group(); group.name = 'horizon.dressing';
  const districts = new Map<string, DistrictArt>();
  let season = opts.season, month = opts.month, night = 0, task: {id: string; run: ReturnType<typeof createBuildTask<Omit<DistrictArt, 'lastResident'>>>} | null = null, pending = false, dead = false;
  const recordsOf = (id: string) => world.dressing?.districts.find(d => d.districtId === id) ?? null;
  const glowOf = (art: Pick<DistrictArt, 'cards'>) => { const glow = art.cards.materials.glow; if (glow) { glow.transparent = true; glow.opacity = DRESSING_DETAIL.glowDay + (1 - DRESSING_DETAIL.glowDay) * night; } };
  function land(art: Omit<DistrictArt, 'lastResident'>): DistrictArt {
    for (const m of Object.values(art.cards.materials)) opts.material?.(m);
    for (const m of art.planting?.materials() ?? []) opts.material?.(m);
    glowOf(art); art.group.visible = false; group.add(art.group);
    const done = {...art, lastResident: performance.now()}; districts.set(art.id, done); opts.changed?.(); return done;
  }
  function release(art: DistrictArt) { group.remove(art.group); art.planting?.dispose(); art.cards.dispose(); districts.delete(art.id); opts.changed?.(); }
  const buildOpts = () => ({tier: opts.tier, theme: opts.theme, season, ...(month !== undefined ? {month} : {}), ground: opts.ground, ...(opts.hideBuildings ? {hideBuildings: true} : {})});
  return {
    group,
    update(camera, resident) {
      if (dead) return;
      const now = performance.now();
      if (task && !resident.has(task.id)) { task.run.cancel(); task = null; }
      if (!task) for (const id of resident) { if (districts.has(id)) continue; const d = recordsOf(id); if (d) { task = {id, run: createBuildTask(buildDistrictDressingSteps(d, buildOpts()))}; break; } }
      if (task) { const done = task.run.advance(); if (done) { land(done); task = null; } }
      pending = task !== null; if (!pending) for (const id of resident) if (!districts.has(id) && recordsOf(id)) { pending = true; break; }
      for (const art of [...districts.values()]) {
        const on = resident.has(art.id); art.group.visible = on;
        if (on) { art.lastResident = now; art.planting?.update(camera, resident); }
        else if (now - art.lastResident > DRESSING_DETAIL.releaseMs) release(art);
      }
    },
    setNight(kIn) { night = Math.max(0, Math.min(1, kIn)); for (const art of districts.values()) glowOf(art); },
    setSeason(next, nextMonth) { season = next; month = nextMonth; for (const art of districts.values()) art.planting?.setSeason(next, nextMonth); },
    building: () => pending,
    prebuild(ids) { for (const id of ids) { if (districts.has(id)) continue; const d = recordsOf(id); if (d) land(finishBuild(buildDistrictDressingSteps(d, buildOpts()))).group.visible = true; } },
    // Cards as built, plus the planting's currently drawn layers (its own distance rules decide what is on).
    stats() { const out: Record<string, DressingDistrictStats> = {}; for (const [id, art] of districts) { const p = art.planting?.stats(); out[id] = {...art.stats, triangles: art.stats.triangles + (p?.triangles ?? 0), drawCalls: art.stats.drawCalls + (p?.drawCalls ?? 0)}; } return {districts: out}; },
    dispose() { if (dead) return; dead = true; task?.run.cancel(); task = null; for (const art of [...districts.values()]) { art.planting?.dispose(); art.cards.dispose(); } districts.clear(); group.removeFromParent(); group.clear(); },
  };
}
