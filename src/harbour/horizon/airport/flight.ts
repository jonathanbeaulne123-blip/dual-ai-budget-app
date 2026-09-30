import type {AirborneBody,ModeController,MoverBody,MoverInput} from '../movers/shared/mode.ts';
import type {HorizonGeography} from '../movers/shared/registry.ts';
import {AIRPORT} from './layout.ts';
import {AIRCRAFT,AIRCRAFT_IDS,type AircraftId} from './aircraft.ts';
export const PLANE={step:1/120} as const;
export type AircraftState=MoverBody&{id:AircraftId;brake:boolean;vx:number;vy:number;vz:number;speed:number;pitch:number;bank:number;throttle:number;grounded:boolean;disabled:boolean;occupied:boolean};
export const newAircraft=(id:AircraftId='kestrel',at:MoverBody=AIRPORT.stands[id]):AircraftState=>({...at,id,brake:false,vx:0,vy:0,vz:0,speed:0,pitch:0,bank:0,throttle:0,grounded:true,disabled:false,occupied:false});
export type FlightEnvironment=Pick<HorizonGeography,'surface'|'blocked'|'ground'|'waterLevel'>&{wind?:()=>readonly[number,number]};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Fixed-step forgiving bush-plane handling. Air and ground share pose and world velocity. */
export function stepAircraft(s:AircraftState,input:Pick<MoverInput,'forward'|'steer'>,env:FlightEnvironment,dt=PLANE.step):void{
 if(s.disabled||!s.occupied)return;
 const spec=AIRCRAFT[s.id],throttle=clamp(s.throttle,0,1),target=s.grounded&&s.brake?0:throttle*spec.max;
 s.speed+=clamp(target-s.speed,-(s.grounded&&(s.brake||throttle===0)?6:2.3)*dt,spec.acceleration*dt);
 if(s.grounded){
  s.yaw-=input.steer*clamp(s.speed*.16,0,1.15)*dt;s.bank=0;
  s.pitch+=clamp((input.forward<-.15&&s.speed>=spec.rotation?.22:0)-s.pitch,-dt,dt);
  if(s.speed>=spec.rotation&&s.pitch>.06){s.grounded=false;s.vy=Math.sin(s.pitch)*s.speed;}
 }else{
  // Neutral input trims level gently; bank is coordinated and never coupled to the camera.
  s.pitch=clamp(s.pitch-input.forward*spec.pitchRate*dt,-.48,.48);
  if(Math.abs(input.forward)<.1)s.pitch*=Math.exp(-.3*dt);
  s.bank+=clamp(input.steer*spec.bankLimit-s.bank,-spec.rollRate*dt,spec.rollRate*dt);
  s.yaw-=Math.tan(s.bank)*8/Math.max(9,s.speed)*dt;
  const sink=s.speed<spec.stall?(spec.stall-s.speed)*.85:0;
  const vy=Math.sin(s.pitch)*s.speed-sink;s.vy+=(vy-s.vy)*(1-Math.exp(-3*dt));
 }
 const wind=s.grounded?[0,0]:env.wind?.()??[0,0];s.vx=Math.sin(s.yaw)*s.speed*Math.cos(s.pitch)+wind[0]!;s.vz=Math.cos(s.yaw)*s.speed*Math.cos(s.pitch)+wind[1]!;
 const nx=s.x+s.vx*dt,nz=s.z+s.vz*dt,ny=s.y+(s.grounded?0:s.vy*dt);
 const floor=env.surface(nx,nz,Math.max(s.y,ny)+.5,1),ground=floor?.y??env.ground(nx,nz),water=env.waterLevel(nx,nz);
 const impact=(reason:boolean)=>{if(reason){s.disabled=true;s.throttle=0;s.speed=0;s.vx=s.vy=s.vz=0;return true;}return false;};
 // Sample nose and both wing tips; the substep prevents thin-wall tunnelling.
 for(let axis=0;axis<2;axis++){const length=axis===0?spec.length:spec.wing;for(let along=-length/2;along<=length/2;along+=.6){
  const side=axis===1?along:0,fore=axis===0?along:0,height=axis===1?(s.id==='kestrel'?2.25:1.1):1;
  const pitchedFore=fore*Math.cos(s.pitch),rolledSide=side*Math.cos(s.bank);
  const x=nx+Math.cos(s.yaw)*rolledSide+Math.sin(s.yaw)*pitchedFore,z=nz-Math.sin(s.yaw)*rolledSide+Math.cos(s.yaw)*pitchedFore,h=ny+height+fore*Math.sin(s.pitch)-side*Math.sin(s.bank);
  if(impact(env.blocked(x,z,h,.4)||env.ground(x,z)>h))return;
 }}
 if(impact(nx<6||nz<6||nx>1994||nz>1794))return;
 if(s.grounded){
  if(impact(ground>s.y+.5||floor!==null&&floor.slope>15||water!==null&&water>ground-.2))return;
  if(ground<s.y-.5){s.grounded=false;s.vy=-.1;}else s.y=ground;
 }else if(ny<=ground){
  if(impact(s.vy< -4.5||Math.abs(s.bank)>.42||Math.abs(s.pitch)>.35||!floor||floor.slope>12||water!==null&&water>=ground-.2))return;
  s.y=ground;s.grounded=true;s.vy=0;s.pitch=0;s.bank=0;
 }else s.y=ny;
 s.x=nx;s.z=nz;
}
export function aircraftExit(s:AircraftState,env:FlightEnvironment):MoverBody|null{
 if(!s.grounded||s.speed>.5)return null;
 for(const side of [-1,1]){const x=s.x+Math.cos(s.yaw)*side*2.2,z=s.z-Math.sin(s.yaw)*side*2.2,f=env.surface(x,z,s.y+.4);if(f&&Math.abs(f.y-s.y)<.6&&!env.blocked(x,z,f.y,.35))return{x,y:f.y,z,yaw:s.yaw};}return null;
}
export function createAircraftController(s:AircraftState,env:FlightEnvironment):ModeController{
 let accumulator=0;
 return{id:'plane',enter(){s.occupied=true;accumulator=0;},
 update(dt,input){accumulator+=clamp(dt,0,.1);while(accumulator>=PLANE.step){stepAircraft(s,input,env);accumulator-=PLANE.step;}
  const sy=Math.sin(s.yaw),cy=Math.cos(s.yaw),height=s.grounded?0:Math.max(0,s.y-env.ground(s.x,s.z));
  return{body:{x:s.x,y:s.y+AIRCRAFT[s.id].cockpit,z:s.z,yaw:s.yaw},camera:{eye:[s.x-sy*16,s.y+6,s.z-cy*16],target:[s.x+sy*8,s.y+1.6,s.z+cy*8],fov:58},pose:{lean:0,roll:s.bank,pitch:s.pitch,crouch:1,slide:0,speed:s.speed},hud:{pace:`${Math.round(s.speed*3.6)} km/h`,arc:s.throttle,glyph:null,label:s.disabled?'Aircraft stopped · recover at the terminal':s.grounded?s.speed>.5?`Taxi · lift at ${Math.round(AIRCRAFT[s.id].rotation*3.6)} km/h`:'Parked':'Flying',height,lift:s.vy},sound:{slide:0,roll:0,bite:false,boost:false},fade:null,events:[]};},
 exit(){s.occupied=false;s.throttle=0;const at=aircraftExit(s,env);if(!s.grounded)s.disabled=true;s.vx=s.vy=s.vz=0;s.speed=0;return at??{x:s.x,y:s.y+AIRCRAFT[s.id].cockpit,z:s.z,yaw:s.yaw};},
 airborne():AirborneBody|null{return s.grounded?null:{x:s.x,y:s.y+AIRCRAFT[s.id].cockpit,z:s.z,yaw:s.yaw,velocity:[s.vx,s.vy,s.vz]};},
 reducedMotion(){},calm(){},tier(){},reducedMotionCut(){return{landings:[{id:'airport-arrival',label:'Airport arrival court',xy:[AIRPORT.arrival.x,AIRPORT.arrival.z],height:AIRPORT.floor}]};},dispose(){s.occupied=false;},};
}

/** Exact inventory restoration: invalid rows cannot add aircraft, resume a controller or start a motor. */
export function restoreAircraft(data:unknown):AircraftState[]|null{
 if(!Array.isArray(data)||data.length!==AIRCRAFT_IDS.length)return null;
 const ids=new Set<string>();const out:AircraftState[]=[];
 for(const raw of data){
  if(!raw||!AIRCRAFT_IDS.includes(raw.id)||ids.has(raw.id)||![raw.x,raw.y,raw.z,raw.yaw,raw.pitch,raw.bank].every(Number.isFinite)||raw.x<6||raw.x>1994||raw.z<6||raw.z>1794||raw.y< -10||raw.y>2000||typeof raw.grounded!=='boolean'||typeof raw.disabled!=='boolean')return null;
  ids.add(raw.id);out.push({...newAircraft(raw.id,raw),pitch:raw.pitch,bank:raw.bank,occupied:false,grounded:raw.grounded,disabled:raw.disabled||!raw.grounded,throttle:0,speed:0,vx:0,vy:0,vz:0,brake:false});
 }
 return out;
}
