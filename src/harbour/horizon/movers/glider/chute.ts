/** One continuous airborne velocity, with a canopy that adds drag as it inflates. */
import type {Point2} from '../../world/definition.ts';
import {windVelocity,type WindSample} from '../shared/wind.ts';
import {CHUTE,chuteAt} from './polar.ts';
import {HORIZON_MANIFEST} from '../../world/manifest.ts';
import type {AirborneBody} from '../shared/mode.ts';

export type ChutePhase='freefall'|'opening'|'canopy'|'flare'|'touchdown'|'fade';
export interface ChuteTouchdown{xy:Point2;groundSpeed:number;flared:boolean;ringIndex:number}
export interface ChuteState{
  phase:ChutePhase;x:number;y:number;z:number;vx:number;vy:number;vz:number;heading:number;brakeT:number;t:number;
  inflation?:number;pullHeld?:boolean;contactT?:number;openT?:number;openFrom?:number;
  releaseT?:number;brake?:number;flareHeld?:boolean;snapped?:boolean;pulledBy?:'hand'|'auto';touchdown?:ChuteTouchdown;
}
export interface ChuteInput{lean:readonly [number,number];pull:boolean;brake:number;yaw:number}
export interface ChuteEnv{
  wind:WindSample;
  windAt?:(x:number,y:number,z:number)=>WindSample;
  ready?:(x:number,z:number)=>boolean;
  ceiling?:(x:number,z:number,y:number)=>number;
  ground:(x:number,z:number,y?:number)=>number;
  /** A wall is not a landing. Upward-facing support is tested separately. */
  blocked?:(x:number,y:number,z:number)=>boolean;
  normal?:(x:number,z:number,y:number)=>readonly [number,number,number];
  sink?:(x:number,y:number,z:number)=>number;
  dropZone?:{xy:Point2;rings:readonly number[]};
}
export interface PlaneDoor{x:number;y:number;z:number;vx:number;vy?:number;vz:number;heading:number}
export const DROP_ZONE_RINGS=[5,10,25] as const;
const DROP_ZONE_XY:Point2=[HORIZON_MANIFEST.sky.dropZone.xy[0]!*HORIZON_MANIFEST.scale.factor,HORIZON_MANIFEST.sky.dropZone.xy[1]!*HORIZON_MANIFEST.scale.factor];
export const FLARE_BRAKE=.5;
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const finite=(v:number)=>Number.isFinite(v)?v:0;
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const SUPPORT_SECONDS=.04;
const SUPPORT_NORMAL=Math.cos(HORIZON_MANIFEST.profiles.walkable.slope_max_deg*Math.PI/180);

/** No height, fall-time, equipment-unlock, or aircraft condition belongs here. */
export function airborneChute(body:AirborneBody,open=false):ChuteState{
  return{phase:open?'opening':'freefall',x:body.x,y:body.y,z:body.z,vx:body.velocity[0],vy:body.velocity[1],vz:body.velocity[2],heading:wrap(body.yaw),brakeT:0,t:0,inflation:0,pullHeld:open,openT:0,brake:0};
}
/** A plane exit is just another airborne source. Ground contact, not height, excludes a bail. */
export function bailOut(plane:PlaneDoor,agl:number):ChuteState|null{
  if(!Number.isFinite(agl)||agl<=0)return null;
  return airborneChute({x:plane.x,y:plane.y,z:plane.z,yaw:plane.heading,velocity:[plane.vx,plane.vy??0,plane.vz]});
}
export function ringIndex(xy:readonly [number,number],zone:{xy:Point2;rings:readonly number[]}={xy:DROP_ZONE_XY,rings:DROP_ZONE_RINGS}):number{
  const d=Math.hypot(xy[0]-zone.xy[0],xy[1]-zone.xy[1]);return zone.rings.findIndex(r=>d<=r+1e-9);
}

