import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {describe,expect,it} from 'vitest';
import {fitMountainHorizonJoins} from '../src/harbour/horizon/land/mountainV2/joins';
import {v2GroundAt} from '../src/harbour/horizon/land/mountainV2/ground';
import {bed,addFlatPad,emitBedGeometry} from '../src/harbour/horizon/land/beds/profiles';
import {buildStair} from '../src/harbour/horizon/land/structures/build';
import {baseHeight,sampleTerrain} from '../src/harbour/horizon/land/terrain';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset';
import {createHorizonGeography,HORIZON_WALKABLE_DEGREES} from '../src/harbour/horizon/runtime/geography';
import {createRegionGeography} from '../src/harbour/horizon/regions/mountainV2/geography';
import {bedPath,pointAt,progressOf} from '../src/harbour/horizon/movers/board/situations';
import {solidTopAt} from '../src/harbour/horizon/world/geometry';
import type {LandCuts,XYZ} from '../src/harbour/horizon/land/interfaces';

const station:XYZ[]=[[1298.3,158.05,481.7],[1300.8875,158.037177701,479.1125],[1304,158.024571818,476],[1307.249375,158.012215574,472.750625],[1310,158,470]];
const head:XYZ=[1319.108997805,170,468],foot:XYZ=[1312.599615031,158.81597646,454.960156792],join:XYZ=[1309.65,158.81597646,454.9125];
function fixture():LandCuts{
  const cuts:LandCuts={beds:[],pads:[],solids:[],mouths:[],waters:[],diagnostics:[]};
  const walk=bed('walk summitStation','walk',structuredClone(station));walk.carried=[station.map(p=>[p[0],p[2]])];cuts.beds.push(walk);
  addFlatPad(cuts,'crossing.walkSummitStation.g1.1','threshold',[1300,480],158.041575688,[6,5]);
  addFlatPad(cuts,'place.L02','place',[1310,470],158,[12,10]);
  buildStair('crownLaunch.stair',head,foot,3,cuts,baseHeight);cuts.beds.find(b=>b.id==='crownLaunch.stair')!.points.push(join);
  return cuts;
}
const before=fixture(),after=structuredClone(before);fitMountainHorizonJoins(after,baseHeight);
for(const cuts of [before,after])for(const b of cuts.beds)emitBedGeometry(b,cuts,baseHeight);
const bytes=readFileSync('public/horizon/terrain/horizon-geo-1.bin'),field=decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer);
const region=createRegionGeography({horizonGround:(x,z)=>sampleTerrain(field,x,z)});
const geography=(cuts:LandCuts)=>{const g=createHorizonGeography(field,cuts);g.addDynamic(region.provider);return g;};

