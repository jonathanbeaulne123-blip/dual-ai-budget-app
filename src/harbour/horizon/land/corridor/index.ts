/**
 * The corridor build (ROAD.md §1): the LAST land step of the bake, after the final ground and the final bed points exist
 * (settleBedEdges, junction aprons, span pins, grounding and foundations). For every road-kind bed:
 *   stations (`buildCorridor`) → guard and retaining runs (`planGuards`) → the plan (`planCorridor`: markings, lamps,
 *   planting, scenic stops) → viewpoint gaps from the plan's stops → the corridor's solids (`buildCorridorSolids`).
 * `applyCorridors` then REPLACES each road bed's old strip and edge solids (`<road>.bed|surface|shoulders|kerbs|edges|
 * retaining|batter`) with the corridor's, adds the new sidewalk beds, and reports what it could not ground.
 * Pure and deterministic: the same cuts and ground give byte-identical corridors and solids.
 */
import type { BedCut, HeightQuery, LandCuts } from '../interfaces';
import type { Corridor, GuardRun } from './types';
import { planCorridor } from './plan';
import { planGuards } from './guards';
import { applyViewpointGaps, buildCorridor, createCorridorEnv, replacedBy, type CorridorCore, type StructureOwnership } from './stations';
import { buildCorridorSolids } from './solids';

export { CORRIDOR } from './types';
export type { Corridor } from './types';
export { buildCorridor, createCorridorEnv, detectStructureOwnership, replacedBy, REPLACED_PIECES, type CorridorCore, type CorridorEnv, type StructureOwnership } from './stations';
export { planGuards, guardNeed } from './guards';
export { buildCorridorSolids, CORRIDOR_SOLID_KINDS } from './solids';
export { V01_REACHES, resolveReaches, isCorridorRoad, isServiceRoad } from './reaches';

export interface CorridorBuildOptions {
  /** Which structure owns the road at a station. Default: `detectStructureOwnership(cuts)` (the built decks). L1's
   * ownership export is passed here once it lands. */
  ownership?: StructureOwnership;
  /** Seed for the plan (same seed → same plan). */
  seed?: string;
  /** Destinations beside the road whose frontage gets a lantern pair (`PlanEnv.destinations`): the bake passes
   * `corridorDestinations(cuts)` (world/build.ts), the same anchors the world publishes. Default: none. */
  destinations?: readonly { id: string; at: readonly [number, number] }[];
}
export interface CorridorBuild { corridors: Corridor[]; cores: CorridorCore[]; solids: LandCuts['solids']; walks: BedCut[]; replacedIds: string[] }

/** Stations, guards, plan and solids for every corridor road. Reads `cuts` and `ground`; changes nothing. */
export function buildCorridors(cuts: LandCuts, ground: HeightQuery, options: CorridorBuildOptions = {}): CorridorBuild {
  const env = createCorridorEnv(cuts, ground, options.ownership), corridors: Corridor[] = [], cores: CorridorCore[] = [], solids: LandCuts['solids'] = [], walks: BedCut[] = [];
  const yearWalk = cuts.beds.find(b => b.id === 'yearWalk'), walkBeds = yearWalk ? [{ id: yearWalk.id, points: yearWalk.points }] : [];
  for (const bed of env.roads) {
    const core = buildCorridor(bed, env);
    // A preliminary guard pass first, so the plan knows where rails will stand (a lantern over a drop is rail-mounted); then
    // the plan (its scenic stops open viewpoint gaps), then the guards again over the final gaps.
    planGuards(core, { ground });
    // The plan reads the bake's own environment (review of #575): the corridor's water test (held water above sea level
    // included), the Year Walk a scenic stop joins, and the destinations whose frontage is lit.
    const plan = planCorridor({ id: core.id, closed: core.closed, step: core.step, stations: core.stations, reaches: core.reaches }, { ground, occupied: env.occupied, water: env.wet, walks: walkBeds, destinations: options.destinations ?? [], seed: options.seed ?? `corridor:${core.id}` });
    applyViewpointGaps(core, plan.stops);
    for (const st of core.stations) for (const side of ['left', 'right'] as const) if (st[side].guard !== 'bridgeRail') st[side].guard = 'none';
    const guards: GuardRun[] = planGuards(core, { ground });
    const built = buildCorridorSolids(core, guards, env);
    solids.push(...built.solids); walks.push(...built.walks); cores.push(core);
    for (const u of clusters(built.unsupported)) cuts.diagnostics.push({ id: `corridor.${core.id}.unsupported.${u.n}`, severity: 'info', message: `${core.id}: the deck hangs up to ${u.depth.toFixed(2)} eu over the ground over ${u.count} stations (a span exclusion, water or a lower route under it: no skirt)`, at: u.at, measured: u.depth });
    for (const p of core.problems) cuts.diagnostics.push({ id: `corridor.${core.id}.reach`, severity: 'conflict', message: p });
    corridors.push({ id: core.id, closed: core.closed, step: core.step, stations: core.stations, reaches: core.reaches, markings: plan.markings, guards, lamps: plan.lamps, planting: plan.planting, stops: plan.stops });
  }
  const replaced = replacedBy(env.roads.map(r => r.id)), replacedIds = cuts.solids.filter(replaced).map(s => s.id);
  return { corridors, cores, solids, walks, replacedIds };
}
/** Replaces the road beds' old strip and edge solids with the corridor's and adds the sidewalk beds (in place). */
export function applyCorridors(cuts: LandCuts, build: CorridorBuild): void {
  const replaced = new Set(build.replacedIds);
  cuts.solids = [...cuts.solids.filter(s => !replaced.has(s.id)), ...build.solids];
  cuts.beds.push(...build.walks);
  cuts.diagnostics.push({ id: 'corridor.build', severity: 'info', message: `Corridors: ${build.corridors.length} road beds, ${build.corridors.reduce((n, c) => n + c.stations.length, 0)} stations, ${build.corridors.reduce((n, c) => n + c.guards.length, 0)} guard and wall runs, ${build.walks.length} sidewalk beds; ${build.replacedIds.length} old road-bed solids replaced by ${build.solids.length} corridor solids` });
}
/** Build and apply in one step (the bake's call). */
export function settleCorridors(cuts: LandCuts, ground: HeightQuery, options: CorridorBuildOptions = {}): CorridorBuild {
  const build = buildCorridors(cuts, ground, options); applyCorridors(cuts, build); return build;
}
function clusters(list: readonly { at: readonly [number, number]; depth: number }[]): { at: [number, number]; depth: number; count: number; n: number }[] {
  const out: { at: [number, number]; depth: number; count: number; n: number }[] = [];
  for (const u of list) { const c = out.find(o => Math.hypot(o.at[0] - u.at[0], o.at[1] - u.at[1]) < 12); if (c) { c.count++; c.depth = Math.max(c.depth, u.depth); } else out.push({ at: [u.at[0], u.at[1]], depth: u.depth, count: 1, n: out.length + 1 }); }
  return out;
}
