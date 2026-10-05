import {describe,it,expect} from 'vitest';
import {AIRCRAFT,AIRCRAFT_IDS,throttleDetents,nearestDetent,stepThrottle} from '../src/harbour/horizon/airport/aircraft.ts';
import {newAircraft,stepAircraft,restoreAircraft,aircraftExit,createAircraftController,PLANE,type FlightEnvironment} from '../src/harbour/horizon/airport/flight.ts';
const env:FlightEnvironment={ground:()=>38,surface:()=>({id:'strip',y:38,nx:0,ny:1,nz:0,slope:0,material:'paved'}),blocked:()=>false,waterLevel:()=>null};
const input={forward:0,steer:0};
function step(s:ReturnType<typeof newAircraft>,seconds:number,forward=0,steer=0,rudder=0){for(let n=0;n<seconds/PLANE.step;n++)stepAircraft(s,{forward,steer,rudder},env);}
describe('Airport airframes',()=>{
 for(const id of AIRCRAFT_IDS){
  it(`${id}: taxi, rotate, climb, trim, approach, land and stop`,()=>{
   const s=newAircraft(id,{x:600,y:38,z:500,yaw:0});s.occupied=true;s.throttle=.12;step(s,3);expect(s.grounded).toBe(true);expect(s.z).toBeGreaterThan(500);expect(s.speed).toBeLessThan(7);
   s.throttle=.85;for(let n=0;n<9/PLANE.step;n++)stepAircraft(s,{forward:s.grounded?-.5:Math.max(-1,Math.min(1,(s.pitch-.08)*7)),steer:0},env);expect(s.disabled).toBe(false);expect(s.grounded).toBe(false);expect(s.y).toBeGreaterThan(40);expect(s.z-500).toBeLessThan(340);
   step(s,5);expect(s.y).toBeGreaterThan(40);s.throttle=(AIRCRAFT[id].stall+3)/AIRCRAFT[id].max;
   // Follow a shallow approach on the same model; no position or velocity reset.
   for(let i=0;i<120*100&&!s.grounded;i++){const desired=s.y<40?-.025:-.12;const f=Math.max(-1,Math.min(1,(s.pitch-desired)*7));stepAircraft(s,{forward:f,steer:0},env);}
   expect(s.disabled,JSON.stringify(s)).toBe(false);expect(s.grounded).toBe(true);s.throttle=0;s.brake=true;step(s,8);expect(s.speed).toBe(0);expect(aircraftExit(s,env)).not.toBeNull();
  });
  it(`${id}: bailout preserves complete velocity and leaves one disabled airframe`,()=>{const s=newAircraft(id);s.grounded=false;s.y=100;s.vx=3;s.vy=-2;s.vz=21;const c=createAircraftController(s,env);expect(c.airborne?.()?.velocity).toEqual([3,-2,21]);c.exit(null);expect(s.disabled).toBe(true);expect(s.occupied).toBe(false);});
 }
 it('turning profiles differ and every aircraft has a unique identity',()=>{expect(new Set(AIRCRAFT_IDS.map(id=>AIRCRAFT[id].bankLimit)).size).toBe(3);});
 it('a collision stops locally without silently recovering',()=>{const s=newAircraft();s.occupied=true;s.throttle=1;stepAircraft(s,input,{...env,blocked:()=>true});expect(s.disabled).toBe(true);expect(s.x).toBe(410.5);});
 it('restoration refuses duplicates, invalid positions and phantom flights',()=>{const rows=AIRCRAFT_IDS.map(id=>newAircraft(id));expect(restoreAircraft(rows)?.length).toBe(3);expect(restoreAircraft([rows[0],rows[0],rows[2]])).toBeNull();expect(restoreAircraft([{...rows[0],x:NaN},rows[1],rows[2]])).toBeNull();rows[0]!.grounded=false;rows[0]!.occupied=true;expect(restoreAircraft(rows)?.[0]).toMatchObject({disabled:true,occupied:false,speed:0,throttle:0});});
 it('parked aircraft do not simulate background traffic',()=>{const s=newAircraft();s.throttle=1;step(s,5);expect(s.speed).toBe(0);});
});

