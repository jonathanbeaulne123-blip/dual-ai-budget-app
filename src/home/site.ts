import type {Reserve} from '../harbour/horizon/world/definition.ts';
export const HOME_RESERVE_ID='plot.terraces.1';
/** Read the surveyed plot; never duplicate a baked elevation in a save. */
export function homeSite(reserves:readonly Reserve[],plotId=HOME_RESERVE_ID){
 const plot=reserves.find(r=>r.id===plotId);if(!plot||!('xy'in plot.door))return null;
 const points=plot.outline;return{x:points.reduce((s,p)=>s+p[0],0)/points.length,z:points.reduce((s,p)=>s+p[1],0)/points.length,y:plot.door.height??0,yaw:-plot.rotationDegrees*Math.PI/180,door:plot.door.xy};
}
export function homeLocal(site:{x:number;z:number;yaw:number},x:number,z:number){const c=Math.cos(site.yaw),s=Math.sin(site.yaw);return{x:(x-site.x)*c-(z-site.z)*s,z:(x-site.x)*s+(z-site.z)*c};}
export function homeWorld(site:{x:number;y:number;z:number;yaw:number},x:number,z:number){const c=Math.cos(site.yaw),s=Math.sin(site.yaw);return{x:site.x+x*c+z*s,y:site.y,z:site.z-x*s+z*c};}
