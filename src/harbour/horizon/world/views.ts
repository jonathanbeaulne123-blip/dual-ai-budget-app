import type { LandCuts, StructureSolid, TerrainField } from '../land/interfaces.ts';
import type { Point3, SketchbookPose, Point2, PortraitPose } from './definition.ts';
import { waterHeightAt } from '../land/water/index.ts';
import { HORIZON_MANIFEST, requireScaleFactor } from './manifest.ts';
import { ellipse, padOutline, pointInPolygon, solidBounds, solidTopAt, terrainHeight } from './geometry.ts';
import { createRayCaster, type RayCaster, type RayHit } from './raycast.ts';
import { sketchbookLens } from './lens.ts';
import { fogFactor, HORIZON_FOG } from '../sky/fog.ts';
export { sketchbookLens, PORTRAIT_MIN_HORIZONTAL_FOV } from './lens.ts';

/**
 * The Sketchbook view proof (R1-15, R1-74, R1-96…98). A pose passes only when, on a ray-cast ID buffer
 * over the heightfield (mouth masks honoured), every water surface, the open sea and every baked solid
 * (world/raycast.ts — the same data the renderer draws):
 * - the eye is above the ground and above any water under it;
 * - the horizon is geometric and inside the frame: the eye-level line lies within the vertical FOV AND
 *   ≥ minPixels of sky or open sea are the first hit at or above that line (a pose into a hillside fails);
 * - every page subject is the FIRST hit of ≥ `minPixels` rays (≥ 1 ‰), at 1440 × 900 (144 × 90, runtime lens) and on the phone
 *   (60 × 130, MANIFEST v1.7 viewRule.portrait: horizontal FOV held, never < 45°, `portrait.frames`).
 * Subjects are identified by what the ray hits — a solid's source id, a landform's ground, a water body —
 * never by polygon-vertex samples or by name prefixes of subjects that are not built.
 */
export interface ViewPixels { grid: Point2; pixels: number; minPixels: number; skyShare: number; seaShare: number; horizonRowSkyOrSea: number; pitchDegrees: number; verticalHalfFovDegrees: number; horizonInFrame: boolean; subjects: Record<string, number>; top: [string, number][] }
export interface ViewProof {
  eyeAboveFloor: boolean; eyeAboveWater: boolean; horizonInFrame: boolean;
  subjects: { id: string; exists: boolean; inFrame: boolean; occludedBy: string | null; pixels: number; portraitPixels: number | null; portraitRequired: boolean; pass: boolean; blocker?: string }[];
  landscape: ViewPixels; portrait: ViewPixels | null; pass: boolean; passLandscape: boolean; passPortrait: boolean; deferred: string[];
}
type Test = (hit: RayHit, direction: Point3) => boolean;
const HOOK: Point2[] = [[520, 780], [545, 940], [460, 1030], [370, 950], [330, 800]];
/** The Pass 1 subjects each page must hold at 16:9, in the manifest's frame vocabulary (portrait.frames uses the same names). */
export const PAGE_SUBJECTS: Record<string, string[]> = {
  A: ['the High Span', "the dam's glass face", 'the Shoulder', 'the Crown'],
  B: ['the Bight Bridge', 'the Flats', 'the hook'],
  C: ['the road deck', 'the skate shelf', 'the walk at the water'],
  D: ['surf', 'the Lamp', 'the zipline landing'],
  E: ['Stillwater', 'the Green', 'the Hollow', 'the Flats', 'the Bight', 'the sea'],
  F: ['L01', 'the town below'],
  G: ["the Throat's mouth of daylight", 'the skylight shaft'],
  H: ['the strip', 'the west sea'],
  I: ['the spring', 'the Reach water'],
  J: ['the arch', 'the Stacks', 'the Prow'],
  K: ['the Glasshouse', 'Stillwater'],
  L: ['Lantern Row', 'the Boathouse'],
};
/**
 * Built-id map (R1-96): each subject name → what a ray must hit. Solid prefixes are SOURCE ids as baked.
 * With the land's solids, a structure also owns what it carries: a hit on any solid standing on the High
 * Span's deck (VG's edges and shoulders on the span are its deck line) counts as the High Span.
 * "The Reach water" is the water of the Reach: its channels and the river where it runs through the
 * Reach landform (page I looks along the river inside the Reach; the channels lie behind the eye). D-C5, MANIFEST v2.0.
 */
