import type { BedCut, LandCuts, PadCut, XYZ } from '../interfaces';
import { distance, mix, nearestOnPath, plan } from '../structures/mesh';

/** Raise continuous approaches to the complete footprint of each junction.
 * The maximum of grade-limited cones retains the route's grade limit.
 * Never lower an existing road to one pad: an adjacent crossing may be higher. Existing
 * endpoints and separated structures are fixed constraints, never erased. */
export function gradePadApproaches(cuts: LandCuts, pads: readonly PadCut[] = cuts.pads, maxJoinDifference = .55): BedCut[] {
  const changed: BedCut[] = [];
  for (const bed of cuts.beds) {
    if (!bed.terrainCut || !['road', 'walk', 'trail', 'skate', 'boardwalk'].includes(bed.kind)) continue;
    const arcs = [0];
    for (let i = 1; i < bed.points.length; i++) arcs.push(arcs[i - 1]! + distance(plan(bed.points[i - 1]!), plan(bed.points[i]!)));
    const total = arcs.at(-1)!, closed = distance(plan(bed.points[0]!), plan(bed.points.at(-1)!)) < .01;
    const at = (along: number): XYZ => {
      along = Math.max(0, Math.min(total, along));
      let i = arcs.findIndex(a => a >= along); if (i <= 0) return bed.points[0]!;
      const a = bed.points[i - 1]!, b = bed.points[i]!, t = (along - arcs[i - 1]!) / (arcs[i]! - arcs[i - 1]!);
      return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
    };
    const limit = Math.min(.12, bed.maxGrade);
    type Level = { lo: number; hi: number; height: number; pad?: PadCut };
    const levels: Level[] = [{ lo: 0, hi: 0, height: bed.points[0]![1] }, { lo: total, hi: total, height: bed.points.at(-1)![1] }];
    bed.points.forEach((p, i) => { if (bed.terrainExclusions?.some(e => distance(plan(p), e.at) < e.radius)) levels.push({ lo: arcs[i]!, hi: arcs[i]!, height: p[1] }); });
    const delta = (a: Level, b: Level) => Math.max(0, a.lo - b.hi, b.lo - a.hi);
    for (const pad of pads.filter(p => p.kind === 'threshold' && !p.underground)) {
      const hit = nearestOnPath(plan(pad.centre), bed.points);
      if (hit.distance > Math.min(...pad.size) / 2 || Math.abs(hit.at[1] - pad.centre[1]) > maxJoinDifference) continue;
      // Circumscribed radius includes diagonal approaches and the body capsule.
      const radius = Math.hypot(...pad.size) / 2 + .65;
      const proposals = [hit.along, ...(closed && hit.along < radius ? [total] : []), ...(closed && total - hit.along < radius ? [0] : [])].map(along => ({ lo: Math.max(0, along - radius), hi: Math.min(total, along + radius), height: pad.centre[1], pad }));
      if (proposals.some(a => levels.filter(b => !b.pad).some(b => a.height - b.height > delta(a, b) * limit + .00001))) continue;
      levels.push(...proposals);
    }
    const junctions = levels.filter(l => l.pad);
    if (!junctions.length) continue;
    const samples = [...new Set([...arcs, ...junctions.flatMap(l => [l.lo, l.hi])])].sort((a, b) => a - b);
    const points = samples.map(along => {
      const p = at(along); let lo = p[1];
      for (const level of junctions) {
        const allowance = Math.max(0, level.lo - along, along - level.hi) * limit;
        lo = Math.max(lo, level.height - allowance);
      }
      return [p[0], lo, p[2]] as XYZ;
    });
    if (points.some((p, i) => i && Math.abs(p[1] - points[i - 1]![1]) > distance(plan(p), plan(points[i - 1]!)) * Math.max(limit, bed.maxGrade) + .0001)) continue;
    bed.points = points; changed.push(bed);
  }
  return changed;
}
