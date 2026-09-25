/**
 * Hearth Mountain world definition — the one facade every other module reads.
 * Geography, navigation, recreation and maps share these units. See CONTRACT.md.
 *
 *   places.ts       districts, plots, building sites, plateaus, gorge water line, dam
 *   roadLine.ts     road and Orchard Lane alignments (plan waypoints + eased elevation)
 *   natural.ts      the landform primitives (massif, arms, spurs, noise, coast)
 *   terrainBase.ts  landform shaped around the roads + plateaus + reservoir hollow + gorge (baked)
 *   bridges.ts      bridge spans grown from the base ground
 *   transport.ts    funicular and gondola splines
 *   pathGraph.ts    the pedestrian network and routing
 *   benches.ts / terrain.ts / mountainGround.ts   exact benches → final ground (baked)
 *   roads.ts        road samples, edges, walls, bridges, dam overlook
 *   course.ts       Summit to Sea
 */
import {mountainGround} from './mountainGround.ts';
import {DISTRICTS,WORLD_BOUNDS,type District} from './places.ts';
import {MOUNTAIN_ROAD,TOWN_RACE_ROAD,SKILL_BRANCHES} from './course.ts';
import {MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,GORGE_BRIDGES,EDGE_RUNS,DAM_OVERLOOK} from './roads.ts';
import {PATH_EDGES,MOUNTAIN_PATH_GRAPH,DOOR_APRONS,OVERLOOKS} from './pathGraph.ts';
import {TRANSPORT_STOPS} from './transportAll.ts';
import {TRANSPORT_LINES} from './transport.ts';
import {ROAD_HALF_WIDTH} from './bridges.ts';
import {RIVER,BASIN,DAM,RESERVED_PLOTS,BUILDING_SITES,MOUNTAIN_VERSION,GEOGRAPHY_REVISION,TERRACES} from './places.ts';
import {clamp,mix,type Point3} from './math.ts';

export type {Point3} from './math.ts';
export {clamp,smooth} from './math.ts';
export {MOUNTAIN_VERSION,GEOGRAPHY_REVISION,WORLD_BOUNDS,DISTRICTS,RESERVED_PLOTS,BUILDING_SITES,BUILDING_FORMS,buildingDoor,buildingYaw,BASIN,DAM,RIVER,RIVER_HALF_WIDTH,TERRACES,
  RESERVOIR_BOWL,RESERVOIR_LEVEL_MAX,SUMMIT_OBSERVATORY_SITE,GOAL_PAVILION_SITE,type District,type ReservedPlot,type Biome,type MountainBuilding,type Terrace} from './places.ts';
export {MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,roadSampleAt,roadSampleAtPlan,GORGE_BRIDGES,EDGE_RUNS,EDGE_SOLIDS,EDGE_RULES,RETAINING_WALLS_ROAD,DAM_OVERLOOK,
  type RoadSample,type RoadLine,type EdgeKind,type SupportKind,type Bridge,type EdgeRun,type EdgeSolid,type RetainingWall} from './roads.ts';
export {ROAD_HALF_WIDTH} from './bridges.ts';
export {MOUNTAIN_ROAD,TOWN_RACE_ROAD,TOWN_LANE_HALF_WIDTH,CANAL_BRIDGE,SKILL_BRANCHES,RACE_FINISH,MOUNTAIN_COURSE_LENGTH,type SkillBranch,type BranchSegment} from './course.ts';
export {MOUNTAIN_PATH_GRAPH,DOOR_APRONS,OVERLOOKS,mountainWalkPlan,type PathNode,type PathEdge,type PathNodeKind,type PathEdgeKind,type WalkPlan,type DoorApron} from './pathGraph.ts';
export {FUNICULAR_STOPS,GONDOLA_STOPS,TRANSPORT_LINES,FUNICULAR_LINE,GONDOLA_LINE,transportSpline,type TransportLine,type TransportFrame,type TransportStation} from './transport.ts';
export {RESERVOIR,DAM_PARTS,KITTY_CHAMBERS} from './damParts.ts';
export {BRIDGES,TRANSPORT_CROSSINGS,type Crossing} from './crossings.ts';


