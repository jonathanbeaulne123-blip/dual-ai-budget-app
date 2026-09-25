/** Mountain v2's projection + weighted shortest-path algorithm, with injected world data. */
import type { BedCut, LandCuts } from '../land/interfaces.ts';
import type { Point3, Host, Line, FlightEnvelope } from './definition.ts';
import type { Intersection } from './crossings.ts';
import { computeIntersections } from './crossings.ts';
import { HORIZON_MANIFEST, requireScaleFactor } from './manifest.ts';
import { arcLengths, closestOnPolyline, distance3, length3, mixPoint } from './geometry.ts';

export interface PathNode { id: string; at: Point3; kind: 'junction' | 'door' | 'station'; facing?: number }
export interface PathEdge { id: string; bedId: string; from: string; to: string; points: Point3[]; length: number; kind: BedCut['kind']; surface: string; halfWidth: number; maxGrade: number }
export interface HorizonPathGraph { nodes: PathNode[]; edges: PathEdge[] }
export interface WalkPlan { points: Point3[]; edges: string[]; length: number; seconds: number; offBedDistance: number }
export interface JourneyLeg { mode: string; bedIds: string[]; lengthEu: number; lengthM: number; speed: number; seconds: number }
export interface JourneyMeasurement { id: string; targetSeconds?: number | readonly number[]; lengthEu: number; lengthM: number; seconds: number | null; pass: boolean; legs: JourneyLeg[]; reason?: string }
const walkKinds = new Set<BedCut['kind']>(['road', 'walk', 'trail', 'boardwalk', 'stair', 'cave']);
export function buildPathGraph(cuts: LandCuts, intersections?: readonly Intersection[]): HorizonPathGraph {
  const beds = cuts.beds.filter(b => walkKinds.has(b.kind) && b.points.length > 1), bedById = new Map(beds.map(b => [b.id, b])), nodes = new Map<string, PathNode>(), edges: PathEdge[] = [];
  const split = new Map<string, Map<number, number[]>>();
  const intersectionsAll = intersections ?? computeIntersections(beds.map(b => ({ id: b.id, points: b.points, clearHeight: b.clearHeight, kind: b.kind, structureIds: b.structureIds })));
  const addSplit = (id: string, segment: number, point: readonly [number, number]) => { const bed = bedById.get(id); if (!bed) return; const a = bed.points[segment], b = bed.points[segment + 1]; if (!a || !b) return; const dx = b[0] - a[0], dz = b[2] - a[2], t = ((point[0] - a[0]) * dx + (point[1] - a[2]) * dz) / (dx * dx + dz * dz || 1), segments = split.get(id) ?? new Map<number, number[]>(), values = segments.get(segment) ?? []; values.push(Math.max(0, Math.min(1, t))); segments.set(segment, values); split.set(id, segments); };
  const joins: { a: Point3; b: Point3 }[] = [];
  for (const p of intersectionsAll) if (bedById.has(p.a) && bedById.has(p.b) && Math.abs(p.heightA - p.heightB) <= .5) { addSplit(p.a, p.segmentA, p.at); addSplit(p.b, p.segmentB, p.at); joins.push({ a: [p.at[0], p.heightA, p.at[1]], b: [p.at[0], p.heightB, p.at[1]] }); }
  const node = (p: Point3) => { const id = `path:${p.map(v => v.toFixed(3)).join(':')}`; if (!nodes.has(id)) nodes.set(id, { id, at: p, kind: 'junction' }); return id; };
  for (const bed of beds) for (let i = 1; i < bed.points.length; i++) {
    const a = bed.points[i - 1]!, b = bed.points[i]!, values = [...new Set([0, ...(split.get(bed.id)?.get(i - 1) ?? []), 1])].sort((a, b) => a - b);
    for (let k = 1; k < values.length; k++) { const p = mixPoint(a, b, values[k - 1]!), q = mixPoint(a, b, values[k]!), length = distance3(p, q); if (length < 1e-5) continue; const horizontal = Math.hypot(q[0] - p[0], q[2] - p[2]); edges.push({ id: `${bed.id}:${i - 1}:${k}`, bedId: bed.id, from: node(p), to: node(q), points: [p, q], length, kind: bed.kind, surface: bed.surface, halfWidth: bed.width / 2, maxGrade: Math.abs(q[1] - p[1]) / (horizontal || 1e-5) }); }
  }
  joins.forEach((join, i) => { const from = node(join.a), to = node(join.b); if (from !== to) edges.push({ id: `lip:${i}`, bedId: 'junction', from, to, points: [join.a, join.b], length: distance3(join.a, join.b), kind: 'walk', surface: 'plaza', halfWidth: 1, maxGrade: 0 }); });
  return { nodes: [...nodes.values()], edges };
}
type Hit = { edge: PathEdge; point: Point3; arc: number; distance: number };
function project(edges: readonly PathEdge[], p: Point3): Hit | null { let best: Hit | null = null; for (const edge of edges) { const hit = closestOnPolyline(edge.points, p[0], p[2]), d = Math.hypot(hit.distance, hit.point[1] - p[1]); if (!best || d < best.distance) best = { edge, point: hit.point, arc: hit.arc, distance: d }; } return best; }
class MinQueue { values: { id: string; cost: number }[] = []; push(id: string, cost: number) { const v = { id, cost }; this.values.push(v); let i = this.values.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.values[p]!.cost <= cost) break; this.values[i] = this.values[p]!; i = p; } this.values[i] = v; } pop() { if (!this.values.length) return undefined; const first = this.values[0]!, last = this.values.pop()!; if (this.values.length) { let i = 0; while (i * 2 + 1 < this.values.length) { let k = i * 2 + 1; if (k + 1 < this.values.length && this.values[k + 1]!.cost < this.values[k]!.cost) k++; if (last.cost <= this.values[k]!.cost) break; this.values[i] = this.values[k]!; i = k; } this.values[i] = last; } return first; } }
export function walkPlan(graph: HorizonPathGraph, from: Point3, to: Point3, options: { speed?: number; stepFree?: boolean; bicycle?: boolean; maxSnap?: number } = {}): WalkPlan | null {
  const speed = options.speed ?? HORIZON_MANIFEST.speeds_ms.walk;
  if (!(speed > 0)) throw new Error('Path speed must be positive');
  const edges = graph.edges.filter(e => !(options.stepFree && e.kind === 'stair') && !(options.bicycle && ['stair', 'cave'].includes(e.kind)) && e.maxGrade <= (options.bicycle ? .13 : Math.tan(40 * Math.PI / 180)));
  const a = project(edges, from), b = project(edges, to); if (!a || !b || a.distance > (options.maxSnap ?? 8) || b.distance > (options.maxSnap ?? 8)) return null;
  const offBedDistance = a.distance + b.distance, cost = (e: PathEdge, length: number) => length / speed * (e.kind === 'stair' ? 1.3 : 1);
  if (a.edge === b.edge) { const length = Math.abs(a.arc - b.arc) + offBedDistance; return { points: [from, a.point, b.point, to], edges: [a.edge.bedId], length, seconds: cost(a.edge, Math.abs(a.arc - b.arc)) + offBedDistance / speed, offBedDistance }; }
  const adj = new Map<string, PathEdge[]>(); for (const e of edges) for (const n of [e.from, e.to]) { const list = adj.get(n) ?? []; list.push(e); adj.set(n, list); }
  const dist = new Map<string, number>(), prev = new Map<string, { id: string; edge: PathEdge }>(), queue = new MinQueue();
  const seed = (id: string, c: number) => { if (c < (dist.get(id) ?? Infinity)) { dist.set(id, c); queue.push(id, c); } };
  seed(a.edge.from, cost(a.edge, a.arc)); seed(a.edge.to, cost(a.edge, a.edge.length - a.arc));
  while (queue.values.length) { const next = queue.pop()!; if (next.cost !== dist.get(next.id)) continue; for (const e of adj.get(next.id) ?? []) { const id = e.from === next.id ? e.to : e.from, value = next.cost + cost(e, e.length); if (value < (dist.get(id) ?? Infinity)) { dist.set(id, value); prev.set(id, { id: next.id, edge: e }); queue.push(id, value); } } }
  const ca = (dist.get(b.edge.from) ?? Infinity) + cost(b.edge, b.arc), cb = (dist.get(b.edge.to) ?? Infinity) + cost(b.edge, b.edge.length - b.arc), end = ca <= cb ? b.edge.from : b.edge.to; if (!Number.isFinite(Math.min(ca, cb))) return null;
  let cur = end; const route: { edge: PathEdge; to: string }[] = []; while (prev.has(cur)) { const p = prev.get(cur)!; route.unshift({ edge: p.edge, to: cur }); cur = p.id; }
  const points: Point3[] = [from, a.point, cur === a.edge.from ? a.edge.points[0]! : a.edge.points.at(-1)!];
  for (const item of route) points.push(...(item.to === item.edge.to ? item.edge.points : [...item.edge.points].reverse()).slice(1)); points.push(b.point, to);
  return { points, edges: [...new Set([a.edge.bedId, ...route.map(r => r.edge.bedId), b.edge.bedId])], length: length3(points), seconds: Math.min(ca, cb) + offBedDistance / speed, offBedDistance };
}
export function nearestPathNode(graph: HorizonPathGraph, p: Point3): PathNode | null { let best: PathNode | null = null, d = Infinity; for (const node of graph.nodes) { const next = distance3(p, node.at); if (next < d) { d = next; best = node; } } return best; }
export const planHorizonWalk = walkPlan;

