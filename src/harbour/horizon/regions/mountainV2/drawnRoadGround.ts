import type {WorldSurface} from '../../../mountain/surfaces.ts';
import {drawnRoadFloor} from './drawnRoadFloor.ts';
/** A cut in Horizon's visible/felt ground, never an additional road floor. Ground
 * already below a bridge remains unchanged when the caller takes min(ground,ceiling). */
export function drawnRoadGroundCeiling(road:WorldSurface,clearance=.08,batterWidth=1.5){
 const floor=drawnRoadFloor(road.landingRows!),size=12,cells=new Map<string,number[]>();
 const segments=road.points.slice(1).map((b,i)=>{const a=road.points[i]!,wa=road.widths?.[i]??road.halfWidth,wb=road.widths?.[i+1]??road.halfWidth,r=Math.max(wa,wb)+batterWidth;
  for(let x=Math.floor((Math.min(a[0],b[0])-r)/size);x<=Math.floor((Math.max(a[0],b[0])+r)/size);x++)for(let z=Math.floor((Math.min(a[2],b[2])-r)/size);z<=Math.floor((Math.max(a[2],b[2])+r)/size);z++){
   const key=`${x}:${z}`,list=cells.get(key)??[];list.push(i);cells.set(key,list);
  }return{a,b,wa,wb};
 });
 const endRow=road.landingRows!.at(-1)!,previous=road.points.at(-2)!,end=road.points.at(-1)!;
 const left=endRow[0]!,right=endRow.at(-1)!,ex=right[0]-left[0],ez=right[2]-left[2],length=Math.hypot(ex,ez);
 const side=(px:number,pz:number)=>ex*(pz-left[2])-ez*(px-left[0]);
 const insideSign=Math.sign(side(previous[0],previous[2]));
 const terminalWidth=road.widths?.at(-1)??road.halfWidth;
 return(x:number,z:number):number|null=>{
  const top=floor(x,z);if(top)return top.y-clearance;
  // The final swept cross-section is an open at-grade junction. Earlier
  // segments' clamped radial batters must not cut backwards across its receiving
  // footway. The true face above always wins; this only restores existing ground
  // beyond the end plane, within the terminal shoulder neighbourhood.
  if(length>0&&insideSign&&side(x,z)*insideSign< -1e-8&&Math.hypot(x-end[0],z-end[2])<=terminalWidth+batterWidth)return null;
  // The shoulder cut returns to the existing ground outside this narrow 2:1 batter.
  // Do not fill missing road triangles or extend a floor beyond the drawn footprint.
  let nearest:{distance:number;over:number;x:number;z:number}|null=null;
  for(const i of cells.get(`${Math.floor(x/size)}:${Math.floor(z/size)}`)??[]){
   const{a,b,wa,wb}=segments[i]!,dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1))),px=a[0]+t*dx,pz=a[2]+t*dz,distance=Math.hypot(x-px,z-pz),over=distance-(wa+(wb-wa)*t);
   if(over<0||over>batterWidth||(nearest&&distance>=nearest.distance))continue;
   nearest={distance,over,x:px,z:pz};
  }
  if(!nearest)return null;
  const edge=floor(nearest.x,nearest.z);return edge?edge.y-clearance+nearest.over*2:null;
 };
}
