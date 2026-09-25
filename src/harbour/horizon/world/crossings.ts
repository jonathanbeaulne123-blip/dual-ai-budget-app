import type { Point2, Point3, Crossing, Line } from './definition.ts';
import type { LandCuts, BedCut, StructureSolid } from '../land/interfaces.ts';
import { HORIZON_MANIFEST, requireScaleFactor } from './manifest.ts';
import { closestOnPolyline, mixPoint, pointInPolygon, padOutline, raySolid, segmentIntersections, solidBounds, solidVerticalRangeAt } from './geometry.ts';

export interface Centreline { id: string; sourceId?: string; points: readonly Point3[]; clearHeight: number; kind: string; structureIds: string[] }
export interface Intersection { a: string; b: string; sourceA?: string; sourceB?: string; at: Point2; heightA: number; heightB: number; segmentA: number; segmentB: number; overlap: boolean }
export interface CrossingProof extends Intersection { id: string; resolution: Crossing['resolution']; kind?: 'crossing' | 'waterConfluence' | 'modeTransfer'; manifestIndex?: number; registered: boolean; proposed: boolean; separation: number; clearHeight?: number; requiredClearance: number; clearancePass: boolean; structureIds: string[]; built: boolean; padId?: string; markerId?: string; kerbGap?: boolean; waterBodyIds?: string[]; moverPending?: boolean; note?: string }
const canonical = (id: string): string => ({ 'Crown Road': 'V02', 'river mouth': 'river lower', 'water.river.upper': 'river upper', 'water.river.lower': 'river lower', 'water.brook': 'brook', 'water wash': 'wash', 'water.wash': 'wash', 'water.reach.1': 'reachChannel.1', 'water.reach.2': 'reachChannel.2', 'Reach west channel': 'reachChannel.1', 'Reach east channel': 'reachChannel.2', 'S1 finish': 'S1' }[id] ?? id);
function matches(name: string, id: string): boolean { return name.split('+').some(part => canonical(part.trim()) === canonical(id)); }
function camel(value: string): string { const words = value.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/); return words.map((w, i) => i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)).join(''); }
function pointKey(hit: Intersection): string { let hash = 2166136261; for (const c of `${hit.a}|${hit.b}|${hit.at.map(v => v.toFixed(2)).join(',')}|${hit.heightA.toFixed(2)}|${hit.heightB.toFixed(2)}`) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619); return (hash >>> 0).toString(36); }
export function collectCentrelines(cuts: LandCuts, lines: readonly Line[] = [], raw = false): Centreline[] {
  const physicalOwner = (b: BedCut) => { if (b.id.startsWith('structure.')) { const name = b.id.slice('structure.'.length), source = cuts.solids.find(s => s.id.startsWith(`${name}.`) && s.role === 'deck' && s.bedIds.length === 1); if (source) return source.bedIds[0]!; } return ({ prowTunnel: 'V01', shoulderTunnel: 'V02', duneCulvert: 'S4' } as Record<string, string>)[b.id] ?? b.id; };
  const out: Centreline[] = cuts.beds.filter(b => b.points.length > 1).map(b => ({ id: raw ? b.id : canonical(physicalOwner(b)), sourceId: b.id, points: b.points, clearHeight: b.clearHeight, kind: b.kind, structureIds: b.structureIds }));
  for (const line of lines) if (line.points.length > 1 && !out.some(c => c.sourceId === line.id || c.id === line.id)) out.push({ id: !raw && line.id === 'RIVER_RUN' ? 'river lower' : line.id, sourceId: line.id, points: line.points, clearHeight: line.mode === 'gondola' ? 8 : line.mode === 'ferry' || line.mode === 'row' ? 4 : 1.25, kind: line.mode, structureIds: [] });
  for (const water of cuts.waters) if (water.points.length > 1) out.push({ id: raw ? water.id : canonical(water.id), sourceId: water.id, points: water.points, clearHeight: water.kind === 'brook' || water.kind === 'dry' ? 1.25 : 4, kind: water.kind === 'dry' ? 'dry' : 'water', structureIds: [] });
  return out;
}
/** Spatial bins reduce candidate pairs only. Exact segment tests decide every intersection. */
export function computeIntersections(lines: readonly Centreline[]): Intersection[] {
  const segments: { line: number; segment: number; a: Point3; b: Point3 }[] = [], bins = new Map<string, number[]>();
  lines.forEach((line, l) => { for (let i = 1; i < line.points.length; i++) { const a = line.points[i - 1]!, b = line.points[i]!, n = segments.length; segments.push({ line: l, segment: i - 1, a, b }); for (let z = Math.floor(Math.min(a[2], b[2]) / 64); z <= Math.floor(Math.max(a[2], b[2]) / 64); z++) for (let x = Math.floor(Math.min(a[0], b[0]) / 64); x <= Math.floor(Math.max(a[0], b[0]) / 64); x++) { const key = `${x}:${z}`, bucket = bins.get(key) ?? []; bucket.push(n); bins.set(key, bucket); } } });
  const visited = new Set<string>(), result = new Map<string, Intersection>();
  for (const bucket of bins.values()) for (let i = 0; i < bucket.length; i++) for (let j = i + 1; j < bucket.length; j++) { const ai = bucket[i]!, bi = bucket[j]!, sa = segments[ai]!, sb = segments[bi]!; if (sa.line === sb.line) continue; const pair = `${Math.min(ai, bi)}:${Math.max(ai, bi)}`; if (visited.has(pair)) continue; visited.add(pair);
    const first = sa.line < sb.line ? sa : sb, second = sa.line < sb.line ? sb : sa, a = lines[first.line]!, b = lines[second.line]!;
    // A structural deck and its source bed are one route. Intersections with every other route remain tested.
    if (a.id === b.id) continue;
    for (const hit of segmentIntersections(first.a, first.b, second.a, second.b)) {
      const p = mixPoint(first.a, first.b, hit.t), q = mixPoint(second.a, second.b, hit.u), key = `${a.id}|${b.id}|${hit.at[0].toFixed(3)}|${hit.at[1].toFixed(3)}|${p[1].toFixed(3)}|${q[1].toFixed(3)}`;
      const previous = result.get(key); result.set(key, { a: a.id, b: b.id, sourceA: a.sourceId ?? a.id, sourceB: b.sourceId ?? b.id, at: hit.at, heightA: p[1], heightB: q[1], segmentA: first.segment, segmentB: second.segment, overlap: hit.overlap || previous?.overlap === true });
    }
  }
  return [...result.values()].sort((a, b) => a.a.localeCompare(b.a) || a.b.localeCompare(b.b) || a.at[0] - b.at[0] || a.at[1] - b.at[1]);
}
export function buildCrossings(cuts: LandCuts, lines: readonly Line[] = []): { crossings: Crossing[]; proofs: CrossingProof[]; rawIntersections: Intersection[] } {
  const centre = collectCentrelines(cuts, lines), byId = new Map(centre.map(l => [l.sourceId ?? l.id, l])), intersections = computeIntersections(centre), s = requireScaleFactor();
  const boxes = new Map(cuts.solids.map(solid => [solid.id, solidBounds(solid)]));
  const solidNear = (solid: StructureSolid, at: Point2, radius: number) => { const b = boxes.get(solid.id)!; return at[0] >= b.min[0] - radius && at[0] <= b.max[0] + radius && at[1] >= b.min[2] - radius && at[1] <= b.max[2] + radius; };
  const proofs = intersections.map(hit => {
    const a = byId.get(hit.sourceA ?? hit.a)!, b = byId.get(hit.sourceB ?? hit.b)!, lower = hit.heightA < hit.heightB ? a : b, separation = Math.abs(hit.heightA - hit.heightB), required = Math.max(1.25, lower.clearHeight, a.kind === 'cable' || b.kind === 'cable' ? 8 : 0);
    const candidates = HORIZON_MANIFEST.crossings.map((row, index) => ({ row, index, flipped: matches(row.a, hit.b) && matches(row.b, hit.a) })).filter(({ row, flipped }) => flipped || matches(row.a, hit.a) && matches(row.b, hit.b)).map(entry => ({ ...entry, distance: Array.isArray(entry.row.at) ? Math.hypot(entry.row.at[0]! * s - hit.at[0], entry.row.at[1]! * s - hit.at[1]) : entry.row.at === 'none' ? Infinity : 48 * s })).filter(entry => entry.distance <= 65 * s).sort((a, b) => a.distance - b.distance);
    const match = candidates[0], base = camel(`cross ${hit.a} ${hit.b}`), n = pointKey(hit);
    const aquatic = (line: Centreline) => ['water', 'row', 'ferry'].includes(line.kind) || line.id === 'DEEP_RUN';
    const confluence = aquatic(a) && aquatic(b), transfer = hit.a === 'FERRY' && hit.b.startsWith('ferry.') || hit.b === 'FERRY' && hit.a.startsWith('ferry.');
    const resolution: Crossing['resolution'] = confluence || transfer ? 'threshold' : match ? match.row.resolution === 'threshold' ? 'threshold' : ((match.row.resolution === 'over') !== match.flipped ? 'over' : 'under') : separation >= required ? hit.heightA > hit.heightB ? 'over' : 'under' : 'threshold';
    const namedStructure = match?.row.structure?.split(' (')[0];
    const relevant = cuts.solids.filter(solid => solid.role !== 'marker' && solidNear(solid, hit.at, 3 * s) && (solid.bedIds.some(id => canonical(id) === hit.a || canonical(id) === hit.b) || namedStructure !== undefined && solid.id.startsWith(namedStructure)));
    const pad = cuts.pads.find(p => (p.id === `crossing.${match?.index}` || p.kind === 'threshold') && (pointInPolygon(hit.at[0], hit.at[1], padOutline(p)) || transfer && p.id.startsWith('threshold.ferryPiers.') && Math.hypot(p.centre[0] - hit.at[0], p.centre[2] - hit.at[1]) <= 20));
    const marker = pad && cuts.solids.find(solid => solid.role === 'marker' && (solid.id === `${pad.id}.marker` || solidNear(solid, hit.at, 8 * s)));
    // A kerb gap is measured against the actual rail/wall solids through the centre of the crossing.
    const obstructionHeight = Math.min(hit.heightA, hit.heightB) + .08;
    const directions = [a, b].map(line => { const nearest = closestOnPolyline(line.points, hit.at[0], hit.at[1]), p = line.points[nearest.segment]!, q = line.points[nearest.segment + 1]!, length = Math.hypot(q[0] - p[0], q[2] - p[2]) || 1; return [(q[0] - p[0]) / length, (q[2] - p[2]) / length] as Point2; });
    const kerbGap = !cuts.solids.some(solid => (solid.role === 'rail' || solid.role === 'wall') && solidNear(solid, hit.at, 8) && boxes.get(solid.id)!.min[1] <= obstructionHeight && boxes.get(solid.id)!.max[1] >= obstructionHeight && directions.some(dir => raySolid([hit.at[0] - dir[0] * 6, obstructionHeight, hit.at[1] - dir[1] * 6], [hit.at[0] + dir[0] * 6, obstructionHeight, hit.at[1] + dir[1] * 6], solid)));
    let clearHeight = separation;
    const foot = Math.min(hit.heightA, hit.heightB), upperHeight = Math.max(hit.heightA, hit.heightB);
    const upper = hit.heightA > hit.heightB ? a : b;
    const physical = relevant.filter(solid => {
      const range = solidVerticalRangeAt(solid, hit.at[0], hit.at[1]); if (!range) return false;
      if (solid.role === 'roof' && solid.bedIds.some(id => canonical(id) === lower.id) && range.bottom > foot) { clearHeight = Math.min(clearHeight, range.bottom - foot); return true; }
      if (solid.role === 'deck' && Math.abs(range.top - upperHeight) <= .75) {
        const prefix = solid.id.replace(/\.(deck|bed|floor|surface\.\d+)$/, '');
        const supported = cuts.solids.some(p => p.role === 'support' && (p.id.startsWith(`${prefix}.`) || p.bedIds.some(id => canonical(id) === upper.id) && solidNear(p, hit.at, 50)));
        if (supported) { clearHeight = Math.min(clearHeight, range.bottom - foot); return true; }
      }
      if (upper.kind === 'cable' && solid.kind === 'cable' && solid.role === 'rail' && solid.bedIds.some(id => canonical(id) === upper.id)) { clearHeight = Math.min(clearHeight, range.bottom - foot); return cuts.solids.some(p => p.role === 'support' && (p.bedIds.includes(upper.id) || upper.id === 'ZIP' && p.id.startsWith('platform.'))); }
      return false;
    });
    const clearancePass = resolution === 'threshold' ? separation <= (transfer ? 1.25 : .5) : (resolution === 'over' ? hit.heightA - hit.heightB : hit.heightB - hit.heightA) >= required && clearHeight >= required - 1e-6;
    const built = confluence ? clearancePass : transfer ? !!pad && !!marker && relevant.some(solid => solid.kind === 'jetty' && solid.role === 'deck') && clearancePass : resolution === 'threshold' ? !!pad && !!marker && kerbGap && clearancePass : physical.length > 0 && clearancePass;
    const proof: CrossingProof = { ...hit, id: `${base}${n}`, resolution, kind: confluence ? 'waterConfluence' : transfer ? 'modeTransfer' : 'crossing', registered: !!match, proposed: !match, ...(match ? { manifestIndex: match.index } : {}), separation, clearHeight, requiredClearance: resolution === 'threshold' ? transfer ? 1.25 : .5 : required, clearancePass, structureIds: relevant.map(solid => solid.id), built, ...(pad ? { padId: pad.id } : {}), ...(marker ? { markerId: marker.id } : {}), ...(resolution === 'threshold' && !confluence ? { kerbGap } : {}), ...(confluence ? { waterBodyIds: [hit.sourceA ?? hit.a, hit.sourceB ?? hit.b], note: 'Continuous water confluence; one physical waterway, no pedestrian pad or furniture in the basin.' } : transfer ? { moverPending: true, note: 'Pier and boarding threshold land interface; ferry deck and gangway animation require the movers pass.' } : match?.row.note ? { note: match.row.note } : {}) };
    return proof;
  });
  return { proofs, rawIntersections: computeIntersections(collectCentrelines(cuts, lines, true)), crossings: proofs.map(p => ({ id: p.id, a: p.a, b: p.b, at: p.at, resolution: p.resolution, structure: p.structureIds[0], proof: p })) };
}
export function bedHeightAt(bed: BedCut, at: Point2): number { return closestOnPolyline(bed.points, at[0], at[1]).point[1]; }
