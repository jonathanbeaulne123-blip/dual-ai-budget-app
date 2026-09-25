/** Collision twins of the authored stone, independent of rendering. */
import {DAM_PARTS,RESERVOIR} from './damParts.ts';
import {mountainGround} from './mountainGround.ts';
import type {Point3} from './math.ts';
export const DAM_SOLIDS:readonly {id:string;min:Point3;max:Point3}[]=[
 ...DAM_PARTS.abutments.map((a,i)=>{const yaw=(a.side==='west'?-1:1)*DAM_PARTS.halfAngle*1.04,c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw)),hx=c*(a.size[0]/2+.4)+s*(a.size[2]/2+.4),hz=s*(a.size[0]/2+.4)+c*(a.size[2]/2+.4);return {id:`dam:abutment:${i}`,min:[a.at[0]-hx,Math.min(mountainGround(a.at[0],a.at[2]),DAM_PARTS.foot)-2,a.at[2]-hz] as Point3,max:[a.at[0]+hx,DAM_PARTS.crest+2.5,a.at[2]+hz] as Point3};}),
 ...Array.from({length:48},(_,i)=>{const a=-DAM_PARTS.halfAngle+2*DAM_PARTS.halfAngle*(i+.5)/48,r=DAM_PARTS.radius,inner=r-1.4,outer=r+.6+(RESERVOIR.bottom-DAM_PARTS.foot+2)*.2,x=DAM_PARTS.centre[0]+Math.sin(a)*(inner+outer)/2,z=DAM_PARTS.centre[2]+Math.cos(a)*(inner+outer)/2,radial=(outer-inner)/2,tangent=r*DAM_PARTS.halfAngle/48+.08,hx=Math.abs(Math.sin(a))*radial+Math.abs(Math.cos(a))*tangent,hz=Math.abs(Math.cos(a))*radial+Math.abs(Math.sin(a))*tangent;return {id:`dam:plinth:${i}`,min:[x-hx,DAM_PARTS.foot-2,z-hz] as Point3,max:[x+hx,RESERVOIR.bottom,z+hz] as Point3};}),
];
