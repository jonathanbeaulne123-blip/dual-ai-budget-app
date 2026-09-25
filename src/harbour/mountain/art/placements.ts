/**
 * Where every free-standing mountain prop stands, as pure data (no three.js), so the
 * renderer and the tests read one answer. Each placement seats its foot on the ground at
 * its footprint: `bottom` is the lowest ground under the footprint less a small sink, so
 * nothing floats and nothing is buried (see test/mountain-art-kit.test.ts).
 */
import {groundHeightAt} from '../../scene/ground.ts';
import {DISTRICTS,RESERVED_PLOTS,MOUNTAIN_ROAD_LINE,ORCHARD_LANE_LINE,OVERLOOKS,TRANSPORT_LINES,MOUNTAIN_PATH_GRAPH,RIVER,type Point3,type District} from '../definition.ts';
import {PATH_EDGES} from '../pathGraph.ts';
import {MOUNTAIN_INTERACTIONS} from '../life.ts';
import {TOWN_SQUARE} from '../townSquare.ts';
import {RACE_FINISH} from '../course.ts';

export type PropKind='signpost'|'bench'|'lantern'|'gate'|'laundry'|'pennants'|'bollard'|'cairn'|'planter'|'waterwheel'|'bell'|'viewer'|'lectern'|'marker'|'woodpile'|'beehive';
export type PropPlacement={id:string;kind:PropKind;x:number;z:number;yaw:number;half:readonly [number,number];bottom:number;top:number;district?:string;label?:string;
  /** A second anchor (the far post of a line of pennants or laundry). */
  to?:readonly [number,number];};
export const PROP_SINK=.12;

export {footGround,corridorClearance} from './spots.ts';
import {footGround,corridorClearance,riverClearance as riverClear,downhillYaw,findSpot} from './spots.ts';
export function seat(id:string,kind:PropKind,x:number,z:number,yaw:number,hx:number,hz:number,height:number,extra:Partial<PropPlacement>={}):PropPlacement{
  const g=footGround(x,z,yaw,hx,hz),bottom=g.min-PROP_SINK;
  return {id,kind,x,z,yaw,half:[hx,hz],bottom,top:g.max+height,...extra};
}

type Line={samples:readonly {at:Point3;normal:Point3;halfWidth:number;tangent:Point3}[]};
/** Nearest road sample to a point (index into MOUNTAIN_ROAD_LINE). */
function nearestSample(x:number,z:number,line:Line=MOUNTAIN_ROAD_LINE){let best=0,d=Infinity;line.samples.forEach((s,i)=>{const e=Math.hypot(s.at[0]-x,s.at[2]-z);if(e<d){d=e;best=i;}});return {i:best,d};}

/** A spot beside a route (outside its edge by `off`), searched along the route for level, clear ground. */
function besideRoute(line:Line,i0:number,side:1|-1,off:number,half:number,span=14):{x:number;z:number;yaw:number}|null{
  let best:{x:number;z:number;yaw:number;score:number}|null=null;
  for(let k=-span;k<=span;k++){const s=line.samples[Math.max(0,Math.min(line.samples.length-1,i0+k))]!;
    const o=s.halfWidth+off,x=s.at[0]+s.normal[0]*o*side,z=s.at[2]+s.normal[2]*o*side,g=footGround(x,z,0,half,half);
    if(Math.abs(g.min-s.at[1])>1.2||corridorClearance(x,z)<half+.25)continue;
    const score=(g.max-g.min)+Math.abs(k)*.02;if(!best||score<best.score)best={x,z,yaw:Math.atan2(-s.normal[0]*side,-s.normal[2]*side),score};}
  return best;
}

