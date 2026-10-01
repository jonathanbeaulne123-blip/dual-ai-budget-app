/**
 * Pass 5 (T1 Land): Horizon beds that ride Mountain v2's own geometry (D-M4/D-M5/D-M6).
 *
 * Inside v2's land the region draws v2's road, course and ground and answers ground and deck queries exactly (T2). A Horizon
 * bed laid on v2's geometry there is data for lines, shares, stones and proofs: it takes v2's heights, never cuts or fills the
 * baked ground and emits no deck, kerb or wall (`regionCarry`: a carried run plus a non-open-span exclusion at every point, the
 * same contract a bridge or tunnel stretch has). Outside v2's land (the Foot terrace, the apron, the Horizon) beds are the
 * Horizon's own as before.
 */
import type { BedCut, XY, XYZ } from '../interfaces';
import V2 from './v2-data.json';
import { bed } from '../beds/profiles';
import { mountainV2Rule } from './ground';

/** v2's mountain road as a Horizon bed (wheels ride it; the Year Walk and the Crown walk share it). */
export const MOUNTAIN_V2_ROAD_ID = 'mountainV2.road';
type Sample = { s: number; at: number[]; hw: number; support: string; bridge: string | null };
const samples = V2.road.samples as Sample[];
/** v2's road, foot → summit, every swept source section and exact height (Horizon space). */
export function mountainV2RoadPoints(): XYZ[] { return samples.map(p => [p.at[0]!, p.at[1]!, p.at[2]!] as XYZ); }
/** Arc length (v2's own `s`) of each road point, for footways that take a stretch of it. */
export function mountainV2RoadArcs(): number[] { return samples.map(p => p.s); }
export function mountainV2Road(): BedCut {
  const b = bed(MOUNTAIN_V2_ROAD_ID, 'road', mountainV2RoadPoints(), false);
  b.width = 2 * Math.max(...samples.map(p => p.hw)); b.shoulder = 0; b.maxGrade = .14; b.districtIds = ['crown'];
  regionCarry(b);
  return b;
}
/** v2's race course (summit start → the quay finish gate), exact Horizon-space points. */
export function mountainV2Course(): XYZ[] { return (V2.course.points as number[][]).map(p => [p[0]!, p[1]!, p[2]!] as XYZ); }
/** The course's own named segments (index ranges on `mountainV2Course`). */
export const MOUNTAIN_V2_SEGMENTS = V2.course.segments as { id: string; name: string; i0: number; i1: number; s0: number; s1: number }[];
/** A region-carried point excludes the bed's whole reach there (its section, shoulder and 15 m blend, plus a lattice step): the
 * bed sampler and the clearance cap test exclusions per query point, so a narrower circle let the blend beside a carried stretch
 * pull v2's ground toward the deck (the woodland bridges' decks filled the gorge by 40-50 eu on the first bake). */
export const regionCarryRadius = (b: Pick<BedCut, 'width' | 'shoulder' | 'blend'>): number => b.width / 2 + b.shoulder + Math.max(b.blend, 15) + 2;
/** Mark points [from, to] of a bed as carried by the region: no Horizon terrain cut, clearance cap, deck, edge or wall there. */
export function regionCarry(b: BedCut, from = 0, to = b.points.length - 1): void {
  const run: XY[] = [];
  for (let i = Math.max(0, from); i <= Math.min(to, b.points.length - 1); i++) {
    const p = b.points[i]!, xy: XY = [p[0], p[2]]; run.push(xy);
    (b.terrainExclusions ??= []).push({ at: xy, radius: regionCarryRadius(b) });
  }
  if (run.length > 1) (b.carried ??= []).push(run);
}
/** Carry every run of a bed that lies on v2's own land (its massif; not the Foot terrace, the apron or the Horizon). */
export function regionCarryLand(b: BedCut): number {
  let start = -1, carried = 0;
  const onLand = (p: XYZ) => mountainV2Rule(p[0], p[2]).kind === 'land';
  for (let i = 0; i <= b.points.length; i++) {
    const land = i < b.points.length && onLand(b.points[i]!);
    if (land && start < 0) start = i;
    if (!land && start >= 0) { regionCarry(b, Math.max(0, start - 1), Math.min(b.points.length - 1, i)); carried += i - start; start = -1; }
  }
  return carried;
}
/** A footway of v2's road: the road's stretch [fromS, toS] offset `offset` to the left (−) or right (+) of the uphill direction. */
export function mountainV2RoadFootway(offset: number, side: 'left' | 'right', fromS = 0, toS = Infinity): XYZ[] {
  const out: XYZ[] = [], sign = side === 'right' ? 1 : -1;
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i]!; if (p.s < fromS - 1e-6 || p.s > toS + 1e-6) continue;
    const a = samples[Math.max(0, i - 1)]!.at, c = samples[Math.min(samples.length - 1, i + 1)]!.at, dx = c[0]! - a[0]!, dz = c[2]! - a[2]!, l = Math.hypot(dx, dz) || 1;
    const q: XYZ = [p.at[0]! - dz / l * offset * sign, p.at[1]!, p.at[2]! + dx / l * offset * sign];
    // Inside a tight bend the offset line folds back over itself: keep only points that stand at the lane offset from the road.
    let near = Infinity; for (const r of samples) near = Math.min(near, Math.hypot(q[0] - r.at[0]!, q[2] - r.at[2]!));
    if (near < offset - .4) continue;
    out.push(q);
  }
  return out;
}
/** True when a plan point lies on Mountain v2's road (its carriageway + `margin`): a Horizon lane there takes v2's own grades
 * (up to 14 % on the road's first switchbacks), which the region owns; walk-grade checks skip it. */
export function onMountainV2Road(xy: XY, margin = 3): boolean {
  if (xy[0] < 1150 || xy[0] > 1470 || xy[1] < 440 || xy[1] > 740) return false;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!.at, b = samples[i]!.at, dx = b[0]! - a[0]!, dz = b[2]! - a[2]!, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((xy[0] - a[0]!) * dx + (xy[1] - a[2]!) * dz) / l2));
    if (Math.hypot(xy[0] - a[0]! - dx * t, xy[1] - a[2]! - dz * t) <= samples[i]!.hw + margin) return true;
  }
  return false;
}
/** The native dam-crest walk, west abutment → east abutment. This is route metadata for
 * the region-owned crest, not a new connection to the road. Native stairs and paths
 * remain in regionPathGraph; a nearest-road chord here had no drawn/supporting deck. */
export function mountainV2Promenade(): BedCut {
  const crest = V2.nativePlanning.walks.find(w => w.id === 'promenade:dam-crest');
  if (!crest) throw new Error('Mountain export is missing promenade:dam-crest');
  const points = crest.points.map(p => [p[0]!, p[1]!, p[2]!] as XYZ);
  const b = bed('walk mountainV2.promenade', 'walk', points, false);
  b.width = crest.halfWidth * 2; b.surface = 'paved'; b.districtIds = ['crown']; regionCarry(b);
  return b;
}
