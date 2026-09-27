/** Mountain v2's projection + weighted shortest-path algorithm, with injected world data. */
import type { BedCut, LandCuts } from '../land/interfaces.ts';
import type { Point3, Host, Line, FlightEnvelope } from './definition.ts';
import type { Intersection } from './crossings.ts';
import { computeIntersections } from './crossings.ts';
import { HORIZON_MANIFEST, requireScaleFactor } from './manifest.ts';
import { arcLengths, closestOnPolyline, distance3, length3, mixPoint } from './geometry.ts';

export interface PathNode { id: string; at: Point3; kind: 'junction' | 'door' | 'station'; facing?: number }
export interface PathEdge { id: string; bedId: string; from: string; to: string; points: Point3[]; length: number; kind: BedCut['kind']; surface: string; halfWidth: number; maxGrade: number }
export interface BlockedEdge { edge: string; bedId: string; at: Point3; solid: string }
export interface HorizonPathGraph { nodes: PathNode[]; edges: PathEdge[]; blocked?: BlockedEdge[] }
/** The body's step (runtime lip) and height: a solid rising above the step within body height
 * over a walking line is a wall the runtime stops at, so no edge may pass through it. */
const STEP = .48, BODY = 1.25;
type P3 = [number, number, number];
type Prism = { solid: string; bedIds: readonly string[]; deck: boolean; quads: [number, number][][]; top: P3[]; bottom: P3[] };
/** Height at (x,z) of the plane through three corners of a prism face (its top or bottom). */
const planeAt = (f: readonly P3[], x: number, z: number) => { const [a, b, c] = f as [P3, P3, P3], ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; return Math.abs(ny) < 1e-9 ? Math.max(a[1], b[1], c[1]) : a[1] - (nx * (x - a[0]) + nz * (z - a[2])) / ny; };
function prismIndex(cuts: LandCuts): { find: (x: number, z: number) => Prism[] } {
  const CELL = 4, grid = new Map<string, Prism[]>();
  for (const s of cuts.solids) {
    // Decks and floors count too: a surface standing more than the step above the line is a wall.
    if (s.role === 'marker' || s.positions.length % 24) continue;
    for (let o = 0; o + 23 < s.positions.length; o += 24) {
      const v = (k: number): P3 => [s.positions[o + k * 3]!, s.positions[o + k * 3 + 1]!, s.positions[o + k * 3 + 2]!];
      const all = Array.from({ length: 8 }, (_, k) => v(k)), prism: Prism = { solid: s.sourceId ?? s.id, bedIds: s.bedIds, deck: s.role === 'deck' || s.role === 'floor', quads: [all.slice(0, 4).map(p => [p[0], p[2]]), all.slice(4).map(p => [p[0], p[2]])], top: all.slice(4), bottom: all.slice(0, 4) };
      const xs = all.map(p => p[0]), zs = all.map(p => p[2]);
      for (let x = Math.floor(Math.min(...xs) / CELL); x <= Math.floor(Math.max(...xs) / CELL); x++) for (let z = Math.floor(Math.min(...zs) / CELL); z <= Math.floor(Math.max(...zs) / CELL); z++) { const key = `${x}:${z}`, list = grid.get(key); if (list) list.push(prism); else grid.set(key, [prism]); }
    }
  }
  return { find: (x, z) => grid.get(`${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`) ?? [] };
}
const inQuad = (q: readonly [number, number][], x: number, z: number) => { let hit = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const a = q[i]!, b = q[j]!; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit; } return hit; };
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
  for (const p of intersectionsAll) { const a = p.sourceA ?? p.a, b = p.sourceB ?? p.b; if (bedById.has(a) && bedById.has(b) && Math.abs(p.heightA - p.heightB) <= STEP) { addSplit(a, p.segmentA, p.at); addSplit(b, p.segmentB, p.at); joins.push({ a: [p.at[0], p.heightA, p.at[1]], b: [p.at[0], p.heightB, p.at[1]] }); } }
  // W7-A (R3-119): a bed that ENDS on another bed's walking surface (a T junction: a stair foot on a walk, a jetty on a quay,
  // a footbridge landing on its trail) never crosses it, so no intersection joins them. Where an end lies on another foot
  // bed's surface (within its half-width + TEE_REACH in plan, ≤ STEP in height) that bed is split there and a tee lip joins
  // the two, kept only if the step between them is clear of every solid (checked with the lanes below).
  const tees: { a: Point3; b: Point3; beds: [string, string] }[] = [];
  for (const bed of beds) for (const end of [bed.points[0]!, bed.points.at(-1)!]) for (const other of beds) {
    if (other === bed) continue;
    const hit = closestOnPolyline(other.points, end[0], end[2]);
    if (hit.distance > Math.max(LANE_JOIN, other.width / 2 + TEE_REACH) || Math.abs(hit.point[1] - end[1]) > STEP) continue;
    addSplit(other.id, hit.segment, [end[0], end[2]]); tees.push({ a: end, b: hit.point, beds: [bed.id, other.id] });
  }
  const node = (p: Point3) => { const id = `path:${p.map(v => v.toFixed(3)).join(':')}`; if (!nodes.has(id)) nodes.set(id, { id, at: p, kind: 'junction' }); return id; };
  for (const bed of beds) for (let i = 1; i < bed.points.length; i++) {
    const a = bed.points[i - 1]!, b = bed.points[i]!, values = [...new Set([0, ...(split.get(bed.id)?.get(i - 1) ?? []), 1])].sort((a, b) => a - b);
    for (let k = 1; k < values.length; k++) { const p = mixPoint(a, b, values[k - 1]!), q = mixPoint(a, b, values[k]!), length = distance3(p, q); if (length < 1e-5) continue; const horizontal = Math.hypot(q[0] - p[0], q[2] - p[2]); edges.push({ id: `${bed.id}:${i - 1}:${k}`, bedId: bed.id, from: node(p), to: node(q), points: [p, q], length, kind: bed.kind, surface: bed.surface, halfWidth: bed.width / 2, maxGrade: Math.abs(q[1] - p[1]) / (horizontal || 1e-5) }); }
  }
  joins.forEach((join, i) => { const from = node(join.a), to = node(join.b); if (from !== to) edges.push({ id: `lip:${i}`, bedId: 'junction', from, to, points: [join.a, join.b], length: distance3(join.a, join.b), kind: 'walk', surface: 'plaza', halfWidth: 1, maxGrade: 0 }); });
  // An edge exists only where the runtime body can walk it: every 0.5 eu along the line, no
  // non-walkable solid may rise above the step within body height.
  const prisms = prismIndex(cuts), blocked: BlockedEdge[] = [];
  // W7-A (R3-119): a blocked edge keeps its open runs. The body walks a bed up to the wall that stops it; dropping the whole
  // edge for one blocked sample at its far end (a rail across a stair's foot, a neighbour's slab at a jetty's end) left every
  // two-point bed (stairs, jetties, footbridges, the lookout bay) out of the graph altogether.
  const open: PathEdge[] = [];
  for (const e of edges) {
    if (e.id.startsWith('lip:')) { open.push(e); continue; }
    const [p, q] = e.points as [Point3, Point3], len = Math.hypot(q[0] - p[0], q[2] - p[2]), n = Math.max(1, Math.ceil(len / .5)), nx = -(q[2] - p[2]) / (len || 1), nz = (q[0] - p[0]) / (len || 1);
    const free: boolean[] = [];
    for (let k = 0; k <= n; k++) {
      // The body is a 0.3 eu capsule: test the line and both flanks.
      const c = mixPoint(p, q, k / n);
      let ok = true;
      for (const side of [0, -.3, .3]) {
        const x = c[0] + nx * side, z = c[2] + nz * side, hit = prisms.find(x, z).find(r => !(r.deck && r.bedIds.includes(e.bedId)) && r.quads.some(quad => inQuad(quad, x, z)) && planeAt(r.top, x, z) > c[1] + STEP && planeAt(r.bottom, x, z) < c[1] + BODY);
        if (hit) { if (free.every(Boolean)) blocked.push({ edge: e.id, bedId: e.bedId, at: [x, c[1], z], solid: hit.solid }); ok = false; break; }
      }
      free.push(ok);
    }
    if (free.every(Boolean)) { open.push(e); continue; }
    // Open runs of at least two clear samples (the body stops before the wall).
    let run = -1, piece = 0;
    for (let k = 0; k <= n + 1; k++) {
      if (k <= n && free[k]) { if (run < 0) run = k; continue; }
      if (run >= 0 && k - 1 - run >= 1) {
        const a = mixPoint(p, q, run / n), b = mixPoint(p, q, (k - 1) / n), from = run === 0 ? e.from : node(a), to = k - 1 === n ? e.to : node(b), length = distance3(a, b);
        if (length >= .5) open.push({ ...e, id: `${e.id}~${piece++}`, from, to, points: [a, b], length });
      }
      run = -1;
    }
  }
  // Tee lips (above): a clear step joins the end to the surface it lands on.
  let teeIndex = 0;
  for (const t of tees) {
    const from = node(t.a), to = node(t.b); if (from === to) continue;
    const own = (r: Prism) => r.deck && r.bedIds.some(x => t.beds.includes(x)), len = Math.hypot(t.b[0] - t.a[0], t.b[2] - t.a[2]), steps = Math.max(1, Math.ceil(len / .25)), top = Math.max(t.a[1], t.b[1]);
    let clear = true;
    for (let k = 0; k <= steps && clear; k++) { const c = mixPoint(t.a, t.b, k / steps); if (prisms.find(c[0], c[2]).some(r => !own(r) && r.quads.some(quad => inQuad(quad, c[0], c[2])) && planeAt(r.top, c[0], c[2]) > top + STEP && planeAt(r.bottom, c[0], c[2]) < top + BODY)) clear = false; }
    if (clear) open.push({ id: `tee:${teeIndex++}`, bedId: 'junction', from, to, points: [t.a, t.b], length: distance3(t.a, t.b), kind: 'walk', surface: 'plaza', halfWidth: 1, maxGrade: 0 });
  }
  // R2-08: two foot beds laid side by side in one lane (the Crown walk inside the Year Walk's lane from the turning circle)
  // never cross, so no intersection joins them. Where a node of one lies within LANE_JOIN of a node of another at the same
  // height (≤ STEP) and the step between them is clear of every solid, a flush lip joins them — the body walks across.
  const foot = (id: string) => { const b = bedById.get(id); return !!b && ['walk', 'trail', 'boardwalk'].includes(b.kind); };
  const footNodes = new Map<string, { at: Point3; beds: Set<string> }>();
  for (const e of open) if (foot(e.bedId)) for (const [id, at] of [[e.from, e.points[0]!], [e.to, e.points.at(-1)!]] as const) { const n = footNodes.get(id) ?? { at, beds: new Set<string>() }; n.beds.add(e.bedId); footNodes.set(id, n); }
  const cell = (x: number, z: number) => `${Math.floor(x / LANE_JOIN)}:${Math.floor(z / LANE_JOIN)}`, grid = new Map<string, string[]>();
  for (const [id, n] of footNodes) { const k = cell(n.at[0], n.at[2]); grid.set(k, [...(grid.get(k) ?? []), id]); }
  const lanes = new Set<string>(); let laneIndex = 0;
  for (const [id, n] of footNodes) {
    const best = new Map<string, { id: string; d: number }>();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const other of grid.get(`${Math.floor(n.at[0] / LANE_JOIN) + dx}:${Math.floor(n.at[2] / LANE_JOIN) + dz}`) ?? []) {
      if (other === id) continue; const m = footNodes.get(other)!; if ([...m.beds].some(b => n.beds.has(b))) continue;
      const d = Math.hypot(m.at[0] - n.at[0], m.at[2] - n.at[2]); if (d > LANE_JOIN || Math.abs(m.at[1] - n.at[1]) > STEP) continue;
      for (const b of m.beds) if (!best.has(b) || best.get(b)!.d > d) best.set(b, { id: other, d });
    }
    for (const { id: other } of best.values()) {
      const key = [id, other].sort().join('|'); if (lanes.has(key)) continue; lanes.add(key);
      const mb = footNodes.get(other)!.beds, own = (r: Prism) => r.deck && r.bedIds.some(x => n.beds.has(x) || mb.has(x));
      const a = n.at, b = footNodes.get(other)!.at, len = Math.hypot(b[0] - a[0], b[2] - a[2]), steps = Math.max(1, Math.ceil(len / .25));
      let clear = true;
      for (let k = 0; k <= steps && clear; k++) { const c = mixPoint(a, b, k / steps); if (prisms.find(c[0], c[2]).some(r => !own(r) && r.quads.some(quad => inQuad(quad, c[0], c[2])) && planeAt(r.top, c[0], c[2]) > Math.max(a[1], b[1]) + STEP && planeAt(r.bottom, c[0], c[2]) < Math.max(a[1], b[1]) + BODY)) clear = false; }
      if (clear) open.push({ id: `lane:${laneIndex++}`, bedId: 'junction', from: id, to: other, points: [a, b], length: distance3(a, b), kind: 'walk', surface: 'plaza', halfWidth: 1, maxGrade: 0 });
    }
  }
  return { nodes: [...nodes.values()], edges: open, blocked };
}
/** R2-08: plan distance (eu) within which two same-height foot-bed nodes share one lane (walk half-width + a body). */
export const LANE_JOIN = 1.6;
/** W7-A (R3-119): plan reach (eu) past another foot bed's half-width within which a bed's end lands on it (a tee). */
export const TEE_REACH = .5;
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
  const rows: { id: string; target: number | readonly number[]; legs: JourneyLeg[]; reason?: string }[] = [];
  const target = m.journeys.targets_s;
  rows.push({ id: 'square→library by bicycle', target: target['square→library by bicycle'], legs: fromPlan('bicycle', walkPlan(graph, origin, door('library'), { speed: speed('bicycle'), bicycle: true, stepFree: true })) });
  // v1.7: the Green run ends at the manifest anchor (the Green's edge on Green Road).
  const greenAnchor = (m.journeys as unknown as { anchors?: Record<string, readonly number[]> }).anchors?.['square→green running'] ?? [1040, 1065];
  rows.push({ id: 'square→green running', target: target['square→green running'], legs: fromPlan('run', walkPlan(graph, origin, destination(greenAnchor), { speed: speed('run'), stepFree: true })) });
  const gondola = getLine('G1'), top = m.places.find(p => p.id === 'L02')!;
  // Both walks step-free: the square walk up to the gondola base (W5-A), the station walk to L02 (D-A3).
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
  return rows.map(row => { const lengthEu = row.legs.reduce((sum, l) => sum + l.lengthEu, 0), seconds = row.legs.length ? row.legs.reduce((sum, l) => sum + l.seconds, 0) : null; return { id: row.id, targetSeconds: row.target, lengthEu, lengthM: lengthEu / s, seconds, pass: seconds !== null && (typeof row.target === 'number' ? seconds <= row.target : seconds >= row.target[0]! && seconds <= row.target[1]!), legs: row.legs, ...(seconds === null ? { reason: 'No connected traversable path between the required anchors.' } : row.reason ? { reason: row.reason } : {}) }; });
}
export function yearWalkStretch(points: readonly Point3[], start: readonly number[], end: readonly number[]): Point3[] {
  if (points.length < 2) return [];
  const a = closestOnPolyline(points, start[0]!, start[1]!), b = closestOnPolyline(points, end[0]!, end[1]!), arcs = arcLengths(points);
  if (b.arc >= a.arc) return [a.point, ...points.filter((_, i) => arcs[i]! > a.arc && arcs[i]! < b.arc), b.point];
  return [a.point, ...points.filter((_, i) => arcs[i]! > a.arc), ...points.filter((_, i) => arcs[i]! < b.arc), b.point];
}
