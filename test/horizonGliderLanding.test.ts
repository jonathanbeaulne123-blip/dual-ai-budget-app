import {describe,expect,it} from 'vitest';
import {buildFlightEnvelope} from '../src/harbour/horizon/world/sky.ts';
import type {LandCuts,TerrainField} from '../src/harbour/horizon/land/interfaces.ts';
import {HORIZON_WALKABLE_DEGREES} from '../src/harbour/horizon/runtime/geography.ts';
import {FOLD_MARGIN,TRIM_GLIDE,WALKABLE_DEGREES,nearestReachableLanding,resolveTouchdown,type LandingContext,type LandingNode,type LandingOutcome,type LandingSurface} from '../src/harbour/horizon/movers/glider/landing.ts';

// FLIGHT.md §2.4 / §10 row 4, on a synthetic world laid out in 100 m bands along x (z 100…199):
// 100 walkable · 200 a 45° face (ledge at z ≥ 195) · 300 the Bight · 400 a host footprint · 500 a neighbourhood ·
// 600 a threshold-pace bed · 700 the Deep · beyond 2000 the sea at the world's edge. The Green is the manifest's.
const field:TerrainField={revision:'horizon-geo-1',width:2000,depth:1800,step:100,columns:21,rows:19,heights:new Float32Array(399).fill(20),surfaces:new Uint8Array(399)};
const cuts:LandCuts={beds:[],pads:[],mouths:[],solids:[],waters:[],diagnostics:[]};
const envelope=buildFlightEnvelope(field,cuts);
const band=(x:number,z:number)=>z>=100&&z<200?Math.floor(x/100):0;
const shore:LandingNode={id:'shore.bight',at:[350,1,240],label:'Bight Shore'},path:LandingNode={id:'path.north',at:[250,30,80],label:'the north path'},jetty:LandingNode={id:'deepJetty',at:[1300,40.6,440],label:'the jetty'};
const ctx:LandingContext={
  surface(x,z){
    if(x<0||z<0||x>2000||z>1800)return null;
    const b=band(x,z);
    if(b===2)return z>=195?{y:10,slope:8,material:'rock',walkable:true}:{y:20,slope:45,material:'rock',walkable:true};
    if(b===3||b===7)return{y:-4,slope:2,material:'sand',walkable:true};
    if(b===6)return{y:20,slope:3,material:'stone',walkable:true,pace:'threshold'} satisfies LandingSurface;
    return{y:20,slope:b===1?10:3,material:'grass',walkable:true};
  },
  water(x,z){const b=band(x,z);return b===3?{id:'water.bight',y:0}:b===7?{id:'water.deep',y:40}:x>2000||z>1800?{id:'water.sea',y:0}:null;},
  district(x,z){return band(x,z)===5?{id:'harbour',kind:'neighbourhood',label:'Little Harbour'}:x>=1000&&x<1100&&z>=1000&&z<1150?{id:'green',kind:'field'}:{id:'wild',kind:'wild'};},
  nearestShoreNode:()=>shore,
  nearestApron:(_x,_z,districtId)=>({id:`apron.${districtId}`,at:[520,20,210],label:districtId==='harbour'?'the square':'the apron'}),
  nearestPathNode:()=>path,
  inHostFootprint:(x,z)=>band(x,z)===4,
  envelope,deepJetty:jetty,
};
const flared={airspeed:8.5,sink:.5},fast={airspeed:12,sink:1.2},steep={airspeed:8.5,sink:2};
const KINDS=['walkoff','tumble','fadeShore','fadeApron','deepSmall','deepBig'];
const all:LandingOutcome[]=[];
const land=(x:number,z:number,v:{airspeed:number;sink:number;groundSpeed?:number;flared?:boolean},mode:'glider'|'parachute'='glider')=>{const o=resolveTouchdown(ctx,{x,y:20,z,mode},v);all.push(o);return o;};