export function measureJourneys(graph: HorizonPathGraph, cuts: LandCuts, hosts: readonly Host[], lines: readonly Line[], sky: FlightEnvelope): JourneyMeasurement[] {
  const m = HORIZON_MANIFEST, s = requireScaleFactor(), square = m.places.find(p => p.id === 'court')!, origin: Point3 = [square.xy[0]! * s, square.h * s, square.xy[1]! * s];
  const speed = (mode: string) => m.speeds_ms[mode as keyof typeof m.speeds_ms];
  const leg = (mode: string, points: readonly Point3[], bedIds: string[]): JourneyLeg => { const lengthEu = length3(points); return { mode, bedIds, lengthEu, lengthM: lengthEu / s, speed: speed(mode), seconds: lengthEu / speed(mode) }; };
  const fromPlan = (mode: string, plan: WalkPlan | null): JourneyLeg[] => plan ? [{ mode, bedIds: plan.edges, lengthEu: plan.length, lengthM: plan.length / s, speed: speed(mode), seconds: plan.seconds }] : [];
  const door = (id: string): Point3 => { const host = hosts.find(h => h.id === id)!; return 'xy' in host.door ? [host.door.xy[0], host.door.height ?? 0, host.door.xy[1]] : [0, 0, 0]; };
  const getLine = (id: string) => lines.find(line => line.id === id)?.points ?? cuts.beds.find(b => b.id === id)?.points ?? [];
  const destination = (xy: readonly number[]) => { const hit = project(graph.edges, [xy[0]! * s, 0, xy[1]! * s]); return [xy[0]! * s, hit?.point[1] ?? 0, xy[1]! * s] as Point3; };
  const rows: { id: string; target: number | readonly number[]; legs: JourneyLeg[] }[] = [];
  const target = m.journeys.targets_s;
  rows.push({ id: 'square→library by bicycle', target: target['square→library by bicycle'], legs: fromPlan('bicycle', walkPlan(graph, origin, door('library'), { speed: speed('bicycle'), bicycle: true, stepFree: true })) });
  rows.push({ id: 'square→green running', target: target['square→green running'], legs: fromPlan('run', walkPlan(graph, origin, destination([1040, 1065]), { speed: speed('run'), stepFree: true, maxSnap: 70 })) });
  const gondola = getLine('G1'), top = m.places.find(p => p.id === 'L02')!;
  const first = gondola.length ? walkPlan(graph, origin, gondola[0]!, { stepFree: true }) : null, last = gondola.length ? walkPlan(graph, gondola.at(-1)!, [top.xy[0]! * s, top.h * s, top.xy[1]! * s], { stepFree: true }) : null;
  rows.push({ id: 'square→summit by gondola + walk', target: target['square→summit by gondola + walk'], legs: first && last ? [...fromPlan('walk', first), leg('gondola', gondola, ['G1']), ...fromPlan('walk', last)] : [] });
  rows.push({ id: 'crown→quay on the board (S1)', target: target['crown→quay on the board (S1)'], legs: getLine('S1').length ? [leg('board', getLine('S1'), ['S1'])] : [] });
  const crown = sky.launches.find(a => a.id === 'crown'), lamp = sky.launches.find(a => a.id === 'lampGallery');
  const to3 = (a: typeof crown): Point3[] => a && 'xy' in a ? [[a.xy[0], a.height ?? 0, a.xy[1]]] : [];
  rows.push({ id: 'crown→lamp by glider', target: target['crown→lamp by glider'], legs: crown && lamp ? [leg('glider', [...to3(crown), ...to3(lamp)], ['sky.crownLamp'])] : [] });
  const gates = m.sky.courses.ringRun.gates.map(n => sky.gates.find(a => a.id === m.sky.gates.find(g => g.n === n)!.id)).flatMap(to3);
  rows.push({ id: 'ring by plane', target: target['ring by plane'], legs: gates.length ? [leg('plane', [...gates, gates[0]!], ['sky.ringRun'])] : [] });
  for (const id of ['home', 'bank']) rows.push({ id: `square→${id} on foot, walking`, target: target['square→home/bank on foot, walking'], legs: fromPlan('walk', walkPlan(graph, origin, door(id), { stepFree: true })) });
  rows.push({ id: 'square→boathouse on foot, walking', target: target['square→boathouse on foot, walking'], legs: fromPlan('walk', walkPlan(graph, origin, door('boathouse'), { stepFree: true })) });
  return rows.map(row => { const lengthEu = row.legs.reduce((sum, l) => sum + l.lengthEu, 0), seconds = row.legs.length ? row.legs.reduce((sum, l) => sum + l.seconds, 0) : null; return { id: row.id, targetSeconds: row.target, lengthEu, lengthM: lengthEu / s, seconds, pass: seconds !== null && (typeof row.target === 'number' ? seconds <= row.target : seconds >= row.target[0]! && seconds <= row.target[1]!), legs: row.legs, ...(seconds === null ? { reason: 'No connected traversable path between the required anchors.' } : {}) }; });
}
export function yearWalkStretch(points: readonly Point3[], start: readonly number[], end: readonly number[]): Point3[] {
  if (points.length < 2) return [];
  const a = closestOnPolyline(points, start[0]!, start[1]!), b = closestOnPolyline(points, end[0]!, end[1]!), arcs = arcLengths(points);
  if (b.arc >= a.arc) return [a.point, ...points.filter((_, i) => arcs[i]! > a.arc && arcs[i]! < b.arc), b.point];
  return [a.point, ...points.filter((_, i) => arcs[i]! > a.arc), ...points.filter((_, i) => arcs[i]! < b.arc), b.point];
}
