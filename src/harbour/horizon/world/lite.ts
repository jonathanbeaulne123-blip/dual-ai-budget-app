/** Offline only: the runtime consumes the serialized indices and never imports meshoptimizer. */
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import type { StructureSolid } from '../land/interfaces.ts';
import type { District, WorldDefinition } from './definition.ts';
import { partitionWorldSolids } from './districts.ts';
import { simplifyPrismChains } from './prismLod.ts';

const ERROR_EU = .001, TARGET_RATIO = .85;
function bounds(positions: readonly number[], indices: readonly number[]): number[] {
  const out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const index of indices) for (let k = 0; k < 3; k++) { const p = positions[index * 3 + k]!; out[k] = Math.min(out[k]!, p); out[k + 3] = Math.max(out[k + 3]!, p); }
  return out;
}
/** Exact coordinate identity only; this does not merge close rails or move vertices. */
function weldIndices(solid: StructureSolid): number[] {
  const vertices = new Map<string, number>();
  return solid.indices.map(index => { const key = solid.positions.slice(index * 3, index * 3 + 3).join(','); let existing = vertices.get(key); if (existing === undefined) { existing = index; vertices.set(key, index); } return existing; });
}
function keepsComponents(before: readonly number[], after: readonly number[]): boolean {
  const parents = new Map<number, number>();
  const root = (v: number): number => { let parent = parents.get(v); if (parent === undefined) { parents.set(v, v); return v; } while (parent !== parents.get(parent)) parent = parents.get(parent)!; parents.set(v, parent); return parent; };
  for (let i = 0; i < before.length; i += 3) { const a = root(before[i]!), b = root(before[i + 1]!), c = root(before[i + 2]!); parents.set(b, a); parents.set(c, a); }
  const required = new Set(before.map(root)), retained = new Set(after.map(root));
  return [...required].every(id => retained.has(id));
}

/** Bounded render LOD; full vertices, indices, collision and authored rail components remain intact. */
export async function prepareLiteWorld(world: WorldDefinition, rawSolids?: readonly StructureSolid[]): Promise<WorldDefinition> {
  if (!world.geometry) return world;
  if (!rawSolids) await MeshoptSimplifier.ready;
  const records: NonNullable<NonNullable<WorldDefinition['geometry']>['simplification']>['solids'] = [];
  let changedSolids = 0, maxReportedErrorEu = 0, minWidthRatio = 1;
  const chainChunks = new Map<string, StructureSolid>(), chainErrors = new Map<string, number>();
  if (rawSolids) for (const raw of rawSolids) {
    const result = simplifyPrismChains(raw); if (!result.mergedPrisms) continue;
    minWidthRatio = Math.min(minWidthRatio, result.minWidthRatio);
    for (const chunk of partitionWorldSolids([result.solid])) { chainChunks.set(chunk.id, chunk); chainErrors.set(chunk.id, result.maxErrorEu); }
  }
  const solids = world.geometry.solids.map(solid => {
    if (rawSolids) {
      const lite = chainChunks.get(solid.id); if (!lite || lite.indices.length >= solid.indices.length) return solid;
      const oldBounds = bounds(solid.positions, solid.indices), newBounds = bounds(lite.positions, lite.indices), deviation = Math.max(...oldBounds.map((n, i) => Math.abs(n - newBounds[i]!))), error = chainErrors.get(solid.id)!;
      const reason = deviation > .1 ? 'district bounds changed beyond the corner error limit' : undefined;
      records.push({ id: solid.id, inputTriangles: solid.indices.length / 3, outputTriangles: reason ? solid.indices.length / 3 : lite.indices.length / 3, reportedErrorEu: error, boundsDeviationEu: deviation, accepted: !reason, ...(reason ? { reason } : {}) });
      if (reason) return solid;
      changedSolids++; maxReportedErrorEu = Math.max(maxReportedErrorEu, error);
      return { ...solid, litePositions: lite.positions, liteIndices: lite.indices, liteErrorEu: error };
    }
    // Authored rooms, buildings, markers and offshore silhouettes retain their original triangulation.
    if (!solid.bedIds.length || !['deck', 'floor', 'wall', 'rail', 'support'].includes(solid.role) || solid.indices.length < 72) return solid;
    const welded = weldIndices(solid), [result, error] = MeshoptSimplifier.simplify(new Uint32Array(welded), new Float32Array(solid.positions), 3, Math.floor(solid.indices.length * TARGET_RATIO / 3) * 3, ERROR_EU, ['ErrorAbsolute', 'LockBorder']);
    const indices = Array.from(result), oldBounds = bounds(solid.positions, solid.indices), newBounds = bounds(solid.positions, indices), deviation = Math.max(...oldBounds.map((n, i) => Math.abs(n - newBounds[i]!)));
    const reason = !Number.isFinite(error) || error > ERROR_EU ? 'reported error exceeds limit' : !Number.isFinite(deviation) || deviation > ERROR_EU ? 'bounds changed beyond limit' : !keepsComponents(welded, indices) ? 'a connected rail or structural component disappeared' : indices.length >= solid.indices.length ? 'topology or error limit prevented reduction' : undefined;
    records.push({ id: solid.id, inputTriangles: solid.indices.length / 3, outputTriangles: reason ? solid.indices.length / 3 : indices.length / 3, reportedErrorEu: error, boundsDeviationEu: deviation, accepted: !reason, ...(reason ? { reason } : {}) });
    if (reason) return solid;
    changedSolids++; maxReportedErrorEu = Math.max(maxReportedErrorEu, error);
    return { ...solid, liteIndices: indices, liteErrorEu: error };
  });
  const before = new Map(world.geometry.solids.map(s => [s.id, (s.liteIndices ?? s.indices).length / 3])), after = new Map(solids.map(s => [s.id, (s.liteIndices ?? s.indices).length / 3]));
  const update = (district: District): District => ({ ...district, ...(district.triangles ? { triangles: { full: district.triangles.full, lite: district.triangles.lite + (district.solidIds ?? []).reduce((sum, id) => sum + (after.get(id) ?? 0) - (before.get(id) ?? 0), 0) } } : {}), ...(district.children ? { children: district.children.map(update) } : {}) });
  const districts = world.districts.map(update), diagnostics = (world.diagnostics ?? []).filter(d => !d.id.startsWith('budget.'));
  for (const d of districts.flatMap(d => [d, ...(d.children ?? [])])) if (d.triangles && (d.triangles.full > 150000 || d.triangles.lite > 60000)) diagnostics.push({ id: `budget.${d.id}`, severity: 'conflict', message: `District triangle budget exceeded: full ${d.triangles.full}, lite ${d.triangles.lite}.` });
  return { ...world, districts, diagnostics, geometry: { ...world.geometry, solids, simplification: { method: rawSolids ? 'prism-chain' : 'meshopt', requestedErrorEu: rawSolids ? .1 : ERROR_EU, targetIndexRatio: rawSolids ? .25 : TARGET_RATIO, inputTriangles: solids.reduce((sum, s) => sum + s.indices.length / 3, 0), outputTriangles: solids.reduce((sum, s) => sum + (s.liteIndices ?? s.indices).length / 3, 0), changedSolids, maxReportedErrorEu, fullCollisionUnchanged: true, ...(rawSolids ? { maximumMergedPrisms: 4, minWidthRatio } : {}), solids: records } } };
}
