/**
 * Bridge spans found from the base ground: a tagged crossing grows outward until the
 * ground meets the deck across the full width, so every abutment lands on real ground.
 */
import {baseHeight} from './terrainBase.ts';
import {ROAD_CENTRE,ORCHARD_LANE_CENTRE,ORCHARD_LANE_HALF_WIDTH,BRIDGE_TAGS,roadTagS,laneTagS} from './roadLine.ts';
import {arcLengths,type Point3} from './math.ts';

export type BridgeType='timber'|'masonry'|'metal-glass';
export type BridgeSpan={id:string;name:string;type:BridgeType;line:'road'|'lane';s0:number;s1:number;i0:number;i1:number};
export const ROAD_HALF_WIDTH=4.8;

/** Is the ground more than `gap` below the deck across the whole width here? */
function open(points:readonly Point3[],i:number,halfWidth:number,gap:number):boolean{
  const p=points[i]!,a=points[Math.max(0,i-1)]!,b=points[Math.min(points.length-1,i+1)]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;
  for(const side of [-1,-.5,0,.5,1]){const x=p[0]+nx*halfWidth*side,z=p[2]+nz*halfWidth*side;if(baseHeight(x,z)>p[1]-gap)return false;}
  return true;
}
function grow(points:readonly Point3[],halfWidth:number,sA:number,sB:number):[number,number]{
  const s=arcLengths(points,true);
  let i0=s.findIndex(v=>v>=Math.min(sA,sB)),i1=s.findIndex(v=>v>=Math.max(sA,sB));if(i1<0)i1=points.length-1;
  // Grow while the gorge is still open below; land two samples onto solid ground.
  while(i0>0&&open(points,i0-1,halfWidth,1.4))i0--;
  while(i1<points.length-1&&open(points,i1+1,halfWidth,1.4))i1++;
  return [Math.max(0,i0-2),Math.min(points.length-1,i1+2)];
}
const roadS=arcLengths(ROAD_CENTRE,true),laneS=arcLengths(ORCHARD_LANE_CENTRE,true);
export const BRIDGE_SPANS:readonly BridgeSpan[]=BRIDGE_TAGS.map(t=>{
  const road=t.line==='road',points=road?ROAD_CENTRE:ORCHARD_LANE_CENTRE,s=road?roadS:laneS;
  const [i0,i1]=grow(points,road?ROAD_HALF_WIDTH:ORCHARD_LANE_HALF_WIDTH,road?roadTagS(t.from):laneTagS(t.from),road?roadTagS(t.to):laneTagS(t.to));
  return {id:t.id,name:t.name,type:t.type,line:t.line,i0,i1,s0:s[i0]!,s1:s[i1]!};
});
export const roadBridgeAt=(i:number)=>BRIDGE_SPANS.find(b=>b.line==='road'&&i>=b.i0&&i<=b.i1)??null;
export const laneBridgeAt=(i:number)=>BRIDGE_SPANS.find(b=>b.line==='lane'&&i>=b.i0&&i<=b.i1)??null;
