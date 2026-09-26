import type { StructureSolid } from '../land/interfaces.ts';
import type { Point3 } from './definition.ts';
import { districtAt } from './districts.ts';

const FACES = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
const ERROR = .1, JOIN = .15, CELL = .25;
const distance = (a: Point3, b: Point3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mix = (a: Point3, b: Point3, t: number): Point3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function lineDistance(p: Point3, a: Point3, b: Point3): number {
  const d = b.map((n, i) => n - a[i]!), t = Math.max(0, Math.min(1, d.reduce((sum, n, i) => sum + (p[i]! - a[i]!) * n, 0) / (d.reduce((sum, n) => sum + n * n, 0) || 1)));
  return distance(p, mix(a, b, t));
}
interface Prism { points: Point3[]; start: Point3; end: Point3; width: number; thickness: number; owner: string | null; eligible: boolean }
/** Only consecutive strip prisms qualify. Posts, route ends, gaps and district seams remain authored. */
export function simplifyPrismChains(source: StructureSolid): { solid: StructureSolid; maxErrorEu: number; mergedPrisms: number; minWidthRatio: number } {
  const unchanged = { solid: source, maxErrorEu: 0, mergedPrisms: 0, minWidthRatio: 1 };
  if (!source.bedIds.length || !['bed', 'shoulder', 'kerb', 'parapet', 'handrail', 'rail'].includes(source.kind) || source.positions.length % 24 || source.indices.length !== source.positions.length / 24 * 36) return unchanged;
  if (source.indices.some((value, i) => value !== Math.floor(i / 36) * 8 + FACES[i % 36]!)) return unchanged;
  const prisms: Prism[] = [];
  for (let offset = 0; offset < source.positions.length; offset += 24) {
    const points = Array.from({ length: 8 }, (_, i) => source.positions.slice(offset + i * 3, offset + i * 3 + 3) as unknown as Point3), start = mix(points[4]!, points[5]!, .5), end = mix(points[6]!, points[7]!, .5), width = distance(points[4]!, points[5]!), thickness = points[4]![1] - points[0]![1], owners = new Set(points.map(p => districtAt(p[0], p[2]))), len = Math.hypot(end[0] - start[0], end[2] - start[2]);
    const uniform = Math.abs(distance(points[6]!, points[7]!) - width) < .001 && [1, 2, 3].every(i => Math.abs(points[i + 4]![1] - points[i]![1] - thickness) < .001);
    prisms.push({ points, start, end, width, thickness, owner: owners.size === 1 ? [...owners][0]! : null, eligible: uniform && thickness > 0 && len > 1 && (source.role !== 'rail' || len > width * 4) });
  }
  const bucket = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`, starts = new Map<string, number[]>();
  prisms.forEach((p, i) => { if (p.eligible && p.owner) { const key = bucket(p.start[0], p.start[2]); (starts.get(key) ?? (starts.set(key, []), starts.get(key)!)).push(i); } });
  const used = new Set<number>(), positions: number[] = [], indices: number[] = []; let maxErrorEu = 0, mergedPrisms = 0, minWidthRatio = 1;
  for (let i = 0; i < prisms.length; i++) {
    if (used.has(i)) continue;
    const first = prisms[i]!, group = [first]; used.add(i); let last = first, groupError = 0, groupRatio = 1;
    while (first.eligible && first.owner && group.length < 4) {
      const candidates: { index: number; error: number; ratio: number; gap: number }[] = [];
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) for (const index of starts.get(bucket(last.end[0] + x * CELL, last.end[2] + z * CELL)) ?? []) {
        const next = prisms[index]!; if (used.has(index) || next.owner !== first.owner || Math.abs(next.width - first.width) > .001 || Math.abs(next.thickness - first.thickness) > .001) continue;
        const gap = Math.max(...[[3, 0], [2, 1], [7, 4], [6, 5]].map(([a, b]) => distance(last.points[a!]!, next.points[b!]!))); if (gap > JOIN) continue;
        // Every original corner must stay within the actual strip's four corresponding long edges.
        const ends = [[0, 3], [1, 2], [4, 7], [5, 6]], all = [...group, next]; let error = 0;
        for (const prism of all) {
          for (const [a, b] of ends) for (const v of [a!, b!]) error = Math.max(error, lineDistance(prism.points[v]!, first.points[a!]!, next.points[b!]!));
          error = Math.max(error, lineDistance(prism.start, first.start, next.end), lineDistance(prism.end, first.start, next.end));
        }
        // The interpolated cross-section width is a linear vector; minimize its norm analytically.
        const w = first.points[5]!.map((n, k) => n - first.points[4]![k]!), delta = next.points[6]!.map((n, k) => n - next.points[7]![k]! - w[k]!), denominator = delta.reduce((sum, n) => sum + n * n, 0), t = Math.max(0, Math.min(1, -w.reduce((sum, n, k) => sum + n * delta[k]!, 0) / (denominator || 1))), ratio = Math.hypot(...w.map((n, k) => n + delta[k]! * t)) / first.width;
        if (error <= ERROR && ratio >= .5) candidates.push({ index, error, ratio, gap });
      }
      candidates.sort((a, b) => a.gap - b.gap || a.index - b.index); const best = candidates[0]; if (!best) break;
      last = prisms[best.index]!; group.push(last); used.add(best.index); groupError = best.error; groupRatio = best.ratio;
    }
    const out = [first.points[0]!, first.points[1]!, last.points[2]!, last.points[3]!, first.points[4]!, first.points[5]!, last.points[6]!, last.points[7]!], n = positions.length / 3;
    out.forEach(p => positions.push(...p)); indices.push(...FACES.map(v => v + n)); mergedPrisms += group.length - 1; maxErrorEu = Math.max(maxErrorEu, groupError); minWidthRatio = Math.min(minWidthRatio, groupRatio);
  }
  return mergedPrisms ? { solid: { ...source, positions, indices }, maxErrorEu, mergedPrisms, minWidthRatio } : unchanged;
}
