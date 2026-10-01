/**
 * The corridor plan (ROAD.md §3–§5): from a corridor's stations and reaches to its markings, lamps, planting
 * groups and scenic stops. Pure and deterministic (same stations, reaches and seed → the same plan, byte for byte;
 * no Math.random). Guard runs are NOT planned here: they are geometry and collision (`guards.ts`).
 *
 * Order: stops first (their outlines and views constrain everything else), then markings, lamps (pairs at the stops)
 * and planting (kept off the stops' views). The helpers live in `corridor/plan/*`.
 */
import type { Point2, Point3 } from '../../world/definition.ts';
import type { CorridorReach, CorridorStation, LampSpot, MarkingRun, PlantingGroup, ScenicStop } from './types.ts';
import { Analysis, defaultLowZones, type LowZone } from './plan/context.ts';
import { defaultStructureKind, type Env, type StructureKind } from './plan/env.ts';
import { planLamps, type LitRun } from './plan/lamps.ts';
import type {RoadLampSites,RoadLampFootCandidate} from './plan/lampFootprint.ts';
export { LAMP } from './plan/lamps.ts';
/** How far from the centreline a destination may lie and still have its frontage lit. */
export const PLAN_DESTINATION_REACH = 45; // = DESTINATION_REACH in plan/lamps.ts
import { MARK, planMarkings } from './plan/markings.ts';
import { planPlanting } from './plan/planting.ts';
import { seedOf } from './plan/rng.ts';
import { planStops, type StopProposal, type PlannedStop } from './plan/stops.ts';

export interface PlanInput { id: string; closed: boolean; step: number; stations: readonly CorridorStation[]; reaches: readonly CorridorReach[] }
export interface PlanEnv {
  /** Measured setback using the planner's actual rounded candidates, beyond the paved edge. */
  lampSetback?(s:number,side:'left'|'right',sites:RoadLampSites):number|undefined;
  /** Exact final parapet-mounted foot must clear other routes, water and native keepouts. */
  lampMountAllowed?(lamp:RoadLampFootCandidate,side:'left'|'right'):boolean;
  /** Explicit sustained native bends, in plan metres; light both running lanes through each bend. */
  lightBends?: readonly {from:number;to:number;apex:number}[];
  /** Required pool coverage, checked against real legal fixture sites after nominal spacing. */
  lightTargets?: readonly (readonly [number,number])[];
  /** Final baked ground height (terrain or walkable solid top) at x,z. */
  ground(x: number, z: number): number;
  /** True where a point is on or inside any bed or solid footprint that planting must avoid. */
  occupied?(x: number, z: number, radius?: number, height?: number): boolean;
  /** Season-independent seed so re-bakes are byte-identical. */
  seed: string;
  /** Optional: true where (x, z) is open water (sea, lagoon, river, lake). Default: ground ≤ sea level 0 + 0.05. */
  water?(x: number, z: number): boolean;
  /** Optional: how a structure owns the road ('tunnel' → tunnel lamps on the wall; 'bridge' → bridge lanterns on the
   * rail). Default: ids containing tunnel / gallery / culvert are tunnels. */
  structureKind?(structureId: string): StructureKind;
  /** Optional: walk beds a scenic stop may join (`ScenicStop.connectsTo`), normally `[world.journey.yearWalk]`. */
  walks?: readonly { id: string; points: readonly Point3[] }[];
  /** Optional: discs where nothing taller than `maxHeight` grows. Default: MANIFEST `protected.green` (r 160, 0.85). */
  lowZones?: readonly { centre: Point2; radius: number; maxHeight: number }[];
  /** Optional: destinations beside the road (journey stations, host doors, parks) whose frontage gets a lantern pair
   * where the road is otherwise dark (brief §3: "destination entrances"; ROAD §3 R7's pair at station.jul). A
   * destination counts when it lies within `PLAN_DESTINATION_REACH` eu of the centreline. */
  destinations?: readonly { id: string; at: Point2 }[];
  /** Optional: which ends of THIS road are a minor road's mouth onto a host road (give-way painted across the arriving
   * lane MARK.giveWayInset eu in from that end, i.e. at the host's paved edge; no centre line within a junction box of
   * it). Default: V01 none (it is the host everywhere), VG both ends (it tees into V01 at both), V03 its start, every
   * other road its start (spurs and service roads are laid from their host junction outward). */
  /** Existing supported native stops participate in the same lamp and planting reservations. */
  authoredStops?: readonly ScenicStop[];
  giveWayAt?: readonly ('start' | 'end')[];
}
export interface CorridorPlan {
  markings: MarkingRun[]; lamps: LampSpot[]; planting: PlantingGroup[]; stops: ScenicStop[];
  /** Plain-language notes: stops skipped and why, where each stop landed. Bake diagnostics may carry them. */
  notes?: string[];
  /** Each stop's entrance on the road (side, s range) for the solids/guard tracks: a flush gap there, no kerb, no rail. */
  stopEntrances?: { stopId: string; side: 'left' | 'right'; from: number; to: number }[];
  /** Stops the island offers only after grading: the landing pad (centre, size, rotation) the bake would add for each.
   * With that pad baked, the next plan finds the ground flat and places the stop itself. */
  stopProposals?: StopProposal[];
  /** The lit runs (s ranges before the two fade-out lamps, with their regimes) the lamps were spaced for: the night
   * track may sequence a line of lamps by run (LIGHT §3). */
  litRuns?: LitRun[];
}

