import {describe,it,expect} from 'vitest';
import {MOUNTAIN_ROAD,ROAD_LENGTH,DISTRICTS,RESERVED_PLOTS,transportPoint,TRANSPORT_STOPS,mountainBaseHeight} from '../src/harbour/mountain/definition.ts';
import {queryWorldSurface,worldCeilingAt,SKILL_BRANCHES,type WorldSurface} from '../src/harbour/mountain/surfaces.ts';
import {crossesRaceGate,MOUNTAIN_GATES} from '../src/harbour/mountain/race.ts';
import {createBasinView,type BasinReading} from '../src/harbour/mountain/basin.ts';
import {createSkateField} from '../src/harbour/skate/world/field.ts';
import {groundHeightAt} from '../src/harbour/scene/ground.ts';

describe('Hearth Mountain spatial contract',()=>{
 it('supports an underpass, a deck and a roof at the same horizontal location',()=>{
  const surfaces:WorldSurface[]=[{id:'bridge',points:[[-5,8,0],[5,8,0]],halfWidth:2,material:'wood',walkable:true},{id:'roof',points:[[-5,14,0],[5,14,0]],halfWidth:2,material:'metal',walkable:true}];
  expect(queryWorldSurface({x:0,z:0,y:0},()=>0,surfaces).y).toBe(0);
  expect(queryWorldSurface({x:0,z:0,y:8},()=>0,surfaces).id).toBe('bridge');
  expect(queryWorldSurface({x:0,z:0,y:14},()=>0,surfaces).id).toBe('roof');
 });
 it('keeps the road continuously supported without terrain protruding into it',()=>{
  const field=createSkateField(groundHeightAt,{tier:'lite'});
  const failures=MOUNTAIN_ROAD.filter(p=>Math.abs(field.sample(p[0],p[2],p[1],'mountain-road').y-p[1])>.3);
  expect(failures.slice(0,4)).toEqual([]);
  expect(DISTRICTS).toHaveLength(6);expect(RESERVED_PLOTS).toHaveLength(3);
  console.info('Authored mountain road length:',ROAD_LENGTH.toFixed(1));
 });
 it('transport starts and finishes at its exact station in both directions',()=>{
  for(const kind of ['funicular','gondola'] as const)for(let a=0;a<TRANSPORT_STOPS[kind].length;a++)for(let b=0;b<TRANSPORT_STOPS[kind].length;b++){
   expect(transportPoint(kind,a,b,0)).toEqual(TRANSPORT_STOPS[kind][a]!.at);
   transportPoint(kind,a,b,1).forEach((v,i)=>expect(v).toBeCloseTo(TRANSPORT_STOPS[kind][b]!.at[i]!,8));
  }
 });
 it('requires forward gate crossings at the right elevation',()=>{
  for(const g of MOUNTAIN_GATES){const [x,y,z]=g.at,[nx,nz]=g.normal;
   expect(crossesRaceGate([x-nx,y,z-nz],[x+nx,y,z+nz],g)).toBe(true);
   expect(crossesRaceGate([x+nx,y,z+nz],[x-nx,y,z-nz],g)).toBe(false);
   expect(crossesRaceGate([x-nx,y-8,z-nz],[x+nx,y-8,z+nz],g)).toBe(false);
  }
 });
 it('keeps both transport alignments above every intermediate ridge',()=>{
  for(const kind of ['funicular','gondola'] as const)for(let stop=1;stop<TRANSPORT_STOPS[kind].length;stop++)for(let step=0;step<=100;step++){
   const [x,y,z]=transportPoint(kind,stop-1,stop,step/100);
   expect(y).toBeGreaterThanOrEqual(mountainBaseHeight(x,z)-.001);
  }
 });
});
const reading=(extra:Partial<BasinReading>={}):BasinReading=>({identity:'fictional:house',revision:1,asOf:'2026-09-24',known:true,balanceCents:40000,kittyCents:10000,freeCents:30000,pendingCents:5000,targetCents:100000,flows:[{id:'old',kind:'inlet',cents:40000,label:'Confirmed'}],...extra});
describe('Fund basin view',()=>{
 it('primes history, animates a new accepted event once and keeps a stable scale',()=>{
  const view=createBasinView();expect(view(reading()).newFlows).toEqual([]);
  const next=reading({revision:2,balanceCents:45000,flows:[...reading().flows,{id:'new',kind:'reserve-in',cents:5000,label:'Released'}]});
  expect(view(next).newFlows.map(f=>f.id)).toEqual(['new']);expect(view(next).newFlows).toEqual([]);
  expect(view({...next,targetCents:50000}).scaleCents).toBe(100000);
  expect(view({...next,balanceCents:200000,revision:3}).scaleChanged).toBe(true);
 });
 it('does not turn unknown evidence into empty water or events',()=>{
  const view=createBasinView();view(reading());expect(view(reading({known:false,balanceCents:null})).level).toBeNull();
  expect(view(reading()).newFlows).toEqual([]);
 });
});

