import {describe,expect,it} from 'vitest';
import {buildFlightEnvelope} from '../src/harbour/horizon/world/sky.ts';
import type {LandCuts,TerrainField} from '../src/harbour/horizon/land/interfaces.ts';
import {solarPosition} from '../src/harbour/horizon/sun/solar.ts';
import {SOUTH_WIND,type WindSample} from '../src/harbour/horizon/movers/shared/wind.ts';
import {ceilingFade,liftAt,liftField} from '../src/harbour/horizon/movers/glider/lift.ts';
import {stepWing,type WingState} from '../src/harbour/horizon/movers/glider/wing.ts';

// FLIGHT.md §10 row 2: thermals +2.5 at the core only inside `hours` by `localMinutes`; ridge only with a south
// wind and a heading along/into the face; sinks −1.0; every volume fades to 0 by h 300; wind adds to the track in full.
const field:TerrainField={revision:'horizon-geo-1',width:2000,depth:1800,step:100,columns:21,rows:19,heights:new Float32Array(399).fill(180),surfaces:new Uint8Array(399)};
const cuts:LandCuts={beds:[],pads:[],mouths:[],solids:[],waters:[],diagnostics:[]};
const envelope=buildFlightEnvelope(field,cuts);
const vol=(id:string)=>envelope.volumes!.find(v=>v.id===id)!;
const zone='America/Toronto';
/** Local hour through the same clock the runtime uses (`solar.localMinutes / 60`). */
const hour=(iso:string)=>solarPosition(new Date(iso),{timeZone:zone}).localMinutes/60;
const still:WindSample={dir:Math.PI,speed:0};
const EAST=Math.PI/2,WEST=-Math.PI/2,NORTH=Math.PI,SOUTH=0,deg=Math.PI/180;
const at=(id:string,y=150,dx=0,dz=0)=>{const v=vol(id);return{x:v.centre[0]+dx,y,z:v.centre[2]+dz};};

describe('thermals follow the real clock',()=>{
  it('gives +2.5 at the core inside hours, nothing outside',()=>{
    const afternoon=hour('2026-07-15T14:00:00-04:00'),morning=hour('2026-07-15T10:00:00-04:00'),evening=hour('2026-07-15T18:00:00-04:00'),dawn=hour('2026-07-15T07:59:00-04:00');
    expect(afternoon).toBeCloseTo(14,6);expect(morning).toBeCloseTo(10,6);
    expect(vol('thermal.1').hours).toEqual([12,18]);expect(vol('thermal.2').hours).toEqual([8,18]);
    expect(liftAt(envelope,still,at('thermal.1'),0,afternoon)).toEqual({lift:2.5,kind:'thermal'});
    expect(liftAt(envelope,still,at('thermal.1'),0,morning)).toEqual({lift:0,kind:null});
    expect(liftAt(envelope,still,at('thermal.2'),0,morning).lift).toBe(2.5);
    expect(liftAt(envelope,still,at('thermal.2'),0,dawn).lift).toBe(0);
    expect(liftAt(envelope,still,at('thermal.2'),0,evening).lift).toBe(0);
    // Reduced motion / calm freeze the sun at 15:30: both thermals are on.
    for(const id of ['thermal.1','thermal.2'])expect(liftAt(envelope,still,at(id),0,15.5).lift).toBe(2.5);
  });
  it('falls off by a cosine to 0 at the rim',()=>{
    const r=vol('thermal.1').radius!;
    expect(liftAt(envelope,still,at('thermal.1',150,r/2),0,14).lift).toBeCloseTo(1.25,10);
    expect(liftAt(envelope,still,at('thermal.1',150,0,r),0,14).lift).toBe(0);
    let last=2.5;for(let d=1;d<=r;d+=1){const l=liftAt(envelope,still,at('thermal.1',150,d),0,14).lift;expect(l).toBeLessThanOrEqual(last+1e-12);last=l;}
  });
});

