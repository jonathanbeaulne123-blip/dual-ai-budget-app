/**
 * The Throat (FLIGHT.md §2.5): gate 12's mouth, the 30° chute, the level run over the Deep, the splash.
 * Pure and deterministic. Only a glider enters; a miss (outside the cone, over-banked, beside the aperture)
 * is simply `null` — the wing flies on past the face, never into a wall.
 *
 * Geometry as authored: the chute's axis runs from the mouth [1300, 110, 300] to the water at
 * [1300, 40, 420] (the manifest's `underground.throat` bed, 30.3°, 139 m). The wing follows that axis
 * until 25 m (horizontal) short of the water — [1300, 54.6, 395] — then the 25 m level run pulls out to
 * `splashH` 42 over its first 15 m, holds 42 for the last 10 m, and touches the water (h 40) at [1300 ± 5, 420].
 */
import type {FlightEnvelope,Point2,Point3} from '../../world/definition.ts';
import {HORIZON_MANIFEST} from '../../world/manifest.ts';
import type {ModeId} from '../shared/mode.ts';
import type {LandingNode,LandingOutcome} from './landing.ts';
import {angleDiff} from './lift.ts';

export interface ThroatGate{
  mouth:Point3;
  /** The level run's end over the water: [x, splashH, z]. */
  to:Point3;
  waterHeight:number;
  /** Width × height of the mouth's aperture, centred on `mouth`. */
  aperture:Point2;
  slopeDegrees:number;
  levelLength:number;
  splashHeight:number;
  coneDegrees:number;
  maxBankDegrees:number;
  modes:readonly string[];
}
export type CorridorPhase='corridor'|'level'|'touchdown';
export interface CorridorState{
  gate:ThroatGate;
  phase:CorridorPhase;
  /** Horizontal metres travelled from the mouth along the axis. */
  s:number;
  /** Metres right-of-axis (+x for a south-going axis is east, i.e. the rider's left; stored in world x). */
  lateral:number;
  speed:number;
  x:number;y:number;z:number;
  heading:number;
  bank:number;
  t:number;
  /** The height the level run started from (the axis height 25 m short of the water). */
  levelFrom?:number;
  splash?:'small'|'big';
  echoes?:number;
}

const m=HORIZON_MANIFEST,scale=m.scale.factor,corridor=m.sky.corridors.throat,gate12=m.sky.gates.find(g=>g.n===corridor.gate)!;
/** The Throat from the manifest alone (the envelope carries the same numbers). */
export const THROAT:ThroatGate=Object.freeze({
  mouth:[gate12.xy[0]!*scale,gate12.h*scale,gate12.xy[1]!*scale] as Point3,
  to:[corridor.to[0]!*scale,corridor.splashH*scale,corridor.to[1]!*scale] as Point3,
  waterHeight:m.underground.rooms.deep.h*scale,
  aperture:[(gate12.aperture_m?.[0]??26)*scale,(gate12.aperture_m?.[1]??18)*scale] as Point2,
  slopeDegrees:corridor.slope_deg,levelLength:corridor.level_m*scale,splashHeight:corridor.splashH*scale,
  coneDegrees:corridor.coneDeg,maxBankDegrees:corridor.maxBankDeg,modes:['glider'],
});
const jetty=m.thresholds.find(t=>t.id==='deepJetty') as {xy?:unknown}|undefined,jettyXY=Array.isArray(jetty?.xy)?jetty.xy.map(Number):[1300,440];
/** The `deepJetty` threshold: every Deep splash fades here. */
export const DEEP_JETTY:LandingNode=Object.freeze({id:'deepJetty',at:[jettyXY[0]!*scale,m.underground.rooms.deep.h*scale+.6,jettyXY[1]!*scale] as Point3,label:'the jetty'});

/** The Throat from a built envelope (its `corridors.throat` and gate volume's aperture), else the manifest. */
export function throatGate(envelope?:Pick<FlightEnvelope,'corridors'|'volumes'>):ThroatGate{
  const spec=envelope?.corridors?.throat;if(!spec)return THROAT;
  const volume=envelope.volumes?.find(v=>v.id===spec.gateId);
  return{mouth:spec.mouth,to:spec.to,waterHeight:spec.waterHeight,aperture:volume?.aperture??THROAT.aperture,slopeDegrees:spec.slopeDegrees,levelLength:spec.levelLength,splashHeight:spec.splashHeight,coneDegrees:spec.coneDegrees,maxBankDegrees:spec.maxBankDegrees,modes:spec.modes};
}

/** Half the mouth's plane depth: a wing within this of the mouth plane is "at" the aperture. */
export const MOUTH_DEPTH=3;
/** Lateral freedom: ±8 m at the mouth narrowing to ±5 m where the slope ends. */
export const LATERAL_MOUTH=8;
export const LATERAL_END=5;
/** Lateral drift per unit of bank input (m/s). */
export const LATERAL_RATE=4;
export const DIVE_SPEED=17;
export const HOLD_SPEED=13;
export const ENTRY_SPEED=11;
export const FLARE_SPEED=8;
export const PULL=2;
export const PUSH=1.5;
/** Bar at or below this is "pushed out" (the hold, the flare). */
export const PUSHED=-.5;
export const ECHOES=3;
const DEG=Math.PI/180;

