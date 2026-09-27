/**
 * Lift and sink from the flight envelope's volumes (FLIGHT.md §2.2). Pure: an envelope, a wind sample,
 * a position, a heading and the local hour in; m/s (up positive) out.
 *
 * Coordinates: engine x east, y up, z south (manifest xy = [x, z]); heading follows mode.ts,
 * `atan2(dx, dz)`: 0 faces +z (south), π/2 east, −π/2 west, π north.
 */
import type {FlightEnvelope,FlightVolume} from '../../world/definition.ts';
import type {WindSample} from '../shared/wind.ts';

export type LiftKind='thermal'|'ridge'|'sink'|null;
export interface LiftSample{lift:number;kind:LiftKind}
export interface LiftPoint{x:number;y:number;z:number}
export type LiftEnvelope=Pick<FlightEnvelope,'volumes'|'ceiling'>;

export const THERMAL_CORE=2.5;
export const RIDGE_LIFT=2;
export const SINK_CORE=-1;
/** Ridge lift is full below this height and fades to 0 at `RIDGE_TOP`. */
export const RIDGE_FULL_BELOW=220;
export const RIDGE_TOP=280;
/** The wind must blow from within this of south, and the heading be within this of east or west. */
export const RIDGE_WIND_CONE=Math.PI/4;
export const RIDGE_HEADING_CONE=Math.PI/3;
/** Every lift fades linearly to 0 over the last 20 m under the ceiling (280 → 300). */
export const CEILING_FADE=20;

const TAU=Math.PI*2;
/** Signed smallest difference a − b in (−π, π]. */
export function angleDiff(a:number,b:number):number{let d=(a-b)%TAU;if(d>Math.PI)d-=TAU;if(d<=-Math.PI)d+=TAU;return d;}
const EAST=Math.PI/2,WEST=-Math.PI/2,SOUTH_FROM=Math.PI;

/** 1 at ≤ ceiling − 20, 0 at the ceiling, linear between. */
export function ceilingFade(y:number,ceiling=300):number{return Math.max(0,Math.min(1,(ceiling-y)/CEILING_FADE));}
/** Raised-cosine falloff: 1 at the core, 0 at (and beyond) the rim. */
export function cosineFalloff(distance:number,radius:number):number{return distance>=radius||radius<=0?0:.5*(1+Math.cos(Math.PI*distance/radius));}
/** `hours` are [from, to) in local hours; a range that wraps midnight is honoured. */
export function hourInside(hours:readonly number[]|undefined,localHour:number):boolean{
  if(!hours||hours.length<2)return true;
  const [from,to]=hours as [number,number],h=((localHour%24)+24)%24;
  return from<=to?h>=from&&h<to:h>=from||h<to;
}
/** The wind blows from within 45° of south (and blows at all). */
export function ridgeWind(wind:WindSample):boolean{return wind.speed>0&&Math.abs(angleDiff(wind.dir,SOUTH_FROM))<=RIDGE_WIND_CONE+1e-9;}
/** Beating along (or into) the face: heading within 60° of east or of west. */
export function ridgeHeading(heading:number):boolean{return Math.abs(angleDiff(heading,EAST))<=RIDGE_HEADING_CONE+1e-9||Math.abs(angleDiff(heading,WEST))<=RIDGE_HEADING_CONE+1e-9;}

function insideBox(v:FlightVolume,p:LiftPoint):boolean{
  const dx=p.x-v.centre[0],dz=p.z-v.centre[2],c=Math.cos(v.yaw),s=Math.sin(v.yaw);
  // Local axes: the box's x runs (cos yaw, −sin yaw), its z (sin yaw, cos yaw), matching sky.ts's gate probes.
  const lx=dx*c-dz*s,lz=dx*s+dz*c;
  return Math.abs(lx)<=v.halfSize[0]&&Math.abs(lz)<=v.halfSize[2]&&Math.abs(p.y-v.centre[1])<=v.halfSize[1];
}

/** One volume's contribution before the ceiling fade. */
export function volumeLift(v:FlightVolume,wind:WindSample,p:LiftPoint,heading:number,localHour:number):number{
  const radius=v.radius??Math.max(v.halfSize[0],v.halfSize[2]),d=Math.hypot(p.x-v.centre[0],p.z-v.centre[2]);
  switch(v.kind){
    case 'thermal':return hourInside(v.hours,localHour)?THERMAL_CORE*cosineFalloff(d,radius):0;
    case 'sink':return SINK_CORE*cosineFalloff(d,radius);
    case 'ridge':{
      if(!insideBox(v,p)||!ridgeWind(wind)||!ridgeHeading(heading))return 0;
      const fade=p.y<=RIDGE_FULL_BELOW?1:Math.max(0,(RIDGE_TOP-p.y)/(RIDGE_TOP-RIDGE_FULL_BELOW));
      return RIDGE_LIFT*fade;
    }
    default:return 0;
  }
}

/**
 * Net vertical air motion at the rider (m/s, up +) and the volume that dominates it.
 * Thermals only inside their `hours` (the caller passes `solar.localMinutes / 60`, frozen at 15.5 under
 * reduced motion or calm); ridge lift only in a south wind with the heading along the face; sinks always;
 * everything × the ceiling fade. Wind itself is not lift: the wing adds it to the ground track.
 */
export function liftAt(envelope:LiftEnvelope,wind:WindSample,p:LiftPoint,heading:number,localHour:number):LiftSample{
  let lift=0,kind:LiftKind=null,strongest=0;
  for(const v of envelope.volumes??[]){
    if(v.kind!=='thermal'&&v.kind!=='ridge'&&v.kind!=='sink')continue;
    const value=volumeLift(v,wind,p,heading,localHour);
    if(value===0)continue;
    lift+=value;
    if(Math.abs(value)>strongest){strongest=Math.abs(value);kind=v.kind;}
  }
  const fade=ceilingFade(p.y,envelope.ceiling);
  lift*=fade;
  return{lift:lift===0?0:lift,kind:lift===0?null:kind};
}

/** The `WingEnv.lift` closure for one wind sample and one hour. */
export function liftField(envelope:LiftEnvelope,wind:WindSample,localHour:number):(x:number,y:number,z:number,heading:number)=>number{
  return(x,y,z,heading)=>liftAt(envelope,wind,{x,y,z},heading,localHour).lift;
}
