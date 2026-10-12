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
 * the night level exactly as the bridge art's glow (`0.12 + 0.88 k`); the ink shifts to STYLE §1.3.3's night ink
 * (`#1a1a24` at 0.8 opacity) and the sun's contact shade fades (`DRESSING_NIGHT`). The district cards and Mountain v2's
 * card materials have no such ramp today; this layer owns its own. Lite: the planting machinery's lite share (a `keep`
 * plant always stays), and the prop kit's one rule (`kit/props propDraws`: an essential kind, or any prop that collides or
 * carries a pastime fixture — lite drops, never substitutes, and a collider is never invisible).
 *
 * Far landmarks: the story's sight chain spans 600–1,100 eu, far beyond residency. From the index-borne landmarks (and the
 * Journey shapes of the buildings that carry them) the layer builds, once, a coarse silhouette per landmark — the carrying
 * building's block and roof, a slim spire up to the sighted top; a landmark no building carries is the landmark tree (the
 * Old Oak), drawn as the plant kit's own tree on the lite tier in the season's look — merged per district, drawn while that district's own
 * dressing is not built (not resident, or still building) and hidden as soon as it is. Fogged like the land. A wheel
 * (`DRESSING_FAR.wheels`: the Long Sands Ferris wheel, story landmark `wheel`) is not a block and a roof: its far shape is
 * the rim's ring in the carrier's long axis (radius = half that side less the kit's 1 eu margin, the hub r below the
 * sighted top) on its A-frame, drawn from both sides (PR 4 D-WW152: the block + roof read as a grey pyramid from the belfry).
 */
import * as THREE from 'three';
import {createBuildTask, finishBuild} from '../../../house/world/buildTask.ts';
import {CardBuilder, rgb, shade, type CardBuild, type V3} from '../../art/cardScene.ts';
import type {WorldDefinition} from '../world/definition.ts';
import type {Corridor, PlantItem, PlantSpecies, PlantingGroup} from '../land/corridor/types.ts';
import type {DistrictDressing, DressingTheme, PlantRecord, WorldDressing} from '../neighbourhoods/types.ts';
import {drawBuilding} from '../kit/buildings/index.ts';
import {drawProp, propDraws} from '../kit/props/index.ts';
import {districtAt} from '../world/districts.ts';
import {SEASON_MONTH, bloomStage} from '../kit/plants/sets.ts';
import {groundPaintHex, groundPaintTone} from '../neighbourhoods/paint.ts';
import {createCorridorPlanting, type CorridorPlanting} from './corridorPlanting.ts';
import type {PlantSeason} from '../kit/plants/archetypes.ts';
import {OAK, oakGeometry} from '../kit/plants/oak.ts';
import {mountainArtPalette} from '../../mountain/art/palette.ts';
import {SCENE_DRESSING} from '../../scene/place.ts';

export const DRESSING_DETAIL = {releaseMs: 20_000, paintLift: 0.04, paintEdge: 2.5, glowDay: 0.12} as const;
/** STYLE §1.3.3: ink at night is `#1a1a24` at 0.8 of its day opacity; the sun's contact shade fades to `shadeNight` of its
 * day strength under the moon. The card ink's vertex colour is the builder's ink (`DRESSING_INK`); the material colour
 * multiplies it, so night = ink × (night ink / day ink) per channel. */
export const DRESSING_NIGHT = {ink: '#1a1a24', inkOpacity: 0.8, shadeNight: 0.4} as const;
export const DRESSING_INK = '#5b5447';
/** Far landmark silhouettes: wall colour per dressing (the roof a shade darker), the spire's radius share of its height. */
export const DRESSING_FAR = {wall: {classic: '#b9ab95', taylor: '#d9c8ad', newfoundland: '#8e9396'}, roof: 0.78, spire: 0.05, minRadius: 0.6, roofRise: 0.6,
  /** Landmarks whose far shape is a wheel's rim (ids from world/story.ts), its rim's radial depth and segment count. */
  wheels: ['wheel'] as readonly string[], rim: 0.9, rimSegments: 28} as const;

