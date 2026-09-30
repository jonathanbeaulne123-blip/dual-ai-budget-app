/**
 * Arc-length frame over a corridor's stations: lookup by `s`, points at a lateral offset, runs of stations that
 * satisfy a predicate (closed loops wrap), and nearest-station queries. Pure; no terrain or scene imports.
 */
import type { Point2, Point3 } from '../../../world/definition.ts';
import type { CorridorSide, CorridorStation } from '../types.ts';

export type SideName = 'left' | 'right';
export const SIDES: readonly SideName[] = ['left', 'right'];
/** Lateral sign of a side: right is o > 0 (types.ts conventions). */
export const sign = (side: SideName): 1 | -1 => (side === 'right' ? 1 : -1);

/** A run of consecutive station indices [i0 … i1] (inclusive); on a closed corridor i1 may be < i0 (it wraps). */
export interface Run { i0: number; i1: number; from: number; to: number }

export class Frame {
  readonly n: number;
  readonly length: number;
  constructor(readonly stations: readonly CorridorStation[], readonly closed: boolean) {
    this.n = stations.length;
    const last = stations[this.n - 1]!, first = stations[0]!;
    this.length = closed ? last.s + Math.hypot(first.at[0] - last.at[0], first.at[2] - last.at[2]) : last.s;
  }
  st(i: number): CorridorStation { return this.stations[this.wrapIndex(i)]!; }
  wrapIndex(i: number): number { return this.closed ? ((i % this.n) + this.n) % this.n : Math.max(0, Math.min(this.n - 1, i)); }
  /** s normalised into [0, length) on a closed corridor, clamped on an open one. */
  wrapS(s: number): number { return this.closed ? ((s % this.length) + this.length) % this.length : Math.max(0, Math.min(this.length, s)); }
  /** Signed along-road distance b − a (shortest way round on a loop). */
  delta(a: number, b: number): number {
    let d = b - a;
    if (this.closed) { d = ((d % this.length) + this.length) % this.length; if (d > this.length / 2) d -= this.length; }
    return d;
  }
  /** Index of the last station with station.s ≤ s (after wrapping). */
  indexAt(s: number): number {
    const x = this.wrapS(s), S = this.stations;
    let lo = 0, hi = this.n - 1;
    if (x >= S[hi]!.s) return hi;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid]!.s <= x) lo = mid; else hi = mid; }
    return lo;
  }
  nearestIndex(s: number): number {
    const i = this.indexAt(s), a = this.st(i), b = this.st(i + 1);
    return Math.abs(this.delta(a.s, s)) <= Math.abs(this.delta(s, b.s)) ? i : this.wrapIndex(i + 1);
  }
  /** Interpolated centre, tangent and right normal at s. */
  frameAt(s: number): { at: Point3; tangent: Point2; right: Point2; i: number; t: number } {
    const x = this.wrapS(s), i = this.indexAt(x), a = this.st(i);
    const b = (this.closed || i < this.n - 1) ? this.st(i + 1) : a;
    const span = b === a ? 1 : (i === this.n - 1 ? this.length - a.s : b.s - a.s);
    const t = b === a ? 0 : Math.max(0, Math.min(1, (x - a.s) / (span || 1)));
    const at: Point3 = [a.at[0] + (b.at[0] - a.at[0]) * t, a.at[1] + (b.at[1] - a.at[1]) * t, a.at[2] + (b.at[2] - a.at[2]) * t];
    let tx = a.tangent[0] + (b.tangent[0] - a.tangent[0]) * t, tz = a.tangent[1] + (b.tangent[1] - a.tangent[1]) * t;
    const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    return { at, tangent: [tx, tz], right: [-tz, tx], i, t };
  }
  /** World xz of lateral offset o at s (y is the centreline surface). */
  point(s: number, o: number): Point3 {
    const f = this.frameAt(s);
    return [f.at[0] + f.right[0] * o, f.at[1], f.at[2] + f.right[1] * o];
  }
  /**
   * Arc length and signed lateral offset of a world point, searched over stations near `hint` (± `window` stations):
   * the nearest centreline segment wins, so a point on the inside of a bend is measured against the nearest road.
   */
  project(x: number, z: number, hint: number, window = 24): { s: number; o: number; d: number } {
    let best = { s: 0, o: 0, d: Infinity };
    const lo = this.closed ? hint - window : Math.max(0, hint - window), hi = this.closed ? hint + window : Math.min(this.n - 2, hint + window);
    for (let k = lo; k <= hi; k++) {
      if (!this.closed && k >= this.n - 1) break;
      const a = this.st(k), b = this.st(k + 1), dx = b.at[0] - a.at[0], dz = b.at[2] - a.at[2], l = dx * dx + dz * dz;
      const t = l ? Math.max(0, Math.min(1, ((x - a.at[0]) * dx + (z - a.at[2]) * dz) / l)) : 0;
      const px = a.at[0] + dx * t, pz = a.at[2] + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < best.d) {
        const len = Math.sqrt(l) || 1, o = ((x - px) * -dz + (z - pz) * dx) / len;
        best = { s: this.wrapS(a.s + t * len), o, d };
      }
    }
    return best;
  }
  side(i: number, side: SideName): CorridorSide { return this.st(i)[side]; }
  /** Maximal runs of stations satisfying `pred`. A closed loop's run through the seam is one run (i1 < i0). */
  runs(pred: (st: CorridorStation, i: number) => boolean): Run[] {
    const S = this.stations, ok = S.map(pred), out: Run[] = [];
    if (ok.every(Boolean)) return [{ i0: 0, i1: this.n - 1, from: 0, to: this.length }];
    let start = 0;
    if (this.closed) { while (ok[start]) start++; }
    for (let k = 0; k < this.n; k++) {
      const i = this.closed ? (start + k) % this.n : k;
      if (!ok[i]) continue;
      const prev = this.closed ? (i - 1 + this.n) % this.n : i - 1;
      if (prev >= 0 && ok[prev] && k > 0) continue;
      let j = i, c = 0;
      while (c < this.n - 1) { const nx = this.closed ? (j + 1) % this.n : j + 1; if (nx >= this.n || !ok[nx]) break; j = nx; c++; }
      out.push({ i0: i, i1: j, from: S[i]!.s, to: S[j]!.s });
    }
    return out.sort((a, b) => a.from - b.from);
  }
  /** Length of a run along the road (handles the seam). */
  runLength(r: Run): number { return this.closed && r.to < r.from ? this.length - r.from + r.to : r.to - r.from; }
  /** Mid s of a run. */
  runMid(r: Run): number { return this.wrapS(r.from + this.runLength(r) / 2); }
  /** Station indices of a run in order. */
  runIndices(r: Run): number[] { const out: number[] = []; for (let i = r.i0; ; i = this.wrapIndex(i + 1)) { out.push(i); if (i === r.i1 || out.length > this.n) break; } return out; }
  /** Split an [a, a + len] interval into non-wrapping [from, to] pieces (for MarkingRun). */
  pieces(a: number, len: number): [number, number][] {
    const from = this.wrapS(a);
    if (!this.closed || from + len <= this.length + 1e-6) return [[from, Math.min(this.closed ? this.length : this.length, from + len)]];
    return [[from, this.length], [0, from + len - this.length]];
  }
}