export type RouteProjection={point:Point3;distance:number;index:number;t:number;gradientX:number;gradientZ:number};
type RouteIndex={cells:Map<string,number[]>;minX:number;maxX:number;minZ:number;maxZ:number};
const routeIndices=new WeakMap<object,RouteIndex>(),CELL=16;
function routeIndex(points:readonly Point3[]):RouteIndex{
  const cached=routeIndices.get(points);if(cached)return cached;
  const index:RouteIndex={cells:new Map(),minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!;
    for(let x=Math.floor(Math.min(a[0],b[0])/CELL);x<=Math.floor(Math.max(a[0],b[0])/CELL);x++)for(let z=Math.floor(Math.min(a[2],b[2])/CELL);z<=Math.floor(Math.max(a[2],b[2])/CELL);z++){
      const key=`${x}:${z}`,bucket=index.cells.get(key)??[];bucket.push(i);index.cells.set(key,bucket);
      index.minX=Math.min(index.minX,x);index.maxX=Math.max(index.maxX,x);index.minZ=Math.min(index.minZ,z);index.maxZ=Math.max(index.maxZ,z);
    }
  }routeIndices.set(points,index);return index;
}
/** Nearest point on a polyline (horizontal distance), with its interpolated height and slope. */
export function nearestOnRoute(x:number,z:number,points:readonly Point3[]=MOUNTAIN_ROAD):RouteProjection{
  let bestD=Infinity,bestI=1,bestT=0;
  const check=(i:number)=>{const a=points[i-1]!,b=points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz,t=clamp(((x-a[0])*dx+(z-a[2])*dz)/(l||1)),ex=x-a[0]-dx*t,ez=z-a[2]-dz*t,d=ex*ex+ez*ez;if(d<bestD){bestD=d;bestI=i;bestT=t;}};
  if(points.length<200){for(let i=1;i<points.length;i++)check(i);}
  else{
    const index=routeIndex(points),cx=Math.floor(x/CELL),cz=Math.floor(z/CELL),limit=Math.max(Math.abs(cx-index.minX),Math.abs(cx-index.maxX),Math.abs(cz-index.minZ),Math.abs(cz-index.maxZ));
    // Far landscape vertices must not expand hundreds of empty grid cells.
    const outside=Math.max(index.minX-cx,cx-index.maxX,index.minZ-cz,cz-index.maxZ);
    if(outside>2){for(let i=1;i<points.length;i++)check(i);}
    else for(let r=0;r<=limit;r++){
      for(let ix=cx-r;ix<=cx+r;ix++)for(let iz=cz-r;iz<=cz+r;iz++){if(r&&ix!==cx-r&&ix!==cx+r&&iz!==cz-r&&iz!==cz+r)continue;for(const i of index.cells.get(`${ix}:${iz}`)??[])check(i);}
      const border=Math.min(x-(cx-r)*CELL,(cx+r+1)*CELL-x,z-(cz-r)*CELL,(cz+r+1)*CELL-z);if(bestD<border*border)break;
    }
  }
  const a=points[bestI-1]!,b=points[bestI]!,dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz;
  return {point:[mix(a[0],b[0],bestT),mix(a[1],b[1],bestT),mix(a[2],b[2],bestT)],distance:Math.sqrt(bestD),index:bestI-1,t:bestT,gradientX:(b[1]-a[1])*dx/(l||1),gradientZ:(b[1]-a[1])*dz/(l||1)};
}
export const ROAD_LENGTH=MOUNTAIN_ROAD_LINE.length;
/** Legacy footpath list: every non-road edge of the path graph (trees, fixtures and art keep clear of these). */
export const FOOTPATHS:readonly {id:string;points:readonly Point3[];kind:string;halfWidth:number}[]=PATH_EDGES.map(e=>({id:e.id,points:e.points,kind:e.kind,halfWidth:e.halfWidth}));


export function districtAt(x:number,z:number):District|null{return DISTRICTS.reduce<District|null>((best,d)=>Math.hypot(x-d.at[0],z-d.at[2])<(best?Math.hypot(x-best.at[0],z-best.at[2]):Infinity)?d:best,null);}
/** Mountain ground (terrain only; decks, bridges and platforms are surfaces). Baked, bilinear, cheap. */
export function mountainBaseHeight(x:number,z:number):number{
  if(z>-48)return -.75;
  return mountainGround(x,z);
}
/** Land (or a deck) the body may stand on north of the harbour island. */
export function mountainContains(x:number,z:number):boolean{
  if(!(z<-48&&z>=WORLD_BOUNDS.minZ&&Math.abs(x)<=WORLD_BOUNDS.maxX-2))return false;
  if(mountainGround(x,z)>-.2)return true;
  return nearestOnRoute(x,z).distance<=ROAD_HALF_WIDTH+.3||nearestOnRoute(x,z,ORCHARD_LANE_LINE.samples.map(s=>s.at)).distance<=3.5||SKILL_BRANCHES.some(b=>nearestOnRoute(x,z,b.points).distance<=b.halfWidth+.3);
}
export const WORLD_DEFINITION={version:MOUNTAIN_VERSION,revision:GEOGRAPHY_REVISION,bounds:WORLD_BOUNDS,districts:DISTRICTS,reservedPlots:RESERVED_PLOTS,terraces:TERRACES,
  road:MOUNTAIN_ROAD,roadLine:MOUNTAIN_ROAD_LINE,lanes:[ORCHARD_LANE_LINE],bridges:GORGE_BRIDGES,edges:EDGE_RUNS,paths:FOOTPATHS,pathGraph:MOUNTAIN_PATH_GRAPH,doors:DOOR_APRONS,overlooks:OVERLOOKS,
  river:RIVER,basin:BASIN,dam:DAM,damOverlook:DAM_OVERLOOK,transport:TRANSPORT_STOPS,transportLines:TRANSPORT_LINES,buildings:BUILDING_SITES,townRace:TOWN_RACE_ROAD} as const;

export {TRANSPORT_STOPS,MONORAIL_STOPS,transportPoint,type TransportKind} from './transportAll.ts';