/**
 * Fireflies (`LifeSpawn` kind 'firefly', D-WW118): until PR 5 flies them, each spawn is drawn as still glowing specks — `perSpawn`
 * specks per creature (lite: `liteShare` of them), `lift` eu over the ground, soft additive points `size` eu across — shown only
 * at night (opacity follows the night level) and in the spawn's months. Emissive only: no point light.
 */
export const DRESSING_FIREFLY = {perSpawn: 16, liteShare: 0.45, size: 0.46, colour: '#f2f7a0', lift: [0.35, 4.6] as const, minNight: 0.05} as const;
type Fireflies = {points: THREE.Points; months: Set<number>};
let fireflyDot: THREE.DataTexture | null = null;
/** A 16 × 16 soft dot (white, alpha falling off to the edge), shared by every district's fireflies. */
function fireflyTexture(): THREE.DataTexture {
  if (fireflyDot) return fireflyDot;
  const n = 16, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const r = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2), a = Math.max(0, 1 - r) ** 1.6, i = (y * n + x) * 4; data[i] = data[i + 1] = data[i + 2] = Math.round(255 * Math.min(1, a * 2.4)); data[i + 3] = Math.round(255 * Math.min(1, a * 1.5)); }
  fireflyDot = new THREE.DataTexture(data, n, n, THREE.RGBAFormat); fireflyDot.needsUpdate = true; return fireflyDot;
}
/** The district's firefly specks (null when it has none). Deterministic: positions hash from the spawn's place and index. */
export function buildFireflies(d: Pick<DistrictDressing, 'districtId' | 'life'>, ground: (x: number, z: number) => number, tier: 'full' | 'lite'): Fireflies | null {
  const spawns = d.life.filter(l => l.kind === 'firefly'); if (!spawns.length) return null;
  const pos: number[] = [], months = new Set<number>();
  spawns.forEach((l, si) => {
    for (const m of l.months ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) months.add(m);
    let seed = (Math.round(l.at[0] * 7 + l.at[2] * 13 + si * 101) >>> 0) || 1; const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const n = Math.round(l.count * DRESSING_FIREFLY.perSpawn * (tier === 'lite' ? DRESSING_FIREFLY.liteShare : 1));
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(0.04 + 0.96 * r()) * l.radius, x = l.at[0] + Math.cos(a) * rr, z = l.at[2] + Math.sin(a) * rr, [lo, hi] = DRESSING_FIREFLY.lift;
      pos.push(x, ground(x, z) + lo + (hi - lo) * r() ** 1.7, z);
    }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeBoundingSphere();
  const m = new THREE.PointsMaterial({color: DRESSING_FIREFLY.colour, size: DRESSING_FIREFLY.size, sizeAttenuation: true, map: fireflyTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending});
  const points = new THREE.Points(g, m); points.name = `horizon.dressing.${d.districtId}.fireflies`; points.visible = false; points.renderOrder = 6;
  return {points, months};
}

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
  stats(): {districts: Record<string, DressingDistrictStats>; far: {districts: string[]; visible: string[]; triangles: number}};
  dispose(): void;
};

type FarSilhouette = {district: string; mesh: THREE.Mesh};
type DistrictArt = {id: string; group: THREE.Group; cards: CardBuild; planting: CorridorPlanting | null; flies: Fireflies | null; lastResident: number; stats: DressingDistrictStats};

/** A plant record as the corridor planting machinery's item (the kit's species union covers every `DressingSpecies`). */
export function plantItem(p: PlantRecord): PlantItem {
  return {species: p.species as PlantSpecies, at: [p.at[0], p.at[1], p.at[2]], scale: p.scale, yaw: p.yaw, ...(p.tint !== undefined ? {tint: p.tint} : {}), ...(p.lean !== undefined ? {lean: p.lean} : {}), ...(p.keep ? {keep: true} : {})};
}
/** The district's plants as one synthetic corridor (`dressing.<district>`) with one `framingTrees` group; the planting's lite
 * share always keeps an item marked `keep`. */