let cache:readonly PropPlacement[]|null=null;
/** Every free-standing prop on the mountain and in the town square, deterministic. */
export function mountainProps():readonly PropPlacement[]{
  if(cache)return cache;
  const out:PropPlacement[]=[];
  // District signposts: at the road where the district's path leaves it, facing the approach.
  for(const d of DISTRICTS){
    const road=nearestSample(d.at[0],d.at[2]),lane=nearestSample(d.at[0],d.at[2],ORCHARD_LANE_LINE),line:Line=lane.d<road.d?ORCHARD_LANE_LINE:MOUNTAIN_ROAD_LINE,n=lane.d<road.d?lane:road;
    const s=line.samples[n.i]!,side=((d.at[0]-s.at[0])*s.normal[0]+(d.at[2]-s.at[2])*s.normal[2])>=0?1:-1,i0=Math.max(0,n.i-10);
    const spot=besideRoute(line,i0,side as 1|-1,1.6,.4,10);
    if(spot){const t=line.samples[i0]!.tangent;out.push(seat(`signpost:${d.id}`,'signpost',spot.x,spot.z,Math.atan2(-t[0],-t[2]),.3,.3,3.1,{district:d.id,label:d.name}));}
  }
  // The race: a signpost beside the start, one beside the finish run-out.
  {const S=MOUNTAIN_ROAD_LINE.samples,i=S.length-6,s=S[i]!,spot=besideRoute(MOUNTAIN_ROAD_LINE,i,1,1.6,.4,5)??besideRoute(MOUNTAIN_ROAD_LINE,i,-1,1.6,.4,5);
    if(spot)out.push(seat('signpost:race:start','signpost',spot.x,spot.z,Math.atan2(s.tangent[0],s.tangent[2]),.3,.3,3.1,{label:'Summit to sea · start'}));}
  {const f=RACE_FINISH,hx=f.heading[0],hz=f.heading[1];for(const side of [1,-1]){const x=f.at[0]+hz*5.2*side,z=f.at[2]-hx*5.2*side;if(corridorClearance(x,z)>.3){out.push(seat('signpost:race:finish','signpost',x,z,Math.atan2(-hx,-hz),.3,.3,3.1,{label:'Summit to sea · finish'}));break;}}}
  for(const p of RESERVED_PLOTS){const g=p.gate,away=Math.atan2(g[0]-p.at[0],g[2]-p.at[2]),[x,z]=findSpot(g[0],g[2],away+1.3,2.2,.35,{near:1.4});out.push(seat(`signpost:plot:${p.id}`,'signpost',x,z,away,.3,.3,2.6,{label:p.name}));}
  // Benches: the interaction benches keep their authored anchors; each faces its district's view.
  for(const item of MOUNTAIN_INTERACTIONS.filter(i=>i.kind==='bench')){
    const yaw=downhillYaw(item.at[0],item.at[2]);
    out.push(seat(`bench:${item.id}`,'bench',item.at[0],item.at[2],yaw,1.5,.45,1.1,{district:item.district}));
  }
  // Overlooks: a bench a little back from the rail, and a brass viewer at the rail.
  for(const o of OVERLOOKS){if(o.id.startsWith('road:')||o.id.startsWith('dam:'))continue;
    const bx=o.at[0]-Math.sin(o.facing)*1.4,bz=o.at[2]-Math.cos(o.facing)*1.4;
    out.push(seat(`viewer:${o.id}`,'viewer',o.at[0]+Math.sin(o.facing)*1.6+Math.cos(o.facing)*1.4,o.at[2]+Math.cos(o.facing)*1.6-Math.sin(o.facing)*1.4,o.facing,.2,.2,1.4));
    if(corridorClearance(bx,bz)>-10)out.push(seat(`bench:overlook:${o.id}`,'bench',bx,bz,o.facing,1.4,.45,1.1));
  }
  // Lanterns: at station platforms (both ends), at each district's heart and along the stairs' feet.
  for(const line of Object.values(TRANSPORT_LINES))for(const st of line.stations){
    const p=st.platform,c=Math.cos(p.yaw),s=Math.sin(p.yaw);
    for(const end of [-1,1]){const lx=0,lz=0;void lx;void lz;const x=p.at[0]+s*(p.half[0]+.5)*end+c*(p.half[1]+.6),z=p.at[2]+c*(p.half[0]+.5)*end-s*(p.half[1]+.6);
      if(corridorClearance(x,z)>.1)out.push(seat(`lantern:${line.kind}:${st.id}:${end}`,'lantern',x,z,p.yaw,.14,.14,2.6));}
  }
  for(const node of MOUNTAIN_PATH_GRAPH.nodes.filter(n=>n.kind==='stair-bottom'||n.kind==='stair-top')){
    for(const side of [-1,1]){const x=node.at[0]+side*1.9,z=node.at[2]+.4;if(corridorClearance(x,z)>.15&&riverClear(x,z)>3.5){out.push(seat(`lantern:${node.id}:${side}`,'lantern',x,z,0,.14,.14,2.4));break;}}
  }
  // District life: gates, a bell, laundry, pennants/rope loops, planters, hives, cairns.
  for(const item of MOUNTAIN_INTERACTIONS){
    if(item.kind==='gate')out.push(seat(`gate:${item.id}`,'gate',item.at[0],item.at[2],0,1.3,.12,1.4));
    if(item.kind==='bell')out.push(seat(`bell:${item.id}`,'bell',item.at[0],item.at[2],0,.7,.2,2.3));
  }
  const around=(d:District,a:number,r:number)=>[d.at[0]+Math.cos(a)*r,d.at[2]+Math.sin(a)*r] as const;
  const clearSpot=(d:District,a0:number,r:number,need:number):readonly [number,number]|null=>{
    for(let k=0;k<24;k++){const a=a0+(k%2?1:-1)*Math.ceil(k/2)*.22,[x,z]=around(d,a,r),g=footGround(x,z,0,need,need);
      if(g.max-g.min<.9&&corridorClearance(x,z)>need+.3&&riverClear(x,z)>4)return [x,z];}
    return null;
  };
  const hearth=DISTRICTS.find(d=>d.id==='hearth')!,orchard=DISTRICTS.find(d=>d.id==='orchard')!,glass=DISTRICTS.find(d=>d.id==='glasshouse')!,summit=DISTRICTS.find(d=>d.id==='summit')!;
  const line=(id:string,kind:PropKind,d:District,a:number,r:number,len:number)=>{const at=clearSpot(d,a,r,len/2+.3);if(!at)return;const yaw=a+Math.PI/2,[x,z]=at,c=Math.cos(yaw),s=Math.sin(yaw);
    const p=seat(id,kind,x,z,yaw,len/2,.15,2.3);out.push({...p,to:[x+c*len/2,z-s*len/2]});};
  line('laundry:hearth','laundry',hearth,2.2,11,5.2);
  line('pennants:hearth','pennants',hearth,-1.1,12,6);
  line('pennants:orchard','pennants',orchard,.4,12,6);
  line('pennants:glasshouse','pennants',glass,-.6,13,7);
  for(const [d,a] of [[hearth,.9],[orchard,2.6],[glass,2.1]] as const){const at=clearSpot(d,a,9.5,.5);if(at)out.push(seat(`planter:${d.id}`,'planter',at[0],at[1],a,.55,.55,.9,{district:d.id}));}
  for(const [i,a] of [0,1.3,2.6].entries()){const at=clearSpot(orchard,a+.5,15,.5);if(at)out.push(seat(`beehive:${i}`,'beehive',at[0],at[1],a,.35,.35,1,{district:'orchard'}));}
  {const at=clearSpot(hearth,-2.4,10,.7);if(at)out.push(seat('woodpile:hearth','woodpile',at[0],at[1],-2.4,.9,.45,1.1,{district:'hearth'}));}
  for(const [i,a] of [.3,1.9,3.6,5.1].entries()){const at=clearSpot(summit,a,12+i,.7);if(at)out.push(seat(`cairn:${i}`,'cairn',at[0],at[1],a,.7,.7,1.6,{district:'summit'}));}
  // Newfoundland's rope bollards (and any theme's mooring posts) along the quay; the art picks the dressing.
  for(let i=0;i<6;i++){const x=-30+i*9,z=66+Math.sin(i)*1.5;if(corridorClearance(x,z)>.3)out.push(seat(`bollard:quay:${i}`,'bollard',x,z,0,.22,.22,.9));}
  // Town square: lanterns at the square's edge, clear of the channel and the lanes.
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.3,x=TOWN_SQUARE.plaza.centre[0]+Math.cos(a)*11,z=TOWN_SQUARE.plaza.centre[1]+Math.sin(a)*11;if(riverClear(x,z)>3.2&&corridorClearance(x,z)>.2)out.push(seat(`lantern:square:${i}`,'lantern',x,z,0,.14,.14,2.6));}
  cache=out;return out;
}
