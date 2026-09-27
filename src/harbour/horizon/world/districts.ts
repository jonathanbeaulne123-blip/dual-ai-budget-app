import type { District, Point2, WorldDefinition } from './definition.ts';
import type { BedCut, StructureSolid, TerrainField } from '../land/interfaces.ts';
import { HORIZON_MANIFEST, requireScaleFactor } from './manifest.ts';
import { ellipse, pointInPolygon, solidBounds } from './geometry.ts';

/** Authored district hearts define a Voronoi partition; these are streaming bounds, never terrain discs.
 * Bake time reads `MANIFEST.districts[*].heart` when the design lead adds it (requested), else this table;
 * the bake writes every heart into the definition (`District.heart`) and the runtime reads them from there
 * (`useDefinitionDistricts`), so the client never carries a second copy of the partition (R1-67). */
const AUTHORED_HEARTS: Record<string, Point2> = { harbour: [1470, 1170], landing: [1060, 1410], reach: [1280, 1260], green: [1030, 1060], hollow: [985, 580], scholars: [765, 400], flats: [420, 685], bight: [745, 995], lakeside: [1130, 820], notch: [1205, 1070], prow: [1600, 780], crown: [1310, 470] };
const manifestHearts = (): Record<string, Point2> => Object.fromEntries(HORIZON_MANIFEST.districts.filter(d => d.id !== 'offshore').map(d => [d.id, ((d as { heart?: Point2 }).heart ?? AUTHORED_HEARTS[d.id])!]));
let hearts: Record<string, Point2> = manifestHearts(), heartScale: number | null = null;
/** The runtime adopts the definition's partition (hearts in engine units). A definition without hearts (a stale bake) keeps the authored table. */
export function useDefinitionDistricts(districts: readonly Pick<District, 'id' | 'heart'>[]): boolean {
  const from = districts.filter(d => d.heart); if (!from.length) return false;
  hearts = Object.fromEntries(from.map(d => [d.id, d.heart!])); heartScale = 1; return true;
}
/** The island box outside which the offshore rocks stream (manifest units), and their streaming radius. */
const OFFSHORE_ISLAND_BOX: [Point2, Point2] = [[300, 0], [1720, 1530]];
/** Exact coincident faces within a solid are internal. No silhouette, support or rail is approximated. */
export function removeInternalFaces(source: StructureSolid): StructureSolid {
  const removed = new Set<number>(), faces = new Map<string, { offsets: number[]; normal: number[] }>();
  const point = (i: number) => source.positions.slice(i * 3, i * 3 + 3), key = (i: number) => point(i).join(',');
  const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  const sub = (a: number[], b: number[]) => a.map((v, k) => v - b[k]!);
  for (let i = 0; i < source.indices.length;) {
    const ids = source.indices.slice(i, i + 3), p = ids.map(point), normal = cross(sub(p[1]!, p[0]!), sub(p[2]!, p[0]!)); let count = 3, vertexKeys = new Set(ids.map(key));
    if (i + 5 < source.indices.length) {
      const next = source.indices.slice(i + 3, i + 6), candidate = new Set([...vertexKeys, ...next.map(key)]), q = next.map(point), nextNormal = cross(sub(q[1]!, q[0]!), sub(q[2]!, q[0]!));
      const samePlane = q.every(v => Math.abs(sub(v, p[0]!).reduce((sum, value, k) => sum + value * normal[k]!, 0)) <= 1e-10);
      if (candidate.size === 4 && samePlane && normal.reduce((sum, v, k) => sum + v * nextNormal[k]!, 0) > 0) { count = 6; vertexKeys = candidate; }
    }
    const faceKey = [...vertexKeys].sort().join('|'), previous = faces.get(faceKey), offsets = Array.from({ length: count }, (_, k) => i + k);
    if (previous) {
      const opposite = normal.reduce((sum, v, k) => sum + v * previous.normal[k]!, 0) < 0;
      for (const offset of offsets) removed.add(offset);
      if (opposite) for (const offset of previous.offsets) removed.add(offset);
    } else faces.set(faceKey, { offsets, normal });
    i += count;
  }
  if (!removed.size) return source;
  const positions: number[] = [], indices: number[] = [], remap = new Map<number, number>();
  source.indices.forEach((old, i) => { if (removed.has(i)) return; let n = remap.get(old); if (n === undefined) { n = positions.length / 3; remap.set(old, n); positions.push(...point(old)); } indices.push(n); });
  return { ...source, positions, indices };
}
function clip(poly: Point2[], nx: number, nz: number, limit: number): Point2[] {
  const out: Point2[] = [];
  for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!, da = a[0] * nx + a[1] * nz - limit, db = b[0] * nx + b[1] * nz - limit; if (da <= 0) out.push(a); if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
  return out;
}
export function districtAt(x: number, z: number, scale = requireScaleFactor()): string {
  let id = 'crown', distance = Infinity; const k = heartScale ?? scale;
  for (const [key, p] of Object.entries(hearts)) { const d = Math.hypot(x - p[0] * k, z - p[1] * k); if (d < distance) { distance = d; id = key; } }
  return id;
}
/** Partition indexed triangles once offline; one long road cannot force its whole island mesh resident. */
export function partitionWorldSolids(solids: readonly StructureSolid[]): (StructureSolid & { sourceId: string })[] {
  const output: (StructureSolid & { sourceId: string })[] = [];
  for (const original of solids) {
    const source = removeInternalFaces(original);
    const chunks = new Map<string, { solid: StructureSolid & { sourceId: string }; vertices: Map<number, number> }>();
    const fixed = source.districtId === 'undercroft' || /^(underground\.|oreTunnel\.|oreSiding\.|ORE\.|seaPassage\.|stepsPortage\.|jetty\.deep\.|deep\.skylight\.)/.test(source.id) ? 'undercroft' : /^(offshore\.|lamp\.|lampGallery\.|jetty\.lamp\.|threshold\.lampGallery\.|threshold\.lampDock\.|needle\.|stacks\.|wreck\.|sandbar\.)/.test(source.id) ? 'offshore' : null;
    for (let i = 0; i < source.indices.length; i += 3) {
      const indices = [source.indices[i]!, source.indices[i + 1]!, source.indices[i + 2]!], x = indices.reduce((sum, id) => sum + source.positions[id * 3]!, 0) / 3, z = indices.reduce((sum, id) => sum + source.positions[id * 3 + 2]!, 0) / 3, id = fixed ?? districtAt(x, z);
      let chunk = chunks.get(id);
      if (!chunk) { chunk = { solid: { ...source, id: `${source.id}@${id}`, sourceId: source.id, districtId: id, positions: [], indices: [] }, vertices: new Map() }; chunks.set(id, chunk); }
      for (const index of indices) { let mapped = chunk.vertices.get(index); if (mapped === undefined) { mapped = chunk.solid.positions.length / 3; chunk.vertices.set(index, mapped); chunk.solid.positions.push(source.positions[index * 3]!, source.positions[index * 3 + 1]!, source.positions[index * 3 + 2]!); } chunk.solid.indices.push(mapped); }
    }
    output.push(...[...chunks.values()].map(chunk => chunk.solid));
  }
  return output;
}
export function buildDistricts(field: TerrainField, beds: readonly BedCut[], solids: readonly StructureSolid[]): District[] {
  const m = HORIZON_MANIFEST, s = requireScaleFactor(), extent: Point2[] = [[0, 0], [2000 * s, 0], [2000 * s, 1800 * s], [0, 1800 * s]];
  const districts = m.districts.map(d => {
    let outline = extent;
    if (d.id !== 'offshore') { const p = hearts[d.id]!; for (const [id, q] of Object.entries(hearts)) if (id !== d.id) outline = clip(outline, (q[0] - p[0]) * s, (q[1] - p[1]) * s, ((q[0] ** 2 + q[1] ** 2) - (p[0] ** 2 + p[1] ** 2)) * s * s / 2); }
    const xs = outline.map(p => p[0]), zs = outline.map(p => p[1]);
    const value: District = { id: d.id, neighbourhood: d.neighbourhood, outline, bounds: { id: d.id, neighbourhood: d.neighbourhood, outline, min: [Math.min(...xs), -40 * s, Math.min(...zs)], max: [Math.max(...xs), 300 * s, Math.max(...zs)] }, solidIds: [], bedIds: [], triangles: { full: 0, lite: 0 }, drawCalls: 0 };
    if (d.id !== 'offshore') value.heart = [hearts[d.id]![0] * s, hearts[d.id]![1] * s];
    else value.offshore = { sites: m.offshore.flatMap(site => (Array.isArray(site.xy[0]) ? site.xy as number[][] : [site.xy as number[]]).map(p => [p[0]! * s, p[1]! * s] as Point2)), islandBox: [[OFFSHORE_ISLAND_BOX[0][0] * s, OFFSHORE_ISLAND_BOX[0][1] * s], [OFFSHORE_ISLAND_BOX[1][0] * s, OFFSHORE_ISLAND_BOX[1][1] * s]], arriveRadius: 80 * s };
    return value;
  });
  const byId = new Map(districts.map(d => [d.id, d]));
  const u = m.underground.footprint, outline = ellipse(u.cx * s, u.cy * s, u.rx * s, u.ry * s);
  const underground: District = { id: 'undercroft', neighbourhood: 'crown', childOf: 'crown', outline, bounds: { id: 'undercroft', neighbourhood: 'crown', childOf: 'crown', outline, min: [1090 * s, 0, 280 * s], max: [1720 * s, 140 * s, 800 * s] }, solidIds: [], bedIds: [], triangles: { full: 0, lite: 0 }, drawCalls: 0 };
  byId.get('crown')!.children = [underground];
  // drawCalls = the meshes the runtime's CardBuilder makes for this district (runtime/cards.ts): one terrain
  // ('flat') mesh and one solids ('card') mesh per 256-eu card cell the district touches. It was a solid count
  // (208 for a district the capture drew in 57 calls, R1-72).
  const solidCells = new Map<District, Set<string>>(), terrainCells = new Map<District, Set<string>>(), cell = (x: number, z: number) => `${Math.floor(x / CARD_CELL_EU)}:${Math.floor(z / CARD_CELL_EU)}`;
  for (const solid of solids) {
    const b = solidBounds(solid), d = solid.districtId === 'undercroft' ? underground : byId.get(solid.districtId) ?? byId.get(districtAt((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2))!; d.solidIds!.push(solid.id); d.triangles!.full += solid.indices.length / 3; d.triangles!.lite += solid.indices.length / 3;
    const cells = solidCells.get(d) ?? new Set<string>(); solidCells.set(d, cells);
    for (let i = 0; i < solid.indices.length; i += 3) { const a = solid.indices[i]! * 3, bb = solid.indices[i + 1]! * 3, c = solid.indices[i + 2]! * 3; cells.add(cell((solid.positions[a]! + solid.positions[bb]! + solid.positions[c]!) / 3, (solid.positions[a + 2]! + solid.positions[bb + 2]! + solid.positions[c + 2]!) / 3)); }
  }
  for (const bed of beds) { const ids = new Set(bed.points.map(p => districtAt(p[0], p[2]))); for (const id of ids) byId.get(id)!.bedIds!.push(bed.id); if (bed.kind === 'cave' || bed.kind === 'rail') byId.get('crown')!.children![0]!.bedIds!.push(bed.id); }
  // These counts correspond to terrain tiles at the world's full/lite sample spacing.
  for (const [tier, stride] of [['full', 1], ['lite', Math.max(1, Math.round(10 * s / field.step))]] as const) {
    for (let z = 0; z < field.rows - 1; z += stride) for (let x = 0; x < field.columns - 1; x += stride) {
      const owner = byId.get(districtAt((x + stride / 2) * field.step, (z + stride / 2) * field.step))!;
      owner.triangles![tier] += 2;
      if (tier === 'full') { const cells = terrainCells.get(owner) ?? new Set<string>(); terrainCells.set(owner, cells); cells.add(cell((x + .5) * field.step, (z + .5) * field.step)); }
    }
  }
  for (const d of [...districts, underground]) d.drawCalls = (solidCells.get(d)?.size ?? 0) + (d.childOf ? 0 : terrainCells.get(d)?.size ?? 0);
  return districts;
}

/** The district CardBuilder cell in runtime/cards.ts (`cell: 256`). */
export const CARD_CELL_EU = 256;
export type DistrictResource = { dispose(): void };
export type StreamPosition = { x: number; z: number; now: number; mode?: 'walk' | 'look'; radius?: number; underground?: boolean };
/** A camera move longer than this in one frame is a relocation (the plane covers < 1 eu per frame). */
export const RELOCATION_JUMP_EU = 50;
/** Same delayed-release / one-build-per-frame algorithm as Mountain v2, with a hard residency cap. */
/** R1-72: `ready(id)` false while a district's geometry chunk is still loading; the stream never builds it early (it stays
 * pending, and `request(id)` asks the loader for it), so a district's cards never go up without its solids. */
export interface DistrictStreamOptions { ready?: (districtId: string) => boolean; request?: (districtId: string) => void }
export function createDistrictStream<T extends DistrictResource>(world: Pick<WorldDefinition, 'districts'>, build: (district: District) => T, tier: 'full' | 'lite' = 'full', options: DistrictStreamOptions = {}) {
  const live = new Map<string, T>(), outsideSince = new Map<string, number>(), cap = tier === 'full' ? 4 : 3;
  let disposed = false, frame = 0, settling = false, last: { x: number; z: number } | null = null;
  const history: { frame: number; time: number; mode: string; built: string[]; released: string[]; resident: string[]; pending: string[] }[] = [];
  const distance = (d: District, x: number, z: number) => {
    if (pointInPolygon(x, z, d.outline)) return 0;
    // Voronoi districts have overlapping bounding boxes. Box distance alone
    // can evict the district containing the camera in favour of distant land.
    return Math.min(...d.outline.map((a,i)=>{const b=d.outline[(i+1)%d.outline.length]!,dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}));
  };
  return {
    live, history, cap,
    update(input: StreamPosition): boolean {
      if (disposed) return false;
      const desired = world.districts.filter(d => d.id !== 'offshore').map(d => ({ d, distance: distance(d, input.x, input.z) })).sort((a, b) => a.distance - b.distance || a.d.id.localeCompare(b.d.id)).filter((d, i) => i === 0 || d.distance <= (input.radius ?? (tier === 'full' ? 220 : 150))).slice(0, cap).map(d => d.d);
      if (input.underground) { const child = world.districts.find(d => d.id === 'crown')?.children?.find(d => d.id === 'undercroft'); if (child) { if (desired.length === cap) desired.pop(); desired.unshift(child); } }
      // Offshore rocks may become a normal resident; permanent horizon cards belong to the sky ring.
      // Offshore sites and the island box come from the definition (R1-67); a stale bake falls back to the manifest.
      const offshore = world.districts.find(d => d.id === 'offshore'), s = offshore?.offshore ? 1 : requireScaleFactor();
      const sites: Point2[] = offshore?.offshore?.sites ?? HORIZON_MANIFEST.offshore.flatMap(site => (Array.isArray(site.xy[0]) ? site.xy as number[][] : [site.xy as number[]]).map(p => [p[0]! * s, p[1]! * s] as Point2));
      const box = offshore?.offshore?.islandBox ?? [[OFFSHORE_ISLAND_BOX[0][0] * s, OFFSHORE_ISLAND_BOX[0][1] * s], [OFFSHORE_ISLAND_BOX[1][0] * s, OFFSHORE_ISLAND_BOX[1][1] * s]] as [Point2, Point2], arrive = offshore?.offshore?.arriveRadius ?? 80 * s;
      const outsideIsland = input.x < box[0][0] || input.x > box[1][0] || input.z > box[1][1];
      const nearOffshore = sites.some(p => Math.hypot(input.x - p[0], input.z - p[1]) <= (input.radius ?? (tier === 'full' ? 220 : 150)));
      if (offshore && (nearOffshore || outsideIsland)) {
        if (desired.length === cap) desired.pop();
        const atOffshore = sites.some(p => Math.hypot(input.x - p[0], input.z - p[1]) < arrive);
        // A distant skyline must never displace the ground under the camera.
        desired.splice(atOffshore || outsideIsland ? 0 : Math.min(1, desired.length), 0, offshore);
      }
      const wanted = new Set(desired.map(d => d.id)), released: string[] = [], built: string[] = [];
      for (const [id, resource] of live) { if (wanted.has(id)) { outsideSince.delete(id); continue; } const since = outsideSince.get(id) ?? input.now; outsideSince.set(id, since); if (input.now - since >= 4000) { resource.dispose(); live.delete(id); outsideSince.delete(id); released.push(id); } }
      // Release before build (R1-70): when a wanted district is waiting and the cap is full, the unwanted resident
      // that has been outside longest is released at once — for the camera's own district always (the ground under
      // the camera never waits for the 4 s grace), and for the rest of the neighbourhood while the stream settles
      // after a relocation (a jump of more than RELOCATION_JUMP_EU in one frame: a page shot, a restore). In place, a waiting neighbour
      // keeps the grace: a Walk/Look toggle changes the wanted radius (the page's radius_eu against the walking
      // 150/220), and on lite's three-district cap an at-once swap thrashed notch↔offshore on every toggle (P22 in
      // the browser: 10 builds on 10 toggles).
      for (const d of desired) if (!live.has(d.id) && options.ready && !options.ready(d.id)) options.request?.(d.id);
      const next = desired.find(d => !live.has(d.id) && (!options.ready || options.ready(d.id)));
      if (!last || Math.hypot(input.x - last.x, input.z - last.z) > RELOCATION_JUMP_EU) settling = true;
      last = { x: input.x, z: input.z };
      if (next && live.size >= cap && (next === desired[0] || settling)) {
        const victim = [...live.keys()].filter(id => !wanted.has(id)).sort((a, b) => (outsideSince.get(a) ?? input.now) - (outsideSince.get(b) ?? input.now) || a.localeCompare(b))[0];
        if (victim !== undefined) { live.get(victim)!.dispose(); live.delete(victim); outsideSince.delete(victim); released.push(victim); }
      }
      if (next && live.size < cap) { live.set(next.id, build(next)); built.push(next.id); }
      const pending = desired.filter(d => !live.has(d.id)).map(d => d.id);
      if (!pending.length) settling = false;
      history.push({ frame: frame++, time: input.now, mode: input.mode ?? 'walk', built, released, resident: [...live.keys()], pending });
      if (history.length > 600) history.shift();
      return built.length > 0 || released.length > 0 || pending.length > 0;
    },
    dispose() { if (disposed) return; disposed = true; for (const resource of live.values()) resource.dispose(); live.clear(); outsideSince.clear(); },
  };
}