export function dressingCorridor(d: Pick<DistrictDressing, 'districtId' | 'plants'>): Corridor {
  const id = `dressing.${d.districtId}`, planting: PlantingGroup[] = d.plants.length ? [{id, kind: 'framingTrees', reachId: 'dressing', side: 'left', items: d.plants.map(plantItem)}] : [];
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
  const b = new CardBuilder(`horizon.dressing.${d.districtId}`, tier, {ink: DRESSING_INK, cell: 8192, shadows: tier === 'full'});
  let buildings = 0, props = 0;
  if (!opts.hideBuildings) for (const rec of d.buildings) { drawBuilding(b, rec, theme, ground, tier); buildings++; yield; }
  for (let i = 0; i < d.props.length; i++) {
    const rec = d.props[i]!;
    if (!propDraws(rec, tier)) continue;
    drawProp(b, rec, theme, ground, tier); props++; if (i % 8 === 7) yield;
  }
  for (const g of d.ground) {
    if (g.fullOnly && tier === 'lite') continue;
    const col = shade(rgb(groundPaintHex(theme, g.surface)), groundPaintTone(g.tone)), y = (p: readonly [number, number]): V3 => [p[0], Math.max(ground(p[0], p[1]), g.floor ?? -Infinity) + DRESSING_DETAIL.paintLift, p[1]];
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
  const flies = buildFireflies(d, ground, tier); if (flies) group.add(flies.points);
  return {id: d.districtId, group, cards, planting, flies, stats: {triangles, drawCalls, buildings, props, plants: d.plants.length}};
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
 * the worst of the three dressings × the four seasons, the cards as built plus every retained plant record on at once
 * (the planting's `capacity`: each layer's item count × its unit triangles, every layer and batch drawn).
 */
export function measureDistrictDressing(d: DistrictDressing, ground: (x: number, z: number) => number, tier: 'full' | 'lite'): {triangles: number; drawCalls: number} {
  let worst = {triangles: 0, drawCalls: 0};
  for (const theme of ['classic', 'taylor', 'newfoundland'] as const) {
    const art = finishBuild(buildDistrictDressingSteps(d, {tier, theme, season: 'summer', ground}));
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      art.planting?.setSeason(season, SEASON_MONTH[season]);
      const cap = art.planting?.stats().capacity ?? {triangles: 0, drawCalls: 0}, triangles = art.stats.triangles + cap.triangles, drawCalls = art.stats.drawCalls + cap.drawCalls;
      if (triangles > worst.triangles || (triangles === worst.triangles && drawCalls > worst.drawCalls)) worst = {triangles, drawCalls};
    }
    art.planting?.dispose(); art.cards.dispose(); disposeFlies(art.flies);
  }
  return worst;
}

function disposeFlies(f: Fireflies | null) { if (!f) return; f.points.geometry.dispose(); (f.points.material as THREE.Material).dispose(); }

/** The far silhouettes of the index-borne landmarks, merged per district (see the header). */
export function buildFarLandmarks(dressing: Pick<WorldDressing, 'landmarks' | 'journey'> | undefined, theme: DressingTheme, districtOf: (x: number, z: number) => string = (x, z) => districtAt(x, z), look: {season: PlantSeason; month?: number} = {season: 'summer'}): {material: THREE.MeshStandardMaterial; silhouettes: FarSilhouette[]} {
  const material = new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 0.95});
  material.name = 'horizon.dressing.far';
  const wall = new THREE.Color(DRESSING_FAR.wall[theme]), roof = wall.clone().multiplyScalar(DRESSING_FAR.roof);
  const byDistrict = new Map<string, {pos: number[]; col: number[]}>();
  const put = (district: string, a: V3, b: V3, c: V3, colour: THREE.Color) => { let m = byDistrict.get(district); if (!m) byDistrict.set(district, m = {pos: [], col: []}); m.pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) m.col.push(colour.r, colour.g, colour.b); };
  const spire = (district: string, x: number, z: number, y0: number, y1: number, r: number) => {
    const n = 6, at = (k: number, rr: number, y: number): V3 => [x + Math.cos(k / n * Math.PI * 2) * rr, y, z + Math.sin(k / n * Math.PI * 2) * rr];
    for (let k = 0; k < n; k++) { put(district, at(k, r, y0), at(k + 1, r, y0), at(k + 1, r * 0.35, y1 - r), wall); put(district, at(k, r, y0), at(k + 1, r * 0.35, y1 - r), at(k, r * 0.35, y1 - r), wall); put(district, at(k, r * 0.35, y1 - r), at(k + 1, r * 0.35, y1 - r), [x, y1, z], roof); }
  };
  const both = (district: string, a: V3, b: V3, c: V3, colour: THREE.Color) => { put(district, a, b, c, colour); put(district, a, c, b, colour); };
  const wheel = (district: string, ring: readonly (readonly [number, number])[], base: number, top: V3) => {
    // The carrier's long side is the wheel's plane (kit ferrisWheel: w = 2 r + 2).
    let ux = 0, uz = 0, long = 0;
    for (let i = 0; i < ring.length; i++) { const p = ring[i]!, q = ring[(i + 1) % ring.length]!, l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > long) { long = l; ux = (q[0] - p[0]) / l; uz = (q[1] - p[1]) / l; } }
    const R = Math.max(1, long / 2 - 1), hub: V3 = [top[0], top[1] - R, top[2]], n = DRESSING_FAR.rimSegments, r0 = R - DRESSING_FAR.rim;
    const on = (a: number, r: number): V3 => [hub[0] + ux * Math.cos(a) * r, hub[1] + Math.sin(a) * r, hub[2] + uz * Math.cos(a) * r];
    for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2; both(district, on(a0, r0), on(a1, r0), on(a1, R), wall); both(district, on(a0, r0), on(a1, R), on(a0, R), wall); }
    // The A-frame: two legs from the hub to the deck at ± 0.62 r along the plane.
    for (const s of [-1, 1]) { const fx = hub[0] + ux * s * R * 0.62, fz = hub[2] + uz * s * R * 0.62, w = 0.5; both(district, [hub[0], hub[1], hub[2]], [fx - ux * w, base, fz - uz * w], [fx + ux * w, base, fz + uz * w], roof); }
  };
  for (const l of dressing?.landmarks ?? []) {
    const carrier = dressing?.journey?.find(j => j.landmarkId === l.id), district = carrier?.districtId ?? districtOf(l.at[0], l.at[2]);
    if (carrier && carrier.footprint.length >= 3 && DRESSING_FAR.wheels.includes(l.id)) { wheel(district, carrier.footprint, carrier.base, l.top); continue; }
    let top = l.at[1];
    if (carrier && carrier.footprint.length >= 3) {
      const ring = carrier.footprint, n = ring.length, y0 = carrier.base - 1, eave = carrier.base + carrier.height;
      // The roof's rise is the main roof's (≤ 0.6 × the footprint's short side); anything taller on the building (a bell cote, a
      // belfry) is the spire below, so a chapel never reads as a tent (PR 3 Highlands: Westwatch's cote stands 7 m over its eave).
      const side = Math.min(...ring.map((p, i) => { const q = ring[(i + 1) % n]!; return Math.hypot(q[0] - p[0], q[1] - p[1]); })), apex = eave + Math.min(carrier.roofHeight, side * DRESSING_FAR.roofRise);
      const cx = ring.reduce((t, p) => t + p[0], 0) / n, cz = ring.reduce((t, p) => t + p[1], 0) / n;
      for (let i = 0; i < n; i++) { const p = ring[i]!, q = ring[(i + 1) % n]!; put(district, [p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], eave, q[1]], wall); put(district, [p[0], y0, p[1]], [q[0], eave, q[1]], [p[0], eave, p[1]], wall); put(district, [p[0], eave, p[1]], [q[0], eave, q[1]], [cx, apex, cz], roof); }
      top = apex;
    }
    if (!carrier && l.yaw !== undefined && l.top[1] > l.at[1] + 0.5) {
      // A landmark tree (D-WW110): the kit's own tree, lite, in the season's look, at the plant's yaw and the sighted height.
      // Only a landmark that names its tree's yaw is a tree (the Old Oak); other uncarried landmarks (the osprey pole, the
      // Fallswatch deck) take the slim spire below (PR 591 review).
      const month = look.month ?? SEASON_MONTH[look.season], g = oakGeometry(mountainArtPalette(SCENE_DRESSING[theme]), 'lite', {season: look.season, month, stage: bloomStage(month)}).body;
      const pos = g.getAttribute('position'), col = g.getAttribute('color'), k = (l.top[1] - l.at[1]) / OAK.height, c = Math.cos(l.yaw ?? 0), s = Math.sin(l.yaw ?? 0);
      let m = byDistrict.get(district); if (!m) byDistrict.set(district, m = {pos: [], col: []});
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) * k, z = pos.getZ(i) * k; m.pos.push(l.at[0] + x * c + z * s, l.at[1] + pos.getY(i) * k, l.at[2] + z * c - x * s); m.col.push(col.getX(i), col.getY(i), col.getZ(i)); }
      g.dispose(); continue;
    }
    // Up to the sighted top: a slim spire (the belfry over its tower, a pole, a tree's height as a marker).
    if (l.top[1] > top + 0.5) spire(district, l.top[0], l.top[2], top, l.top[1], Math.max(DRESSING_FAR.minRadius, (l.top[1] - top) * DRESSING_FAR.spire));
  }
  const silhouettes: FarSilhouette[] = [...byDistrict.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([district, m]) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(m.col, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material); mesh.name = `horizon.dressing.far.${district}`; mesh.castShadow = false; mesh.receiveShadow = false;
    return {district, mesh};
  });
  return {material, silhouettes};
}