describe('Rudder, take-off assist and throttle detents',()=>{
 for(const id of AIRCRAFT_IDS){
  it(`${id}: rudder pivots the nose at a crawl on the ground without banking`,()=>{
   const s=newAircraft(id,{x:600,y:38,z:500,yaw:0});s.occupied=true;s.throttle=.13;step(s,2,0,0,1);const right=s.yaw;expect(right).toBeLessThan(0);expect(s.bank).toBe(0);
   const l=newAircraft(id,{x:600,y:38,z:500,yaw:0});l.occupied=true;l.throttle=.13;step(l,2,0,0,-1);expect(l.yaw).toBeGreaterThan(0);expect(Math.abs(l.yaw+right)).toBeLessThan(1e-9);
  });
  it(`${id}: in the air rudder skids the nose flat and only leans the wings a little`,()=>{
   const s=newAircraft(id,{x:600,y:300,z:500,yaw:0});s.occupied=true;s.grounded=false;s.speed=AIRCRAFT[id].max*.8;s.throttle=.8;step(s,1.5,0,0,1);
   expect(s.yaw).toBeLessThan(-.2);expect(Math.abs(s.bank)).toBeLessThan(AIRCRAFT[id].bankLimit*.3);expect(s.disabled).toBe(false);
   const b=newAircraft(id,{x:600,y:300,z:500,yaw:0});b.occupied=true;b.grounded=false;b.speed=AIRCRAFT[id].max*.8;b.throttle=.8;step(b,1.5,0,1,0);expect(Math.abs(b.bank)).toBeGreaterThan(Math.abs(s.bank));
  });
  it(`${id}: take-off assist rotates, climbs clear of the ground and hands control back`,()=>{
   const s=newAircraft(id,{x:600,y:38,z:500,yaw:0});s.occupied=true;s.throttle=.85;s.takeoff=true;
   let airborne=false;for(let n=0;n<14/PLANE.step&&s.takeoff;n++){stepAircraft(s,{forward:0,steer:0},env);airborne||=!s.grounded;}
   expect(airborne).toBe(true);expect(s.disabled).toBe(false);expect(s.takeoff).toBe(false);expect(s.y-38).toBeGreaterThan(29);
  });
  it(`${id}: a real pitch input, a brake or a closed throttle cancels the assist`,()=>{
   for(const cancel of ['pitch','brake','throttle'] as const){const s=newAircraft(id,{x:600,y:38,z:500,yaw:0});s.occupied=true;s.throttle=.85;s.takeoff=true;
    if(cancel==='brake')s.brake=true;if(cancel==='throttle')s.throttle=.2;stepAircraft(s,{forward:cancel==='pitch'?.8:0,steer:0},env);expect(s.takeoff,cancel).toBe(false);}
  });
  it(`${id}: detents rise from idle, approach clears the stall and full is 100%`,()=>{
   const d=throttleDetents(id);expect(d.map(x=>x.id)).toEqual(['idle','taxi','approach','cruise','full']);expect(d.map(x=>x.value)).toEqual([...d.map(x=>x.value)].sort((a,b)=>a-b));
   const approach=d.find(x=>x.id==='approach')!;expect(approach.value*AIRCRAFT[id].max).toBeGreaterThan(AIRCRAFT[id].stall);expect(d.at(-1)!.value).toBe(1);
   expect(nearestDetent(id,.78).id).toBe('cruise');expect(stepThrottle(id,0,.1)).toBe(.13);expect(stepThrottle(id,1,.1)).toBe(1);expect(stepThrottle(id,.8,-.1)).toBe(.7);
  });
 }
 it('exit, collision and restoration all clear the assist flag',()=>{
  const s=newAircraft();s.occupied=true;s.takeoff=true;s.throttle=1;stepAircraft(s,{forward:0,steer:0},{...env,blocked:()=>true});expect(s.takeoff).toBe(false);
  const t=newAircraft();t.takeoff=true;createAircraftController(t,env).exit(null);expect(t.takeoff).toBe(false);
  const rows=AIRCRAFT_IDS.map(id=>({...newAircraft(id),takeoff:true}));expect(restoreAircraft(rows)?.every(r=>r.takeoff===false)).toBe(true);
 });
});
