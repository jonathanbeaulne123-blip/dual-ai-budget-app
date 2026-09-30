/** A quiet seat on the existing library garden, reached from its existing apron path. */
import type {CorridorEnv} from './stations';
import type {ScenicStop} from './types';
import type {Point2,Point3} from '../../world/definition';
import {nativeWalks,nativeOccupied,nativeWaterLevel} from '../mountainV2/planning';
import {nearestOnPath} from '../structures/mesh';
import {planeFit} from './plan/stops';
export function nativeScenicStops(env:CorridorEnv):ScenicStop[]{
  const x=1364,z=592,facing=Math.PI/4,nx=Math.sin(facing),nz=Math.cos(facing),tx=nz,tz=-nx;
  const at=(u:number,v:number):Point3=>{const px=x+tx*u+nx*v,pz=z+tz*u+nz*v;return[px,env.ground(px,pz),pz];};
  const samples:Point3[]=[];for(let u=-1.8;u<=1.81;u+=.6)for(let v=-1.2;v<=1.21;v+=.6)samples.push(at(u,v));
  const fit=planeFit(samples),clear=(p:Point3,ignoreWalk?:string)=>!env.occupied(p[0],p[2])&&!env.wet(p[0],p[2])&&nativeWaterLevel(p[0],p[2],env.ground)===null&&!nativeOccupied(p[0],p[2],env.ground,0,6,ignoreWalk);
  if(fit.slope>.08||fit.residual>.12||samples.some(p=>!clear(p)))throw new Error('Library garden stop lost its clear, level existing floor');
  const walk=nativeWalks.find(w=>w.id==='path:apron:library~door:library')!;
  const near=nearestOnPath([x,z],walk.points),d=near.distance,dx=(x-near.at[0])/d,dz=(z-near.at[2])/d;
  // Test a real 1.2 m wide walk-up across existing lawn, including its attachment to the existing path.
  for(const lateral of [-.6,0,.6]){let previous:Point3|null=null;for(let k=0;k<=Math.ceil(d/.25);k++){
    const a=d*k/Math.ceil(d/.25),px=near.at[0]+dx*a-dz*lateral,pz=near.at[2]+dz*a+dx*lateral,p:Point3=[px,env.ground(px,pz),pz];
    if(!clear(p,'*')||previous&&Math.abs(p[1]-previous[1])/Math.hypot(p[0]-previous[0],p[2]-previous[2])>.08)throw new Error('Library garden stop lost its clear walking attachment');
    previous=p;
  }}
  return[{id:'mountainV2.stop.library-garden',label:'Library garden bench',at:[x,env.ground(x,z),z],outline:[[-1.8,-1.2],[-1.8,1.2],[1.8,1.2],[1.8,-1.2]].map(([u,v])=>{const p=at(u!,v!);return[p[0],p[2]] as Point2;}),facing,connectsTo:[`mountainV2:${walk.id}`],existingFloor:true}];
}
