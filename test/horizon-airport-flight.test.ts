import {describe,it,expect} from 'vitest';
import {AIRCRAFT,AIRCRAFT_IDS} from '../src/harbour/horizon/airport/aircraft.ts';
import {newAircraft,stepAircraft,restoreAircraft,aircraftExit,createAircraftController,PLANE,type FlightEnvironment} from '../src/harbour/horizon/airport/flight.ts';
const env:FlightEnvironment={ground:()=>38,surface:()=>({id:'strip',y:38,nx:0,ny:1,nz:0,slope:0,material:'paved'}),blocked:()=>false,waterLevel:()=>null};
const input={forward:0,steer:0};
function step(s:ReturnType<typeof newAircraft>,seconds:number,forward=0,steer=0){for(let n=0;n<seconds/PLANE.step;n++)stepAircraft(s,{forward,steer},env);}
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
