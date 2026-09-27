import {describe,expect,it} from 'vitest';
import {buildFlightEnvelope} from '../src/harbour/horizon/world/sky.ts';
import type {LandCuts,TerrainField} from '../src/harbour/horizon/land/interfaces.ts';
import {DEEP_JETTY,THROAT,axisHeight,corridorOutcome,enterCorridor,lateralFreedom,stepCorridor,throatGate,type CorridorState} from '../src/harbour/horizon/movers/glider/corridor.ts';

// FLIGHT.md §2.5 / §10 row 5: the cone admits and refuses (a miss, not a wall); parachute and plane refused; the wing
// stays inside the aperture down the whole chute; the level run ends on the water at [1300, 420 ± 10]; three echoes;
// the deepJetty fade; the splash is small when the bar is pushed out in the level run, big when it is not.
const field:TerrainField={revision:'horizon-geo-1',width:2000,depth:1800,step:100,columns:21,rows:19,heights:new Float32Array(399).fill(0),surfaces:new Uint8Array(399)};
const cuts:LandCuts={beds:[],pads:[],mouths:[],solids:[],waters:[],diagnostics:[]};
const gate=throatGate(buildFlightEnvelope(field,cuts));
const deg=Math.PI/180;
const wing=(over:Partial<{x:number;y:number;z:number;heading:number;bank:number;airspeed:number}>={})=>({x:1300,y:110,z:300,heading:0,bank:0,airspeed:11,...over});
function dive(input:(s:CorridorState)=>{bar:number;bank:number},start=enterCorridor(gate,wing(),'glider')!){
  const path=[start];let s=start;while(s.phase!=='touchdown'&&path.length<6000){s=stepCorridor(s,input(s),1/60);path.push(s);}return path;
}

describe('the Throat mouth',()=>{
  it('is built from the envelope with the manifest numbers',()=>{
    expect(gate).toMatchObject({mouth:[1300,110,300],to:[1300,42,420],waterHeight:40,aperture:[26,18],coneDegrees:25,maxBankDegrees:20,levelLength:25,splashHeight:42,modes:['glider']});
    expect(THROAT).toEqual(gate);
  });
  it('admits a glider inside the cone and the aperture',()=>{
    for(const w of [wing(),wing({heading:24*deg}),wing({heading:-24*deg}),wing({bank:19*deg}),wing({bank:-19*deg}),wing({x:1312.9}),wing({x:1287.1}),wing({y:101.1}),wing({y:118.9}),wing({z:297.5})])
      expect(enterCorridor(gate,w,'glider')).toMatchObject({phase:'corridor',s:0});
  });
  it('refuses a miss — outside the cone, over-banked, beside or above the aperture, short of the mouth',()=>{
    for(const w of [wing({heading:26*deg}),wing({heading:Math.PI}),wing({bank:21*deg}),wing({bank:-35*deg}),wing({x:1313.5}),wing({y:100}),wing({y:120}),wing({z:290}),wing({z:310})])
      expect(enterCorridor(gate,w,'glider')).toBeNull();
  });
  it('refuses the parachute and the plane whatever they do',()=>{
    for(const mode of ['parachute','plane','feet','balloon'] as const)expect(enterCorridor(gate,wing(),mode)).toBeNull();
  });
});

describe('the chute',()=>{
  it('keeps the wing inside the aperture all the way down, even banking hard to the walls',()=>{
    const path=dive((s)=>({bar:1,bank:Math.floor(s.t*.5)%2?1:-1}),enterCorridor(gate,wing({x:1312}),'glider')!);
    expect(path[0]!.lateral).toBe(8);
    let touchedWall=false;
    for(const s of path){
      expect(Math.abs(s.x-1300)).toBeLessThanOrEqual(13);
      expect(Math.abs(s.lateral)).toBeLessThanOrEqual((s.phase==='corridor'?lateralFreedom(gate,s.s):5)+1e-9);
      if(Math.abs(Math.abs(s.lateral)-(s.phase==='corridor'?lateralFreedom(gate,s.s):5))<1e-9&&s.s>20)touchedWall=true;
      expect(s.y).toBeLessThanOrEqual(110+1e-9);expect(s.y).toBeGreaterThanOrEqual(40);
      if(s.phase==='corridor')expect(s.y).toBeCloseTo(axisHeight(gate,s.s),9);
    }
    expect(touchedWall).toBe(true);
  });
  it('follows the 30° chute, builds 11 → 17 and holds 13 pushed out',()=>{
    const full=dive(()=>({bar:0,bank:0})),held=dive(()=>({bar:-1,bank:0}));
    const a=full[30]!,b=full[60]!;
    expect(Math.atan2(a.y-b.y,b.z-a.z)/deg).toBeCloseTo(30.26,1);
    expect(full[0]!.speed).toBe(11);expect(Math.max(...full.map(s=>s.speed))).toBe(17);
    const heldSlope=held.filter(s=>s.phase==='corridor');expect(heldSlope.at(-1)!.speed).toBe(13);
    expect(Math.max(...heldSlope.map(s=>s.speed))).toBe(13);
  });
  it('ends the 25 m level run on the water at [1300, 420 ± 10], level at 42 for its last 10 m',()=>{
    const path=dive(()=>({bar:0,bank:0})),end=path.at(-1)!;
    expect(end.phase).toBe('touchdown');
    expect(Math.abs(end.x-1300)).toBeLessThanOrEqual(10);expect(Math.abs(end.z-420)).toBeLessThanOrEqual(10);expect(end.y).toBe(40);
    const level=path.filter(s=>s.phase==='level');
    expect(level.length).toBeGreaterThan(0);
    expect(level[0]!.z).toBeGreaterThanOrEqual(395-.5);
    for(const s of level)if(s.z>=410)expect(s.y).toBeCloseTo(42,9);
    expect(end.echoes).toBe(3);
  });
  it('splashes small when pushed out through the level run, big when not, and fades to the jetty',()=>{
    const flare=dive(s=>({bar:s.phase==='level'?-1:1,bank:0})).at(-1)!,plain=dive(()=>({bar:1,bank:0})).at(-1)!;
    expect(flare.splash).toBe('small');expect(plain.splash).toBe('big');
    expect(corridorOutcome(flare)).toMatchObject({kind:'deepSmall',echoes:3,node:DEEP_JETTY,label:'→ the jetty'});
    expect(corridorOutcome(plain)).toMatchObject({kind:'deepBig',echoes:3,at:DEEP_JETTY.at});
    expect(DEEP_JETTY.at[0]).toBe(1300);expect(DEEP_JETTY.at[2]).toBe(440);
    expect(corridorOutcome(dive(()=>({bar:0,bank:0}))[10]!)).toBeNull();
  });
});
