/**
 * Shared reading of a corridor's stations for the plan (ROAD.md §3–§5): the gap runs ("mouths"), junction boxes,
 * sight triangles, structure runs and which reach style applies where. Pure; built once per `planCorridor` call.
 */
import type { Point2 } from '../../../world/definition.ts';
import { HORIZON_MANIFEST as M } from '../../../world/manifest.ts';
import type { CorridorGapKind, CorridorReach, CorridorStation } from '../types.ts';
import { CORRIDOR } from '../types.ts';
import { Frame, SIDES, type Run, type SideName, sign } from './frame.ts';

/** The three roads that carry centre lines (ROAD.md §4.2). */
export const MAIN_ROADS: ReadonlySet<string> = new Set(['V01', 'VG', 'V03']);
/** Mouths whose sight triangle a lamp post keeps out of (a crossing is lit, so its lamps stand at it). */
export const LAMP_SIGHT_KINDS: readonly CorridorGapKind[] = ['junction', 'entrance', 'layby'];
/** Junction box half-length beyond a junction gap (no centre dash inside). */
export const JUNCTION_BOX = 12;

/** A gap run on one side: a real opening in the kerb / guard / planting line. */
export interface Mouth { kind: CorridorGapKind; side: SideName; run: Run; s: number; half: number }

/** How far along the host (reach) and how deep behind the paved edge (depth) a sight zone reaches, per gap kind. */
const SIGHT: Partial<Record<CorridorGapKind, { reach: number; depth: number }>> = {
  junction: { reach: CORRIDOR.sightlineReach, depth: 6 },
  entrance: { reach: 25, depth: 4.5 },
  layby: { reach: 25, depth: 4.5 },
  crossing: { reach: 15, depth: 3 },
  threshold: { reach: 12, depth: 3 },
};

/** A reach style: V01's named reaches R1–R13 (ROAD.md §3), the Green Road, the Mountain Road, or a context fallback. */
export type Style = `R${number}` | 'VG' | 'V03' | 'minor' | `ctx:${CorridorStation['context']}`;

const LABEL_TO_R: readonly [RegExp, number][] = [
  [/harbour\s*gate/i, 1], [/prow\s*gallery/i, 2], [/prow\s*cliff/i, 3], [/crown/i, 4], [/scholar/i, 5], [/west\s*rise/i, 6],
  [/flats/i, 7], [/bight\s*descent/i, 8], [/bight\s*bridge/i, 9], [/long\s*sands/i, 10], [/tideline|campfire/i, 11], [/quay/i, 12], [/harbour\s*avenue/i, 13],
];
/** The ROAD.md §3 reach number of a V01 reach (from its id, e.g. `R4` / `V01.R4`, or its label), else null. */
export function reachNumber(reach: CorridorReach | undefined): number | null {
  if (!reach) return null;
  const m = /(?:^|[^A-Za-z0-9])R(\d{1,2})(?![0-9])/.exec(reach.id) ?? /^R(\d{1,2})$/.exec(reach.id);
  if (m) return Number(m[1]);
  for (const [re, n] of LABEL_TO_R) if (re.test(reach.label) || re.test(reach.id)) return n;
  return null;
}

/** A disc where nothing taller than `maxHeight` grows (STYLE rule 12: the Green's protected centre). */
export interface LowZone { centre: Point2; radius: number; maxHeight: number }
export function defaultLowZones(): LowZone[] {
  const g = M.protected.green, f = M.scale.factor;
  return [{ centre: [g.cx * f, g.cy * f], radius: g.r * f, maxHeight: 0.85 }];
}

export class Analysis {
  readonly frame: Frame;
  readonly main: boolean;
  readonly furnished: boolean;
  readonly mouths: Mouth[] = [];
  readonly boxes: [number, number][] = [];
  readonly structures: { run: Run; id: string }[] = [];
  private readonly reachById = new Map<string, CorridorReach>();