function axis(gate:ThroatGate){
  const dx=gate.to[0]-gate.mouth[0],dz=gate.to[2]-gate.mouth[2],length=Math.hypot(dx,dz),drop=gate.mouth[1]-gate.waterHeight;
  return{yaw:Math.atan2(dx,dz),ux:dx/length,uz:dz/length,length,drop,slopeEnd:Math.max(0,length-gate.levelLength)};
}
/** The axis height at `s` horizontal metres from the mouth. */
export function axisHeight(gate:ThroatGate,s:number):number{const a=axis(gate);return gate.mouth[1]-a.drop*Math.min(s,a.length)/a.length;}
/** Lateral half-freedom at `s`. */
export function lateralFreedom(gate:ThroatGate,s:number):number{const a=axis(gate);return LATERAL_MOUTH+(LATERAL_END-LATERAL_MOUTH)*Math.min(1,s/(a.slopeEnd||1));}

/** Inside the mouth's aperture (width × height, centred), within the mouth plane's depth. */
export function insideAperture(gate:ThroatGate,p:{x:number;y:number;z:number}):boolean{
  const a=axis(gate),dx=p.x-gate.mouth[0],dz=p.z-gate.mouth[2],along=dx*a.ux+dz*a.uz,across=dx*a.uz-dz*a.ux;
  return Math.abs(along)<=MOUTH_DEPTH&&Math.abs(across)<=gate.aperture[0]/2&&Math.abs(p.y-gate.mouth[1])<=gate.aperture[1]/2;
}

/**
 * The approach cone: glider only, heading within ±25° of the axis (south), |bank| ≤ 20°, inside the
 * aperture. Anything else is a miss (`null`). The parachute and the plane are refused whatever they do.
 */
export function enterCorridor(gate:ThroatGate,state:{x:number;y:number;z:number;heading:number;bank:number;airspeed?:number;t?:number},mode:ModeId='glider'):CorridorState|null{
  if(!gate.modes.includes(mode))return null;
  const a=axis(gate);
  if(Math.abs(angleDiff(state.heading,a.yaw))>gate.coneDegrees*DEG+1e-9)return null;
  if(Math.abs(state.bank)>gate.maxBankDegrees*DEG+1e-9)return null;
  if(!insideAperture(gate,state))return null;
  const dx=state.x-gate.mouth[0],dz=state.z-gate.mouth[2],across=dx*a.uz-dz*a.ux,lateral=Math.max(-LATERAL_MOUTH,Math.min(LATERAL_MOUTH,across));
  const speed=Math.max(ENTRY_SPEED,Math.min(DIVE_SPEED,state.airspeed??ENTRY_SPEED)),s=0;
  return{gate,phase:'corridor',s,lateral,speed,x:gate.mouth[0]+a.uz*lateral,y:axisHeight(gate,s),z:gate.mouth[2]-a.ux*lateral,heading:a.yaw,bank:0,t:state.t??0};
}

const smooth=(u:number)=>{const k=Math.max(0,Math.min(1,u));return k*k*(3-2*k);};
/** Share of the level run spent pulling out to `splashH`; the rest is level. */
export const PULL_OUT_SHARE=.6;

/** One step down the chute: bank = lateral, bar = speed (11 → 17, pushed out holds 13), then the level run and the splash. */
export function stepCorridor(state:CorridorState,input:{bar:number;bank:number},dt:number):CorridorState{
  if(state.phase==='touchdown'||!(dt>0))return state;
  const gate=state.gate,a=axis(gate),bar=Number.isFinite(input.bar)?input.bar:0,bankIn=Math.max(-1,Math.min(1,Number.isFinite(input.bank)?input.bank:0)),t=state.t+dt;
  const pushed=bar<=PUSHED;
  let speed=state.speed;
  const target=state.phase==='level'?(pushed?FLARE_SPEED:speed):(pushed?HOLD_SPEED:DIVE_SPEED);
  speed=target>speed?Math.min(target,speed+PULL*dt):Math.max(target,speed-PUSH*dt);
  const slope=Math.atan2(a.drop,a.length),horizontal=state.phase==='level'?speed:speed*Math.cos(slope);
  let s=state.s+horizontal*dt,phase:CorridorPhase=state.phase,levelFrom=state.levelFrom;
  // A right bank drifts toward the rider's right: for a south-going axis that is −x (west).
  let lateral=state.lateral-bankIn*LATERAL_RATE*dt;
  if(phase==='corridor'&&s>=a.slopeEnd){phase='level';levelFrom=axisHeight(gate,a.slopeEnd);}
  const freedom=phase==='level'?LATERAL_END:lateralFreedom(gate,s);
  lateral=Math.max(-freedom,Math.min(freedom,lateral));
  let y:number,splash:CorridorState['splash'],echoes:number|undefined;
  if(phase==='level'){
    const u=(s-a.slopeEnd)/(gate.levelLength||1),from=levelFrom??axisHeight(gate,a.slopeEnd);
    y=from+(gate.splashHeight-from)*smooth(u/PULL_OUT_SHARE);
    if(s>=a.length){s=a.length;y=gate.waterHeight;phase='touchdown';splash=pushed?'small':'big';echoes=ECHOES;}
  }else y=axisHeight(gate,s);
  const x=gate.mouth[0]+a.ux*s+a.uz*lateral,z=gate.mouth[2]+a.uz*s-a.ux*lateral;
  return{...state,phase,s,lateral,speed,x,y,z,heading:a.yaw,bank:bankIn*gate.maxBankDegrees*DEG,t,...(levelFrom===undefined?{}:{levelFrom}),...(splash?{splash,echoes}:{})};
}

/** The splash's outcome: small (flared) or big, three echoes, and the `deepJetty` fade. */
export function corridorOutcome(state:CorridorState,jettyNode:LandingNode=DEEP_JETTY):LandingOutcome|null{
  if(state.phase!=='touchdown'||!state.splash)return null;
  return{kind:state.splash==='small'?'deepSmall':'deepBig',at:jettyNode.at,label:`→ ${jettyNode.label??'the jetty'}`,node:jettyNode,echoes:ECHOES,rule:'deep'};
}
