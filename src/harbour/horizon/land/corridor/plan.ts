/**
 * The corridor plan (ROAD.md §3–§5): from a corridor's stations and reaches to its markings, lamps, planting
 * groups and scenic stops. Pure and deterministic (same stations → same plan). Guard runs are NOT planned here:
 * they are geometry and collision (`guards.ts`).
 */
import type { CorridorReach, CorridorStation, LampSpot, MarkingRun, PlantingGroup, ScenicStop } from './types.ts';

export interface PlanInput { id: string; closed: boolean; step: number; stations: readonly CorridorStation[]; reaches: readonly CorridorReach[] }
export interface PlanEnv {
  /** Final baked ground height (terrain or walkable solid top) at x,z. */
  ground(x: number, z: number): number;
  /** True where a point is on or inside any bed or solid footprint that planting must avoid. */
  occupied?(x: number, z: number): boolean;
  /** Season-independent seed so re-bakes are byte-identical. */
  seed: string;
}
export interface CorridorPlan { markings: MarkingRun[]; lamps: LampSpot[]; planting: PlantingGroup[]; stops: ScenicStop[] }

/** Placeholder until the plan track lands: an empty plan. */
export function planCorridor(_input: PlanInput, _env: PlanEnv): CorridorPlan {
  return { markings: [], lamps: [], planting: [], stops: [] };
}