export function createDressingLayer(world: Pick<WorldDefinition, 'dressing'>, opts: DressingLayerOptions): DressingLayer {
  const group = new THREE.Group(); group.name = 'horizon.dressing';
  const districts = new Map<string, DistrictArt>();
  let season = opts.season, month = opts.month, night = 0, task: {id: string; run: ReturnType<typeof createBuildTask<Omit<DistrictArt, 'lastResident'>>>} | null = null, pending = false, dead = false;
  // Records by district: re-indexed only when the chunk loader appends a district (no per-frame search).
  const index = new Map<string, DistrictDressing>(); let indexed = -1;
  const recordsOf = (id: string) => { const list = world.dressing?.districts; if ((list?.length ?? 0) !== indexed) { index.clear(); for (const d of list ?? []) index.set(d.districtId, d); indexed = list?.length ?? 0; } return index.get(id) ?? null; };
  let far = buildFarLandmarks(world.dressing, opts.theme, undefined, {season, ...(month !== undefined ? {month} : {})});
  opts.material?.(far.material);
  for (const f of far.silhouettes) group.add(f.mesh);
  /** The season turns: a landmark tree's far silhouette follows it (rebuilt; a handful of landmarks). */
  const refreshFar = () => {
    if (!world.dressing?.landmarks?.some(l => !world.dressing?.journey?.some(j => j.landmarkId === l.id))) return;
    const next = buildFarLandmarks(world.dressing, opts.theme, undefined, {season, ...(month !== undefined ? {month} : {})});
    for (const f of far.silhouettes) { group.remove(f.mesh); f.mesh.geometry.dispose(); } far.material.dispose();
    far = next; opts.material?.(far.material); for (const f of far.silhouettes) group.add(f.mesh);
  };
  const dayOpacity = new WeakMap<THREE.Material, number>(), day = (m: THREE.Material) => { let o = dayOpacity.get(m); if (o === undefined) dayOpacity.set(m, o = m.opacity); return o; };
  const dayInk = rgb(DRESSING_INK), nightInk = rgb(DRESSING_NIGHT.ink), inkFactor = (k: number) => [0, 1, 2].map(i => 1 + (nightInk[i]! / Math.max(1e-6, dayInk[i]!) - 1) * k) as [number, number, number];
  /** The night ramp of one district's card materials: glow cards light, ink shifts to the night ink, the contact shade fades. */
  const glowOf = (art: Pick<DistrictArt, 'cards' | 'flies'>) => {
    const {glow, ink, shade: contact} = art.cards.materials;
    if (art.flies) { const on = night > DRESSING_FIREFLY.minNight && art.flies.months.has(month ?? SEASON_MONTH[season]); art.flies.points.visible = on; (art.flies.points.material as THREE.PointsMaterial).opacity = on ? night : 0; }
    if (glow) { glow.transparent = true; glow.opacity = DRESSING_DETAIL.glowDay + (1 - DRESSING_DETAIL.glowDay) * night; }
    if (ink) { const f = inkFactor(night); (ink as THREE.LineBasicMaterial).color.setRGB(f[0], f[1], f[2], THREE.LinearSRGBColorSpace); ink.opacity = day(ink) * (1 - (1 - DRESSING_NIGHT.inkOpacity) * night); }
    if (contact) contact.opacity = day(contact) * (1 - (1 - DRESSING_NIGHT.shadeNight) * night);
  };
  function land(art: Omit<DistrictArt, 'lastResident'>): DistrictArt {
    for (const m of Object.values(art.cards.materials)) opts.material?.(m);
    for (const m of art.planting?.materials() ?? []) opts.material?.(m);
    glowOf(art); art.group.visible = false; group.add(art.group);
    const done = {...art, lastResident: performance.now()}; districts.set(art.id, done); opts.changed?.(); return done;
  }
  function release(art: DistrictArt) { group.remove(art.group); art.planting?.dispose(); art.cards.dispose(); disposeFlies(art.flies); districts.delete(art.id); opts.changed?.(); }
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
      // Deleting the entry being visited is safe in a Map iteration.
      for (const art of districts.values()) {
        const on = resident.has(art.id); art.group.visible = on;
        if (on) { art.lastResident = now; art.planting?.update(camera, resident); }
        else if (now - art.lastResident > DRESSING_DETAIL.releaseMs) release(art);
      }
      // A landmark's far silhouette stands until its district's own dressing is drawn.
      for (const f of far.silhouettes) f.mesh.visible = !(resident.has(f.district) && districts.has(f.district));
    },
    setNight(kIn) { night = Math.max(0, Math.min(1, kIn)); for (const art of districts.values()) glowOf(art); },
    setSeason(next, nextMonth) { const changed = next !== season || nextMonth !== month; season = next; month = nextMonth; for (const art of districts.values()) { art.planting?.setSeason(next, nextMonth); glowOf(art); } if (changed) refreshFar(); },
    building: () => pending,
    prebuild(ids) { for (const id of ids) { if (districts.has(id)) continue; const d = recordsOf(id); if (d) land(finishBuild(buildDistrictDressingSteps(d, buildOpts()))).group.visible = true; } },
    // Cards as built, plus the planting's currently drawn layers (its own distance rules decide what is on).
    stats() {
      const out: Record<string, DressingDistrictStats> = {}; for (const [id, art] of districts) { const p = art.planting?.stats(); out[id] = {...art.stats, triangles: art.stats.triangles + (p?.triangles ?? 0), drawCalls: art.stats.drawCalls + (p?.drawCalls ?? 0)}; }
      return {districts: out, far: {districts: far.silhouettes.map(f => f.district), visible: far.silhouettes.filter(f => f.mesh.visible).map(f => f.district), triangles: far.silhouettes.reduce((t, f) => t + f.mesh.geometry.getAttribute('position').count / 3, 0)}};
    },
    dispose() { if (dead) return; dead = true; task?.run.cancel(); task = null; for (const art of districts.values()) { art.planting?.dispose(); art.cards.dispose(); disposeFlies(art.flies); } districts.clear(); for (const f of far.silhouettes) f.mesh.geometry.dispose(); far.material.dispose(); group.removeFromParent(); group.clear(); },
  };
}
