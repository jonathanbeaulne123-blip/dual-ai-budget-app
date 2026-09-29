/**
 * The slice of the Mountain v2 region the cable rides consume (pass 5 brief §2, T2's `regions/mountainV2/index.ts`):
 * `offset`, `rides.lines` (stations in Horizon space), `rides.createRide` (v2's `body/ride.ts`, native space) and
 * `rides.curve` (frames in Horizon space), plus the mounted scene's `setTransit`. Declared structurally here so the
 * movers never import the region's module (T2's `MountainV2Region` satisfies `CableRegion` as it stands).
 *
 * `fallbackCableRegion()` is the same contract built directly over v2's `body/ride.ts`, `body/geography.ts
 * transportCurve` and `mountain/transport.ts` with the one placement offset: the runtime uses it until a region is
 * connected (`connectCableRegion`), and the tests run on it standalone. No three, no DOM.
 */
import {createRide} from '../../../body/ride.ts';
import {transportCurve} from '../../../body/geography.ts';
import {TRANSPORT_LINES} from '../../../mountain/transport.ts';
import {MOUNTAIN_V2_OFFSET, toHorizonXYZ} from '../../regions/mountainV2/placement.ts';
import {CABLE_KINDS, type CableKind, type CableLines, type CableStation} from './route.ts';

export type CableFrame = {at:readonly [number,number,number]; yaw:number; pitch:number; cabin?:boolean};
export interface CableRegion {
  readonly offset:{readonly x:number; readonly y:number; readonly z:number};
  readonly rides:{
    lines:CableLines;
    /** v2's pure ride (native space): `pose()` + offset is the rider in Horizon space. */
    createRide:typeof createRide;
    /** The trip's frames in Horizon space (used for its length). */
    curve(kind:CableKind, from:number, to:number):readonly CableFrame[];
  };
}
/** The mounted region's cabin hook: the rider's cabin (Horizon space) while riding, null when none is ridden (cabins parked or on their own loop). */
export interface CableTransit { setTransit(cabin:{at:[number,number,number]; yaw:number; pitch:number}|null, kind:CableKind):void }

let fallback:CableRegion|null = null;
/** v2's own lines placed on the Horizon: exactly what T2's region publishes (same numbers + offset). */
export function fallbackCableRegion():CableRegion {
  if (fallback) return fallback;
  const lines = Object.fromEntries(CABLE_KINDS.map(kind => [kind, {stations:TRANSPORT_LINES[kind].stations.map((s):CableStation => ({id:s.id, name:s.name, at:toHorizonXYZ(s.platform.at), yaw:s.platform.yaw}))}])) as unknown as CableLines;
  fallback = {
    offset:MOUNTAIN_V2_OFFSET,
    rides:{
      lines, createRide,
      curve(kind, from, to) {
        const c = transportCurve(kind, from, to), n = Math.max(2, Math.ceil(c.length)), out:CableFrame[] = [];
        for (let i = 0; i <= n; i++) { const f = c.frame(c.length * i / n); out.push({at:toHorizonXYZ(f.at), yaw:f.yaw, pitch:f.pitch, cabin:f.aboard !== false}); }
        return out;
      },
    },
  };
  return fallback;
}

/** The trip's length along its frames (metres). */
export function curveLength(frames:readonly CableFrame[]):number {
  let length = 0;
  for (let i = 1; i < frames.length; i++) { const a = frames[i - 1]!.at, b = frames[i]!.at; length += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
  return length;
}
