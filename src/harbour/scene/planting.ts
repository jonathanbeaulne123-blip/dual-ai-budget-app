import {MOUNTAIN_ROAD,TOWN_RACE_ROAD,nearestOnRoute} from '../mountain/definition.ts';
import {SKATE_SPOTS} from '../skate/park.ts';
import { VILLAGE_SITES, VILLAGE_WATERFRONT } from '../village/layout.ts';
import { HARBOUR_LANES, HARBOUR_WANDERS, distanceToTrail } from '../village/world.ts';

/** One deterministic planting plan is shared by terrain rendering and collision. */
export type KeepOutRect = { kind:'rect'; id:string; x:number; z:number; halfWidth:number; halfDepth:number; yaw:number };
export type KeepOutCircle = { kind:'circle'; id:string; x:number; z:number; r:number };
export type KeepOut = KeepOutRect | KeepOutCircle;
const rect=(id:string,x:number,z:number,halfWidth:number,halfDepth:number,yaw:number):KeepOutRect=>({kind:'rect',id,x,z,halfWidth,halfDepth,yaw});
const doorway=(id:string,x:number,z:number,yaw:number,door:readonly[number,number]):KeepOutCircle=>({
  kind:'circle',id,x:x+door[0]*Math.cos(yaw)+door[1]*Math.sin(yaw),z:z+door[1]*Math.cos(yaw)-door[0]*Math.sin(yaw),r:1.7,
});
export const ISLAND_KEEP_OUTS:readonly KeepOut[]=Object.freeze([
  ...SKATE_SPOTS.map(s=>rect(`skate-${s.id}`,s.x,s.z,s.halfWidth+1.5,s.halfDepth+1.5,0)),
  ...Object.values(VILLAGE_SITES).flatMap(site=>{
    const [x,z]=site.spot,yaw=Math.atan2(-x,-z);
    return [rect(site.entry,x,z,site.half[0]+.25,site.half[1]+.25,yaw),doorway(`${site.entry}-door`,x,z,yaw,site.door)];
  }),
  rect('campfire',...VILLAGE_WATERFRONT.spot,VILLAGE_WATERFRONT.half[0]+.25,VILLAGE_WATERFRONT.half[1]+.25,VILLAGE_WATERFRONT.yaw),
  doorway('campfire-door',...VILLAGE_WATERFRONT.spot,VILLAGE_WATERFRONT.yaw,VILLAGE_WATERFRONT.door),
  ...HARBOUR_WANDERS.map(wander=>({kind:'circle' as const,id:wander.id,x:wander.at[0],z:wander.at[1],r:4.5})),
]);

export function keepOutHit(x:number,z:number,clearance:number,keepOuts:readonly KeepOut[]=ISLAND_KEEP_OUTS):string|null{
  for(const keepOut of keepOuts){
    if(keepOut.kind==='circle'){
      if(Math.hypot(x-keepOut.x,z-keepOut.z)<=keepOut.r+clearance)return keepOut.id;
    }else{
      const c=Math.cos(keepOut.yaw),s=Math.sin(keepOut.yaw),dx=x-keepOut.x,dz=z-keepOut.z;
      if(Math.abs(dx*c-dz*s)<=keepOut.halfWidth+clearance&&Math.abs(dz*c+dx*s)<=keepOut.halfDepth+clearance)return keepOut.id;
    }
  }
  return null;
}

export type Plant={x:number;z:number;r:number;angle:number;size:number;spin:number};
export type PlantPlan={trees:Plant[];shrubs:Plant[]};
export const TREE_COUNT=Object.freeze({full:96,lite:64});
export const SHRUB_COUNT=72;
export const PLANT_ATTEMPTS=64;
export const treeClearance=(size:number):number=>size;
export const shrubClearance=(size:number):number=>.55*size;
export const trunkRadius=(size:number):number=>.16*(.8+size);

/** Groves have breathing room, while every door, trail and destination stays open. */
export function plantPlan(tier:'full'|'lite',keepOuts:readonly KeepOut[]=ISLAND_KEEP_OUTS):PlantPlan{
  const trees:Plant[]=[],shrubs:Plant[]=[];
  let seed = 0x7a11;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const sow=(count:number,plants:Plant[],spread:(size:number)=>number,isTree:boolean)=>{
    for(let slot=0;slot<count;slot++){
      for(let attempt=0;attempt<PLANT_ATTEMPTS;attempt++){
        const angle=rand()*Math.PI*2,r=14+Math.sqrt(rand())*(isTree?48:51);
        const size=isTree?1.1+rand()*1.2:.75+rand()*.9,spin=rand()*Math.PI;
        const x=Math.cos(angle)*r,z=Math.sin(angle)*r,clearance=spread(size);
        if(keepOutHit(x,z,clearance,keepOuts))continue;
        if(nearestOnRoute(x,z,MOUNTAIN_ROAD).distance<5.8+clearance||nearestOnRoute(x,z,TOWN_RACE_ROAD).distance<4.5+clearance)continue;
        if(HARBOUR_LANES.some(lane=>distanceToTrail(x,z,lane.points)<1.25+clearance))continue;
        if(plants.some(p=>Math.hypot(x-p.x,z-p.z)<clearance+spread(p.size)))continue;
        plants.push({x,z,r,angle,size,spin});break;
      }
    }
  };
  sow(TREE_COUNT[tier],trees,treeClearance,true);
  sow(SHRUB_COUNT,shrubs,shrubClearance,false);
  return {trees,shrubs};
}