export function subjectTests(solids: readonly StructureSolid[] = []): Record<string, Test> {
  const m = HORIZON_MANIFEST, s = requireScaleFactor();
  const solid = (...prefixes: string[]): Test => hit => hit.kind === 'solid' && prefixes.some(p => hit.sourceId.startsWith(p));
  const water = (...prefixes: string[]): Test => hit => hit.kind === 'water' && prefixes.some(p => hit.id.startsWith(p));
  const polygon = (poly: readonly (readonly number[])[]): Point2[] => poly.map(p => [p[0]! * s, p[1]! * s]);
  const ground = (poly: Point2[]): Test => hit => hit.kind === 'terrain' && pointInPolygon(hit.point[0], hit.point[2], poly);
  const landform = (id: string): Test => { const l = m.landforms.find(q => q.id === id); return l?.poly ? ground(polygon(l.poly)) : () => false; };
  const near = (xy: readonly number[], r: number): Test => hit => hit.kind !== 'sky' && Math.hypot(hit.point[0] - xy[0]! * s, hit.point[2] - xy[1]! * s) < r * s;
  const any = (...tests: Test[]): Test => (hit, d) => tests.some(t => t(hit, d));
  const lamp = m.offshore.find(o => o.id === 'lamp')!.xy as number[];
  const reachPoly = polygon(m.landforms.find(q => q.id === 'reach')?.poly ?? []), reachRiver: Test = hit => hit.kind === 'water' && hit.id.startsWith('water.river.lower') && reachPoly.length > 2 && pointInPolygon(hit.point[0], hit.point[2], reachPoly);
  const carried = (deckPrefix: string): Test => {
    const decks = solids.filter(q => ((q as StructureSolid & { sourceId?: string }).sourceId ?? q.id.split('@')[0]!).startsWith(deckPrefix)).map(solidBounds);
    return hit => hit.kind === 'solid' && decks.some(b => hit.point[0] >= b.min[0] && hit.point[0] <= b.max[0] && hit.point[2] >= b.min[2] && hit.point[2] <= b.max[2] && hit.point[1] >= b.min[1] - .25);
  };
  return {
    'the High Span': any(solid('highSpan.'), carried('highSpan.deck')), "the dam's glass face": solid('dam.wall'), 'the Shoulder': landform('shoulder'), 'the Crown': landform('crown'),
    'the Bight Bridge': solid('bightBridge.'), 'the Flats': landform('flats'), 'the hook': ground(polygon(HOOK)),
    'the road deck': solid('highSpan.deck'), 'the skate shelf': solid('highSpan.shelf'), 'the walk at the water': solid('highSpan.walk'),
    surf: water('water.sea'), 'the Lamp': any(solid('lampGallery', 'jetty.lamp', 'threshold.lampGallery', 'threshold.lampDock', 'offshore.lamp', 'lamp.'), near(lamp, 45)), 'the zipline landing': solid('platform.zipLanding', 'zipLanding', 'threshold.zipLanding'),
    Stillwater: water('water.stillwater'), 'the Green': landform('green'), 'the Hollow': landform('hollow'), 'the Bight': water('water.bight', 'water.lagoon'), 'the sea': water('water.sea'),
    L01: solid('place.L01'), 'the town below': landform('harbour'),
    "the Throat's mouth of daylight": (hit, d) => hit.kind === 'sky' && d[1] < 0.6 || hit.kind === 'terrain', 'the skylight shaft': (hit, d) => solid('deep.skylight', 'underground.deep.skylight')(hit, d) || hit.kind === 'sky' && d[1] >= 0.6,
    'the strip': solid('strip.', 'threshold.strip'), 'the west sea': hit => hit.kind === 'water' && hit.id.startsWith('water.sea') && hit.point[0] < 330 * s,
    // R2-74: the spring is its own water body or structure (proximity counted any ground near its point). D-C5 (v2.0,
    // views.I.subjectDefs): the Reach water is the Reach's channels OR the lower river where the hit lies inside landforms.reach.
    'the spring': any(water('water.spring'), solid('spring', 'water.spring')), 'the Reach water': any(water('water.reach'), reachRiver),
    'the arch': solid('offshore.needle', 'needle.'), 'the Stacks': solid('offshore.stacks', 'stacks.'), 'the Prow': landform('prow'),
    'the Glasshouse': solid('host.glasshouse'), 'Lantern Row': solid('town.quay', 'town quay'), 'the Boathouse': solid('host.boathouse'),
  };
}
export function floorAt(field: TerrainField, cuts: LandCuts, xy: Point2, underground = false): number {
  const pads = cuts.pads.filter(p => !!p.underground === underground && pointInPolygon(xy[0], xy[1], padOutline(p)));
  const terrain = terrainHeight(field, xy[0], xy[1]);
  if (underground) return pads.length ? Math.max(...pads.map(p => p.centre[1])) : terrain;
  let floor = Math.max(terrain, ...pads.map(p => p.centre[1]));
  for (const solid of cuts.solids) if (solid.walkable) { const b = solidBounds(solid); if (b.max[1] > floor && xy[0] >= b.min[0] && xy[0] <= b.max[0] && xy[1] >= b.min[2] && xy[1] <= b.max[2]) { const h = solidTopAt(solid, xy[0], xy[1]); if (h !== null) floor = Math.max(floor, h); } }
  return floor;
}
export function projectSubject(eye: Point3, target: Point3, point: Point3, fovDegrees: number, aspect = 16 / 9): { ndc: Point2; depth: number } {
  const dx = target[0] - eye[0], dy = target[1] - eye[1], dz = target[2] - eye[2], length = Math.hypot(dx, dy, dz) || 1, fx = dx / length, fy = dy / length, fz = dz / length, horizontal = Math.hypot(fx, fz) || 1;
  const rx = -fz / horizontal, rz = fx / horizontal, ux = -fy * rz, uy = fx * rz - fz * rx, uz = fy * rx;
  // Camera up = right cross forward, matching Three's default +y-up lookAt basis.
  const px = point[0] - eye[0], py = point[1] - eye[1], pz = point[2] - eye[2], depth = px * fx + py * fy + pz * fz, tan = Math.tan(fovDegrees * Math.PI / 360);
  return { ndc: [(px * rx + pz * rz) / (depth * tan || 1e-8), (px * ux + py * uy + pz * uz) / (depth * tan / aspect || 1e-8)], depth };
}
/** R2-74: the proof renders the ACCEPTANCE frames (CONTRACT §7: 1440 × 900 and 390 × 844) at 1/10 and 1/6.5, through the
 * runtime lens (world/lens.ts): the 1440 × 900 frame keeps the page's 16:9 vertical FOV and so shows less width than 16:9. */
