/**
 * A ride on the funicular or the gondola, as pure motion.
 *
 * The cabin travels its line by ARC LENGTH: it eases out of the platform,
 * cruises at the line's own speed and eases into the next one, so equal time
 * is equal distance (the old ride spent equal time on every span and peaked at
 * 65 units a second). The body is attached to the cabin's transform for the
 * whole ride; `pose()` is where both of them are. Skip jumps to the arrival.
 * Pure: no three.js, no DOM, no clock.
 */
import {stationPlatforms,transportCurve,transportStopCount,type Point3,type TransportCurve,type TransportKind} from './geography.ts';

/** Where the rider is, facing independently; `cabin` and `cabinYaw` keep the carriage on its track. */
export type RidePose={x:number;y:number;z:number;yaw:number;cabinYaw:number;pitch:number;seated:boolean;moving:boolean;cabin:readonly [number,number,number]};
export type Ride={
  kind:TransportKind;from:number;to:number;
  /** Seconds the whole ride takes (0 under reduced motion: a cut). */
  duration:number;
  /** One frame; returns where the cabin — and the body in it — is now. */
  step(dt:number):RidePose;
  pose():RidePose;
  /** Walk on the cabin floor in its local frame; the walls bound both axes. */
  move(forward:number,strafe:number,dt:number):void;
  /** The gondola bench is optional; walking stands the rider first. */
  toggleSeat():void;
  /** Progress, 0…1 by distance. */
  progress():number;
  done():boolean;
  /** Finish now: the cabin (and you) arrive at the platform. */
  skip():void;
};

/** Seconds to reach cruise from a standstill (and to stop from it). */
export const RIDE_EASE_SECONDS=2.2;

export function createRide(kind:TransportKind,from:number,to:number,options:{reduced?:boolean}={}):Ride{
  const count=transportStopCount(kind);
  from=Math.max(0,Math.min(count-1,Math.round(from)));to=Math.max(0,Math.min(count-1,Math.round(to)));
  const curve:TransportCurve=transportCurve(kind,from,to);
  const L=curve.length,v=curve.cruise;
  // Trapezoid speed profile; a short hop never reaches cruise and is a smooth triangle.
  const ease=Math.min(RIDE_EASE_SECONDS,L/v),a=ease>0?v/ease:Infinity,peak=Math.min(v,Math.sqrt(a*L)||v);
  const tA=peak/a,dA=.5*a*tA*tA,tCruise=Math.max(0,(L-2*dA)/peak);
  const duration=options.reduced||L<1e-6?0:2*tA+tCruise;
  let seated=kind==='gondola',localX=0,localZ=0,localHeading=0,moving=false,t=0;
  const exit=curve.frame(L),exitCabin=exit.cabin??exit.at;
  const exitLength=Math.hypot(exit.at[0]-exitCabin[0],exit.at[1]-exitCabin[1],exit.at[2]-exitCabin[2]);
  const distance=(time:number)=>{
    if(duration===0)return L;
    if(time<=0)return 0;if(time>=duration)return L;
    if(time<tA)return .5*a*time*time;
    if(time<tA+tCruise)return dA+peak*(time-tA);
    const r=duration-time;return L-.5*a*r*r;
  };
  const poseAt=(s:number):RidePose=>{
    const f=curve.frame(s),aboard=f.aboard!==false,cabin=f.cabin??f.at,c=Math.cos(f.yaw),sn=Math.sin(f.yaw);
    // On alighting, carry a walked position toward the doorway over the actual exit leg.
    // Clearing it in one frame would teleport someone who stood near a window.
    const gap=Math.hypot(f.at[0]-cabin[0],f.at[1]-cabin[1],f.at[2]-cabin[2]);
    const offset=aboard?1:s>L/2&&exitLength>1e-6?Math.max(0,1-gap/exitLength):0;
    return {x:f.at[0]+offset*(c*localX+sn*localZ),y:f.at[1],z:f.at[2]+offset*(-sn*localX+c*localZ),yaw:f.yaw+(seated?0:localHeading),cabinYaw:f.yaw,pitch:f.pitch,seated:seated&&aboard,moving:moving&&aboard,cabin};
  };
  return {
    kind,from,to,duration,
    step(dt){t=Math.min(duration,t+Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0)));return poseAt(distance(t));},
    pose:()=>poseAt(distance(t)),
    move(forward,strafe,dt){
      if(duration===0||t>=duration||curve.frame(distance(t)).aboard===false){moving=false;return;}
      const f=Math.max(-1,Math.min(1,Number.isFinite(forward)?forward:0)),s=Math.max(-1,Math.min(1,Number.isFinite(strafe)?strafe:0));
      moving=f!==0||s!==0;if(!moving)return;
      seated=false;
      localHeading=Math.atan2(s,f);
      const scale=Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0))*1.6/Math.max(1,Math.hypot(f,s));
      localX=Math.max(-.62,Math.min(.62,localX+s*scale));
      localZ=Math.max(kind==='funicular'?-1.3:-.62,Math.min(kind==='funicular'?1.3:.62,localZ+f*scale));
    },
    toggleSeat(){if(kind==='gondola'&&curve.frame(distance(t)).aboard!==false){seated=!seated;moving=false;}},
    progress:()=>L>0?distance(t)/L:1,
    done:()=>t>=duration,
    skip(){t=duration;},
  };
}

