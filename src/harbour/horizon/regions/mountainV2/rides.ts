/**
 * Mountain v2's two lines for the Horizon (T3 builds the `gondola` / `funicular` ModeControllers on this).
 *
 * - `lines[kind].stations`: each station's PLATFORM (where a body stands to board) in Horizon space, its id, name and the
 *   platform's yaw — the thresholds' anchors.
 * - `createRide`: v2's own `body/ride.ts createRide`, untouched: it runs in NATIVE space (its poses are native; add
 *   `offset`, or use `toHorizon`). Reduced motion (`{reduced:true}`) is a 0 s ride: a cut to the far platform.
 * - `curve(kind, from, to)`: the ride's path sampled by arc length (about every 2 m, both ends exact) in Horizon space:
 *   the rider's `at`, the cabin's yaw and pitch, and `cabin` = the rider is aboard (false while stepping between the
 *   platform and the cabin at either end).
 * - `toHorizon(pose)`: a `RidePose` moved into Horizon space (x, y, z and `cabin`), for `mount().setTransit`.
 */
import {createRide,type RidePose} from '../../../body/ride.ts';
import {transportCurve} from '../../../body/geography.ts';
import {TRANSPORT_LINES,type TransportKind} from '../../../mountain/transport.ts';
import {MOUNTAIN_V2_OFFSET as O,toHorizonXYZ} from './placement.ts';

export type RegionRideKind='gondola'|'funicular';
export type RegionStation={id:string;name:string;at:[number,number,number];yaw:number};
export type RegionCurveFrame={at:[number,number,number];yaw:number;pitch:number;cabin:boolean};
const CURVE_STEP=2;
export function regionRides(){
  const lines=Object.fromEntries((['gondola','funicular'] as const).map(kind=>[kind,{stations:TRANSPORT_LINES[kind].stations.map(s=>({id:s.id,name:s.name,at:toHorizonXYZ(s.platform.at),yaw:s.platform.yaw}))}])) as Record<RegionRideKind,{stations:RegionStation[]}>;
  const curves=new Map<string,RegionCurveFrame[]>();
  function curve(kind:RegionRideKind,from:number,to:number):RegionCurveFrame[]{
    const key=`${kind}:${from}:${to}`,hit=curves.get(key);if(hit)return hit;
    const c=transportCurve(kind as TransportKind,from,to),n=Math.max(1,Math.ceil(c.length/CURVE_STEP)),out:RegionCurveFrame[]=[];
    for(let i=0;i<=n;i++){const f=c.frame(c.length*i/n);out.push({at:toHorizonXYZ(f.at),yaw:f.yaw,pitch:f.pitch,cabin:f.aboard!==false});}
    curves.set(key,out);return out;
  }
  const toHorizon=(p:RidePose):RidePose=>({...p,x:p.x+O.x,y:p.y+O.y,z:p.z+O.z,cabin:toHorizonXYZ(p.cabin)});
  return {lines,createRide,curve,toHorizon,offset:O};
}
export type RegionRides=ReturnType<typeof regionRides>;