export function stepChute(state:ChuteState,input:ChuteInput,env:ChuteEnv,dt:number):ChuteState{
  if(state.phase==='touchdown'||state.phase==='fade'||!(dt>0))return state;
  // The controller supplies fixed steps; bound direct callers too, without dropping elapsed time.
  if(dt>1/60+1e-9){let out=state,left=dt;while(left>1e-9){const h=Math.min(left,1/120);out=stepChute(out,input,env,h);left-=h;}return out;}
  let phase:ChutePhase=state.phase,inflation=state.inflation??(phase==='canopy'||phase==='flare'?1:0);
  const edge=input.pull&&!state.pullHeld;
  if(edge)phase=phase==='freefall'?'opening':'freefall';
  const opening=phase!=='freefall';
  inflation=clamp(inflation+dt*(opening?1/CHUTE.openingSeconds:-5),0,1);
  if(opening)phase=inflation<1-1e-9?'opening':'canopy';
  const [wx,wz]=windVelocity(env.windAt?.(state.x,state.y,state.z)??env.wind);
  const ground0=env.ground(state.x,state.z,state.y),agl=state.y-ground0;
  const yaw=clamp(finite(input.yaw),-1,1),heading=wrap(state.heading-yaw*CHUTE.yawRate*inflation*dt);
  let brake=opening?clamp(finite(input.brake),0,1):0;
  let brakeT=brake>=.99?state.brakeT+dt:0,releaseT=Math.max(0,(state.releaseT??0)-dt);
  const inBand=agl<=CHUTE.flareAgl;
  if(brakeT>CHUTE.fullBrakeSeconds&&!inBand)releaseT=CHUTE.mushReleaseSeconds;
  if(releaseT>0){brake=0;brakeT=0;}
  let {forward,sink}=chuteAt(brake);
  if(releaseT>0)sink=CHUTE.mushSink;
  else if(phase==='canopy'&&inBand&&brake>=FLARE_BRAKE){
    phase='flare';if(brake>=.99){const f=clamp(1-agl/CHUTE.flareAgl,0,1);forward=2*(1-f);sink=1.5-f;}
  }
  sink+=CHUTE.turnSink*Math.abs(yaw)-Math.min(0,env.sink?.(state.x,state.y,state.z)??0);
  let lx=finite(input.lean[0]),lz=finite(input.lean[1]);const len=Math.hypot(lx,lz);if(len>1){lx/=len;lz/=len;}
  // All controls supply finite forces toward a target. Neither deploy nor retract assigns a new velocity.
  const airDrag=.18,canopyDrag=2.5*inflation,k=airDrag*(1-inflation)+canopyDrag;
  const tx=(lx*CHUTE.leanMax+wx*.5)*(1-inflation)+(Math.sin(heading)*forward+wx)*inflation;
  const tz=(lz*CHUTE.leanMax+wz*.5)*(1-inflation)+(Math.cos(heading)*forward+wz)*inflation;
  const blend=1-Math.exp(-k*dt);
  let vx=state.vx+(tx-state.vx)*blend,vz=state.vz+(tz-state.vz)*blend;
  let vy=state.vy < -CHUTE.freefallCap
    ? -CHUTE.freefallCap+(state.vy+CHUTE.freefallCap)*Math.exp(-2*dt)
    : Math.max(-CHUTE.freefallCap,state.vy-CHUTE.gravity*(1-inflation)*dt);
  // A strictly negative equilibrium prevents toggle pumping. Existing upward momentum is allowed to decay.
  vy=-sink+(vy+sink)*Math.exp(-3*inflation*dt);
  if(env.ready&&!env.ready(state.x+vx*dt,state.z+vz*dt))return{...state,phase,inflation,pullHeld:input.pull,openT:inflation*CHUTE.openingSeconds};
  let x=state.x,z=state.z,y=state.y;
  let supported=false;
  const steps=Math.max(1,Math.ceil(Math.hypot(vx,vy,vz)*dt/.2)),h=dt/steps;
  for(let i=0;i<steps;i++){
    let nx=x+vx*h,nz=z+vz*h,ny=y+vy*h;
    const ceiling=env.ceiling?.(nx,nz,y)??Infinity;
    if(vy>0&&ny+1.25>=ceiling){ny=ceiling-1.25;vy=0;}
    if(env.blocked?.(nx,ny,nz)){
      const canX=!env.blocked(nx,ny,z),canZ=!env.blocked(x,ny,nz);
      if(!canX){nx=x;vx=0;}if(!canZ){nz=z;vz=0;}
      if(canX&&canZ){nx=x;nz=z;vx=0;vz=0;}
      if(env.blocked(nx,ny,nz)){ny=y;vy=Math.min(0,vy);}
    }
    const floor=env.ground(nx,nz,y),n=env.normal?.(nx,nz,floor)??[0,1,0];
    const onSupport=supported||(state.contactT??0)>0;
    supported=false;
    const inward=vx*n[0]+vy*n[1]+vz*n[2];
    if((ny<=floor||onSupport&&ny-floor<=.04)&&(vy<=0||inward<=0)&&y>=floor-.2){
      ny=floor;
      if(n[1]>=SUPPORT_NORMAL){
        supported=true;
        // Retain tangential momentum on slopes; vertical=0 would bounce above downhill support.
        vx-=inward*n[0];vy-=inward*n[1];vz-=inward*n[2];
      }
      else{
        // Brush a steep face: remove inward speed and slide along it, keeping the canopy available.
        const dot=vx*n[0]+vy*n[1]+vz*n[2];if(dot<0){vx-=dot*n[0];vy-=dot*n[1];vz-=dot*n[2];}
      }
    }else if(ny<floor){nx=x;nz=z;vx=0;vz=0;}
    x=nx;y=ny;z=nz;
  }
  const contactT=supported?(state.contactT??0)+dt:0;
  const canopyStep=phase==='canopy'||phase==='flare';
  const flareHeld=canopyStep&&inBand?(state.flareHeld??true)&&brake>=FLARE_BRAKE:undefined;
  const touchdown=contactT>=SUPPORT_SECONDS?{xy:[x,z] as Point2,groundSpeed:Math.hypot(vx,vz),flared:flareHeld===true,ringIndex:ringIndex([x,z],env.dropZone)}:undefined;
  if(touchdown){phase='touchdown';inflation=0;}
  return{phase,x,y,z,vx,vy,vz,heading,brakeT,t:state.t+dt,inflation,pullHeld:input.pull,contactT,openT:inflation*CHUTE.openingSeconds,releaseT,brake,flareHeld,snapped:edge&&opening,pulledBy:edge&&opening?'hand':state.pulledBy,touchdown};
}