export function planCorridor(input: PlanInput, env: PlanEnv): CorridorPlan {
  const stations = input.stations;
  if (stations.length < 2) return { markings: [], lamps: [], planting: [], stops: [], notes: [], stopEntrances: [], stopProposals: [], litRuns: [] };
  const A = new Analysis(input.id, input.closed, stations, input.reaches);
  const E: Env = {
    ground: env.ground,
    lightBends:env.lightBends??[],
    lightTargets:env.lightTargets??[],
    lampSetback:env.lampSetback,
    lampMountAllowed:env.lampMountAllowed,
    occupied: env.occupied ?? (() => false),
    wet: env.water ?? ((x, z) => env.ground(x, z) <= 0.05),
    structureKind: env.structureKind ?? defaultStructureKind,
    walks: env.walks ?? [],
    lowZones: (env.lowZones as LowZone[] | undefined) ?? defaultLowZones(),
    destinations: env.destinations ?? [],
    seed: seedOf(`${env.seed}|${input.id}`),
  };
  const notes: string[] = [], proposals: StopProposal[] = [];
  const planned = planStops(A, E, notes, proposals);
  for(const stop of env.authoredStops??[]){
    let q={s:0,o:0,d:Infinity};for(let k=0;k<stations.length;k+=10){const p=A.frame.project(stop.at[0],stop.at[2],k,10);if(p.d<q.d)q=p;}
    const side=q.o<0?'left':'right',half=Math.max(1,...stop.outline.map(p=>Math.hypot(p[0]-stop.at[0],p[1]-stop.at[2])));
    planned.push({stop,s:q.s,span:{side,from:q.s-half,to:q.s+half},reach:0} satisfies PlannedStop);
  }
  const giveWayAt = env.giveWayAt ?? (input.id === 'V01' ? [] : input.id === 'VG' ? ['start', 'end'] as const : ['start'] as const);
  const markings = planMarkings(A, { giveWayAt, giveWayInset: MARK.giveWayInset });
  const litRuns: LitRun[] = [];
  const lamps = planLamps(A, E, planned, litRuns);
  const planting = planPlanting(A, E, planned);
  return {
    markings, lamps, planting, stops: planned.map(p => p.stop), notes,
    stopEntrances: planned.map(p => ({ stopId: p.stop.id, side: p.span.side, from: p.span.from, to: p.span.to })),
    stopProposals: proposals, litRuns,
  };
}
