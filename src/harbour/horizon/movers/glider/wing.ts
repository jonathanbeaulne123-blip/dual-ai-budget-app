/**
 * The hang glider as a polar, not a physics engine (FLIGHT.md §2.2–2.4). Pure and deterministic:
 * `stepWing(state, input, env, dt)` returns a new state. Integrate at a fixed step (1/60 s recommended),
 * semi-implicit Euler: speeds first, then position from the new speeds.
 *
 * Axes: engine x east, y up, z south. `heading` follows mode.ts (`atan2(dx, dz)`, 0 = south). A right bank
 * (+, right wing down) turns right, which for this yaw convention *decreases* heading.
 */
import type {Point3} from '../../world/definition.ts';
import {windVelocity,type WindSample} from '../shared/wind.ts';
import {LAUNCH_MS,GLIDER_MAX_MS,PULL_ACCEL,PUSH_ACCEL,STALL_HEIGHT_LOSS,STALL_MS,STALL_RECOVERY_MS,STALL_RECOVERY_S,barTarget,sinkAt} from './polar.ts';

export type WingPhase='run'|'flight'|'corridor'|'flare'|'touchdown'|'fade';
export interface WingState{
  x:number;y:number;z:number;
  /** Radians, mode.ts yaw. */
  heading:number;
  /** Radians, right wing down +. */
  bank:number;
  airspeed:number;
  /** Vertical speed, up +. */
  vs:number;
  phase:WingPhase;
  /** Seconds of stall recovery left (0 = flying). */
  stallT:number;
  /** Seconds since launch. */
  t:number;
  /** Seconds the bar has been pushed out inside the flare band. */
  flareT?:number;
  /** Net lift sampled on the last step (m/s), for the HUD's ↑/↓ and the vario. */
  lift?:number;
  /** Metres run toward the lip in `phase: 'run'`. */
  run?:number;
  /** Ground velocity on the last step `[vx, vz]`. */
  ground?:readonly [number,number];
  /** Airspeed / sink / ground speed on the touchdown frame. */
  touch?:{airspeed:number;sink:number;groundSpeed:number};
  /** Bodies already gusted this pass (`passThroughBodies`). */
  gusts?:readonly string[];
}
/** Bar −1…1 (+ pulled in = faster), bank −1…1 (+ right). */
export interface WingInput{bar:number;bank:number}
export interface WingEnv{
  wind:WindSample;
  /** Net vertical air motion at the rider (lift.ts `liftField`). */
  lift:(x:number,y:number,z:number,heading:number)=>number;
  /** Height of whatever is under the rider: terrain, a deck, or a water surface. */
  ground:(x:number,z:number)=>number;
  dt?:number;
}

export const WING_DT=1/60;
export const MAX_BANK=50*Math.PI/180;
export const BANK_IN_RATE=60*Math.PI/180;
export const BANK_OUT_RATE=90*Math.PI/180;
/** ω = TURN_G · tan(bank) / airspeed (FLIGHT.md §2.2: 4.9). */
export const TURN_G=4.9;
/** Height above the surface under the rider below which the wing is in its flare band. */
export const FLARE_AGL=8;
export const FLARE_SECONDS=2;
export const FLARE_AIRSPEED=8;
export const FLARE_SINK=.3;
/** The run off the pad: three steps at this pace before the lip. */
export const RUN_LENGTH=3;
export const RUN_PACE=4;

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const finite=(v:number)=>Number.isFinite(v)?v:0;
const TAU=Math.PI*2;
const wrap=(a:number)=>{let r=a%TAU;if(r>Math.PI)r-=TAU;if(r<=-Math.PI)r+=TAU;return r;};

/**
 * A wing on the rider at the pad's lip: the midpoint of `edge`, facing `heading`.
 * `run: true` starts three steps back from the lip in `phase: 'run'` (forward input runs it off);
 * otherwise the state is the lip itself, `phase: 'flight'` at 9 m/s.
 */
export function launchWing(edge:readonly Point3[]|{edge:readonly Point3[]},heading:number,options:{run?:boolean}={}):WingState{
  const points='edge' in edge?edge.edge:edge,a=points[0]!,b=points.at(-1)!;
  const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,z=(a[2]+b[2])/2,run=options.run?RUN_LENGTH:0;
  return{x:x-Math.sin(heading)*run,y,z:z-Math.cos(heading)*run,heading:wrap(heading),bank:0,airspeed:options.run?0:LAUNCH_MS,vs:0,phase:options.run?'run':'flight',stallT:0,t:0,flareT:0,run:0};
}

function stepBank(bank:number,input:number,dt:number):number{
  const target=clamp(finite(input),-1,1)*MAX_BANK;
  if(target===bank)return bank;
  // Rolling out (toward level, or across it) is 90°/s; rolling in, 60°/s.
  const outward=Math.abs(target)>Math.abs(bank)&&(bank===0||Math.sign(target)===Math.sign(bank));
  const rate=(outward?BANK_IN_RATE:BANK_OUT_RATE)*dt,next=bank+clamp(target-bank,-rate,rate);
  // Crossing level from one side to the other rolls in on the far side at the slower rate.
  return Math.sign(next)!==Math.sign(bank)&&bank!==0&&next!==0?Math.sign(next)*Math.min(Math.abs(next),BANK_IN_RATE*dt):next;
}

/** Turn rate (rad/s of heading, right bank → heading decreases). */
export function turnRate(bank:number,airspeed:number):number{return-TURN_G*Math.tan(bank)/Math.max(1,airspeed);}
/** Radius of a steady coordinated turn. */
export function turnRadius(bank:number,airspeed:number):number{return airspeed*airspeed/(TURN_G*Math.tan(Math.abs(bank))||Infinity);}

