/**
 * Markings (ROAD.md §4.2): centre dash 3/6 on V01/VG/V03 outside junction boxes (structure decks keep them), centre
 * solid where the forward sight distance is under 60 eu and on a median nose approach, edge lines on shoulder sides,
 * give-way at a minor road's mouth, zebras at pedestrian crossings in developed/boulevard reaches. Restraint: no
 * markings on minor roads except the give-way, nothing inside a median, nothing on a road narrower than 5.
 */
import type { CorridorContext, MarkingKind, MarkingRun } from '../types.ts';
import { JUNCTION_BOX, type Analysis } from './context.ts';
import { SIDES, sign } from './frame.ts';
import { r3 } from './rng.ts';

export const MARK = Object.freeze({
  lineWidth: 0.12,
  dash: [3, 6] as const,
  /** Forward sight distance below which the centre line is solid (no overtaking on a blind curve or crest). */
  sight: 60,
  /** Eye and object heights for the crest test (a rider's eye; an oncoming rider's head). */
  eye: 1.1,
  object: 1.1,
  /** Lateral room either side of the centreline the sight line may use before the verge hides it. */
  sightClear: 2,
  noseApproach: 20,
  edgeInset: 0.2,
  /** Minimum length of a painted run (shorter solids fold into the dash, shorter dashes between solids become solid). */
  minSolid: 12,
  minDash: 18,
  minEdge: 8,
  giveWayWidth: 0.3,
  giveWayDash: [0.6, 0.3] as const,
  /** A give-way line sits this far in from the host's centreline (host paved half 5 + 0.5). */
  giveWayInset: 5.5,
  zebraLength: 3,
  zebraBars: [0.5, 0.5] as const,
});

type CentreState = 'none' | 'dash' | 'solid';

/** Forward sight distance from each station (eu, capped at MARK.sight + step): horizontal (curve) and vertical (crest). */
export function sightDistances(A: Analysis, dir: 1 | -1): number[] {
  const F = A.frame, S = A.stations, n = S.length, step = n > 1 ? F.length / (F.closed ? n : n - 1) : 2;
  const look = Math.ceil((MARK.sight + step) / step), out: number[] = new Array(n).fill(MARK.sight + step);
  for (let i = 0; i < n; i++) {
    if (!F.closed && (dir > 0 ? i + 1 >= n : i === 0)) { out[i] = Infinity; continue; }
    const a = S[i]!, lane = sign(dir > 0 ? 'right' : 'left') * Math.min(2, a.half / 2);
    const ex = a.at[0] - a.tangent[1] * lane, ez = a.at[2] + a.tangent[0] * lane, ey = a.at[1] + MARK.eye;
    let seen = MARK.sight + step;
    for (let k = 2; k <= look; k++) {
      const j = i + dir * k;
      if (!F.closed && (j < 0 || j >= n)) { seen = Infinity; break; }
      const b = F.st(j), tx = b.at[0], tz = b.at[2], ty = b.at[1] + MARK.object;
      const d = Math.abs(F.delta(a.s, b.s));
      let blocked = false;
      // The chord from eye to target must stay over the road (+ clearance) and above every surface between.
      for (let m = 1; m < k && !blocked; m++) {
        const c = F.st(i + dir * m), f = m / k;
        const px = ex + (tx - ex) * f, pz = ez + (tz - ez) * f, py = ey + (ty - ey) * f;
        const lat = (px - c.at[0]) * -c.tangent[1] + (pz - c.at[2]) * c.tangent[0];
        const room = Math.min(c.left.paved, c.right.paved) + MARK.sightClear;
        if (Math.abs(lat) > room && !(c.structureId && Math.abs(lat) <= Math.max(c.left.paved, c.right.paved) + MARK.sightClear)) blocked = true;
        if (py < c.at[1] + 0.05) blocked = true;
      }
      if (blocked) { seen = d; break; }
    }
    out[i] = seen;
  }
  return out;
}

const DEVELOPED: ReadonlySet<CorridorContext> = new Set(['developed', 'boulevard']);

export interface MarkingOptions { giveWayAt: readonly ('start' | 'end')[]; giveWayInset: number }