// Run the actual runtime movement body, as the modes audit does. Only scene-ready
// and stationary initial state are supplied here; no movement tolerance is copied.
const runtime=readFileSync('src/harbour/horizon/runtime/index.ts','utf8'),start=runtime.indexOf('  function move(dx:number'),end=runtime.indexOf('  let emote:',start);
if(start<0||end<=start)throw new Error('Update the exact runtime walker extraction');
const compiled=transformSync(`function makeWalker(body,geography,world,HORIZON_WALKABLE_DEGREES){let held=false,leftSupport=false,velocityY=0,swimming=false,lastMovementBlocker=null;const gateOpen=()=>true;const waterLevel=(x,z,y)=>geography.waterLevel(x,z,y);${runtime.slice(start,end)}return{move,report:()=>({leftSupport,lastMovementBlocker})}}`,{loader:'ts'}).code;
const makeWalker=new Function(`${compiled};return makeWalker;`)();
function replay(cuts:LandCuts,id:string,reverse:boolean){
  const b=cuts.beds.find(b=>b.id===id)!,path=bedPath({...b,points:reverse?[...b.points].reverse():b.points}),g=geography(cuts),p=pointAt(path,.5),body={x:p.x,y:p.y,z:p.z,yaw:p.heading};
  const initial=g.surface(body.x,body.z,body.y,.48);if(initial)body.y=initial.y;
  const w=makeWalker(body,g,{extent:{w:field.width,h:field.depth}},HORIZON_WALKABLE_DEGREES);let d=.5,checkpoint=.5,stall=0;
  for(let frame=0;frame<1800;frame++){
    const pr=progressOf(path,body.x,body.z,d,20);d=Math.max(d,pr.d);if(d>=path.length-.5&&pr.off<1)return'end';
    if(d>checkpoint+.2){checkpoint=d;stall=0;}else stall+=1/60;if(stall>5)return'stalled';
    const target=pointAt(path,pr.d+.8),dx=target.x-body.x,dz=target.z-body.z,l=Math.hypot(dx,dz),pace=Math.min(l,2.4/60);
    w.move(dx/l*pace,dz/l*pace,1/60);const floor=g.surface(body.x,body.z,body.y,.02);
    if(w.report().leftSupport||!floor||body.y-floor.y>.05)return'air';
  }
  return'timeout';
}
describe('physical SummitStation and Crown stair joins',()=>{
  it('keeps the source summit walk open through its full width without deleting the remaining landing guards',()=>{
    const cuts=fixture(),walk=bed('walk summit','walk',[[1309.792592593,159.075883075,448.503703704],[1309.65,158.81597646,454.9125],[1309.585185185,158.549485133,461.340740741]]);
    walk.width=2.5;cuts.beds.push(walk);const old=structuredClone(cuts);fitMountainHorizonJoins(cuts,baseHeight);
    expect(cuts.beds.find(b=>b.id===walk.id)!.points).toEqual(old.beds.find(b=>b.id===walk.id)!.points);
    const rail=cuts.solids.find(s=>s.id==='crownLaunch.stair.landingRails')!,landing=cuts.solids.find(s=>s.id==='crownLaunch.stair.landing')!;
    const g=createHorizonGeography(field,{beds:[],pads:[],mouths:[],waters:[],diagnostics:[],solids:[rail]});
    // Independently sweep the declared path, not the rail builder's gap helper.
    let checks=0;
    for(let i=1;i<walk.points.length;i++){
      const a=walk.points[i-1]!,b=walk.points[i]!,length=Math.hypot(b[0]-a[0],b[2]-a[2]),nx=-(b[2]-a[2])/length,nz=(b[0]-a[0])/length;
      for(let s=0;s<=length;s+=.05)for(const offset of[-.95,0,.95]){
        const x=a[0]+(b[0]-a[0])*s/length+nx*offset,z=a[2]+(b[2]-a[2])*s/length+nz*offset,top=solidTopAt(landing,x,z);
        if(top===null)continue;expect(g.contact(x,z,top,.3,undefined,false,.65)).toBeNull();checks++;
      }
    }
    expect(checks).toBeGreaterThan(40);expect(rail.indices.length).toBeGreaterThan(0);
    const a=12*7*6,b=13*7*6,x=(landing.positions[a]!+landing.positions[b]!)/2,z=(landing.positions[a+2]!+landing.positions[b+2]!)/2,y=(landing.positions[a+1]!+landing.positions[b+1]!)/2;
    expect(g.contact(x,z,y,.1,undefined,false,.65)?.id).toBe(rail.id);
    // The original stair rails/treads remain byte-for-byte; the separate existing
    // between-post 0.65m guard-band regression also remains unchanged below.
    for(const suffix of['treads','rails','stringers','supports','cheeks'])expect(cuts.solids.find(s=>s.id==='crownLaunch.stair.'+suffix)).toEqual(old.solids.find(s=>s.id==='crownLaunch.stair.'+suffix));
  });

  it('closes both original failures with rendered geometry and unchanged walking limits',()=>{
    expect(replay(before,'walk summitStation',false)).toBe('air');expect(replay(before,'walk summitStation',true)).toBe('stalled');
    expect(replay(before,'crownLaunch.stair',true)).toBe('stalled');
    for(const id of ['walk summitStation','crownLaunch.stair'])for(const reverse of [false,true])expect(replay(after,id,reverse)).toBe('end');
  });
  it('preserves source paths, native ground, all original stair members and the upper platform height',()=>{
    expect(after.beds.find(b=>b.id==='walk summitStation')!.points).toEqual(station);
    const b=after.beds.find(b=>b.id==='crownLaunch.stair')!;expect(b.points.map(p=>[p[0],p[2]])).toEqual([head,foot,join].map(p=>[p[0],p[2]]));expect(b.points[0]).toEqual(head);
    expect(b.points[1]![1]).toBeCloseTo(160.1716156769697,6);expect(b.points[2]![1]).toBeCloseTo(v2GroundAt(join[0],join[2])!+.015,8);
    for(const suffix of ['treads','rails','stringers','supports','cheeks'])expect(after.solids.find(s=>s.id==='crownLaunch.stair.'+suffix)).toEqual(before.solids.find(s=>s.id==='crownLaunch.stair.'+suffix));
    expect(after.solids.some(s=>s.id.startsWith('crownLaunch.stair.bed.'))).toBe(false);expect(after.solids.some(s=>s.id.startsWith('crownLaunch.stair.edges.'))).toBe(false);
    expect(after.solids.some(s=>s.id==='crownLaunch.stair.landingRails')).toBe(true);
  });
  it('has a visible landing guard across the 0.65m body contact band between posts',()=>{
    const landing=after.solids.find(s=>s.id==='crownLaunch.stair.landing')!,rail=after.solids.find(s=>s.id==='crownLaunch.stair.landingRails')!;
    // Rows 3 and 4 on the first edge lie between the end and the next 1.75m post.
    const a=3*7*6,b=4*7*6,x=(landing.positions[a]!+landing.positions[b]!)/2,z=(landing.positions[a+2]!+landing.positions[b+2]!)/2,y=(landing.positions[a+1]!+landing.positions[b+1]!)/2;
    const g=createHorizonGeography(field,{beds:[],pads:[],mouths:[],waters:[],diagnostics:[],solids:[rail]});
    expect(g.contact(x,z,y,.1,undefined,false,.65)?.id).toBe(rail.id);
  });
  it('keeps the closed fairing inside the pre-existing deck and flight footprint',()=>{
    const landing=after.solids.find(s=>s.id==='crownLaunch.stair.landing')!,oldBeds=before.solids.filter(s=>s.id.startsWith('crownLaunch.stair.bed.')),treads=before.solids.find(s=>s.id==='crownLaunch.stair.treads')!;
    const edges=new Map<string,number>();
    for(let i=0;i<landing.indices.length;i+=3){
      const triangle=landing.indices.slice(i,i+3);for(let k=0;k<3;k++){const a=triangle[k]!,b=triangle[(k+1)%3]!,key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);}
      for(const weights of [[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[0,.5,.5],[.5,0,.5],[1/3,1/3,1/3]]){
        const x=triangle.reduce((s,v,k)=>s+landing.positions[v*3]!*weights[k]!,0),z=triangle.reduce((s,v,k)=>s+landing.positions[v*3+2]!*weights[k]!,0);
        expect([...oldBeds,treads].some(s=>solidTopAt(s,x,z)!=null)).toBe(true);
      }
    }
    expect([...edges.values()].every(n=>n===2)).toBe(true);
  });
});

