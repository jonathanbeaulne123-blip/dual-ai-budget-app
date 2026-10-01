/** D-MR: furniture and map over the region-owned road. Never a second road or guard mesh. */
import V2 from '../mountainV2/v2-data.json';
import type {Point2,Point3} from '../../world/definition';
import type {Corridor,CorridorReach,CorridorSide,CorridorStation,GuardKind} from './types';
import {createCorridorEnv,type CorridorEnv} from './stations';
import {planCorridor,LAMP,type PlanEnv} from './plan';
import {roadLampFootClear,selectSupportedRoadLampSetback} from './plan/lampFootprint';
import {nearestOnPath} from '../structures/mesh';
import {nativeOccupied,nativeWaterLevel,nativeWalks} from '../mountainV2/planning';
import {Frame} from './plan/frame';
import {selectLiteLamps} from './lights';
import {nativeScenicStops} from './nativeStops';
import {stopLayout} from '../../kit/road/stops';
import {CORRIDOR} from './types';

const SOURCE=V2.road.frames;
const r=(n:number)=>Math.round(n*1e6)/1e6;
const P=(p:readonly number[]):Point3=>[p[0]!,p[1]!,p[2]!];
const kind=(k:string):GuardKind=>k==='parapet'?'stoneParapet':k==='bridge'?'bridgeRail':k==='wall'?'retaining':'none';
const length=SOURCE.at(-1)!.s;
const reachSpec:readonly [number,string,string][]=[
  [0,'M4','Foot and lower switchbacks'],[260,'M5','Library Woods'],[445,'M6','Meadow sweep'],
  [618,'M7','Reservoir Heights'],[720,'M8','Alpine bends'],[890,'M-top','Summit Commons'],
];
export const MOUNTAIN_REACHES:CorridorReach[]=reachSpec.map(([from,id,label],i)=>({id,label,from,to:reachSpec[i+1]?.[0]??length,context:'mountain'}));

function frame(s:number){
  let i=0;while(i<SOURCE.length-2&&SOURCE[i+1]!.s<s)i++;
  const a=SOURCE[i]!,b=SOURCE[i+1]!,t=Math.max(0,Math.min(1,(s-a.s)/(b.s-a.s))),dx=b.at[0]!-a.at[0]!,dz=b.at[2]!-a.at[2]!,l=Math.hypot(dx,dz)||1;
  return {source:t<.5?a:b,at:a.at.map((v,k)=>r(v+(b.at[k]!-v)*t)) as unknown as Point3,tangent:[dx/l,dz/l] as Point2,half:a.half+(b.half-a.half)*t};
}
/** The same real-world occupancy and ground are passed by the bake and by tests. Native crowns,
 * reserved plots and edge runs join the ordinary bed/solid inventory; no false empty native lawn. */
export function mountainPlanEnvironment(env:CorridorEnv,destinations:NonNullable<PlanEnv['destinations']>):PlanEnv{
  const setbackCache=new Map<string,number|undefined>();
  let offRoad:CorridorEnv|undefined;
  const E:PlanEnv={lampSetback:(s,side,sites)=>{const key=`${r(s)}:${side}`;if(!setbackCache.has(key))setbackCache.set(key,selectSupportedRoadLampSetback(sites,E,LAMP.maxStep));return setbackCache.get(key);},ground:env.ground,water:(x,z)=>env.wet(x,z)||nativeWaterLevel(x,z,env.ground)!==null,seed:'mountain-road:1',giveWayAt:[],destinations,
    walks:[...env.cuts.beds.filter(b=>['walk','trail','boardwalk'].includes(b.kind)).map(b=>({id:b.id,points:b.points})),...nativeWalks],
    occupied:(x,z,radius=0,height=6)=>env.occupied(x,z)||nativeOccupied(x,z,env.ground,radius,height),
    lampMountAllowed:lamp=>{
      // A masonry mount may meet only its own road. Year Walk, S1, other beds,
      // pads and solids retain their existing occupancy widths and checks.
      offRoad??=createCorridorEnv({...env.cuts,beds:env.cuts.beds.filter(b=>b.id!=='mountainV2.road')},env.ground);
      return roadLampFootClear(lamp,{water:E.water,occupied:(x,z)=>offRoad!.occupied(x,z)||nativeOccupied(x,z,()=>lamp.at[1],0,6,'mountain-road')});
    },
  };
  return E;
}

/** Sustained bends, grouped by turning direction and short curvature gaps; endpoint derivative spikes are not bends. */
export function mountainBendTargets(){
  const groups:(typeof SOURCE[number])[][]=[];
  for(const f of SOURCE){
    if(f.s<20||f.s>length-20||Math.abs(f.curvature)<.025)continue;
    const last=groups.at(-1),previous=last?.at(-1);
    if(!previous||f.s-previous.s>12||f.curvature*previous.curvature<0)groups.push([f]);else last!.push(f);
  }
  return groups.flatMap((g,i)=>{
    const turn=g.slice(1).reduce((sum,f,k)=>sum+(Math.abs(f.curvature)+Math.abs(g[k]!.curvature))/2*(f.s-g[k]!.s),0);
    if(turn<.5)return[];
    const apex=g.reduce((a,b)=>Math.abs(a.curvature)>Math.abs(b.curvature)?a:b);
    return[{id:`mountain-bend-${i}`,s:apex.s,from:g[0]!.s,to:g.at(-1)!.s,turn,at:[apex.at[0]!,apex.at[2]!] as Point2}];
  });
}
/** Both riding lines through each bend, every source opening, and the route ends.
 * These targets derive from the same native frames as the full-tier lamp plan. */
