import type { TerrainField, LandCuts, StructureSolid } from '../land/interfaces.ts';
import type { FlightEnvelope, FlightVolume, Point3, Anchor, Point2 } from './definition.ts';
import { HORIZON_MANIFEST, requireScaleFactor } from './manifest.ts';
import { distance3, mixPoint, pointInPolygon, padOutline, rayTriangle, solidBounds, solidTopAt, terrainHeight } from './geometry.ts';

export interface SkyProof { gates: { id: string; requestedAperture: Point2 | null; measuredAperture: Point2; clear: boolean; obstructionIds: string[] }[]; landings: { id: string; clear: boolean; obstructionIds: string[] }[]; glide: { lengthEu: number; durationSeconds: number; arrivalHeight: number; samples: { at: Point3; clearance: number; required: number; obstacle: string | null }[]; minClearance: number; pass: boolean }; pass: boolean }
function pointInsideSolid(point: Point3, solid: StructureSolid): boolean {
  const end: Point3 = [point[0] + .123, point[1] + 1000, point[2] + .217], fractions = new Set<number>();
  const vertex = (i: number): Point3 => [solid.positions[i * 3]!, solid.positions[i * 3 + 1]!, solid.positions[i * 3 + 2]!];
  for (let i = 0; i < solid.indices.length; i += 3) { const f = rayTriangle(point, end, vertex(solid.indices[i]!), vertex(solid.indices[i + 1]!), vertex(solid.indices[i + 2]!)); if (f !== null) fractions.add(Math.round(f * 1e8)); }
  return fractions.size % 2 === 1;
}
export function buildFlightEnvelope(field: TerrainField, cuts: LandCuts): FlightEnvelope {
  const m = HORIZON_MANIFEST, s = requireScaleFactor(), ceiling = m.sky.ceiling_m * s, volumes: FlightVolume[] = [], launches: Anchor[] = [], launchPads: NonNullable<FlightEnvelope['launchPads']> = [], landings: Anchor[] = [], gates: Anchor[] = [];
  const boxes = cuts.solids.map(solid => ({ solid, bounds: solidBounds(solid) }));
  const inMouth = (p: Point3) => cuts.mouths.some(mask => p[1] >= mask.floor && p[1] <= mask.ceiling && pointInPolygon(p[0], p[2], mask.outline));
  const blocked = (p: Point3): string | null => {
    if (p[1] > ceiling) return 'ceiling';
    if (p[1] < terrainHeight(field, p[0], p[2]) && !inMouth(p)) return 'terrain';
    for (const { solid, bounds: b } of boxes) if (p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && p[2] >= b.min[2] && p[2] <= b.max[2] && pointInsideSolid(p, solid)) return solid.id;
    return null;
  };
  for (const [id, launch] of Object.entries(m.sky.launches)) { if (typeof launch === 'string') continue; const at: Point3 = [launch.xy[0]! * s, launch.h * s, launch.xy[1]! * s], thresholdId = id === 'crown' ? 'crownLaunch' : id === 'prow' ? 'prowPlatform' : id, pad = cuts.pads.find(p => p.id === `threshold.${thresholdId}`); launches.push({ id, xy: [at[0], at[2]], height: at[1] }); launchPads.push({ id, padId: pad?.id, edge: [[at[0] - 3 * s, at[1], at[2]], [at[0] + 3 * s, at[1], at[2]]], graded: !!pad && pointInPolygon(at[0], at[2], padOutline(pad)) && Math.abs(pad.centre[1] - at[1]) < .5 }); }
  for (const [i, thermal] of m.sky.lift.thermals.entries()) volumes.push({ id: `thermal.${i + 1}`, kind: 'thermal', centre: [thermal.xy[0]! * s, ceiling / 2, thermal.xy[1]! * s], halfSize: [thermal.r * s, ceiling / 2, thermal.r * s], radius: thermal.r * s, yaw: 0, hours: thermal.hours });
  for (const [i, sink] of m.sky.lift.sink.entries()) volumes.push({ id: `sink.${i + 1}`, kind: 'sink', centre: [sink.xy[0]! * s, ceiling / 2, sink.xy[1]! * s], halfSize: [sink.r * s, ceiling / 2, sink.r * s], radius: sink.r * s, yaw: 0 });
  volumes.push({ id: 'ridge.crownSouth', kind: 'ridge', centre: [1310 * s, 180 * s, 670 * s], halfSize: [200 * s, 100 * s, 45 * s], yaw: 0, modes: ['glider'] });
  for (const [id, landing] of Object.entries(m.sky.landings)) { if (typeof landing === 'string' || Array.isArray(landing)) continue; const x = landing.xy[0]! * s, z = landing.xy[1]! * s, h = terrainHeight(field, x, z); landings.push({ id, xy: [x, z], height: h }); volumes.push({ id, kind: 'landing', centre: [x, h + 2, z], halfSize: [landing.r * s, 2, landing.r * s], radius: landing.r * s, yaw: 0, modes: ['glider'] }); }
  const strip = m.structures.strip, dx = (strip.to[0]! - strip.from[0]!) * s, dz = (strip.to[1]! - strip.from[1]!) * s, stripAt: Point2 = [(strip.from[0]! + strip.to[0]!) * s / 2, (strip.from[1]! + strip.to[1]!) * s / 2], sh = terrainHeight(field, ...stripAt);
  landings.push({ id: 'strip', xy: stripAt, height: sh }); volumes.push({ id: 'strip', kind: 'landing', centre: [stripAt[0], sh + 2, stripAt[1]], halfSize: [strip.width_m * s / 2, 2, Math.hypot(dx, dz) / 2], yaw: Math.atan2(dx, dz), modes: ['plane', 'glider'] });
  const wetCircle = (x: number, z: number, radius: number, level: number): boolean => {
    for (const r of [0, radius / 2, radius]) for (let i = 0; i < 24; i++) if (terrainHeight(field, x + Math.cos(i * Math.PI / 12) * r, z + Math.sin(i * Math.PI / 12) * r) > level - .25) return false;
    return true;
  };
  for (const id of ['harbour', 'bight', 'deep']) {
    const water = cuts.waters.find(w => w.id === id || w.id === `water.${id}`) ?? (id === 'harbour' ? cuts.waters.find(w => w.kind === 'sea') : undefined); if (!water?.outline.length) continue;
    let x = water.outline.reduce((sum, p) => sum + p[0], 0) / water.outline.length, z = water.outline.reduce((sum, p) => sum + p[1], 0) / water.outline.length; const radius = (id === 'deep' ? 20 : 60) * s;
    if (id === 'harbour' && water.kind === 'sea') {
      const dock = m.structures.floatplaneDock; let found = false; x = dock[0]! * s + 100 * s; z = dock[1]! * s;
      // Harbour shares the sea mesh. Select the nearest actual open water patch beside its authored dock.
      for (let distance = 80; distance <= 240 && !found; distance += 20) for (let angle = 0; angle < 24; angle++) {
        const px = dock[0]! * s + Math.cos(angle * Math.PI / 12) * distance * s, pz = dock[1]! * s + Math.sin(angle * Math.PI / 12) * distance * s;
        if (!wetCircle(px, pz, radius, water.level) || boxes.some(({ solid, bounds: b }) => solid.role !== 'marker' && b.max[1] > water.level + .5 && b.min[1] < water.level + 10 && Math.hypot(Math.max(b.min[0] - px, 0, px - b.max[0]), Math.max(b.min[2] - pz, 0, pz - b.max[2])) < radius)) continue;
        x = px; z = pz; found = true; break;
      }
    }
    landings.push({ id: `water.${id}`, xy: [x, z], height: water.level }); volumes.push({ id: `water.${id}`, kind: 'landing', waterBodyId: water.id, centre: [x, water.level + 2, z], halfSize: [radius, 2, radius], radius, yaw: 0, modes: id === 'deep' ? ['glider'] : ['plane', 'glider'] });
  }
  const gateProofs: SkyProof['gates'] = [];
  m.sky.gates.forEach((gate, i) => {
    const next = m.sky.gates[(i + 1) % m.sky.gates.length]!, prev = m.sky.gates[(i + m.sky.gates.length - 1) % m.sky.gates.length]!, centre: Point3 = [gate.xy[0]! * s, gate.h * s, gate.xy[1]! * s];
    let yaw = Math.atan2(next.xy[0]! - prev.xy[0]!, next.xy[1]! - prev.xy[1]!);
    const bridge = cuts.beds.find(b => ['highSpan', 'bightBridge'].includes(gate.id) && b.id === `structure.${gate.id}`), throat = gate.id === 'throat' ? cuts.beds.find(b => b.id === 'underground.throat') : undefined;
    if (gate.id === 'needle') yaw = Math.PI / 2; // The actual rock intrados opens east/west.
    else if (bridge && bridge.points.length > 1) { const a = bridge.points[0]!, b = bridge.points.at(-1)!; yaw = Math.atan2(-(b[2] - a[2]), b[0] - a[0]); }
    else if (throat && throat.points.length > 1) { const a = throat.points[0]!, b = throat.points[1]!; yaw = Math.atan2(b[0] - a[0], b[2] - a[2]); }
    const requested: Point2 | null = gate.aperture_m ? [gate.aperture_m[0]! * s, gate.aperture_m[1]! * s] : null, halfW = (requested?.[0] ?? 24 * s) / 2, halfH = (requested?.[1] ?? 16 * s) / 2, obstructions = new Set<string>();
    const probe = (x: number, y: number) => blocked([centre[0] + Math.cos(yaw) * x, centre[1] + y, centre[2] - Math.sin(yaw) * x]);
    let clear = true; for (let ix = -4; ix <= 4; ix++) for (let iy = -4; iy <= 4; iy++) { const hit = probe(ix / 4 * halfW, iy / 4 * halfH); if (hit) { clear = false; obstructions.add(hit); } }
    let horizontal = 0, vertical = 0; for (let d = .5; d <= halfW; d += .5) { if (probe(d, 0) || probe(-d, 0)) break; horizontal = d; } for (let d = .5; d <= halfH; d += .5) { if (probe(0, d) || probe(0, -d)) break; vertical = d; }
    const measured: Point2 = [horizontal * 2, vertical * 2]; clear &&= horizontal >= halfW && vertical >= halfH;
    if (!clear && !obstructions.size) obstructions.add('aperture centreline clearance');
    gates.push({ id: gate.id, xy: [centre[0], centre[2]], height: centre[1] }); volumes.push({ id: gate.id, kind: 'gate', centre, halfSize: [halfW, halfH, 3 * s], yaw, aperture: requested ?? measured, modes: gate.id === 'throat' ? ['glider'] : ['plane', 'glider'] }); gateProofs.push({ id: gate.id, requestedAperture: requested, measuredAperture: measured, clear, obstructionIds: [...obstructions] });
  });
  const landingProofs = volumes.filter(v => v.kind === 'landing').map(v => {
    const normalized = (p: Point3): Point2 => { const x = p[0] - v.centre[0], z = p[2] - v.centre[2]; return [(x * Math.cos(v.yaw) - z * Math.sin(v.yaw)) / v.halfSize[0], (x * Math.sin(v.yaw) + z * Math.cos(v.yaw)) / v.halfSize[2]]; };
    const contains = (p: Point2) => v.radius ? p[0] ** 2 + p[1] ** 2 <= 1 : Math.abs(p[0]) <= 1 && Math.abs(p[1]) <= 1;
    const hits = (solid: StructureSolid) => {
      const vertex = (i: number): Point3 => [solid.positions[i * 3]!, solid.positions[i * 3 + 1]!, solid.positions[i * 3 + 2]!];
      for (let i = 0; i < solid.indices.length; i += 3) {
        const p = [vertex(solid.indices[i]!), vertex(solid.indices[i + 1]!), vertex(solid.indices[i + 2]!)];
        if (Math.max(...p.map(p => p[1])) <= v.centre[1] - 1.5 || Math.min(...p.map(p => p[1])) >= v.centre[1] + 8) continue;
        const xy = p.map(normalized); if (xy.some(contains) || pointInPolygon(0, 0, xy)) return true;
        for (let k = 0; k < 3; k++) { const a = xy[k]!, b = xy[(k + 1) % 3]!, dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dz) / (dx * dx + dz * dz || 1))); if (contains([a[0] + dx * t, a[1] + dz * t])) return true; }
      }
      return false;
    };
    const ids = boxes.filter(({ solid, bounds: b }) => solid.role !== 'marker' && b.max[1] > v.centre[1] - 1.5 && b.min[1] < v.centre[1] + 8 && hits(solid)).map(v => v.solid.id);
    if (v.waterBodyId && v.id !== 'water.deep' && !wetCircle(v.centre[0], v.centre[2], v.radius!, v.centre[1] - 2)) ids.push('terrain inside water landing field');
    return { id: v.id, clear: ids.length === 0, obstructionIds: ids };
  });
  const start = m.sky.launches.crown, finish = m.sky.launches.lampGallery, from: Point3 = [start.xy[0]! * s, start.h * s, start.xy[1]! * s], to: Point3 = [finish.xy[0]! * s, finish.h * s, finish.xy[1]! * s], planLength = Math.hypot(to[0] - from[0], to[2] - from[2]), duration = planLength / m.sky.glider.speed_ms, steps = Math.ceil(planLength / 4), samples: SkyProof['glide']['samples'] = [];
  for (let i = 0; i <= steps; i++) { const t = i / steps, p = mixPoint(from, to, t), height = from[1] - duration * t * m.sky.glider.sink_ms, at: Point3 = [p[0], height, p[2]], ground = terrainHeight(field, at[0], at[2]); let obstacle: string | null = null, surface = ground; for (const { solid, bounds: b } of boxes) if (at[0] >= b.min[0] && at[0] <= b.max[0] && at[2] >= b.min[2] && at[2] <= b.max[2] && b.max[1] > surface) { const top = solidTopAt(solid, at[0], at[2]); if (top !== null && top > surface) { surface = top; obstacle = solid.id; } } samples.push({ at, clearance: height - surface, required: i === 0 ? 0 : 10, obstacle }); }
  const glide: SkyProof['glide'] = { lengthEu: distance3(from, samples.at(-1)!.at), durationSeconds: duration, arrivalHeight: samples.at(-1)!.at[1], samples, minClearance: Math.min(...samples.slice(1).map(p => p.clearance)), pass: samples.every(p => p.clearance >= p.required) };
  const proofs: SkyProof = { gates: gateProofs, landings: landingProofs, glide, pass: gateProofs.every(g => g.clear) && landingProofs.every(l => l.clear) && glide.pass };
  return { ceiling, launches, launchPads, landings, gates, volumes, glider: { speed: m.sky.glider.speed_ms, sink: m.sky.glider.sink_ms }, proofs };
}