  constructor(readonly id: string, closed: boolean, readonly stations: readonly CorridorStation[], reaches: readonly CorridorReach[]) {
    this.frame = new Frame(stations, closed);
    this.main = MAIN_ROADS.has(id);
    this.furnished = this.main || id === 'mountainV2.road' || id === 'spur stillwater';
    for (const r of reaches) this.reachById.set(r.id, r);
    const F = this.frame;
    // Gap runs per side and kind.
    for (const side of SIDES) {
      const kinds = [...new Set(stations.map(s => s[side].gap).filter((g): g is CorridorGapKind => !!g))].sort();
      for (const kind of kinds) for (const run of F.runs(st => st[side].gap === kind)) {
        const len = F.runLength(run);
        this.mouths.push({ kind, side, run, s: F.runMid(run), half: len / 2 + CORRIDOR.step / 2 });
      }
    }
    this.mouths.sort((a, b) => a.s - b.s || (a.side < b.side ? -1 : 1));
    for (const m of this.mouths) if (m.kind === 'junction') this.boxes.push([m.s - m.half - JUNCTION_BOX, m.s + m.half + JUNCTION_BOX]);
    const ids = [...new Set(stations.map(s => s.structureId).filter((x): x is string => !!x))].sort();
    for (const sid of ids) for (const run of F.runs(st => st.structureId === sid)) this.structures.push({ run, id: sid });
    this.structures.sort((a, b) => a.run.from - b.run.from);
  }

  reachOf(st: CorridorStation): CorridorReach | undefined { return this.reachById.get(st.reachId); }

  style(st: CorridorStation): Style {
    if (this.id === 'V01') { const n = reachNumber(this.reachOf(st)); if (n) return `R${n}`; }
    if (this.id === 'VG') return 'VG';
    if (this.id === 'V03') return 'V03';
    if (!this.furnished) return 'minor';
    return `ctx:${st.context}`;
  }

  /** True when s lies inside a junction box (± JUNCTION_BOX of a junction gap). */
  inBox(s: number): boolean {
    for (const [a, b] of this.boxes) { const d = this.frame.delta(a, s); if (d >= 0 && d <= b - a) return true; }
    return false;
  }

  /** The nearest mouth on `side` (any kind unless given) and its along-road distance from s beyond the mouth's own half-length. */
  nearMouth(s: number, side: SideName | null, margin: number, kinds?: readonly CorridorGapKind[]): Mouth | null {
    for (const m of this.mouths) {
      if (side && m.side !== side) continue;
      if (kinds && !kinds.includes(m.kind)) continue;
      if (Math.abs(this.frame.delta(m.s, s)) <= m.half + margin) return m;
    }
    return null;
  }

  /**
   * True when something at (s, o) with footprint radius r would stand inside a sight zone: the triangle behind a
   * mouth between the minor road's set-back point and the host's edge `reach` eu along either way (ROAD.md §5).
   * Only the mouth's own side is a triangle (the far verge never hides the traffic a minor-road driver looks for).
   */
  inSight(s: number, o: number, r: number, kinds?: readonly CorridorGapKind[]): boolean {
    const side: SideName = o >= 0 ? 'right' : 'left';
    const i = this.frame.nearestIndex(s), paved = this.stations[i]![side].paved, depth = Math.abs(o) - paved - r;
    for (const m of this.mouths) {
      if (m.side !== side || (kinds && !kinds.includes(m.kind))) continue;
      const z = SIGHT[m.kind]; if (!z) continue;
      const d = Math.max(0, Math.abs(this.frame.delta(m.s, s)) - m.half - r);
      if (d <= z.reach && depth < z.depth * (1 - d / z.reach)) return true;
    }
    return false;
  }

  /** Structure run containing s, if any. */
  structureAt(s: number): { run: Run; id: string } | null {
    for (const x of this.structures) { const d = this.frame.delta(x.run.from, s); if (d >= -1e-6 && d <= this.frame.runLength(x.run) + 1e-6) return x; }
    return null;
  }

  /** Lateral sign of a side (re-exported for helpers). */
  sgn(side: SideName): 1 | -1 { return sign(side); }
}