describe('the §2.4 outcome table',()=>{
  it('uses the runtime walkable limit',()=>{expect(WALKABLE_DEGREES).toBe(HORIZON_WALKABLE_DEGREES);});
  it('a landing field: flared → walk-off, faster or steeper → the tumble',()=>{
    expect(land(1040,1065,flared)).toMatchObject({kind:'walkoff',label:'the Green',rule:'field',at:[1040,20,1065]});
    expect(land(1040,1065,fast)).toMatchObject({kind:'tumble',rule:'field'});
    expect(land(1040,1065,steep)).toMatchObject({kind:'tumble',rule:'field'});
    expect(land(1040,1065,{airspeed:9,sink:1.5}).kind).toBe('walkoff');
  });
  it('any walkable surface: the same rule',()=>{
    expect(land(150,150,flared)).toMatchObject({kind:'walkoff',rule:'walkable',at:[150,20,150]});
    expect(land(150,150,fast).kind).toBe('tumble');
  });
  it('water other than the Deep: a fade to the nearest shore node, wet for 20 s',()=>{
    for(const v of [flared,fast])expect(land(350,150,v)).toMatchObject({kind:'fadeShore',node:shore,at:shore.at,label:'→ Bight Shore',wet:20,rule:'water'});
  });
  it('the Deep: flared = small splash, else big; three echoes; the jetty fade',()=>{
    expect(land(750,150,flared)).toMatchObject({kind:'deepSmall',echoes:3,node:jetty,at:jetty.at,label:'→ the jetty'});
    expect(land(750,150,fast)).toMatchObject({kind:'deepBig',echoes:3,node:jetty});
  });
  it('a neighbourhood or a host footprint: a fade to the apron, labelled',()=>{
    expect(land(550,150,flared)).toMatchObject({kind:'fadeApron',label:'→ the square',rule:'neighbourhood'});
    expect(land(450,150,flared)).toMatchObject({kind:'fadeApron',node:{id:'apron.wild'}});
  });
  it('unwalkable ground: the tumble down to walkable within 6 m, else a fade to the nearest path node',()=>{
    const near=land(250,191,fast);expect(near.kind).toBe('tumble');expect(near.at[1]).toBe(10);expect(near.at[2]).toBeGreaterThanOrEqual(195);expect(Math.hypot(near.at[0]-250,near.at[2]-191)).toBeLessThanOrEqual(6);
    expect(land(250,150,flared)).toMatchObject({kind:'fadeApron',node:path,label:'→ the north path',rule:'unwalkable'});
    expect(land(650,150,flared)).toMatchObject({kind:'fadeApron',node:path,rule:'unwalkable'});
  });
  it('the sea at the world boundary: the shore fade',()=>{
    expect(land(2050,150,flared)).toMatchObject({kind:'fadeShore',node:shore,wet:20});
    expect(land(-10,-10,flared)).toMatchObject({kind:'fadeShore',node:shore});
  });
  it('the parachute: stand-up with at least half brakes and ≤ 3 m/s over the ground',()=>{
    expect(land(1040,1065,{airspeed:0,sink:.5,groundSpeed:2,flared:true},'parachute').kind).toBe('walkoff');
    expect(land(1040,1065,{airspeed:0,sink:.5,groundSpeed:4,flared:true},'parachute').kind).toBe('tumble');
    expect(land(1040,1065,{airspeed:0,sink:.5,groundSpeed:1,flared:false},'parachute').kind).toBe('tumble');
  });
  it('no outcome is a crash, and every fade lands on a node',()=>{
    expect(all.length).toBeGreaterThanOrEqual(20);
    for(const o of all){
      expect(KINDS).toContain(o.kind);
      if(o.kind.startsWith('fade')||o.kind.startsWith('deep')){expect(o.node).toBeDefined();expect(o.at).toEqual(o.node!.at);expect(o.label.startsWith('→ ')).toBe(true);}
      expect(o.at.every(Number.isFinite)).toBe(true);
    }
  });
});

describe('the Fold bubble',()=>{
  it('offers the nearest field only when height in hand ≥ distance / 9.17 + 10',()=>{
    const green=envelope.landings.find(l=>l.id==='green')!,gh=('height' in green?green.height:0)!;
    expect(TRIM_GLIDE).toBeCloseTo(9.17,2);expect(FOLD_MARGIN).toBe(10);
    const need=410/TRIM_GLIDE+10;
    expect(nearestReachableLanding(envelope,{x:1040,y:gh+need+.1,z:1065-410})).toMatchObject({id:'green',label:'the Green',distance:410});
    expect(nearestReachableLanding(envelope,{x:1040,y:gh+need-.1,z:1065-410})?.id).not.toBe('green');
  });
  it('never offers an unreachable field, and never a farther one when a nearer is reachable',()=>{
    const fields=envelope.landings.filter(l=>['green','reachMeadow','sands','strip'].includes(l.id)) as {id:string;xy:readonly [number,number];height?:number}[];
    let offers=0;
    for(let x=0;x<=2000;x+=125)for(let z=0;z<=1800;z+=125)for(const y of [40,80,140,220,300]){
      const offer=nearestReachableLanding(envelope,{x,y,z}),reachable=fields.filter(f=>y-(f.height??0)>=Math.hypot(f.xy[0]-x,f.xy[1]-z)/TRIM_GLIDE+FOLD_MARGIN);
      if(!offer){expect(reachable).toHaveLength(0);continue;}
      offers++;
      const f=fields.find(f=>f.id===offer.id)!;expect(reachable).toContain(f);
      for(const r of reachable)expect(Math.hypot(r.xy[0]-x,r.xy[1]-z)).toBeGreaterThanOrEqual(offer.distance-1e-9);
    }
    expect(offers).toBeGreaterThan(50);
  });
});