describe('ridge lift on the Crown\'s south face',()=>{
  const ridge=(wind:WindSample,heading:number,y=150)=>liftAt(envelope,wind,at('ridge.crownSouth',y),heading,3);
  it('works only in a south wind, beating along (or into) the face',()=>{
    expect(ridge(SOUTH_WIND,EAST)).toEqual({lift:2,kind:'ridge'});
    expect(ridge(SOUTH_WIND,WEST).lift).toBe(2);
    expect(ridge(SOUTH_WIND,EAST+59*deg).lift).toBe(2);
    expect(ridge(SOUTH_WIND,WEST-59*deg).lift).toBe(2);
    expect(ridge(SOUTH_WIND,NORTH).lift).toBe(0);
    expect(ridge(SOUTH_WIND,SOUTH).lift).toBe(0);
    expect(ridge(SOUTH_WIND,EAST+61*deg).lift).toBe(0);
    expect(ridge({dir:0,speed:4},EAST).lift).toBe(0);
    expect(ridge({dir:3*Math.PI/2,speed:4},EAST).lift).toBe(0);
    expect(ridge({dir:Math.PI+44*deg,speed:4},EAST).lift).toBe(2);
    expect(ridge({dir:Math.PI+46*deg,speed:4},EAST).lift).toBe(0);
    expect(ridge(still,EAST).lift).toBe(0);
  });
  it('is full below 220, fades to 0 at 280, and lives only in its box',()=>{
    expect(ridge(SOUTH_WIND,EAST,219).lift).toBe(2);
    expect(ridge(SOUTH_WIND,EAST,250).lift).toBeCloseTo(1,10);
    expect(ridge(SOUTH_WIND,EAST,280).lift).toBe(0);
    expect(ridge(SOUTH_WIND,EAST,70).lift).toBe(0);
    const box=vol('ridge.crownSouth');
    expect(liftAt(envelope,SOUTH_WIND,at('ridge.crownSouth',150,0,box.halfSize[2]+1),EAST,3).lift).toBe(0);
    expect(liftAt(envelope,SOUTH_WIND,at('ridge.crownSouth',150,box.halfSize[0]+1),EAST,3).lift).toBe(0);
  });
});

describe('sinks, the ceiling and the wind',()=>{
  it('sinks are −1.0 at the core with a cosine falloff, at every hour',()=>{
    for(const id of ['sink.1','sink.2'])for(const h of [3,14])expect(liftAt(envelope,still,at(id),0,h)).toEqual({lift:-1,kind:'sink'});
    expect(vol('sink.1').centre[0]).toBe(600);expect(vol('sink.1').centre[2]).toBe(760);
    expect(liftAt(envelope,still,at('sink.1',150,vol('sink.1').radius!/2),0,14).lift).toBeCloseTo(-.5,10);
  });
  it('every volume fades linearly to 0 between 280 and 300',()=>{
    expect(ceilingFade(280)).toBe(1);expect(ceilingFade(290)).toBe(.5);expect(ceilingFade(300)).toBe(0);expect(ceilingFade(320)).toBe(0);
    expect(liftAt(envelope,still,at('thermal.1',290),0,14).lift).toBeCloseTo(1.25,10);
    expect(liftAt(envelope,still,at('thermal.1',300),0,14).lift).toBe(0);
    expect(liftAt(envelope,still,at('sink.1',290),0,14).lift).toBeCloseTo(-.5,10);
    expect(liftAt(envelope,still,at('sink.2',300),0,14).lift).toBe(0);
    for(let y=300;y<=320;y+=5)for(const v of envelope.volumes!)expect(liftAt(envelope,SOUTH_WIND,{x:v.centre[0],y,z:v.centre[2]},EAST,15.5).lift).toBe(0);
  });
  it('is nothing outside every volume',()=>{expect(liftAt(envelope,SOUTH_WIND,{x:50,y:150,z:50},EAST,14)).toEqual({lift:0,kind:null});});
  it('wind is not lift: it adds to the ground track in full (15 m/s north, 7 south)',()=>{
    const env={wind:SOUTH_WIND,lift:liftField(envelope,SOUTH_WIND,3),ground:()=>-100};
    const fly=(heading:number):WingState=>{let s:WingState={x:40,y:150,z:40,heading,bank:0,airspeed:11,vs:0,phase:'flight',stallT:0,t:0};for(let i=0;i<60;i++)s=stepWing(s,{bar:0,bank:0},env,1/60);return s;};
    const north=fly(NORTH),south=fly(SOUTH),east=fly(EAST);
    expect(40-north.z).toBeCloseTo(15,6);expect(south.z-40).toBeCloseTo(7,6);
    expect(east.x-40).toBeCloseTo(11,6);expect(east.z-40).toBeCloseTo(-4,6);
    for(const s of [north,south,east])expect(s.vs).toBeCloseTo(-1.2,10);
  });
});
