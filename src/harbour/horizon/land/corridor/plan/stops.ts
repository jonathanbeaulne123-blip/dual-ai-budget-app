/**
 * Scenic stops (ROAD.md §4.7, brief §6): one to three pull-offs where the island offers a genuine view. The Crown
 * Lookout on R4 at the biggest visible drop to the sea (with the Year Walk nearby when it is); optionally one on R8
 * looking at the Bight Bridge and the lagoon, and one on R10/R11 by the water. Each is a 14 × 6 eu outline beside
 * the road on the view side (beyond a level footway where the Year Walk runs there), its entrance flush with the road,
 * placed only where the ground under it is already flat (≤ 8 % and within 0.3 eu of a plane). A site that would pass
 * after a small graded landing pad is returned as a proposal instead, with the pad the bake would add; nothing is
 * placed on ground that does not hold it.
 */
import type { Point2, Point3 } from '../../../world/definition.ts';
import type { CorridorStation, ScenicStop } from '../types.ts';
import type { Analysis } from './context.ts';
import { reachNumber } from './context.ts';
import { seaSide, nearestOnPolyline, type Env } from './env.ts';
import { sign, type SideName } from './frame.ts';
import { r3 } from './rng.ts';

export const STOP = Object.freeze({
  length: 14,
  depth: 6,
  maxSlope: 0.08,
  /** The entrance edge sits within this of the road surface (a flush entrance, no lip to build out). */
  flush: 0.35,
  /** Every sample of the outline lies within this of its fitted plane (flat, not merely tilted evenly). */
  rough: 0.3,
  /** No stop within this of a junction box, a mouth or a structure end. */
  clear: 20,
  structureClear: 40,
  walkReach: 25,
  apart: 200,
  /** The view: nothing within `viewNear` beyond the outline rises more than `viewEye` above the stop (it would hide the view). */
  viewNear: 40,
  viewFar: 80,
  viewEye: 1,
  /** A Year Walk footway beside the road may lie between the road and the stop only when it is this close to road level. */
  footwayFlush: 0.3,
  /** A site that fails the flat test but would pass after grading (a bake `landing` pad, walled on its drop side like a
   * viewpoint with its own wall, ROAD.md §2.5) is proposed, not placed, when its entrance is near road level and the
   * fill is modest. */
  gradeSlope: 0.4,
  gradeRough: 4,
  gradeFlush: 0.7,
});

export interface StopSpan { side: SideName; from: number; to: number }
export interface PlannedStop { stop: ScenicStop; span: StopSpan; s: number; reach: number }
/** A stop site that needs grading first: where a bake landing pad (centre, size, rotation) would make it pass. */
export interface StopProposal { label: string; slug: string; s: number; side: SideName; centre: Point3; size: Point2; rotationDegrees: number; slope: number; roughness: number; entrance: number; outline: Point2[]; connectsTo?: string[] }

interface Target { reaches: number[]; slug: string; label: string; required: boolean; score(c: Candidate): number | null }
interface Candidate { i: number; s: number; st: CorridorStation; side: SideName; o0: number; y: number; slope: number; rough: number; entrance: number; graded: boolean; view: number; walk: { id: string; d: number } | null; outward: Point2; waterEu: number | null; seaward: boolean }
type Verdict = { ok: Candidate } | { no: string };

/** Least-squares plane through samples (x, z, y): its slope |∇y| and the worst residual. */
export function planeFit(samples: readonly (readonly [number, number, number])[]): { slope: number; residual: number } {
  const n = samples.length; let sx = 0, sz = 0, sy = 0;
  for (const [x, z, y] of samples) { sx += x; sz += z; sy += y; }
  const mx = sx / n, mz = sz / n, my = sy / n;
  let xx = 0, xz = 0, zz = 0, xy = 0, zy = 0;
  for (const [x, z, y] of samples) { const dx = x - mx, dz = z - mz, dy = y - my; xx += dx * dx; xz += dx * dz; zz += dz * dz; xy += dx * dy; zy += dz * dy; }
  const det = xx * zz - xz * xz; if (Math.abs(det) < 1e-9) return { slope: 0, residual: 0 };
  const a = (xy * zz - zy * xz) / det, b = (zy * xx - xy * xz) / det;
  let residual = 0;
  for (const [x, z, y] of samples) residual = Math.max(residual, Math.abs(y - (my + a * (x - mx) + b * (z - mz))));
  return { slope: Math.hypot(a, b), residual };
}