/** One fixed step. Phases 'corridor', 'touchdown' and 'fade' are owned elsewhere and returned unchanged. */
export function stepWing(state:WingState,input:WingInput,env:WingEnv,dt=env.dt??WING_DT):WingState{
  if(state.phase==='corridor'||state.phase==='touchdown'||state.phase==='fade'||!(dt>0))return state;
  const t=state.t+dt;
  if(state.phase==='run'){
    // Forward input runs the three steps; letting go stops at the lip (a visible lip, never a fall).
    if(!(input.bar>0))return{...state,t};
    const run=(state.run??0)+RUN_PACE*dt,dx=Math.sin(state.heading)*RUN_PACE*dt,dz=Math.cos(state.heading)*RUN_PACE*dt;
    if(run<RUN_LENGTH)return{...state,x:state.x+dx,z:state.z+dz,run,t,airspeed:RUN_PACE};
    return{...state,x:state.x+dx,z:state.z+dz,run:RUN_LENGTH,t,phase:'flight',airspeed:LAUNCH_MS,vs:0};
  }
  const bar=clamp(finite(input.bar),-1,1);
  const bank=stepBank(state.bank,input.bank,dt);
  let airspeed=state.airspeed,stallT=state.stallT,flareT=state.flareT??0,sink:number;
  const lift=env.lift(state.x,state.y,state.z,state.heading),ground0=env.ground(state.x,state.z),agl=state.y-ground0,inFlare=agl<FLARE_AGL;
  if(stallT===0&&airspeed<STALL_MS){stallT=STALL_RECOVERY_S;}
  if(stallT>0){
    // The nose drops: airspeed recovers to 9 over 1.5 s, 6 m are lost, the bar is ignored. Never a spin.
    const step=Math.min(dt,stallT),left=stallT;
    airspeed+=(STALL_RECOVERY_MS-airspeed)*(step/left);
    stallT=stallT-dt>1e-9?stallT-dt:0;
    sink=STALL_HEIGHT_LOSS/STALL_RECOVERY_S*(step/dt);
    flareT=0;
  }else if(inFlare&&bar<0){
    // Pushing out in the flare band bleeds airspeed to 8 and sink to 0.3 over 2 s.
    flareT=Math.min(FLARE_SECONDS,flareT+dt*-bar);
    const rate=Math.max(PUSH_ACCEL,(airspeed-FLARE_AIRSPEED)/Math.max(dt,FLARE_SECONDS-flareT+dt));
    airspeed=airspeed>FLARE_AIRSPEED?Math.max(FLARE_AIRSPEED,airspeed-rate*dt):airspeed;
    const polarSink=sinkAt(airspeed)/Math.cos(bank),f=flareT/FLARE_SECONDS;
    sink=polarSink+(FLARE_SINK-polarSink)*f;
  }else{
    const target=barTarget(bar);
    if(target>airspeed)airspeed=Math.min(target,airspeed+PULL_ACCEL*dt);
    else if(target<airspeed)airspeed=Math.max(target,airspeed-PUSH_ACCEL*dt);
    flareT=inFlare?flareT:0;
    sink=sinkAt(airspeed)/Math.cos(bank);
  }
  airspeed=Math.min(GLIDER_MAX_MS,airspeed);
  const vs=-sink+(stallT>0?0:lift);
  const heading=wrap(state.heading+turnRate(bank,airspeed)*dt);
  const [wx,wz]=windVelocity(env.wind),vx=airspeed*Math.sin(heading)+wx,vz=airspeed*Math.cos(heading)+wz;
  const x=state.x+vx*dt,z=state.z+vz*dt;let y=state.y+vs*dt;
  const ground=env.ground(x,z);
  let phase:WingPhase=y-ground<FLARE_AGL?'flare':'flight',touch:WingState['touch'];
  if(y<=ground){y=ground;phase='touchdown';touch={airspeed,sink:-vs,groundSpeed:Math.hypot(vx,vz)};}
  return{...state,x,y,z,heading,bank,airspeed,vs,phase,stallT,t,flareT,lift,ground:[vx,vz],...(touch?{touch}:{})};
}

/** A body the wing may pass through: the partner, Hercules, a walker. */
export interface PassBody{id:string;x:number;y:number;z:number}
export interface GustEvent{kind:'gust';bodyId:string;at:Point3}
export const GUST_RADIUS=3;
/** A gusted body re-arms once the wing is this far away again. */
export const GUST_REARM=6;
/**
 * No collisions with people (FLIGHT.md §2.2): bodies are passed through. A body within 3 m fires one
 * `gust` event (the 2b card and the 0.3 s wobble); it fires again only after the wing has left 6 m.
 * The state's motion is never touched: only its `gusts` memory changes.
 */
export function passThroughBodies(state:WingState,bodies:readonly PassBody[]):{state:WingState;events:GustEvent[]}{
  const seen=new Set(state.gusts??[]),events:GustEvent[]=[];
  for(const body of bodies){
    const d=Math.hypot(body.x-state.x,body.y-state.y,body.z-state.z);
    if(d<=GUST_RADIUS&&!seen.has(body.id)){seen.add(body.id);events.push({kind:'gust',bodyId:body.id,at:[body.x,body.y,body.z]});}
    else if(d>GUST_REARM&&seen.has(body.id))seen.delete(body.id);
  }
  const gusts=[...seen];
  const same=gusts.length===(state.gusts?.length??0)&&gusts.every(id=>state.gusts!.includes(id));
  return{state:same?state:{...state,gusts},events};
}
