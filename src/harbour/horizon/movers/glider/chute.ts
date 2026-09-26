/**
 * The square canopy (FLIGHT.md §3). Reached only by the plane's carried `bailOut` threshold.
 * Pure and deterministic: `stepChute(state, input, env, dt)` returns a new state.
 *
 * Axes: engine x east, y up, z south; heading follows mode.ts (0 = south). `lean` is a world-axis
 * `[x, z]` steer (the controller turns the Move pad into it by the camera's yaw).
 */
import type {Point2} from '../../world/definition.ts';
import {windVelocity,type WindSample} from '../shared/wind.ts';
import {CHUTE,chuteAt} from './polar.ts';

export type ChutePhase='freefall'|'opening'|'canopy'|'flare'|'touchdown'|'fade';
/**
 * `flared`: the brakes were ≥ 0.5 on every step of the last 5 m (FLIGHT §3.4 as ruled). The stand-up also needs
 * ground speed ≤ 3 m/s; `resolveTouchdown` applies that half of the rule.
 */
export interface ChuteTouchdown{xy:Point2;groundSpeed:number;flared:boolean;ringIndex:number}
export interface ChuteState{
  phase:ChutePhase;
  x:number;y:number;z:number;
  /** Ground velocity, m/s (vy up +). */
  vx:number;vy:number;vz:number;
  heading:number;
  /** Seconds the brakes have been held full (the 3 s limit). */
  brakeT:number;
  t:number;
  /** The plane's velocity still carried in freefall `[vx, vz]`, decaying with τ 0.5 s. */
  carried?:readonly [number,number];
  /** Seconds into the 1.2 s opening, and the fall speed it started from. */
  openT?:number;openFrom?:number;
  /** Seconds left of the mush's auto-release (brakes up, sink 4). */
  releaseT?:number;
  /** The brake setting applied on the last step. */
  brake?:number;
  /** Inside the last 5 m: true while the brakes have been ≥ 0.5 on every step since entering it (the flare). */
  flareHeld?:boolean;
  /** True on the step the pull happened (auto or by hand): the snap. */
  snapped?:boolean;
  pulledBy?:'hand'|'auto';
  touchdown?:ChuteTouchdown;
}
export interface ChuteInput{lean:readonly [number,number];pull:boolean;brake:number;yaw:number}
export interface ChuteEnv{
  wind:WindSample;
  /** Height of whatever is under the rider at height `y` (a deck above the rider is not ground). */
  ground:(x:number,z:number,y?:number)=>number;
  /** Sink fields only (the Bight, the Notch): m/s, ≤ 0. No thermal or ridge lift for the canopy. */
  sink?:(x:number,y:number,z:number)=>number;
  /** The Drop Zone target for `touchdown.ringIndex`. */
  dropZone?:{xy:Point2;rings:readonly number[]};
}
export interface PlaneDoor{x:number;y:number;z:number;vx:number;vz:number;heading:number}

export const DROP_ZONE_RINGS=[5,10,25] as const;
const FULL=.99;
/** Brakes at or above this through the last 5 m are a flare (FLIGHT §3.4 as ruled: half brakes or more). */
export const FLARE_BRAKE=.5;
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const finite=(v:number)=>Number.isFinite(v)?v:0;
const TAU=Math.PI*2;
const wrap=(a:number)=>{let r=a%TAU;if(r>Math.PI)r-=TAU;if(r<=-Math.PI)r+=TAU;return r;};

/** Jump: refused (null) below 60 m above the ground under the plane. The rider leaves with the plane's velocity. */
export function bailOut(plane:PlaneDoor,agl:number):ChuteState|null{
  if(!(agl>=CHUTE.minBailAgl))return null;
  return{phase:'freefall',x:plane.x,y:plane.y,z:plane.z,vx:plane.vx,vy:0,vz:plane.vz,heading:wrap(plane.heading),brakeT:0,t:0,carried:[plane.vx,plane.vz],brake:0};
}

/** 0 bullseye (≤ 5 m), 1 inner (≤ 10), 2 outer (≤ 25), −1 beyond ("on the Green"). */
export function ringIndex(xy:readonly [number,number],zone:{xy:Point2;rings:readonly number[]}={xy:[1040,1065],rings:DROP_ZONE_RINGS}):number{
  const d=Math.hypot(xy[0]-zone.xy[0],xy[1]-zone.xy[1]);
  return zone.rings.findIndex(r=>d<=r+1e-9);
}

