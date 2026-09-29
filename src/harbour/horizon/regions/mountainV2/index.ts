/**
 * Mountain v2 on the Horizon (pass 5, T2): the placed region. One object answers the Horizon runtime's questions inside
 * v2's footprint with v2's own numbers — ground, decks, ceilings, solids, the walk graph, the two rides — and mounts v2's
 * stripped-down scene (scene.ts) under one host group at `MOUNTAIN_V2_OFFSET`. Native in, offset out, everywhere.
 *
 * `contains(hx, hz)` is the drawn footprint (geography.ts has the rule); the runtime hides its terrain cells there
 * (`runtime/cards.ts buildTerrainSteps` `skip`) and registers `provider` with `runtime/geography.ts addDynamic`, which
 * then owns the ground there. Importing this module evaluates v2's definition (a top-level-await terrain fetch): the
 * runtime imports it dynamically, once the Horizon's assets are in hand.
 */
import type * as THREE from 'three';
import {SCENE_DRESSING,type PlaceDressing} from '../../../scene/place.ts';
import {finishBuild} from '../../../../house/world/buildTask.ts';
import {createRegionGeography,mouthExclusion,terraceBedExclusion,type RegionGeographyOptions,type RegionSurface} from './geography.ts';
import {regionPathGraph} from './graph.ts';
import {regionRides} from './rides.ts';
import {mountRegionSteps,type RegionScene,type RegionSeason,type RegionCabinPose} from './scene.ts';
import {MOUNTAIN_V2_OFFSET,MOUNTAIN_V2_FOOTPRINT} from './placement.ts';
import type {ExtraPathGraph} from '../../world/pathGraph.ts';

export {MOUNTAIN_V2_OFFSET,MOUNTAIN_V2_FOOTPRINT,mouthExclusion,terraceBedExclusion};
export type {RegionScene,RegionSurface,RegionCabinPose};
export const MOUNTAIN_V2_REGION_ID='mountainV2';

export type MountainV2RegionOptions=RegionGeographyOptions&{
  /** The Horizon terrain's cell size (`TerrainField.step`): the hidden-tile grid the ground mesh covers. Default 5. */
  terrainStep?:number;
};
export type MountainV2MountOptions={season?:RegionSeason;quiet?:boolean};
export interface MountainV2Region {
  id:typeof MOUNTAIN_V2_REGION_ID;
  offset:typeof MOUNTAIN_V2_OFFSET;
  footprint:typeof MOUNTAIN_V2_FOOTPRINT;
  /** Inside the drawn footprint (Horizon x, z). */
  contains(hx:number,hz:number):boolean;
  /** The Horizon terrain cell whose centre is (hx, hz) is hidden under the region's ground (= `contains` at the centre). */
  hidesTerrainCell(hx:number,hz:number):boolean;
  /** v2's exact ground (+ offset y); null outside. */
  groundAt(hx:number,hz:number):number|null;
  /** v2's floor (ground or deck: bridges, the dam crest, platforms, stairs, branches) at or under hy + step; null outside. */
  surface(hx:number,hy:number,hz:number,step:number):RegionSurface|null;
  /** v2's drawn solids and edge solids at a point (v2's `worldCollisionAt` shape). */
  blocked(hx:number,hy:number,hz:number,r:number):boolean;
  /** The lowest deck underside above hy; null when open sky (or outside). */
  ceiling(hx:number,hy:number,hz:number):number|null;
  /** The Horizon `DynamicGeography` (plus `owns` / `ground` / `waterLevel`), always live (tests, tools). */
  provider:ReturnType<typeof createRegionGeography>['provider'];
  /** PR #566 Codex: the provider the runtime registers with `geography.addDynamic`: decks, solids and ceilings only while
   *  `drawn()` (the region's scene is visible); ownership, ground and water always. */
  providerWhileDrawn(drawn:()=>boolean):ReturnType<typeof createRegionGeography>['provider'];
  /** PR #566 Codex: v2's reservoir and river surface at a Horizon point (+ offset y); null when dry or outside. */
  waterLevel(hx:number,hz:number):number|null;
  /** v2's walk graph in Horizon space, for `withExtraGraph` / `buildPathGraph(…, extraGraph)`. */
  pathGraph():ExtraPathGraph;
  rides:ReturnType<typeof regionRides>;
  /** Builds the scene at once (tests, tools). The runtime uses `mountSteps` (one builder per step). */
  mount(scene:THREE.Scene,tier:'full'|'lite',dressing:PlaceDressing,options?:MountainV2MountOptions):RegionScene;
  mountSteps(scene:THREE.Scene,tier:'full'|'lite',dressing:PlaceDressing,options?:MountainV2MountOptions):Generator<void,RegionScene,void>;
}
export function createMountainV2Region(options:MountainV2RegionOptions={}):MountainV2Region{
  const geo=createRegionGeography(options),terrainStep=options.terrainStep??5,rides=regionRides();
  // The ground mesh's triangle selection depends on the footprint; with a baked field it is this region's own.
  const groundCache=options.horizonGround?new Map():undefined;
  const mountSteps=(scene:THREE.Scene,tier:'full'|'lite',dressing:PlaceDressing,o:MountainV2MountOptions={})=>mountRegionSteps(scene,tier,dressing,{contains:geo.contains,terrainStep,season:o.season,quiet:o.quiet,groundCache,...(options.yield?.ceiling?{groundCeiling:options.yield.ceiling}:{})});
  return {
    id:MOUNTAIN_V2_REGION_ID,offset:MOUNTAIN_V2_OFFSET,footprint:MOUNTAIN_V2_FOOTPRINT,
    contains:geo.contains,hidesTerrainCell:geo.contains,groundAt:geo.groundAt,
    surface:(hx,hy,hz,step)=>geo.surface(hx,hy,hz,step),
    blocked:(hx,hy,hz,r)=>geo.blocked(hx,hy,hz,r),
    ceiling:geo.ceiling,provider:geo.provider,providerWhileDrawn:geo.whileDrawn,waterLevel:geo.waterLevel,
    pathGraph:regionPathGraph,rides,
    mount:(scene,tier,dressing,o)=>finishBuild(mountSteps(scene,tier,dressing,o)),
    mountSteps,
  };
}
/** The place dressing v2's palette is built from, per app theme (Classic, Taylor, Newfoundland). */
export function regionDressing(theme:'classic'|'taylor'|'newfoundland'):PlaceDressing{return SCENE_DRESSING[theme];}
