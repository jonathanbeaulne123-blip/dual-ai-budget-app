import type { LandCuts, StructureSolid, TerrainField, PadCut } from '../land/interfaces.ts';
import type { Anchor, Bed, Host, Line, Point2, Point3, Threshold, WorldDefinition } from './definition.ts';
import { HORIZON_MANIFEST, requireScaleFactor } from './manifest.ts';
import { buildCrossings } from './crossings.ts';
import type { CrossingProof } from './crossings.ts';
import { buildDistricts, districtAt, partitionWorldSolids } from './districts.ts';
import { arcLengths, closestOnPolyline, ellipse, length3, padOutline, rectangle, solidBounds, terrainHeight } from './geometry.ts';
import { buildPathGraph, measureJourneys, yearWalkStretch } from './pathGraph.ts';
import { buildFlightEnvelope } from './sky.ts';
import { buildViews, protectedGreenOutline } from './views.ts';

export const GEOGRAPHY_REVISION = 'horizon-geo-1';
export interface LandWorldOptions { terrainAsset?: { url: string; bytes: number; step: number }; extraSolids?: StructureSolid[] }
function anchor(id: string, p: Point3): Anchor { return { id, xy: [p[0], p[2]], height: p[1] }; }
function resolvePad(cuts: LandCuts, id: string) { return cuts.pads.find(p => p.id === id); }
export function buildWorldLines(cuts: LandCuts): Line[];
export function buildWorldLines(field: TerrainField, cuts: LandCuts): Line[];
export function buildWorldLines(input: LandCuts | TerrainField, supplied?: LandCuts): Line[] {
  const cuts = 'beds' in input ? input : supplied!, field = 'heights' in input ? input : undefined;
  const m = HORIZON_MANIFEST, s = requireScaleFactor(), lines: Line[] = cuts.beds.filter(b => ['road', 'skate', 'rail', 'cable'].includes(b.kind) && !b.id.startsWith('structure.') && !['prowTunnel', 'shoulderTunnel', 'duneCulvert'].includes(b.id)).map(b => ({ id: b.id, bedIds: [b.id], mode: b.kind === 'road' ? 'bicycle' : b.kind === 'skate' ? 'board' : b.id === 'G1' ? 'gondola' : b.id === 'ZIP' ? 'zip' : 'cart', points: b.points }));
  const level = (x: number, z: number) => { let closest = Infinity, h = 0; for (const w of cuts.waters) { if (!w.points.length) continue; const p = closestOnPolyline(w.points, x, z); if (p.distance < closest) { closest = p.distance; h = p.point[1]; } } return closest < 100 * s ? h : field ? Math.min(0, terrainHeight(field, x, z)) : 0; };
  for (const [id, route] of Object.entries(m.water_routes)) {
    if (!('pts' in route)) continue;
    const authored = cuts.beds.find(b => b.id === id), path = route.pts.map(p => [p[0]! * s, 0, p[1]! * s] as Point3), arcs = arcLengths(path);
    const points = authored?.points ?? path.map((p, i): Point3 => [p[0], id === 'FERRY' ? 0 : id === 'DEEP_RUN' ? Math.max(0, 40 * s - Math.min(36 * s, arcs[i]! / (120 * s) * 36 * s) - Math.max(0, arcs[i]! - 120 * s) / Math.max(1, arcs.at(-1)! - 120 * s) * 4 * s) : level(p[0], p[2]), p[2]]);
    lines.push({ id, mode: id === 'FERRY' ? 'ferry' : 'row', bedIds: authored ? [authored.id] : [], points });
  }
  // ROW is a traversable water domain, not an invented centreline.
  lines.push({ id: 'ROW', mode: 'row', bedIds: [], points: [], waterBodyIds: cuts.waters.filter(w => w.kind !== 'dry' && w.kind !== 'brook').map(w => w.id) });
  return lines;
}
function buildHosts(cuts: LandCuts): Host[] {
  const m = HORIZON_MANIFEST, s = requireScaleFactor();
  return m.hosts.map(host => {
    const pad = resolvePad(cuts, `host.${host.id}`), apron = resolvePad(cuts, `host.${host.id}.apron`), centre: Point3 = [host.xy[0]! * s, host.h * s, host.xy[1]! * s];
    const normal: Point2 = host.door.startsWith('west') ? [-1, 0] : host.door.startsWith('east') ? [1, 0] : host.door.startsWith('south-east') ? [Math.SQRT1_2, Math.SQRT1_2] : [0, 1];
    const door = pad?.door ?? [centre[0] + normal[0] * host.footprint_m[0]! * s / 2, centre[1], centre[2] + normal[1] * host.footprint_m[1]! * s / 2] as Point3, facing = Math.atan2(normal[0], normal[1]), returnAt: Point3 = [door[0] + normal[0] * 4, door[1], door[2] + normal[1] * 4];
    return { id: host.id, placeIds: host.placeIds, door: anchor(`door.${host.id}`, door), apron: apron ? padOutline(apron) : [], arrivalThresholds: cuts.pads.filter(p => p.kind === 'threshold' && Math.hypot(p.centre[0] - door[0], p.centre[2] - door[2]) < 50 * s).map(p => p.id.replace('threshold.', '')), height: host.h * s, roofHeight: host.roofH_eu, footprint: rectangle([centre[0], centre[2]], [host.footprint_m[0]! * s, host.footprint_m[1]! * s], pad?.rotationDegrees), solidIds: cuts.solids.filter(solid => solid.id.startsWith(`host.${host.id}`)).map(solid => solid.id), padId: pad?.id, facing, returnAt, arrivalEye: [door[0] + normal[0] * 9, door[1] + 1.6, door[2] + normal[1] * 9], arrivalTarget: [door[0], door[1] + 1.25, door[2]], toolPlaceId: host.placeIds[0] };
  });
}
export function buildThresholds(field: TerrainField, cuts: LandCuts, proofs: readonly CrossingProof[] = []): Threshold[] {
  const s = requireScaleFactor(), thresholds: Threshold[] = [];
  const add = (id: string, sourceId: string, xy: readonly number[], modes: string[], action: string, padName = `threshold.${id}`) => { const p = resolvePad(cuts, padName), at: Point2 = [xy[0]! * s, xy[1]! * s], marker = cuts.solids.find(solid => solid.id === `${padName}.marker`); thresholds.push({ id, sourceId, at, height: p?.centre[1] ?? terrainHeight(field, ...at), modes: modes as `${string}→${string}`[], action, padId: p?.id, markerId: marker?.id, kerbGap: false, built: !!p && !!marker }); };
  for (const t of HORIZON_MANIFEST.thresholds) {
    if (typeof t.xy === 'string') { for (const [id, xy] of Object.entries(HORIZON_MANIFEST.water_routes.FERRY.piers)) add(`${t.id}.${id}`, t.id, xy, t.modes, t.action); }
    else if (Array.isArray(t.xy[0])) (t.xy as number[][]).forEach((xy, i) => add(`${t.id}.${i + 1}`, t.id, xy, t.modes, t.action));
    else add(t.id, t.id, t.xy as number[], t.modes, t.action);
  }
  HORIZON_MANIFEST.crossings.forEach((c, i) => { if (c.resolution === 'threshold' && Array.isArray(c.at)) add(`crossing.${i}`, `crossing.${i}`, c.at, ['board→feet'], c.note ?? 'Dismount at the marked crossing.', `crossing.${i}`); });
  const mode = (id: string) => { const b = cuts.beds.find(b => b.id === id); return b?.kind === 'road' ? 'wheels' : b?.kind === 'skate' ? 'board' : b?.kind === 'rail' ? 'cart' : b?.kind === 'cable' ? id === 'ZIP' ? 'zip' : 'cable' : id === 'FERRY' ? 'ferry' : id.startsWith('water') || id === 'DEEP_RUN' ? 'boat' : 'feet'; };
  for (const p of cuts.pads) if (p.kind === 'threshold' && !thresholds.some(t => t.padId === p.id)) { const proof = proofs.find(row => row.padId === p.id || p.id === `crossing.${row.id}`), kinds = proof ? [...new Set([mode(proof.sourceA ?? proof.a), mode(proof.sourceB ?? proof.b)])] : ['feet'], modes = kinds.filter(k => k !== 'feet').map(k => `${k}→feet`); add(p.id.replace(/^threshold\./, ''), proof?.id ?? p.id, [p.centre[0] / s, p.centre[2] / s], modes.length ? modes : ['feet→feet'], kinds.every(k => k === 'feet') ? 'Pause and give way at the marked junction.' : 'Stop at the marker and deliberately change mode.', p.id); }
  return thresholds;
}
function stationPositions(p: PadCut, s: number) { const theta = p.rotationDegrees * Math.PI / 180, c = Math.cos(theta), sn = Math.sin(theta); return Array.from({ length: 20 }, (_, i) => { const x = ((i % 10) - 4.5) * 3.3 * s, z = (Math.floor(i / 10) - .5) * 6 * s; return { yearIndex: i, at: [p.centre[0] + x * c - z * sn, p.centre[1], p.centre[2] + x * sn + z * c] as Point3, size: [3 * s, 2 * s] as Point2 }; }); }