import {courtObstacles,holdAshore} from '../src/harbour/body/obstacles.ts';
import {makeSim,intent} from '../src/harbour/skate/sim/testKit.ts';
it('stops an upward jump at a bridge underside without selecting its upper deck',()=>{
 const decks:WorldSurface[]=[{id:'test-bridge',points:[[-10,3,0],[10,3,0]],halfWidth:5,material:'wood',walkable:true}];
 const sim=makeSim({sample:()=>({y:0,nx:0,ny:1,nz:0,kind:'concrete',feature:null,lip:null}),ceilingAt:(x,z,y)=>worldCeilingAt(x,z,y,.2,decks),grindables:[],solids:[],spots:[]});
 let highest=0;
 for(let i=0;i<120;i++){const p=sim.step(intent({pop:i===0?{from:'tail',flipId:null,strength:1}:null}),1/60).present;highest=Math.max(highest,p.y);}
 expect(highest).toBeGreaterThan(.3);expect(highest+1.55).toBeLessThanOrEqual(2.72+.001);expect(sim.present().y).toBeCloseTo(0,3);
});
import {MOUNTAIN_COURSE_POINTS} from '../src/harbour/mountain/race.ts';
it('measures the descent using unmodified v2 physics and steering inputs',()=>{
 const route=MOUNTAIN_COURSE_POINTS,start=route[0]!,next=route[1]!;
 const sim=makeSim(createSkateField(groundHeightAt,{tier:'lite'}),{x:start[0],z:start[2],yaw:Math.atan2(next[0]-start[0],next[2]-start[2]),islandObstacles:courtObstacles('lite'),shore:holdAshore});
 let index=0,seconds=0,bails=0,maxError=0,gateIndex=1;
 for(let tick=0;tick<135*60;tick++){
  const p=sim.present();
  let nearest=index,dist=Infinity;
  for(let i=index;i<Math.min(route.length,index+12);i++){const q=route[i]!,d=Math.hypot(p.x-q[0],p.z-q[2]);if(d<dist){nearest=i;dist=d;}}
  index=nearest;maxError=Math.max(maxError,dist);
  if(gateIndex===MOUNTAIN_GATES.length){seconds=tick/60;break;}
  let aim=index;let ahead=0;while(aim<route.length-1&&ahead<Math.max(3,p.speed*.65)){const a=route[aim]!,b=route[++aim]!;ahead+=Math.hypot(b[0]-a[0],b[2]-a[2]);}
  const target=route[aim]!,angle=Math.atan2(target[0]-p.x,target[2]-p.z),error=Math.atan2(Math.sin(angle-p.boardYaw),Math.cos(angle-p.boardYaw));
  const before=[p.x,p.y,p.z] as const;
  const result=sim.step(intent({push:true,steer:Math.max(-1,Math.min(1,-error*2.2))}),1/60);
  const after=result.present;if(MOUNTAIN_GATES[gateIndex]&&crossesRaceGate(before,[after.x,after.y,after.z],MOUNTAIN_GATES[gateIndex]!))gateIndex++;
  bails+=result.events.filter(e=>e.kind==='bail').length;
 }
 console.info('Mountain input-driven descent:',{seconds,index,points:route.length,bails,maxError,gateIndex,gates:MOUNTAIN_GATES.length});
 expect(seconds).toBeGreaterThanOrEqual(60);expect(seconds).toBeLessThanOrEqual(120);expect(bails).toBe(0);expect(gateIndex).toBe(MOUNTAIN_GATES.length);
},30000);

