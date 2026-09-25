import type { LandCuts, StructureSolid, TerrainField } from '../land/interfaces.ts';
import type { Point3, SketchbookPose, Point2 } from './definition.ts';
import { HORIZON_MANIFEST, requireScaleFactor } from './manifest.ts';
import { distance3, ellipse, mixPoint, padOutline, pointInPolygon, raySolid, solidBounds, terrainHeight } from './geometry.ts';

export interface ViewSubject { id: string; at: Point3; exists: boolean; geometryIds: string[] }
export interface ViewProof { eyeAboveFloor: boolean; horizonInFrame: boolean; subjects: { id: string; exists: boolean; ndc: Point2; inFrame: boolean; occludedBy: string | null; distance: number }[]; pass: boolean; deferred: string[] }
const subjectsByView: Record<string, string[]> = { A: ['landform.reach', 'structure.highSpan', 'structure.dam', 'landform.crown'], B: ['structure.bightBridge', 'landform.flats', 'island.hook'], C: ['structure.highSpan.deck', 'structure.highSpan.shelf', 'structure.highSpan.walk'], D: ['water.sea', 'offshore.lamp', 'threshold.zipLanding'], E: ['landform.harbour', 'landform.sands', 'landform.reach', 'landform.green', 'landform.hollow', 'landform.scholars', 'landform.flats', 'water.stillwater', 'landform.prow', 'water.sea'], F: ['place.L01', 'water.stillwater', 'landform.harbour'], G: ['mouth.throat', 'deep.skylight', 'water.deep'], H: ['structure.strip', 'structure.windsock', 'structure.balloonMooring', 'sea.west'], I: ['landform.reach', 'water.spring'], J: ['offshore.needle', 'offshore.stacks', 'landform.prow'], K: ['host.glasshouse', 'water.stillwater'], L: ['structure.townQuay', 'structure.floatplaneDock', 'host.boathouse'] };
const deferred: Record<string, string[]> = { D: ['bench', 'wrack and footprints'], F: ['plaques', 'L01 instrument dressing'], G: ['glider', 'glow-worms'], H: ['windsock fabric', 'balloon'], I: ['reeds', 'heron'], K: ['seed pots'], L: ['lantern cards', 'floatplane'] };
export function floorAt(field: TerrainField, cuts: LandCuts, xy: Point2, underground = false): number {
  const pads = cuts.pads.filter(p => !!p.underground === underground && pointInPolygon(xy[0], xy[1], padOutline(p)));
  if (pads.length) return Math.max(...pads.map(p => p.centre[1]));
  return terrainHeight(field, xy[0], xy[1]);
}
export function buildViewSubjects(field: TerrainField, cuts: LandCuts): ViewSubject[] {
  const m = HORIZON_MANIFEST, s = requireScaleFactor(), subjects: ViewSubject[] = [];
  const add = (id: string, xy: readonly number[], height?: number, exists = true, geometryIds: string[] = []) => subjects.push({ id, at: [xy[0]! * s, height ?? terrainHeight(field, xy[0]! * s, xy[1]! * s), xy[1]! * s], exists, geometryIds });
  const aggregate = (id: string, solids: StructureSolid[], fallback: readonly number[], height?: number) => { if (!solids.length) { add(id, fallback, height, false); return; } const boxes = solids.map(solidBounds), min: Point3 = [Math.min(...boxes.map(b => b.min[0])), Math.min(...boxes.map(b => b.min[1])), Math.min(...boxes.map(b => b.min[2]))], max: Point3 = [Math.max(...boxes.map(b => b.max[0])), Math.max(...boxes.map(b => b.max[1])), Math.max(...boxes.map(b => b.max[2]))]; subjects.push({ id, at: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], exists: true, geometryIds: solids.map(s => s.id) }); };
  for (const landform of m.landforms) if (landform.poly) { const p = landform.summit ?? [landform.poly.reduce((v, p) => v + p[0]!, 0) / landform.poly.length, landform.poly.reduce((v, p) => v + p[1]!, 0) / landform.poly.length]; add(`landform.${landform.id}`, p); }
  for (const host of m.hosts) aggregate(`host.${host.id}`, cuts.solids.filter(solid => solid.id.startsWith(`host.${host.id}`)), host.xy, host.h * s + host.roofH_eu / 2);
  for (const place of m.places) add(`place.${place.id}`, place.xy, place.h * s);
  for (const water of cuts.waters) { const p = water.outline.length ? [water.outline.reduce((v, p) => v + p[0], 0) / water.outline.length / s, water.outline.reduce((v, p) => v + p[1], 0) / water.outline.length / s] : [1300, 420]; add(water.id.startsWith('water.') ? water.id : `water.${water.id}`, p, water.level); }
  for (const item of m.offshore) { const xy = Array.isArray(item.xy[0]) ? item.xy[0] as number[] : item.xy as number[]; aggregate(`offshore.${item.id}`, cuts.solids.filter(solid => solid.id.startsWith(item.id) || solid.id.startsWith(`offshore.${item.id}`)), xy, (item.heightMax ?? 0) * s); }
  const groups: [string, readonly number[], number?][] = [['highSpan', m.structures.highSpan.xy, 24 * s], ['dam', m.structures.dam.xy, 50 * s], ['bightBridge', m.structures.bightBridge.xy, 12 * s], ['strip', [435, 690]], ['windsock', m.structures.strip.windsock], ['balloonMooring', m.structures.strip.balloonMooring], ['townQuay', m.structures.townQuay.from], ['floatplaneDock', m.structures.floatplaneDock]];
  for (const [id, xy, h] of groups) aggregate(`structure.${id}`, cuts.solids.filter(solid => solid.id.startsWith(id) || solid.id.startsWith(`structure.${id}`)), xy, h);
  for (const [id, h] of [['deck', 24], ['shelf', 12], ['walk', 9]] as const) aggregate(`structure.highSpan.${id}`, cuts.solids.filter(solid => solid.id.startsWith('highSpan') && solid.role === 'deck' && Math.abs(solidBounds(solid).max[1] - h * s) < 1), [1240, 1105], h * s);
  add('island.hook', [440, 1010]); add('sea.west', [200, 700], 0); if (!subjects.some(p => p.id === 'water.sea')) add('water.sea', [1100, 1540], 0);
  add('water.spring', m.water.spring.xy); add('threshold.zipLanding', m.cable.ZIP.to, m.cable.ZIP.toH * s, cuts.pads.some(p => p.id === 'threshold.zipLanding'));
  add('mouth.throat', m.underground.doors.throat.xy, m.underground.doors.throat.h * s, cuts.mouths.some(p => p.id.toLowerCase().includes('throat')));
  add('deep.skylight', m.underground.rooms.deep.skylight.to, m.underground.rooms.deep.skylight.topH * s, cuts.mouths.some(p => p.id.toLowerCase().includes('skylight')));
  if (!subjects.some(p => p.id === 'water.deep')) add('water.deep', [1300, 420], 40 * s, false);
  return subjects;
}
export function projectSubject(eye: Point3, target: Point3, point: Point3, fovDegrees: number, aspect = 16 / 9): { ndc: Point2; depth: number } {
  const dx = target[0] - eye[0], dy = target[1] - eye[1], dz = target[2] - eye[2], length = Math.hypot(dx, dy, dz) || 1, fx = dx / length, fy = dy / length, fz = dz / length, horizontal = Math.hypot(fx, fz) || 1;
  const rx = -fz / horizontal, rz = fx / horizontal, ux = -fy * rz, uy = fz * rx - fx * rz, uz = fy * rx;
  // The camera up is forward cross right; its y component must be positive.
  const sign = uy < 0 ? -1 : 1, px = point[0] - eye[0], py = point[1] - eye[1], pz = point[2] - eye[2], depth = px * fx + py * fy + pz * fz, tan = Math.tan(fovDegrees * Math.PI / 360);
  return { ndc: [(px * rx + pz * rz) / (depth * tan || 1e-8), (px * ux + py * uy + pz * uz) * sign / (depth * tan / aspect || 1e-8)], depth };
}
function terrainOcclusion(eye: Point3, target: Point3, field: TerrainField): boolean { const steps = Math.max(2, Math.ceil(distance3(eye, target) / Math.min(4, field.step))); for (let i = 1; i < steps - 1; i++) { const p = mixPoint(eye, target, i / steps); if (terrainHeight(field, p[0], p[2]) > p[1] + .25) return true; } return false; }
export function buildViews(field: TerrainField, cuts: LandCuts): SketchbookPose[] {
  const s = requireScaleFactor(), subjects = buildViewSubjects(field, cuts), byId = new Map(subjects.map(p => [p.id, p]));
  return HORIZON_MANIFEST.views.map(view => {
    const xy: Point2 = [view.xy[0]! * s, view.xy[1]! * s], underground = view.id === 'G';
    const floor = underground ? (cuts.pads.find(p => p.id === 'threshold.deepJetty')?.centre[1] ?? 40 * s) : view.id === 'B' ? 25 * s : floorAt(field, cuts, xy);
    const eye: Point3 = [xy[0], view.eyeH !== undefined ? view.eyeH * s : floor + 1.6, xy[1]], tx = view.target[0]! * s, tz = view.target[1]! * s;
    const target: Point3 = [tx, view.id === 'G' ? 110 * s : view.id === 'J' ? 14 * s : view.id === 'C' ? 16 * s : terrainHeight(field, tx, tz), tz];
    const horizontal = Math.hypot(target[0] - eye[0], target[2] - eye[2]), pitch = Math.atan2(target[1] - eye[1], horizontal), verticalHalfFov = Math.atan(Math.tan(view.fov_deg * Math.PI / 360) / (16 / 9));
    const proof: ViewProof = { eyeAboveFloor: eye[1] > floor, horizonInFrame: Math.abs(pitch) < verticalHalfFov, subjects: [], pass: false, deferred: deferred[view.id] ?? [] };
    for (const id of subjectsByView[view.id] ?? []) {
      const subject = byId.get(id) ?? { id, at: target, exists: false, geometryIds: [] }, projection = projectSubject(eye, target, subject.at, view.fov_deg), ignore = new Set(subject.geometryIds);
      let occludedBy: string | null = !underground && terrainOcclusion(eye, subject.at, field) ? 'terrain' : null;
      if (!occludedBy) { const hit = cuts.solids.find(solid => !ignore.has(solid.id) && solid.role !== 'marker' && raySolid(eye, subject.at, solid)); if (hit) occludedBy = hit.id; }
      proof.subjects.push({ id, exists: subject.exists, ndc: projection.ndc, inFrame: projection.depth > 0 && Math.abs(projection.ndc[0]) <= 1 && Math.abs(projection.ndc[1]) <= 1, occludedBy, distance: distance3(eye, subject.at) });
    }
    proof.pass = proof.eyeAboveFloor && proof.horizonInFrame && proof.subjects.every(subject => subject.exists && subject.inFrame && subject.occludedBy === null);
    return { id: view.id, label: view.label, eye, target, floor, underground, fovDegrees: view.fov_deg, aspect: 16 / 9, radius: view.radius_eu, bestHour: view.bestHour, also: view.also, subjectIds: subjectsByView[view.id], proof };
  });
}
export function protectedGreenOutline(): Point2[] { const g = HORIZON_MANIFEST.protected.green, s = requireScaleFactor(); return ellipse(g.cx * s, g.cy * s, g.r * s); }