/** The station nearest a point, for each line (a ride's "From" defaults to it). */
export function nearestStation(kind:TransportKind,x:number,z:number,y?:number):number{
  let best=0,bestD=Infinity;
  for(const s of stationPlatforms())if(s.kind===kind){const d=Math.hypot(s.at[0]-x,s.at[2]-z)+(y===undefined?0:Math.abs(s.at[1]-y)*.5);if(d<bestD){bestD=d;best=s.index;}}
  return best;
}

export type RideOffer={kind:TransportKind;from:number;to:number;label:string;reason:'platform'|'far'};
/** Walking onto a platform offers the ride from it: this close, and roughly level with it. */
export const PLATFORM_REACH=3.6;
const LINE_NAME:Record<TransportKind,string>={funicular:'funicular',gondola:'gondola'};
/**
 * Standing on a platform, what ride does it offer? Uphill first (the demo's
 * "Ride the funicular ↑"); at the top station, back down.
 */
export function platformOffer(x:number,y:number,z:number):RideOffer|null{
  for(const s of stationPlatforms()){
    if(Math.hypot(s.at[0]-x,s.at[2]-z)>PLATFORM_REACH||Math.abs(s.at[1]-y)>1.2)continue;
    const last=transportStopCount(s.kind)-1,up=s.index<last,to=up?s.index+1:s.index-1;
    return {kind:s.kind,from:s.index,to,label:`Ride the ${LINE_NAME[s.kind]} ${up?'↑':'↓'}`,reason:'platform'};
  }
  return null;
}
/** A walk longer than this, with a station nearer than the destination, offers a ride instead. */
export const RIDE_SUGGEST_LENGTH=150;
/**
 * After a long tap: is a station close at hand whose line ends much nearer
 * the destination? That is a "Ride there?" worth asking.
 */
export function farOffer(from:{x:number;y?:number;z:number},to:{x:number;y?:number;z:number},routeLength:number):RideOffer|null{
  if(!(routeLength>RIDE_SUGGEST_LENGTH))return null;
  let best:RideOffer|null=null,score=Infinity;
  for(const kind of ['funicular','gondola'] as const){
    const stops=stationPlatforms().filter(s=>s.kind===kind),near=(p:{x:number;z:number})=>stops.reduce((b,s)=>Math.hypot(s.at[0]-p.x,s.at[2]-p.z)<Math.hypot(b.at[0]-p.x,b.at[2]-p.z)?s:b);
    const a=near(from),b=near(to);if(a.index===b.index)continue;
    const walkA=Math.hypot(a.at[0]-from.x,a.at[2]-from.z),walkB=Math.hypot(b.at[0]-to.x,b.at[2]-to.z);
    if(walkA>=routeLength*.5||walkA+walkB>=routeLength*.6)continue;
    if(walkA+walkB<score){score=walkA+walkB;best={kind,from:a.index,to:b.index,label:`Ride there? The ${LINE_NAME[kind]} from ${a.name}`,reason:'far'};}
  }
  return best;
}
export type {Point3};