export function planMarkings(A: Analysis, opts: MarkingOptions): MarkingRun[] {
  const F = A.frame, S = A.stations, n = S.length, id = A.id, out: MarkingRun[] = [];
  const counters = new Map<MarkingKind, number>();
  const push = (kind: MarkingKind, from: number, len: number, offset: number, width: number, extra: Partial<MarkingRun> = {}) => {
    if (len <= 0.05) return;
    for (const [a, b] of F.pieces(from, len)) {
      if (b - a <= 0.05) continue;
      const k = counters.get(kind) ?? 0; counters.set(kind, k + 1);
      out.push({ id: `${id}.mark.${kind}.${k}`, kind, from: r3(a), to: r3(b), offset: r3(offset), width, ...extra });
    }
  };
  const halfStep = n > 1 ? F.length / (F.closed ? n : n - 1) / 2 : 1;
  const narrow = S.every(st => st.half * 2 < 5);

  // 1. Centre line (main roads only).
  if (A.main && !narrow) {
    const fwd = sightDistances(A, 1), back = sightDistances(A, -1);
    const nearGiveWay = (s: number) => (opts.giveWayAt.includes('start') && s - S[0]!.s < opts.giveWayInset + JUNCTION_BOX) ||
      (opts.giveWayAt.includes('end') && S[n - 1]!.s - s < opts.giveWayInset + JUNCTION_BOX);
    const state: CentreState[] = S.map((st, i) => {
      if (st.median || st.half * 2 < 5 || A.inBox(st.s) || (!F.closed && nearGiveWay(st.s))) return 'none';
      return Math.min(fwd[i]!, back[i]!) < MARK.sight ? 'solid' : 'dash';
    });
    // The approach to a median nose is solid for MARK.noseApproach.
    for (const r of F.runs(st => !!st.median)) {
      for (const [edge, dir] of [[r.from, -1], [r.to, 1]] as const) {
        for (let d = halfStep; d <= MARK.noseApproach; d += halfStep) { const i = F.nearestIndex(edge + dir * d); if (state[i] !== 'none') state[i] = 'solid'; }
      }
    }
    // Hysteresis: short solids fold into the dash; short dashes squeezed between solids become solid.
    const smooth = (target: CentreState, into: CentreState, min: number, needBoth: boolean) => {
      for (const r of F.runs((_, i) => state[i] === target)) {
        if (F.runLength(r) + 2 * halfStep >= min) continue;
        const before = state[F.wrapIndex(r.i0 - 1)], after = state[F.wrapIndex(r.i1 + 1)];
        if (needBoth ? before === into && after === into : before === into || after === into) for (const i of F.runIndices(r)) state[i] = into;
      }
    };
    smooth('solid', 'dash', MARK.minSolid, false);
    smooth('dash', 'solid', MARK.minDash, true);
    for (const kind of ['dash', 'solid'] as const) {
      for (const r of F.runs((_, i) => state[i] === kind)) {
        const whole = F.runLength(r) + 2 * halfStep >= F.length - 1e-6;
        // A run meets the neighbouring dash/solid run half-way between stations; it stops AT its last station where
        // the neighbour is unpainted (a junction box, a median, a narrow end), so no paint enters the box.
        const openBefore = state[F.wrapIndex(r.i0 - 1)] !== 'none' && (F.closed || r.i0 > 0);
        const openAfter = state[F.wrapIndex(r.i1 + 1)] !== 'none' && (F.closed || r.i1 < n - 1);
        const lead = openBefore ? halfStep : 0, trail = openAfter ? halfStep : 0;
        const from = whole ? 0 : r.from - lead, len = whole ? F.length : F.runLength(r) + lead + trail;
        push(kind === 'dash' ? 'centreDash' : 'centreSolid', from, len, 0, MARK.lineWidth, kind === 'dash' ? { dash: MARK.dash } : {});
      }
    }
  }

  // 2. Edge lines on shoulder sides (main roads), broken at every gap.
  if (A.main && !narrow) {
    for (const side of SIDES) {
      const q = (i: number) => Math.round((S[i]![side].paved - MARK.edgeInset) * 20) / 20;
      const ok = (i: number) => { const st = S[i]!, sd = st[side]; return sd.edge === 'shoulder' && !sd.gap && !st.structureId && st.half * 2 >= 5; };
      for (const r of F.runs((_, i) => ok(i))) {
        // Split where the offset changes (a widening), so each run carries one offset.
        let start = r.i0, prevQ = q(r.i0);
        const idx = F.runIndices(r);
        const flush = (a: number, b: number, off: number) => {
          const sa = S[a]!.s, raw = S[b]!.s - sa, len = raw < 0 ? raw + F.length : raw;
          if (len >= MARK.minEdge) push('edgeLine', sa, len, sign(side) * off, MARK.lineWidth);
        };
        for (let k = 1; k < idx.length; k++) { const i = idx[k]!, v = q(i); if (Math.abs(v - prevQ) > 0.05) { flush(start, idx[k - 1]!, prevQ); start = i; prevQ = v; } }
        flush(start, idx[idx.length - 1]!, prevQ);
      }
    }
  }

  // 3. Give-way across the approach lane at this road's own mouth(s).
  for (const end of opts.giveWayAt) {
    if (n < 2) break;
    const s = end === 'start' ? S[0]!.s + Math.min(opts.giveWayInset, F.length / 3) : S[n - 1]!.s - Math.min(opts.giveWayInset, F.length / 3);
    const st = S[F.nearestIndex(s)]!;
    // Traffic keeps right: arriving at the start one drives toward −s (its lane is o < 0); arriving at the end, o > 0.
    // A road under 6 wide is one shared lane: the line crosses all of it.
    const lane: [number, number] = st.half * 2 < 6 ? [-st.half, st.half] : end === 'start' ? [-st.half, 0] : [0, st.half];
    push('giveWay', s - MARK.giveWayWidth / 2, MARK.giveWayWidth, (lane[0] + lane[1]) / 2, MARK.giveWayWidth, { dash: MARK.giveWayDash, span: [r3(lane[0]), r3(lane[1])] });
  }

  // 4. Zebras at pedestrian crossings (developed / boulevard only; minor roads carry none).
  if (A.main) {
    const done: number[] = [];
    for (const m of A.mouths) {
      if (m.kind !== 'crossing') continue;
      // The station's own context decides (a developed junction box inside an open reach gets its zebra, ROAD §3 R5).
      const st = S[F.nearestIndex(m.s)]!, ctx = st.context === 'structure' ? A.reachOf(st)?.context ?? st.context : st.context;
      if (!DEVELOPED.has(ctx)) continue;
      if (done.some(s => Math.abs(F.delta(s, m.s)) < MARK.zebraLength + 2)) continue;
      done.push(m.s);
      const span: [number, number] = [-st.left.paved + 0.3, st.right.paved - 0.3];
      push('zebra', m.s - MARK.zebraLength / 2, MARK.zebraLength, (span[0] + span[1]) / 2, MARK.zebraLength, { dash: MARK.zebraBars, span: [r3(span[0]), r3(span[1])] });
    }
  }
  return out.sort((a, b) => a.from - b.from || a.id.localeCompare(b.id));
}