export function mountainLightTargets(stations:readonly CorridorStation[]):Point2[]{
  const F=new Frame(stations,false),targets:Point2[]=[],lanes=(s:number)=>{const st=F.st(F.nearestIndex(s));for(const side of[-1,1]){const p=F.point(s,side*st.half/2);targets.push([p[0],p[2]]);}};
  for(const bend of mountainBendTargets()){lanes(bend.s);const n=Math.ceil((bend.to-bend.from)/.5);for(let i=0;i<=n;i++)lanes(bend.from+(bend.to-bend.from)*i/n);}
  for(const opening of V2.road.openings){const mid=(opening.s0+opening.s1)/2;const nearest=SOURCE.reduce((a,b)=>Math.abs(a.spatialS-mid)<Math.abs(b.spatialS-mid)?a:b);lanes(nearest.s);}
  lanes(0);lanes(length);return targets;
}

export function buildMountainCorridor(env:CorridorEnv,destinations:NonNullable<PlanEnv['destinations']>):Corridor|null{
  if(!env.cuts.beds.some(b=>b.id==='mountainV2.road'))return null;
  const E=mountainPlanEnvironment(env,destinations);
  const stations:CorridorStation[]=[],n=Math.ceil(length/2),step=length/n;
  for(let i=0;i<=n;i++){
    const s=step*i,f=frame(s),reach=MOUNTAIN_REACHES.find(r=>s>=r.from&&s<=r.to+1e-6)!,src=f.source;
    const side=(name:'left'|'right'):CorridorSide=>{
      const sg=name==='left'?-1:1,nx=-f.tangent[1]*sg,nz=f.tangent[0]*sg,x=f.at[0]+nx*(f.half+1.5),z=f.at[2]+nz*(f.half+1.5);
      const opening=V2.road.openings.find(o=>o.side===name&&src.spatialS>=o.s0-1&&src.spatialS<=o.s1+1);
      return {edge:src.bridge?'structure':'shoulder',guard:kind(src[name]),guardOffset:f.half,paved:f.half,drop:r(f.at[1]-env.ground(x,z)),waterEu:(env.wet(x,z)||nativeWaterLevel(x,z,env.ground)!==null)?1.5:null,
        ...(opening?{gap:opening.by==='junction'?'junction' as const:'entrance' as const}:{}),
        ...(!src.bridge?{planting:{inner:f.half+5,outer:f.half+14}}:{})};
    };
    stations.push({s:r(s),at:f.at,tangent:f.tangent,grade:src.grade,half:f.half,context:src.bridge?'structure':'mountain',reachId:reach.id,left:side('left'),right:side('right'),...(src.bridge?{structureId:`mountainV2:${src.bridge}`}:{})});
  }
  const stops=nativeScenicStops(env);
  const bends=mountainBendTargets();
  const plan=planCorridor({id:'mountainV2.road',closed:false,step,stations,reaches:MOUNTAIN_REACHES},{...E,authoredStops:stops,lightBends:bends.map(b=>({from:b.from,to:b.to,apex:b.s})),lightTargets:mountainLightTargets(stations),destinations:[...destinations,...stops.map(s=>({id:s.id,at:[s.at[0],s.at[2]] as Point2}))]});
  // Exactly the stop fixture condition and placement used by corridorArt. Its
  // independent lamp stays in both tiers, so it can cover the garden target.
  const stopPools=stops.flatMap(stop=>{const lamp=stopLayout(stop,env.ground).lamp;return lamp&&!plan.lamps.some(l=>Math.hypot(l.at[0]-lamp.at[0],l.at[2]-lamp.at[2])<6)?[{pool:lamp.at,poolRadius:CORRIDOR.lampPoolRadius}]:[];});
  // Mountain lights safety places, with dark stretches between them. The same
  // essential fixture set serves both tiers; lite subtracts secondary kit details,
  // not a required lamp. Other corridors keep their own full-tier lighting plans.
  const liteLampIds=selectLiteLamps(plan.lamps,[...mountainLightTargets(stations),...stops.map(s=>[s.at[0],s.at[2]] as Point2)],stopPools);
  const essential=new Set(liteLampIds),lamps=plan.lamps.filter(l=>essential.has(l.id));
  const project=(p:Point3)=>nearestOnPath([p[0],p[2]],stations.map(s=>s.at)).along;
  // The native meadow and summit already carry dense forest here (6–11 nearby
  // native trees per proposed addition). Keep the lower approach accents and
  // leave those upper clearings framed by their existing authored woodland.
  const planting=plan.planting.filter(g=>g.kind!=='framingTrees'||!['M6','M-top'].includes(g.reachId));
  return {id:'mountainV2.road',source:'mountain-v2',closed:false,step,stations,reaches:MOUNTAIN_REACHES,markings:[],lamps,liteLampIds,planting,stops,
    sourceBridges:V2.road.bridges.map(b=>({...b,axis:b.axis.map(P)})),
    guards:V2.road.guards.filter(g=>g.points.length>1).map(g=>({id:`mountainV2:${g.id}`,owner:'region',side:g.side as 'left'|'right',kind:kind(g.kind),from:project(P(g.points[0]!)),to:project(P(g.points.at(-1)!)),offset:4.8,height:g.height,line:g.points.map(P),ends:['continues','continues'],colliderId:`mountainV2:${g.id}`})),
  };
}
