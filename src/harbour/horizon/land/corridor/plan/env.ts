/** The plan's resolved environment: PlanEnv with every optional member filled in (plan.ts documents each). */
import type { Point3 } from '../../../world/definition.ts';
import type { CorridorStation } from '../types.ts';
import type { LowZone } from './context.ts';
import type { SideName } from './frame.ts';
import type {RoadLampSites,RoadLampFootCandidate} from './lampFootprint.ts';

export type StructureKind = 'bridge' | 'tunnel';
export interface Env {
  /** Measured setback using the planner's actual rounded candidates, beyond the paved edge. */
  lampSetback?(s:number,side:'left'|'right',sites:RoadLampSites):number|undefined;
  /** Exact final parapet-mounted foot must clear other routes, water and native keepouts. */
  lampMountAllowed?(lamp:RoadLampFootCandidate,side:'left'|'right'):boolean;
  lightBends?: readonly {from:number;to:number;apex:number}[];
  /** Required pool coverage, checked against real legal fixture sites after nominal spacing. */
  lightTargets?: readonly (readonly [number,number])[];
  ground(x: number, z: number): number;
  occupied(x: number, z: number, radius?: number, height?: number): boolean;
  wet(x: number, z: number): boolean;
  structureKind(id: string): StructureKind;
  walks: readonly { id: string; points: readonly Point3[] }[];
  lowZones: readonly LowZone[];
  destinations: readonly { id: string; at: readonly [number, number] }[];
  seed: number;
}

export const defaultStructureKind = (id: string): StructureKind => (/tunnel|gallery/i.test(id) ? 'tunnel' : 'bridge');

/** The side facing open water at a station (the smaller water distance), or null when neither side sees water. */
export function seaSide(st: CorridorStation): SideName | null {
  const l = st.left.waterEu, r = st.right.waterEu;
  if (l === null && r === null) return null;
  if (l === null) return 'right';
  if (r === null) return 'left';
  if (Math.abs(l - r) < 4) return null;
  return l < r ? 'left' : 'right';
}

/** The landward side at a station (opposite the sea; right when neither side sees water). */
export function landSide(st: CorridorStation): SideName {
  const sea = seaSide(st);
  return sea === 'right' ? 'left' : 'right';
}

/** Distance from (x, z) to a polyline in xz, with the nearest point's index (brute force over a bounding pre-check). */
export function nearestOnPolyline(points: readonly Point3[], x: number, z: number, within = Infinity): { d: number; i: number } {
  let best = Infinity, bi = -1;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    if (Math.min(a[0], b[0]) - within > x || Math.max(a[0], b[0]) + within < x || Math.min(a[2], b[2]) - within > z || Math.max(a[2], b[2]) + within < z) continue;
    const dx = b[0] - a[0], dz = b[2] - a[2], l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / l)) : 0;
    const d = Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
    if (d < best) { best = d; bi = i; }
  }
  return { d: best, i: bi };
}
