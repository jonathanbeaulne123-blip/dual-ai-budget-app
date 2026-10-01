/** Exact placed road-lantern footprint; pure data, shared by candidate search and final acceptance. */
import type {Point2} from '../../../world/definition.ts';
import type {LampSpot} from '../types.ts';

export type RoadLampFootCandidate=Pick<LampSpot,'at'|'head'|'yaw'>;
export type RoadLampSites={
  /** The same station height used by the planner's ordinary road/guard mounting choice. */
  roadHeight:number;
  /** Uses the planner's actual interpolated frame and final millimetre rounding. */
  candidate(setback:number):RoadLampFootCandidate;
};
export type RoadLampFootEnvironment={
  ground(x:number,z:number):number;
  occupied?(x:number,z:number,radius?:number,height?:number):boolean;
  water?(x:number,z:number):boolean;
};
/** roadLantern's unchanged stone plinth is 0.4 x 0.4 m; retain the existing planner tolerance. */
export const ROAD_LAMP_FOOT_HALF=.2,ROAD_LAMP_FOOT_MAX_DELTA=.14;

/** Local +x follows at→head, exactly like kit/road/lamps.ts lampPlacement. */
export function roadLampFootprint(l:RoadLampFootCandidate):Point2[]{
  const dx=l.head[0]-l.at[0],dz=l.head[2]-l.at[2],length=Math.hypot(dx,dz);
  const ux=length>.3?dx/length:Math.sin(l.yaw),uz=length>.3?dz/length:Math.cos(l.yaw),points:Point2[]=[];
  for(const u of [-ROAD_LAMP_FOOT_HALF,0,ROAD_LAMP_FOOT_HALF])for(const v of [-ROAD_LAMP_FOOT_HALF,0,ROAD_LAMP_FOOT_HALF])
    points.push([l.at[0]+ux*u-uz*v,l.at[2]+uz*u+ux*v]);
  return points;
}
/** Clearance applies to the same nine points for ground posts and supported masonry mounts. */
export function roadLampFootClear(l:RoadLampFootCandidate,env:Pick<RoadLampFootEnvironment,'occupied'|'water'>):boolean{
  return [...l.at,...l.head,l.yaw].every(Number.isFinite)&&roadLampFootprint(l).every(([x,z])=>!env.occupied?.(x,z,0,6)&&!env.water?.(x,z));
}
export function roadLampFootSupported(l:RoadLampFootCandidate,env:RoadLampFootEnvironment):boolean{
  return roadLampFootClear(l,env)&&roadLampFootprint(l).every(([x,z])=>{
    const y=env.ground(x,z);
    return Number.isFinite(y)&&Math.abs(y-l.at[1])<=ROAD_LAMP_FOOT_MAX_DELTA;
  });
}
/** Same bounded search as before: no taller plinth, terrain change or tolerance waiver. */
export function selectSupportedRoadLampSetback(sites:RoadLampSites,env:RoadLampFootEnvironment,maxRoadStep:number):number|undefined{
  for(let back=.9;back<=5;back+=.25){
    const l=sites.candidate(back);
    if(Math.abs(l.at[1]-sites.roadHeight)>maxRoadStep)continue;
    if(roadLampFootSupported(l,env))return Math.round(back*1e6)/1e6;
  }
  return undefined;
}