import {pushOutAll,hit} from '../src/harbour/skate/sim/geometry.ts';
it('keeps the complete width of each optional branch supported, clear and inside the world',()=>{
 const obstacles=courtObstacles('lite'),out=hit(),failures:unknown[]=[];
 for(const branch of SKILL_BRANCHES)for(let i=1;i<branch.points.length;i++){
  const a=branch.points[i-1]!,b=branch.points[i]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
  for(let k=0;k<=4;k++)for(const side of [-.95,0,.95]){
   const t=k/4,x=a[0]+dx*t+dz/l*branch.halfWidth*side,z=a[2]+dz*t-dx/l*branch.halfWidth*side,y=a[1]+(b[1]-a[1])*t;
   const surface=queryWorldSurface({x,z,y,supportId:branch.id},groundHeightAt);
   pushOutAll(x,z,y,.24,obstacles,[],out);
   if(Math.abs(surface.y-y)>.3||out.id||!holdAshore(x,z).ashore)failures.push({branch:branch.id,i,x,y,z,surface:surface.y,solid:out.id});
  }
 }
 expect(failures.slice(0,8)).toEqual([]);
});
it('keeps the full downhill road width clear of buildings, trees and boundary clamps',()=>{
 const obstacles=courtObstacles('lite'),out=hit();const failures:unknown[]=[];
 for(let i=1;i<MOUNTAIN_COURSE_POINTS.length;i++){
  const p=MOUNTAIN_COURSE_POINTS[i]!,a=MOUNTAIN_COURSE_POINTS[i-1]!,dx=p[0]-a[0],dz=p[2]-a[2],l=Math.hypot(dx,dz)||1;
  for(const side of [-2,0,2]){const x=p[0]+dz/l*side,z=p[2]-dx/l*side;
   pushOutAll(x,z,p[1],.24,obstacles,[],out);const shore=holdAshore(x,z);
   if(out.id||!shore.ashore)failures.push({i,x,z,id:out.id,shore:shore.ashore});
  }
 }
 expect(failures).toEqual([]);
});

it('does not replay contributions received while evidence was frozen',()=>{
 const view=createBasinView();view(reading({identity:'reconnect'}));view(reading({identity:'reconnect',motion:false}));
 const resumed=reading({identity:'reconnect',revision:2,flows:[...reading().flows,{id:'offline-arrival',kind:'inlet',cents:10000,label:'Contribution'}]});
 expect(view(resumed).newFlows).toEqual([]);
 expect(view({...resumed,revision:3,flows:[...resumed.flows,{id:'live-arrival',kind:'inlet',cents:10000,label:'Contribution'}]}).newFlows.map(f=>f.id)).toEqual(['live-arrival']);
});
import {createWorldTrack} from '../src/ledgerSync/worldMotion.ts';
import {decodeWorldPresence} from '../src/ledgerSync/worldPresenceWire.ts';
import {createSkateDriver} from '../src/harbour/skate/driver.ts';
it('mounts underneath a bridge and preserves the elevation of a recovery marker',()=>{
 const x=19,z=-109,y=groundHeightAt(x,z),field=createSkateField(groundHeightAt,{tier:'lite'});
 expect(field.sample(x,z).y-y).toBeGreaterThan(10);
 const driver=createSkateDriver({obstacles:[]});
 driver.mount(x,z,0,undefined,{y});expect(driver.present()!.y).toBeCloseTo(y,5);
 expect(driver.unmount()!.y).toBeCloseTo(y,5);
 const sim=makeSim(createSkateField(()=>0,{tier:'lite'}),{x,z,y:0});expect(sim.setMarker()).toBe(true);
 sim.reset(0,0,0);sim.toMarker();expect(sim.present().y).toBeCloseTo(0,5);
});
it('keeps elevated walking and delayed mountain presence outside the old shore radius',()=>{
 const track=createWorldTrack({renderDelayMs:0});
 for(const [at,x] of [[0,98],[100,99]]){const pose=decodeWorldPresence({type:'world-step',version:1,world:'hearth-mountain-1',x,z:-174,y:51,yaw:0,moving:true});if(pose.type==='world-step')track.push({...pose,at:at!});}
 expect(track.pose(200)?.x).toBeGreaterThanOrEqual(99);expect(track.pose(200)?.y).toBe(51);expect(track.pose(2700)?.y).toBe(51);
});
