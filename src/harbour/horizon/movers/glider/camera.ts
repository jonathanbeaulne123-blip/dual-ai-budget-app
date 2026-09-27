/**
 * The flight cam (FLIGHT.md §4) for both wings, on `camera/obstruction.ts`. It is not `camera/flight.ts`
 * (the Look camera's between-places flight). Horizon-locked: every pose has roll 0; the camera's lean into a
 * turn (≤ 8°, full tier only, 0 under reduced motion) is a lateral eye offset, never a roll.
 *
 * `flightCamera(state, opts)` is pure: this frame's flight state + the previous camera memory in, a pose and the
 * next memory out. `createFlightCam()` is the stateful wrapper the controllers hold (memory + the handoff blends:
 * run-off 0.8 s, the Throat's mouth 1.0 s, the pull 1.2 s; every blend is a cut under reduced motion).
 */
import {clearFraction,createPullIn} from '../../../camera/obstruction.ts';
import type {ModeCameraPose,MoverBody,Vec3} from '../shared/mode.ts';
import {angleDiff} from './lift.ts';
import {MAX_BANK} from './wing.ts';

export type FlightCamKind='glider'|'corridor'|'freefall'|'canopy';
export interface FlightCamState{
  kind:FlightCamKind;
  /** The rider (the sim's position). */
  rider:Vec3;
  /** Radians, mode.ts yaw (0 faces +z). */
  heading:number;
  /** Radians, right wing down +. */
  bank:number;
  /** Ground velocity [vx, vy, vz], m/s. */
  velocity:Vec3;
  airspeed:number;
  /** The corridor's axis: yaw, and its pitch down (30° in the chute, 0 on the level run). */
  axis?:{yaw:number;slope:number;floor?:number};
}
export interface FlightCamMemory{yaw:number;yawRate:number;lookYaw:number;lookPitch:number;lookIdle:number;pull:number}
export interface FlightCamOptions{
  dt:number;
  tier:'full'|'lite';
  reducedMotion:boolean;
  prev?:FlightCamMemory|null;
  /** This frame's free-look delta [yaw, pitch] in radians. */
  look?:readonly [number,number];
  /** What is under a point at height y (terrain, a deck, water): the 2 m floor. */
  ground?:(x:number,z:number,y:number)=>number;
  /** The obstruction point test (terrain, hosts) for `clearFraction`, marched every 0.5 m. */
  blocked?:(x:number,y:number,z:number)=>boolean;
  /** A costlier structure test, sampled at four points along the line and at the eye. */
  solid?:(x:number,y:number,z:number)=>boolean;
}
export interface FlightCamResult{pose:ModeCameraPose;memory:FlightCamMemory;
  /** The lean applied this frame (radians, + toward the rider's right). */
  lean:number}