/** Offline pure assembly. Importing this module never allocates terrain or builds geometry. */
export function createLandWorld(terrain: TerrainField, input: LandCuts, options: LandWorldOptions = {}): WorldDefinition {
  const m = HORIZON_MANIFEST, s = requireScaleFactor();
  if (terrain.revision !== GEOGRAPHY_REVISION) throw new Error(`Terrain revision ${terrain.revision} does not match ${GEOGRAPHY_REVISION}`);
  if (terrain.heights.length !== terrain.columns * terrain.rows || terrain.columns < 2 || terrain.rows < 2) throw new Error('Invalid terrain lattice');
  const cuts: LandCuts = { ...input, solids: [...input.solids, ...(options.extraSolids ?? [])] }, hosts = buildHosts(cuts), lines = buildWorldLines(terrain, cuts), crossing = buildCrossings(cuts, lines), graph = buildPathGraph(cuts, crossing.proofs), sky = buildFlightEnvelope(terrain, cuts), views = buildViews(terrain, cuts), geometry = partitionWorldSolids(cuts.solids), districts = buildDistricts(terrain, cuts.beds, geometry), thresholds = buildThresholds(terrain, cuts, crossing.proofs);
  const sourceMap: Record<string, string[]> = {};
  for (const solid of geometry) (sourceMap[solid.sourceId] ??= []).push(solid.id);
  for (const host of hosts) host.solidIds = host.solidIds?.flatMap(id => sourceMap[id] ?? []);
  for (const t of thresholds) { const proof = crossing.proofs.find(p => p.padId === t.padId); if (proof) { t.kerbGap = proof.kerbGap ?? false; t.built = t.built && proof.built; } }
  const yearCut = cuts.beds.find(b => b.id === 'yearWalk'), toBed = (b: typeof cuts.beds[number]): Bed => ({ id: b.id, kind: b.kind, profile: b.profile, surface: b.surface, points: b.points, width: b.width, clearHeight: b.clearHeight, structureIds: b.structureIds, surfaceSegments: b.surfaceSegments, districtIds: [...new Set(b.points.map(p => districtAt(p[0], p[2], s)))] });
  const yearWalk: Bed = yearCut ? toBed(yearCut) : { id: 'yearWalk', profile: 'walk', surface: 'gravel', points: [], districtIds: [] };
  const measurements = measureJourneys(graph, cuts, hosts, lines, sky), diagnostics = [...cuts.diagnostics];
  for (const p of crossing.proofs) if (!p.registered || !p.built) diagnostics.push({ id: p.id, severity: p.built ? 'info' : 'conflict', message: `${p.a} × ${p.b}: ${p.registered ? 'registered' : 'proposed for design lead'} ${p.resolution}; ${p.built ? 'built' : 'physical resolution incomplete'}.`, at: p.at, measured: p.separation, required: p.requiredClearance });
  for (const p of views) if (!p.proof!.pass) diagnostics.push({ id: `view.${p.id}`, severity: 'conflict', message: `Fixed camera pose fails ${[...(!p.proof!.eyeAboveFloor ? ['eye above floor'] : []), ...(!p.proof!.horizonInFrame ? ['horizon in frame'] : []), ...p.proof!.subjects.filter(s => !s.exists || !s.inFrame || s.occludedBy).map(s => `${s.id}: ${!s.exists ? 'missing' : !s.inFrame ? 'outside frame' : `occluded by ${s.occludedBy}`}`)].join('; ')}.` });
  for (const p of measurements) if (!p.pass) diagnostics.push({ id: `journey.${p.id}`, severity: 'conflict', message: p.reason ?? `Measured journey ${p.seconds!.toFixed(1)} s exceeds the unchanged target.`, measured: p.seconds ?? undefined });
  for (const p of sky.proofs!.gates) if (!p.clear) diagnostics.push({ id: `sky.gate.${p.id}`, severity: 'conflict', message: `Gate aperture obstructed by ${p.obstructionIds.join(', ')}.` });
  for (const p of sky.proofs!.landings) if (!p.clear) diagnostics.push({ id: `sky.landing.${p.id}`, severity: 'conflict', message: `Landing field intersects ${p.obstructionIds.join(', ')}.` });
  for (const p of sky.launchPads ?? []) if (!p.graded) diagnostics.push({ id: `sky.launch.${p.id}`, severity: 'conflict', message: 'Launch has no graded pad at its required deck height.' });
  if (!sky.proofs!.glide.pass) diagnostics.push({ id: 'sky.crownLamp', severity: 'conflict', message: 'The Crown to Lamp trajectory does not maintain the 10 eu terrain/structure margin.', measured: sky.proofs!.glide.minClearance, required: 10 });
  diagnostics.push({ id: 'walkableSlope', severity: 'conflict', message: 'Existing Mountain body limit is 40 degrees; manifest requests 38. The explicit keep-existing-contract instruction retains 40 for Horizon collision.', measured: 40, required: 38 });
  for (const d of districts) if (d.triangles!.full > 150000 || d.triangles!.lite > 60000) diagnostics.push({ id: `budget.${d.id}`, severity: 'conflict', message: `District triangle budget exceeded: full ${d.triangles!.full}, lite ${d.triangles!.lite}.` });
  for (const t of thresholds) if (!t.built) diagnostics.push({ id: `threshold.${t.id}`, severity: 'conflict', message: 'Threshold needs its graded pad, marker and any crossing kerb gap.' });
  const small = m.underground.footprint;
  const roomVolumes = Object.keys(m.underground.rooms).flatMap(id => { const pad = cuts.pads.find(p => p.id === `underground.${id}`), roof = cuts.solids.find(s => s.id === `underground.${id}.roof`); if (!pad || !roof) { diagnostics.push({ id: `room.${id}`, severity: 'conflict', message: 'Missing room floor or ceiling geometry.' }); return []; } return [{ id, outline: ellipse(pad.centre[0], pad.centre[2], pad.size[0] / 2, pad.size[1] / 2, 24), floor: pad.centre[1], ceiling: solidBounds(roof).min[1], solidIds: geometry.filter(s => s.sourceId.startsWith(`underground.${id}.`)).map(s => s.id) }]; });
  return {
    id: 'horizon', geographyRevision: GEOGRAPHY_REVISION, scaleFactor: s, extent: { w: 2000, h: 1800 }, seaLevel: 0,
    heightfield: { kind: 'baked', revision: GEOGRAPHY_REVISION, url: options.terrainAsset?.url ?? '/horizon/terrain/horizon-geo-1.bin', bytes: options.terrainAsset?.bytes ?? 0, step: options.terrainAsset?.step ?? terrain.step },
    water: cuts.waters.map(w => ({ id: w.id, outline: w.outline, level: w.level, kind: w.kind })),
    landforms: m.landforms.map(l => ({ id: l.id, outline: l.poly?.map(p => [p[0]! * s, p[1]! * s] as Point2) ?? (l.footprint ? ellipse(l.footprint.cx * s, l.footprint.cy * s, l.footprint.rx * s, l.footprint.ry * s) : l.centreline?.map(p => [p[0]! * s, p[1]! * s] as Point2) ?? []), minHeight: Array.isArray(l.h) ? l.h[0]! * s : 0, maxHeight: Array.isArray(l.h) ? l.h[1]! * s : 45 * s })),
    districts, hosts, places: m.places.map(p => ({ id: p.id, anchor: anchor(p.id, [p.xy[0]! * s, p.h * s, p.xy[1]! * s]), districtId: districtAt(p.xy[0]! * s, p.xy[1]! * s, s) })), beds: cuts.beds.map(toBed), lines,
    structures: geometry.map(solid => { const b = solidBounds(solid); return { id: solid.id, kind: solid.kind, footprint: rectangle([(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2], [b.max[0] - b.min[0], b.max[2] - b.min[2]]), bedIds: solid.bedIds, geometryId: solid.id, role: solid.role, districtId: solid.districtId, bounds: b }; }),
    crossings: crossing.crossings, crossingProofs: crossing.proofs, rawIntersections: crossing.rawIntersections, thresholds,
    reserves: cuts.pads.filter(p => p.kind === 'reserve').map(p => ({ id: p.id, placeId: p.placeId ?? p.id, outline: padOutline(p), door: anchor(`${p.id}.door`, p.door ?? p.centre), rotationDegrees: p.rotationDegrees })), sky,
    underground: { doors: Object.entries(m.underground.doors).map(([id, door]) => anchor(id, [door.xy[0]! * s, door.h * s, door.xy[1]! * s])), rooms: roomVolumes.map(room => room.outline), roomVolumes, waterBodyId: cuts.waters.find(w => w.kind === 'deep')?.id, skylight: anchor('deep.skylight', [small.cx * s, m.underground.rooms.deep.skylight.topH * s, m.underground.rooms.deep.skylight.to[1]! * s]) },
    lights: [...hosts.map(h => { const d = h.door as { xy: Point2; height: number }; return { id: `door.${h.id}.lamp`, at: [d.xy[0], d.height + 2.2, d.xy[1]] as Point3, kind: 'door' }; }), ...thresholds.map(t => ({ id: `${t.id}.lamp`, at: [t.at[0], (t.height ?? 0) + .8, t.at[1]] as Point3, kind: 'threshold' }))], views, lanterns: [],
    protected: [{ id: 'green', outline: protectedGreenOutline(), reason: 'No building, plot or tall prop inside the protected centre.' }],
    geometry: { solids: geometry, sourceMap }, collision: { beds: cuts.beds, pads: cuts.pads, mouths: cuts.mouths, waters: cuts.waters, walkableSlopeDegrees: 40, lipStepMax: .5 }, pathGraph: graph, diagnostics, journeyMeasurements: measurements,
    journey: {
      stations: m.journey.stations.map((station, i) => { const pad = resolvePad(cuts, `station.${station.id}`), prev = m.journey.stations[(i + 11) % 12]!, points = yearWalkStretch(yearWalk.points, prev.xy.map(v => v * s), station.xy.map(v => v * s)), len = length3(points); return { id: station.id, month: station.month, anchor: anchor(`station.${station.id}`, pad?.centre ?? [station.xy[0]! * s, terrainHeight(terrain, station.xy[0]! * s, station.xy[1]! * s), station.xy[1]! * s]), bedIds: [], padId: pad?.id, footprint: pad ? padOutline(pad) : [], bedPositions: pad ? stationPositions(pad, s) : [], stretch: { from: prev.id, lengthEu: len, lengthM: len / s, spacing: [28, 29, 30, 31].map(days => ({ days, eu: len / days })), points } }; }), yearWalk,
      homestead: m.journey.homestead.sites.map(site => { const pad = resolvePad(cuts, `homestead.${site.id}`), host = hosts.find(h => h.id === site.id), fallback = site.id === 'reserveBasin' ? m.places.find(p => p.id === 'L01')!.xy : site.xy ?? m.hosts[0]!.xy, p: Point3 = pad?.centre ?? [fallback[0]! * s, terrainHeight(terrain, fallback[0]! * s, fallback[1]! * s), fallback[1]! * s]; return { id: site.id, anchor: anchor(`homestead.${site.id}`, p), footprint: pad ? padOutline(pad) : host?.footprint ?? [] }; }),
      kittyPlaza: anchor('kittyPlaza', resolvePad(cuts, 'homestead.kittyPlaza')?.centre ?? [m.journey.kittyPlaza.xy[0]! * s, terrainHeight(terrain, m.journey.kittyPlaza.xy[0]! * s, m.journey.kittyPlaza.xy[1]! * s), m.journey.kittyPlaza.xy[1]! * s]),
      lod: { l0Triangles: m.journey.lod.L0.tris[0]!, l0DrawCalls: m.journey.lod.L0.drawCalls[0]!, l1Triangles: m.journey.lod.L1.tris[0]! },
    },
  };
}
export const buildHorizonDefinition = createLandWorld;