export function stepChute(state:ChuteState,input:ChuteInput,env:ChuteEnv,dt:number):ChuteState{
  if(state.phase==='touchdown'||state.phase==='fade'||!(dt>0))return state;
  const t=state.t+dt,ground0=env.ground(state.x,state.z,state.y),agl=state.y-ground0,[wx,wz]=windVelocity(env.wind);
  const sinkField=Math.min(0,env.sink?.(state.x,state.y,state.z)??0);
  let phase:ChutePhase=state.phase,{heading,brakeT}=state,vx:number,vy:number,vz:number,openT=state.openT,openFrom=state.openFrom,releaseT=state.releaseT??0,carried=state.carried,snapped=false,pulledBy=state.pulledBy,brake=0;
  const inBand=agl<=CHUTE.flareAgl;
  if(phase==='freefall'){
    const decay=Math.exp(-dt/CHUTE.planeTau);carried=[(carried?.[0]??0)*decay,(carried?.[1]??0)*decay];
    let lx=finite(input.lean[0]),lz=finite(input.lean[1]);const l=Math.hypot(lx,lz);if(l>1){lx/=l;lz/=l;}
    vx=carried[0]+lx*CHUTE.leanMax+wx*CHUTE.freefallWind;vz=carried[1]+lz*CHUTE.leanMax+wz*CHUTE.freefallWind;
    vy=Math.max(-CHUTE.freefallCap,state.vy-CHUTE.gravity*dt);
    if(input.pull||agl<=CHUTE.autoPullAgl){phase='opening';openT=0;openFrom=-vy;snapped=true;pulledBy=input.pull&&agl>CHUTE.autoPullAgl?'hand':'auto';}
  }else if(phase==='opening'){
    openT=(openT??0)+dt;const u=Math.min(1,openT/CHUTE.openingSeconds),from=openFrom??CHUTE.freefallCap;
    // Square-root curve: most of the fall speed goes in the first instants of the snap.
    vy=-(from+(CHUTE.openedSink-from)*Math.sqrt(u));
    const decay=Math.exp(-dt/CHUTE.planeTau);carried=[(carried?.[0]??0)*decay,(carried?.[1]??0)*decay];
    const drive=chuteAt(0).forward*u;
    vx=carried[0]+Math.sin(heading)*drive+wx*(CHUTE.freefallWind+(1-CHUTE.freefallWind)*u);
    vz=carried[1]+Math.cos(heading)*drive+wz*(CHUTE.freefallWind+(1-CHUTE.freefallWind)*u);
    if(u>=1){phase='canopy';carried=[0,0];}
  }else{
    // Canopy (and its flare band): toggles set forward and sink; the wind acts in full.
    const yaw=clamp(finite(input.yaw),-1,1);
    heading=wrap(heading-yaw*CHUTE.yawRate*dt);
    let forward:number,sink:number;
    const wanted=clamp(finite(input.brake),0,1),wantFull=wanted>=FULL;
    if(releaseT>0){
      // The mush: sink 4, brakes released themselves for 1 s.
      releaseT=Math.max(0,releaseT-dt);brake=0;forward=chuteAt(0).forward;sink=CHUTE.mushSink;
      if(releaseT===0)brakeT=0;
      if(phase==='flare')phase='canopy';
    }else if(inBand&&wanted>=FLARE_BRAKE){
      // The flare: half brakes or more in the last 5 m (no 3 s limit here). Full brakes take forward 2 → 0 and
      // sink 1.5 → 0.5 as the ground comes up; half to full fly the toggle table (half: 4 forward, 2.2 sink).
      phase='flare';
      if(wantFull){brake=1;const f=clamp(1-agl/CHUTE.flareAgl,0,1);forward=2*(1-f);sink=1.5-f;}
      else{brake=wanted;({forward,sink}=chuteAt(brake));}
    }else{
      brake=wanted;brakeT=wantFull?brakeT+dt:0;
      ({forward,sink}=chuteAt(brake));
      if(brakeT>CHUTE.fullBrakeSeconds){releaseT=CHUTE.mushReleaseSeconds;brake=0;sink=CHUTE.mushSink;forward=chuteAt(0).forward;}
      if(phase==='flare')phase='canopy';
    }
    if(Math.abs(yaw)>.05)sink+=CHUTE.turnSink*Math.abs(yaw);
    vx=Math.sin(heading)*forward+wx;vz=Math.cos(heading)*forward+wz;vy=-sink;
  }
  if(phase!=='freefall')vy+=sinkField;
  // The flare is held only if the brakes stayed ≥ 0.5 on every canopy step inside the last 5 m.
  const canopyStep=phase==='canopy'||phase==='flare',flareHeld=canopyStep&&inBand?(state.flareHeld??true)&&brake>=FLARE_BRAKE:undefined;
  const x=state.x+vx*dt,z=state.z+vz*dt;let y=state.y+vy*dt;
  const ground=env.ground(x,z,state.y);
  let touchdown:ChuteTouchdown|undefined;
  if(y<=ground){
    y=ground;
    const groundSpeed=Math.hypot(vx,vz),flared=flareHeld===true;
    touchdown={xy:[x,z],groundSpeed,flared,ringIndex:ringIndex([x,z],env.dropZone)};
    phase='touchdown';
  }
  const {flareHeld:_held,...rest}=state;void _held;
  return{...rest,phase,x,y,z,vx,vy,vz,heading,brakeT,t,carried,releaseT,brake,snapped,...(flareHeld===undefined?{}:{flareHeld}),
    ...(openT===undefined?{}:{openT}),...(openFrom===undefined?{}:{openFrom}),...(pulledBy?{pulledBy}:{}),...(touchdown?{touchdown}:{})};
}