export const VIEW_GRID = { landscape: [144, 90] as Point2, portrait: [60, 130] as Point2 };
/** R2-74: a subject is legible when it is the first hit of ≥ 1 ‰ of the frame (review 2's P27 rule; was 0.5 ‰). */
export const LEGIBLE_PERMILLE = 1;
/** R2-74: above this fog factor a hit reads as the fog band, not its subject (P30 holds the summit silhouette at 40–60 %). */
export const FOG_LEGIBLE = .6;
/** Render one ID buffer: rays through pixel centres of a camera with this horizontal FOV. */
export function viewPixels(ray: RayCaster, eye: Point3, target: Point3, horizontalFovDegrees: number, grid: Point2, tests: Record<string, Test>, underground: boolean, fog?: { near: number; far: number }): ViewPixels {
  const [NX, NY] = grid, aspect = NX / NY; let f: Point3 = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]; const fl = Math.hypot(...f) || 1; f = [f[0] / fl, f[1] / fl, f[2] / fl];
  const hz = Math.hypot(f[0], f[2]) || 1e-9, r: Point3 = [-f[2] / hz, 0, f[0] / hz], u: Point3 = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const htan = Math.tan(horizontalFovDegrees * Math.PI / 360), vtan = htan / aspect, pitch = Math.atan2(f[1], hz), vhalf = Math.atan(vtan);
  // The eye-level line (elevation 0) crosses the image centre column at ndcY = −tan(pitch)/vtan (exact at the centre column).
  const horizonNdc = -Math.tan(pitch) / vtan, horizonRow = Math.round((1 - horizonNdc) / 2 * NY - .5);
  const counts: Record<string, number> = Object.fromEntries(Object.keys(tests).map(k => [k, 0])), top = new Map<string, number>();
  let sky = 0, sea = 0, horizonHits = 0;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const nx = (i + .5) / NX * 2 - 1, ny = 1 - (j + .5) / NY * 2;
    let d: Point3 = [f[0] + r[0] * nx * htan + u[0] * ny * vtan, f[1] + r[1] * nx * htan + u[1] * ny * vtan, f[2] + r[2] * nx * htan + u[2] * ny * vtan]; const dl = Math.hypot(...d); d = [d[0] / dl, d[1] / dl, d[2] / dl];
    // R2-74: a hit drawn more than FOG_LEGIBLE fog (sky/fog.ts smoothstep at its view depth) reads as the fog band: it is
    // horizon, never a subject (the proof counted the fogged sea band and far ground as legible subjects).
    const cast = ray.first(eye, d, 2600, { underground }), fogged = !underground && !!fog && cast.kind !== 'sky' && fogFactor(fog, cast.t * (d[0] * f[0] + d[1] * f[1] + d[2] * f[2])) > FOG_LEGIBLE, hit: RayHit = fogged ? { kind: 'sky', t: Infinity, id: 'sky' } : cast;
    if (hit.kind === 'sky') sky++; if (hit.kind === 'water' && hit.id.startsWith('water.sea')) sea++;
    if (j <= horizonRow + 1 && (hit.kind === 'sky' || hit.kind === 'water' && hit.id.startsWith('water.sea'))) horizonHits++;
    const key = hit.kind === 'solid' ? hit.sourceId.split('.').slice(0, 2).join('.') : hit.kind === 'terrain' ? 'terrain' : hit.id; top.set(key, (top.get(key) ?? 0) + 1);
    for (const [name, test] of Object.entries(tests)) if (test(hit, d)) counts[name]!++;
  }
  const pixels = NX * NY, minPixels = Math.max(3, Math.ceil(pixels * LEGIBLE_PERMILLE / 1000 - 1e-9)), inFrame = Math.abs(pitch) < vhalf && horizonRow >= 0 && horizonRow < NY;
  return { grid, pixels, minPixels, skyShare: sky / pixels, seaShare: sea / pixels, horizonRowSkyOrSea: horizonHits, pitchDegrees: pitch * 180 / Math.PI, verticalHalfFovDegrees: vhalf * 180 / Math.PI, horizonInFrame: inFrame && horizonHits >= minPixels, subjects: counts, top: [...top].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => [k, +(n / pixels).toFixed(4)]) };
}
export function buildViews(field: TerrainField, cuts: LandCuts, options: { grid?: typeof VIEW_GRID } = {}): SketchbookPose[] {
  const s = requireScaleFactor(), tests = subjectTests(cuts.solids), ray = createRayCaster(field, cuts), grid = options.grid ?? VIEW_GRID;
  return HORIZON_MANIFEST.views.map(view => {
    const xy: Point2 = [view.xy[0]! * s, view.xy[1]! * s], underground = view.id === 'G', v = view as typeof view & { target_h?: number; portrait?: { fov_deg: number; target?: number[]; target_h?: number; frames?: string[]; xy?: number[]; eyeH?: number }; deferred?: string[]; subjects?: string[] };
    const floor = underground ? (cuts.pads.find(p => p.id === 'threshold.deepJetty')?.centre[1] ?? 40 * s) : Math.max(floorAt(field, cuts, xy), ray.floorAt(xy[0], xy[1]));
    const eye: Point3 = [xy[0], view.eyeH !== undefined ? view.eyeH * s : floor + 1.6, xy[1]], tx = view.target[0]! * s, tz = view.target[1]! * s;
    // target_h (v1.7) replaces the per-page constants and the terrain default.
    const target: Point3 = [tx, v.target_h !== undefined ? v.target_h * s : terrainHeight(field, tx, tz), tz];
    const p = v.portrait, pxy = p?.xy ? [p.xy[0]! * s, p.xy[1]! * s] as Point2 : null, pt = p?.target ?? view.target;
    const portrait: PortraitPose | undefined = p ? { eye: pxy ? [pxy[0], p.eyeH !== undefined ? p.eyeH * s : floorAt(field, cuts, pxy) + 1.6, pxy[1]] : eye, target: [pt[0]! * s, p.target_h !== undefined ? p.target_h * s : target[1], pt[1]! * s], fovDegrees: p.fov_deg, frames: p.frames ?? [] } : undefined;
    const pose: SketchbookPose = { id: view.id, label: view.label, eye, target, floor, underground, fovDegrees: view.fov_deg, aspect: 16 / 9, radius: view.radius_eu, bestHour: view.bestHour, also: view.also, portrait, deferred: v.deferred ?? [] };
    const names = v.subjects ?? PAGE_SUBJECTS[view.id] ?? [], pageTests = Object.fromEntries(names.map(n => [n, tests[n] ?? (() => false)]));
    // R2-74: fog at this eye's height (sky/fog.ts): full tier on the 1440 × 900 frame, lite on the phone.
    const lift = Math.max(0, eye[1] - floor), fogAt = (tier: 'full' | 'lite') => ({ near: HORIZON_FOG[tier].near + lift * HORIZON_FOG.nearPerEyeHeight, far: HORIZON_FOG[tier].far + lift * HORIZON_FOG.farPerEyeHeight }), farFull = fogAt('full'), farLite = fogAt('lite');
    const landLens = sketchbookLens(pose, grid.landscape[0] / grid.landscape[1]), land = viewPixels(ray, landLens.eye, landLens.target, landLens.horizontalFovDegrees, grid.landscape, pageTests, underground, farFull);
    const portLens = sketchbookLens(pose, grid.portrait[0] / grid.portrait[1]), frames = portrait?.frames ?? names;
    const port = viewPixels(ray, portLens.eye, portLens.target, portLens.horizontalFovDegrees, grid.portrait, Object.fromEntries(frames.map(n => [n, tests[n] ?? (() => false)])), underground, farLite);
    const terrainHere = terrainHeight(field, xy[0], xy[1]);
    const eyeAboveFloor = underground ? eye[1] > floor : eye[1] > Math.max(floor, terrainHere);
    const eyeAboveWater = !cuts.waters.some(w => w.kind !== 'dry' && !!w.underground === underground && (waterHeightAt(w, eye[0], eye[2]) ?? -Infinity) >= eye[1]);
    // Underground (G) has no horizon; its daylight is a subject instead.
    const horizonInFrame = underground || land.horizonInFrame && port.horizonInFrame;
    const subjects = names.map(id => { const pixels = land.subjects[id] ?? 0, portraitRequired = frames.includes(id), portraitPixels = portraitRequired ? port.subjects[id] ?? 0 : null, known = id in tests; return { id, exists: known, inFrame: pixels > 0, occludedBy: pixels >= land.minPixels ? null : 'not the first hit of enough rays', pixels, portraitPixels, portraitRequired, pass: known && pixels >= land.minPixels && (!portraitRequired || portraitPixels! >= port.minPixels) }; });
    for (const id of frames) if (!names.includes(id)) subjects.push({ id, exists: id in tests, inFrame: false, occludedBy: 'portrait frame not in the page subjects', pixels: 0, portraitPixels: port.subjects[id] ?? 0, portraitRequired: true, pass: false });
    const passLandscape = eyeAboveFloor && eyeAboveWater && (underground || land.horizonInFrame) && subjects.every(q => q.exists && q.pixels >= land.minPixels);
    const passPortrait = eyeAboveFloor && eyeAboveWater && (underground || port.horizonInFrame) && subjects.filter(q => q.portraitRequired).every(q => q.exists && q.portraitPixels! >= port.minPixels);
    pose.subjectIds = names;
    pose.proof = { eyeAboveFloor, eyeAboveWater, horizonInFrame, subjects, landscape: land, portrait: port, pass: passLandscape && passPortrait, passLandscape, passPortrait, deferred: pose.deferred! };
    return pose;
  });
}
export function protectedGreenOutline(): Point2[] { const g = HORIZON_MANIFEST.protected.green, s = requireScaleFactor(); return ellipse(g.cx * s, g.cy * s, g.r * s); }
