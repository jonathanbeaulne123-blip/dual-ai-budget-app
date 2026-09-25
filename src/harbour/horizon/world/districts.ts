import type { District, Point2, WorldDefinition } from './definition.ts';
import type { BedCut, StructureSolid, TerrainField } from '../land/interfaces.ts';
import { HORIZON_MANIFEST, requireScaleFactor } from './manifest.ts';
import { ellipse, pointInPolygon, solidBounds } from './geometry.ts';

/** Authored district hearts define a Voronoi partition; these are streaming bounds, never terrain discs. */
const hearts: Record<string, Point2> = { harbour: [1470, 1170], landing: [1060, 1410], reach: [1280, 1260], green: [1030, 1060], hollow: [985, 580], scholars: [765, 400], flats: [420, 685], bight: [745, 995], lakeside: [1130, 820], notch: [1205, 1070], prow: [1600, 780], crown: [1310, 470] };
function clip(poly: Point2[], nx: number, nz: number, limit: number): Point2[] {
  const out: Point2[] = [];
  for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!, da = a[0] * nx + a[1] * nz - limit, db = b[0] * nx + b[1] * nz - limit; if (da <= 0) out.push(a); if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
  return out;
}
export function districtAt(x: number, z: number, scale = requireScaleFactor()): string {
  let id = 'crown', distance = Infinity;
  for (const [key, p] of Object.entries(hearts)) { const d = Math.hypot(x - p[0] * scale, z - p[1] * scale); if (d < distance) { distance = d; id = key; } }
  return id;
}
/** Partition indexed triangles once offline; one long road cannot force its whole island mesh resident. */
export function partitionWorldSolids(solids: readonly StructureSolid[]): (StructureSolid & { sourceId: string })[] {
  const output: (StructureSolid & { sourceId: string })[] = [];
  for (const source of solids) {
    const chunks = new Map<string, { solid: StructureSolid & { sourceId: string }; vertices: Map<number, number> }>();
    const fixed = source.districtId === 'undercroft' || /^(underground\.|oreTunnel\.|oreSiding\.|seaPassage\.|deep\.skylight\.)/.test(source.id) ? 'undercroft' : /^(offshore\.|lamp\.|needle\.|stacks\.|wreck\.|sandbar\.)/.test(source.id) ? 'offshore' : null;
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
    return value;
  });
  const byId = new Map(districts.map(d => [d.id, d]));
  const u = m.underground.footprint, outline = ellipse(u.cx * s, u.cy * s, u.rx * s, u.ry * s);
  byId.get('crown')!.children = [{ id: 'undercroft', neighbourhood: 'crown', childOf: 'crown', outline, bounds: { id: 'undercroft', neighbourhood: 'crown', childOf: 'crown', outline, min: [1090 * s, 0, 280 * s], max: [1720 * s, 140 * s, 800 * s] }, solidIds: [], bedIds: [] }];
  for (const solid of solids) { const b = solidBounds(solid), owner = solid.districtId === 'undercroft' ? 'crown' : solid.districtId; const d = byId.get(owner) ?? byId.get(districtAt((b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2))!; d.solidIds!.push(solid.id); d.triangles!.full += solid.indices.length / 3; d.triangles!.lite += solid.indices.length / 3; d.drawCalls!++; if (solid.districtId === 'undercroft') d.children![0]!.solidIds!.push(solid.id); }
  for (const bed of beds) { const ids = new Set(bed.points.map(p => districtAt(p[0], p[2]))); for (const id of ids) byId.get(id)!.bedIds!.push(bed.id); if (bed.kind === 'cave' || bed.kind === 'rail') byId.get('crown')!.children![0]!.bedIds!.push(bed.id); }
  // These counts correspond to terrain tiles at the world's full/lite sample spacing.
  for (const [tier, stride] of [['full', 1], ['lite', Math.max(1, Math.round(10 * s / field.step))]] as const) {
    for (let z = 0; z < field.rows - 1; z += stride) for (let x = 0; x < field.columns - 1; x += stride) {
      const owner = byId.get(districtAt((x + stride / 2) * field.step, (z + stride / 2) * field.step))!;
      owner.triangles![tier] += 2;
    }
  }
  for (const d of districts) d.drawCalls! += d.id === 'offshore' ? 1 : 2;
  return districts;
}

export type DistrictResource = { dispose(): void };
export type StreamPosition = { x: number; z: number; now: number; mode?: 'walk' | 'look'; radius?: number };
/** Same delayed-release / one-build-per-frame algorithm as Mountain v2, with a hard residency cap. */
export function createDistrictStream<T extends DistrictResource>(world: Pick<WorldDefinition, 'districts'>, build: (district: District) => T, tier: 'full' | 'lite' = 'full') {
  const live = new Map<string, T>(), outsideSince = new Map<string, number>(), cap = tier === 'full' ? 4 : 3;
  let disposed = false, frame = 0;
  const history: { frame: number; time: number; mode: string; built: string[]; released: string[]; resident: string[]; pending: string[] }[] = [];
  const distance = (d: District, x: number, z: number) => { if (pointInPolygon(x, z, d.outline)) return 0; const b = d.bounds!; return Math.hypot(Math.max(b.min[0] - x, 0, x - b.max[0]), Math.max(b.min[2] - z, 0, z - b.max[2])); };
  return {
    live, history, cap,
    update(input: StreamPosition): boolean {
      if (disposed) return false;
      const desired = world.districts.filter(d => d.id !== 'offshore').map(d => ({ d, distance: distance(d, input.x, input.z) })).sort((a, b) => a.distance - b.distance || a.d.id.localeCompare(b.d.id)).filter((d, i) => i === 0 || d.distance <= (input.radius ?? (tier === 'full' ? 220 : 150))).slice(0, cap).map(d => d.d);
      // Offshore rocks may become a normal resident; permanent horizon cards belong to the sky ring.
      const offshore = world.districts.find(d => d.id === 'offshore');
      if (offshore && (input.x < 300 || input.x > 1720 || input.z > 1530)) { if (desired.length === cap) desired.pop(); desired.unshift(offshore); }
      const wanted = new Set(desired.map(d => d.id)), released: string[] = [], built: string[] = [];
      for (const [id, resource] of live) { if (wanted.has(id)) { outsideSince.delete(id); continue; } const since = outsideSince.get(id) ?? input.now; outsideSince.set(id, since); if (input.now - since >= 4000) { resource.dispose(); live.delete(id); outsideSince.delete(id); released.push(id); } }
      // Walk/Look only changes desired districts on a regular render frame. It cannot flush or build synchronously.
      if (live.size < cap) { const next = desired.find(d => !live.has(d.id)); if (next) { live.set(next.id, build(next)); built.push(next.id); } }
      const pending = desired.filter(d => !live.has(d.id)).map(d => d.id);
      history.push({ frame: frame++, time: input.now, mode: input.mode ?? 'walk', built, released, resident: [...live.keys()], pending });
      if (history.length > 600) history.shift();
      return built.length > 0 || released.length > 0 || pending.length > 0;
    },
    dispose() { if (disposed) return; disposed = true; for (const resource of live.values()) resource.dispose(); live.clear(); outsideSince.clear(); },
  };
}