/** The outline: five points along its road edge (offset o0), then five back along its far edge (o0 + depth). */
export function outlineAt(A: Analysis, s: number, side: SideName, o0: number): Point2[] {
  const F = A.frame, sg = sign(side), out: Point2[] = [];
  const along = [-STOP.length / 2, -STOP.length / 4, 0, STOP.length / 4, STOP.length / 2];
  for (const d of along) { const p = F.point(s + d, sg * o0); out.push([r3(p[0]), r3(p[2])]); }
  for (const d of [...along].reverse()) { const p = F.point(s + d, sg * (o0 + STOP.depth)); out.push([r3(p[0]), r3(p[2])]); }
  return out;
}

export function planStops(A: Analysis, env: Env, notes: string[], proposals: StopProposal[] = []): PlannedStop[] {
  if (A.id !== 'V01') return [];
  const F = A.frame, S = A.stations;
  const byReach = new Map<number, number[]>();
  S.forEach((st, i) => { const n = reachNumber(A.reachOf(st)); if (n !== null) { const l = byReach.get(n) ?? []; l.push(i); byReach.set(n, l); } });
  const bridge = A.structures.find(x => /bight/i.test(x.id));
  const bridgeAt = bridge ? F.point(F.runMid(bridge.run), 0) : null;

  const candidate = (i: number, side: SideName): Verdict => {
    const st = S[i]!, sd = st[side];
    if (st.structureId || st.median) return { no: 'structure' };
    if (sd.gap || A.inBox(st.s) || A.nearMouth(st.s, null, STOP.clear + STOP.length / 2)) return { no: 'gap' };
    for (const x of A.structures) {
      const a = Math.abs(F.delta(x.run.from, st.s)), b = Math.abs(F.delta(x.run.to, st.s));
      if (Math.min(a, b) < STOP.structureClear || A.structureAt(st.s)) return { no: 'structure' };
    }
    // Where a level footway runs beside the road the stop lies beyond it (the walk crosses its flush entrance).
    const fw = sd.footway;
    if (fw && Math.abs(fw.height - st.at[1]) > STOP.footwayFlush) return { no: 'footway' };
    const o0 = fw ? fw.outer : sd.paved;
    for (let d = -STOP.length / 2; d <= STOP.length / 2; d += 2) {
      const q = S[F.nearestIndex(st.s + d)]!, qs = q[side];
      if (q.structureId || qs.gap) return { no: 'gap' };
      if (!!qs.footway !== !!fw || (qs.footway && fw && Math.abs(qs.footway.outer - fw.outer) > 0.8)) return { no: 'footway' };
    }
    const sg = sign(side), samples: [number, number, number][] = [];
    let entrance = 0;
    for (let a = -STOP.length / 2; a <= STOP.length / 2 + 1e-6; a += STOP.length / 8) {
      const road = F.frameAt(st.s + a).at[1];
      for (let o = o0; o <= o0 + STOP.depth + 1e-6; o += STOP.depth / 4) {
        const p = F.point(st.s + a, sg * o), g = env.ground(p[0], p[2]);
        if (env.wet(p[0], p[2])) return { no: 'water' };
        if (o > o0 + 0.45 && env.occupied(p[0], p[2])) return { no: 'occupied' };
        samples.push([p[0], p[2], g]);
        if (o === o0) entrance = Math.max(entrance, Math.abs(g - road));
      }
    }
    const fit = planeFit(samples);
    const graded = entrance > STOP.flush || fit.slope > STOP.maxSlope || fit.residual > STOP.rough;
    if (entrance > STOP.gradeFlush) return { no: 'flush' };
    if (fit.slope > STOP.gradeSlope || fit.residual > STOP.gradeRough) return { no: 'slope' };
    // The view from the stop: outward (and 25° either way), unblocked within viewNear, the lowest ground or water seen.
    const f = F.frameAt(st.s), outward: Point2 = [f.right[0] * sg, f.right[1] * sg], y = st.at[1];
    const c = F.point(st.s, sg * (o0 + STOP.depth));
    let view = -Infinity, seaward = false;
    for (const turn of [-0.44, 0, 0.44]) {
      const dx = outward[0] * Math.cos(turn) - outward[1] * Math.sin(turn), dz = outward[0] * Math.sin(turn) + outward[1] * Math.cos(turn);
      let low = Infinity, blocked = false, wetHere = false;
      for (let d = 2; d <= STOP.viewFar; d += 2) {
        const x = c[0] + dx * d, z = c[2] + dz * d, wet = env.wet(x, z), g = wet ? 0 : env.ground(x, z);
        if (d <= STOP.viewNear && g > y + STOP.viewEye) { blocked = true; break; }
        if (wet) wetHere = true;
        low = Math.min(low, g);
      }
      if (!blocked) { view = Math.max(view, y - low); seaward = seaward || wetHere; }
    }
    if (!Number.isFinite(view)) return { no: 'view' };
    let walk: Candidate['walk'] = null;
    const m = F.point(st.s, sg * (o0 + STOP.depth / 2));
    for (const w of env.walks) { const n = nearestOnPolyline(w.points, m[0], m[2], STOP.walkReach + STOP.depth); if (n.d <= STOP.walkReach && (!walk || n.d < walk.d)) walk = { id: w.id, d: n.d }; }
    return { ok: { i, s: st.s, st, side, o0, y, slope: fit.slope, rough: fit.residual, entrance, graded, view, walk, outward, waterEu: sd.waterEu, seaward } };
  };

  const targets: Target[] = [
    // The Crown Lookout: the biggest visible drop to the sea on R4, the Year Walk close by.
    { reaches: [4], slug: 'crownLookout', label: 'Crown Lookout', required: true,
      score: c => (c.view < 6 || !c.seaward ? null : c.view + (c.walk ? 20 - c.walk.d / 2 : 0) - c.slope * 40) },
    // On the Bight Descent: a stop that looks at the Bight Bridge and the lagoon.
    { reaches: [8], slug: 'bightDescent', label: 'Bight Descent Lookout', required: false,
      score: c => {
        if (!bridgeAt) return null;
        const dx = bridgeAt[0] - c.st.at[0], dz = bridgeAt[2] - c.st.at[2], d = Math.hypot(dx, dz), cos = (dx * c.outward[0] + dz * c.outward[1]) / (d || 1);
        if (cos < 0.35 || d < 60 || d > 400 || c.view < 3) return null;
        return c.view + 30 * cos + (c.walk ? 10 : 0) - c.slope * 40;
      } },
    // By the water on Long Sands / Tideline: open water in view within 80 eu.
    { reaches: [10, 11], slug: 'longSandsShore', label: 'Long Sands Shore', required: false,
      score: c => (!c.seaward || c.side !== seaSide(c.st) ? null : 80 - (c.waterEu ?? 80) + c.view + (c.walk ? 15 - c.walk.d / 2 : 0) - c.slope * 40) },
  ];

  const out: PlannedStop[] = [];
  for (const t of targets) {
    let best: { c: Candidate; v: number } | null = null, graded: { c: Candidate; v: number } | null = null, looked = 0;
    const why = new Map<string, number>();
    for (const n of t.reaches) for (const i of byReach.get(n) ?? []) {
      for (const side of ['left', 'right'] as const) {
        looked++;
        const r = candidate(i, side);
        if ('no' in r) { why.set(r.no, (why.get(r.no) ?? 0) + 1); continue; }
        const c = r.ok;
        if (out.some(o => Math.abs(F.delta(o.s, c.s)) < STOP.apart)) { why.set('apart', (why.get('apart') ?? 0) + 1); continue; }
        const v = t.score(c);
        if (v === null) { why.set('no view', (why.get('no view') ?? 0) + 1); continue; }
        if (c.graded) {
          why.set('not flat', (why.get('not flat') ?? 0) + 1);
          // Rank a graded site by its view, then by how little grading it needs.
          const gv = v - c.slope * 60 - c.rough * 6 - c.entrance * 6;
          if (!graded || gv > graded.v + 1e-9) graded = { c, v: gv };
          continue;
        }
        if (!best || v > best.v + 1e-9) best = { c, v };
      }
    }
    if (!best) {
      const reasons = [...why.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k} ${v}`).join(', ');
      if (looked) notes.push(`${t.label} (R${t.reaches.join('/R')}) skipped: no ${STOP.length} × ${STOP.depth} eu outline is flat (≤ ${STOP.maxSlope * 100} %, within ${STOP.rough} eu of a plane, entrance within ${STOP.flush} eu of the road), clear and looking at the view (station-sides refused: ${reasons}).`);
      else if (t.required) notes.push(`${t.label}: the corridor has no R${t.reaches.join('/R')} stations.`);
      if (graded) {
        const { c } = graded, f = F.frameAt(c.s), centre = F.point(c.s, sign(c.side) * (c.o0 + STOP.depth / 2));
        const rot = (Math.atan2(f.tangent[1], f.tangent[0]) * 180) / Math.PI;
        proposals.push({ label: t.label, slug: t.slug, s: r3(c.s), side: c.side, centre: [r3(centre[0]), r3(c.y), r3(centre[2])], size: [STOP.length, STOP.depth], rotationDegrees: r3(rot),
          slope: r3(c.slope), roughness: r3(c.rough), entrance: r3(c.entrance), outline: outlineAt(A, c.s, c.side, c.o0), ...(c.walk ? { connectsTo: [c.walk.id] } : {}) });
        notes.push(`${t.label}: best site if graded — s ${c.s.toFixed(0)} ${c.side}${c.st[c.side].footway ? ' (beyond the footway)' : ''}, centre [${centre[0].toFixed(1)}, ${c.y.toFixed(1)}, ${centre[2].toFixed(1)}], today ${(c.slope * 100).toFixed(1)} % with ${c.rough.toFixed(2)} eu of relief and the entrance ${c.entrance.toFixed(2)} eu off the road; visible drop ${c.view.toFixed(1)} eu${c.walk ? `, ${c.walk.id} ${c.walk.d.toFixed(1)} eu away` : ''}. A ${STOP.length} × ${STOP.depth} landing pad at road height there (like the Terraces laybys, walled on its drop side) makes it pass.`);
      }
      continue;
    }
    const { c } = best, centre = F.point(c.s, sign(c.side) * (c.o0 + STOP.depth / 2));
    const stop: ScenicStop = {
      id: `${A.id}.stop.${t.slug}`, label: t.label, at: [r3(centre[0]), r3(c.y), r3(centre[2])],
      outline: outlineAt(A, c.s, c.side, c.o0), facing: r3(Math.atan2(c.outward[0], c.outward[1])),
      ...(c.walk ? { connectsTo: [c.walk.id] } : {}),
    };
    const span = { side: c.side, from: r3(F.wrapS(c.s - STOP.length / 2)), to: r3(F.wrapS(c.s + STOP.length / 2)) };
    out.push({ stop, span, s: c.s, reach: t.reaches[0]! });
    notes.push(`${t.label}: s ${c.s.toFixed(0)} ${c.side}${c.st[c.side].footway ? ' (beyond the footway)' : ''}, slope ${(c.slope * 100).toFixed(1)} %, visible drop ${c.view.toFixed(1)} eu${c.walk ? `, ${c.walk.id} ${c.walk.d.toFixed(1)} eu` : ', no walk within 25 eu'}.`);
  }
  return out;
}