const DEG=Math.PI/180;
/** FLIGHT.md §4, the table. */
export const FLIGHT_CAM={
  glider:{behind:14,above:4.5,ahead:22,fov:55,fovBoost:8,fovFrom:11,fovAt:17,freeYaw:120*DEG,pitchMin:-30*DEG,pitchMax:45*DEG},
  corridor:{behind:8,above:2.5,ahead:22,fov:55},
  freefall:{behind:6,above:6,pitch:-35*DEG,fov:62},
  canopy:{behind:9,above:3,pitch:-20*DEG,ahead:12,fov:55,freeYaw:90*DEG},
  leanMax:8*DEG,
  yawSpring:.35,
  yawLagMax:12*DEG,
  pitchShare:.5,
  floor:2,
  lookReturnAfter:1.5,
  lookReturnTau:.3,
  blend:{runOff:.8,mouth:1,pull:1.2,touchdown:.6},
} as const;
/** The runtime's walk camera (runtime/index.ts `updateCamera`: 9 behind, pitch −0.26, eye height 1.15). */
export const WALK_CAM={distance:9,pitch:-.26,eye:1.15} as const;

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const wrap=(a:number)=>angleDiff(a,0);
const add=(a:Vec3,b:Vec3,k=1):Vec3=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k];
const dir=(yaw:number,pitch:number):Vec3=>[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
export const distance3=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

/** The walk camera's pose for a body (the handoff's other end). */
export function walkCameraPose(body:MoverBody,fov=45):ModeCameraPose{
  const target:Vec3=[body.x,body.y+WALK_CAM.eye,body.z];
  return{eye:[body.x-Math.sin(body.yaw)*WALK_CAM.distance,target[1]-Math.sin(WALK_CAM.pitch)*WALK_CAM.distance,body.z-Math.cos(body.yaw)*WALK_CAM.distance],look:target,fov,roll:0};
}
/** Lean toward the bank: ≤ 8° at full tier, 0 on lite or under reduced motion. */
export function cameraLean(bank:number,tier:'full'|'lite',reducedMotion:boolean):number{
  return tier==='full'&&!reducedMotion?clamp(bank/MAX_BANK,-1,1)*FLIGHT_CAM.leanMax:0;
}
/** FOV per phase; 55° fixed on lite and under reduced motion. */
export function cameraFov(kind:FlightCamKind,airspeed:number,tier:'full'|'lite',reducedMotion:boolean):number{
  const fixed=tier!=='full'||reducedMotion,g=FLIGHT_CAM.glider;
  if(fixed)return 55;
  if(kind==='glider')return g.fov+g.fovBoost*clamp((airspeed-g.fovFrom)/(g.fovAt-g.fovFrom),0,1);
  return FLIGHT_CAM[kind].fov;
}
export function initialMemory(heading:number):FlightCamMemory{return{yaw:heading,yawRate:0,lookYaw:0,lookPitch:0,lookIdle:Infinity,pull:1};}

/** Critically damped yaw spring (0.35 s), lag clamped to 12°. Sub-stepped so a long dt stays stable. */
function springYaw(yaw:number,rate:number,target:number,dt:number):[number,number]{
  const w=1/FLIGHT_CAM.yawSpring;let t=Math.max(0,dt);
  while(t>1e-9){const h=Math.min(t,1/120);const e=angleDiff(yaw,target);const a=-w*w*e-2*w*rate;rate+=a*h;yaw=wrap(yaw+rate*h);t-=h;}
  const lag=angleDiff(yaw,target);
  if(Math.abs(lag)>FLIGHT_CAM.yawLagMax){yaw=wrap(target+Math.sign(lag)*FLIGHT_CAM.yawLagMax);if(Math.sign(rate)!==Math.sign(-lag))rate=0;}
  return[yaw,rate];
}

/** One frame of the flight cam. Pure. */
export function flightCamera(state:FlightCamState,opts:FlightCamOptions):FlightCamResult{
  const dt=Math.max(0,opts.dt),prev=opts.prev??initialMemory(state.heading),reduced=opts.reducedMotion;
  const r=state.rider,up:Vec3=[0,1,0];
  // Free look: orbit within the phase's limits; springs back 1.5 s after the last input.
  const free=state.kind==='glider'?FLIGHT_CAM.glider.freeYaw:state.kind==='canopy'?FLIGHT_CAM.canopy.freeYaw:0;
  let {lookYaw,lookPitch,lookIdle}=prev;
  const look=opts.look??[0,0],moved=free>0&&(look[0]!==0||look[1]!==0);
  if(free>0){
    lookYaw=clamp(lookYaw+look[0],-free,free);lookPitch=clamp(lookPitch+look[1],FLIGHT_CAM.glider.pitchMin,FLIGHT_CAM.glider.pitchMax);
    lookIdle=moved?0:lookIdle+dt;
    if(lookIdle>FLIGHT_CAM.lookReturnAfter){const k=Math.exp(-dt/FLIGHT_CAM.lookReturnTau);lookYaw*=k;lookPitch*=k;if(Math.abs(lookYaw)<1e-4)lookYaw=0;if(Math.abs(lookPitch)<1e-4)lookPitch=0;}
  }else{lookYaw=0;lookPitch=0;lookIdle=Infinity;}
  // Yaw: the axis in the corridor, else the heading through the spring.
  let yaw:number,yawRate:number;
  if(state.kind==='corridor'&&state.axis){yaw=state.axis.yaw;yawRate=0;}
  else[yaw,yawRate]=springYaw(prev.yaw,prev.yawRate,state.heading,dt);
  const lean=state.kind==='glider'?cameraLean(state.bank,opts.tier,reduced):0;
  let desired:Vec3,target:Vec3,obstruct=true;
  const camYaw=yaw+lookYaw,right:Vec3=[-Math.cos(camYaw),0,Math.sin(camYaw)];
  switch(state.kind){
    case 'glider':{
      const g=FLIGHT_CAM.glider,[vx,vy,vz]=state.velocity,horizontal=Math.hypot(vx,vz);
      const pitch=FLIGHT_CAM.pitchShare*Math.atan2(vy,Math.max(1e-6,horizontal))+lookPitch,d=dir(camYaw,pitch);
      desired=add(add(add(r,d,-g.behind),up,g.above*Math.cos(lean)),right,g.above*Math.sin(lean));
      // 22 ahead along the velocity vector (turned by any free look).
      const speed=Math.hypot(vx,vy,vz),trackYaw=horizontal>.5?Math.atan2(vx,vz):yaw,trackPitch=speed>.5?Math.atan2(vy,horizontal):0;
      target=add(r,dir(trackYaw+lookYaw,trackPitch+lookPitch),g.ahead);
      break;
    }
    case 'corridor':{
      const c=FLIGHT_CAM.corridor,d=dir(yaw,-(state.axis?.slope??30*DEG));
      desired=add(add(r,d,-c.behind),up,c.above);target=add(r,d,c.ahead);obstruct=false;
      break;
    }
    case 'freefall':{
      const f=FLIGHT_CAM.freefall,h=dir(yaw,0);
      desired=add(add(r,h,-f.behind),up,f.above);target=add(desired,dir(yaw,f.pitch),20);
      break;
    }
    case 'canopy':{
      const c=FLIGHT_CAM.canopy,h=dir(yaw,0);
      desired=add(add(r,h,-c.behind),up,c.above);
      target=add(desired,dir(camYaw,c.pitch+lookPitch),Math.hypot(c.behind+c.ahead,c.above));
      if(lookYaw!==0)desired=add(add(r,dir(camYaw,0),-c.behind),up,c.above);
      break;
    }
  }
  // Ground: pull in by clearFraction (fast in, slow out), then never below the 2 m floor or inside a host.
  let pull=1;
  if(obstruct&&opts.blocked){
    const p=createPullIn();p.reset(prev.pull);
    const clear=Math.min(clearFraction(r,desired,opts.blocked,.5,48),opts.solid?clearFraction(r,desired,opts.solid,4,4):1);
    pull=p.update(clear,dt,reduced);
  }
  let eye=add(r,[desired[0]-r[0],desired[1]-r[1],desired[2]-r[2]],pull);
  if(opts.ground){
    const floor=opts.ground(eye[0],eye[2],eye[1])+FLIGHT_CAM.floor;
    if(state.kind==='corridor'){const min=(state.axis?.floor??-Infinity)+FLIGHT_CAM.floor;if(eye[1]<min)eye=[eye[0],min,eye[2]];}
    else if(eye[1]<floor)eye=[eye[0],floor,eye[2]];
  }
  const inside=(p:Vec3)=>!!opts.blocked?.(p[0],p[1],p[2])||!!opts.solid?.(p[0],p[1],p[2]);
  if(obstruct)for(let k=0;k<40&&inside(eye);k++)eye=[eye[0],eye[1]+1,eye[2]];
  return{pose:{eye,look:target,fov:cameraFov(state.kind,state.airspeed,opts.tier,reduced),roll:0},memory:{yaw,yawRate,lookYaw,lookPitch,lookIdle,pull},lean};
}

const smooth=(u:number)=>{const k=clamp(u,0,1);return k*k*(3-2*k);};
export function lerpPose(a:ModeCameraPose,b:ModeCameraPose,u:number):ModeCameraPose{
  const k=smooth(u),mix=(p:Vec3,q:Vec3):Vec3=>[p[0]+(q[0]-p[0])*k,p[1]+(q[1]-p[1])*k,p[2]+(q[2]-p[2])*k];
  return{eye:mix(a.eye,b.eye),look:mix(a.look,b.look),fov:a.fov+(b.fov-a.fov)*k,roll:0};
}

/** The controllers' camera: memory between frames, a held pose, and the handoff blends. */
export function createFlightCam(){
  let memory:FlightCamMemory|null=null,pose:ModeCameraPose|null=null,held:ModeCameraPose|null=null,lean=0;
  let blend:{from:ModeCameraPose;t:number;duration:number}|null=null;
  return{
    /** Hold a fixed pose (the walk cam before the first running step; the last pose on the ground). */
    hold(p:ModeCameraPose|null){held=p;if(p)pose=p;},
    /** Blend from the current output over `seconds` (a cut under reduced motion). */
    blendFrom(seconds:number,reducedMotion:boolean,from:ModeCameraPose|null=pose){blend=!reducedMotion&&from&&seconds>0?{from,t:0,duration:seconds}:null;},
    blending:()=>blend!==null,
    reset(heading:number){memory=initialMemory(heading);blend=null;held=null;},
    update(state:FlightCamState,opts:Omit<FlightCamOptions,'prev'>):ModeCameraPose{
      if(held){pose=held;return held;}
      const out=flightCamera(state,{...opts,prev:memory});memory=out.memory;lean=out.lean;
      let next=out.pose;
      if(blend){blend.t+=opts.dt;next=lerpPose(blend.from,out.pose,blend.t/blend.duration);if(blend.t>=blend.duration)blend=null;}
      pose=next;return next;
    },
    pose:()=>pose,
    memory:()=>memory,
    lean:()=>lean,
  };
}
export type FlightCam=ReturnType<typeof createFlightCam>;