describe('L02 physical platform edge',()=>{
  it('fairs the east edge inside its existing footprint and crosses the short entry both ways',()=>{
    const original:LandCuts={beds:[],pads:[],solids:[],mouths:[],waters:[],diagnostics:[]};
    addFlatPad(original,'place.L02','place',[1310,470],158,[12,10]);
    const route=bed('L02 east entry','walk',[[1318,158.099428919,472],[1313.69375,158.049620651,472.378125],[1310,158,470]]);
    route.carried=[route.points.map(p=>[p[0],p[2]])];original.beds.push(route);
    const repaired=structuredClone(original);fitMountainHorizonJoins(repaired,baseHeight);
    const old=geography(original),g=geography(repaired),inside=[1315.975,472.175609] as const,outside=[1316.025,472.175609] as const;
    expect(old.surface(...inside)!.y-old.surface(...outside)!.y).toBeGreaterThan(.45);
    expect(Math.abs(g.surface(...inside)!.y-g.surface(...outside)!.y)).toBeLessThan(.025);
    expect(g.surface(1310,470)!.y).toBe(158);
    const pad=repaired.solids.find(s=>s.id==='place.L02.slab')!;
    for(let i=0;i<pad.positions.length;i+=3){expect(pad.positions[i]!).toBeGreaterThanOrEqual(1304);expect(pad.positions[i]!).toBeLessThanOrEqual(1316);expect(pad.positions[i+2]!).toBeGreaterThanOrEqual(465);expect(pad.positions[i+2]!).toBeLessThanOrEqual(475);}
    for(const reverse of [false,true])expect(replay(repaired,route.id,reverse)).toBe('end');
  });
});
