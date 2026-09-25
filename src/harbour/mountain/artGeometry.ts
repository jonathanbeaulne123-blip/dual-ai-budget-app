import {TRANSPORT_LINES,DISTRICTS,SKILL_BRANCHES,SUMMIT_OBSERVATORY_SITE,GOAL_PAVILION_SITE,DOOR_APRONS,nearestOnRoute,type Point3,type District} from './definition.ts';
import {landHeight as groundHeightAt} from './art/land.ts';
import {findSpot,footGround,corridorClearance} from './art/spots.ts';

/** Shared structural boxes: the renderer and collision query read these exact bounds. */
export type ArtSolid={id:string;min:Point3;max:Point3};
const box=(id:string,x:number,z:number,hx:number,hz:number,y0:number,y1:number):ArtSolid=>({id,min:[x-hx,y0,z-hz],max:[x+hx,y1,z+hz]});

/**
 * Station structure, following each platform: the funicular canopy's posts on the
 * platform's outer edge, the gondola terminal's four columns. Platforms themselves stay open.
 */
export const STATION_SOLIDS:readonly ArtSolid[]=Object.values(TRANSPORT_LINES).flatMap(line=>line.stations.flatMap(st=>{
  const p=st.platform,c=Math.cos(p.yaw),s=Math.sin(p.yaw),[hl,hw]=p.half,id=`station-art:${line.kind}:${st.id}`;
  const W=(along:number,across:number):[number,number]=>[p.at[0]+s*along+c*across,p.at[2]+c*along-s*across];
  const y=p.at[1];
  if(line.kind==='funicular'){
    const f=line.at(st.s),toTrack=Math.sign((f.at[0]-p.at[0])*c-(f.at[2]-p.at[2])*s)||1,outer=-toTrack*(hw-.2);
    return [-hl+.4,0,hl-.4].map((a,k)=>{const [x,z]=W(a,outer);return box(`${id}:post:${k}`,x,z,.12,.12,y,y+3.2);});
  }
  return ([[-1,-1],[1,-1],[1,1],[-1,1]] as const).map(([a,d],k)=>{const [x,z]=W(a*(hl+.6),d*(hw+2.2));return box(`${id}:post:${k}`,x,z,.16,.16,Math.min(y,groundHeightAt(x,z))-.2,st.at[1]+3.1+1.4);});
}));

export type DistrictFixture={id:string;district:string;kind:'rock'|'bed'|'logs'|'crate';at:Point3;size:number;height:number;yaw:number;
  /** Half extents of the turned footprint (local x, z). */
  half:readonly [number,number];solid:ArtSolid};
/** Clear an object's full footprint, not just its centre, around every travel corridor. */
export function districtArtClear(d:District,x:number,z:number,radius=1){
  void d;
  return corridorClearance(x,z)>radius+.4&&SKILL_BRANCHES.every(p=>nearestOnRoute(x,z,p.points).distance>p.halfWidth+1+radius);
}
/** Close district furniture that a body bumps into: raised beds, log stacks, crates and boulders. */
export const DISTRICT_FIXTURES:readonly DistrictFixture[]=DISTRICTS.flatMap(d=>{
  const out:DistrictFixture[]=[];let seed=d.id.split('').reduce((n,c)=>n+c.charCodeAt(0),17);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const kinds:readonly DistrictFixture['kind'][]=d.biome==='garden'?['bed','bed','crate','bed']:d.biome==='orchard'?['crate','bed','crate','logs']:d.biome==='woods'?['logs','logs','rock']:d.biome==='meadow'?['bed','bed','bed']:['rock','rock','rock','rock'];
  const n=d.biome==='meadow'?5:7;
  for(let i=0;i<n;i++){
    const kind=kinds[i%kinds.length]!,size=kind==='rock'?.8+random()*.9:1,yaw=random()*Math.PI;
    const hx=kind==='bed'?1.5:kind==='logs'?1.05:kind==='crate'?.45:size,hz=kind==='bed'?.75:kind==='logs'?.5:kind==='crate'?.45:size*.8;
    // The collision solid is axis-aligned round the turned footprint; the whole solid clears every walk.
    const ex=Math.abs(Math.cos(yaw))*hx+Math.abs(Math.sin(yaw))*hz,ez=Math.abs(Math.sin(yaw))*hx+Math.abs(Math.cos(yaw))*hz,reach=Math.hypot(ex,ez);
    const [x,z]=findSpot(d.at[0],d.at[2],i*2.399+random()*.6,d.radius*.7+random()*9,reach,{level:.7});
    if(!districtArtClear(d,x,z,reach))continue;
    // Seated on the lowest ground under its own (turned) footprint, a hair into the soil.
    const g=footGround(x,z,yaw,hx,hz),y=g.min-.06;if(g.max-g.min>.85)continue;
    const height=kind==='rock'?size*.9:kind==='bed'?.45:kind==='logs'?.8:.7;
    const id=`district-art:${d.id}:${i}`;
    out.push({id,district:d.id,kind,at:[x,y,z],size,height,yaw,half:[hx,hz],solid:{id,min:[x-ex,y,z-ez],max:[x+ex,g.max+height,z+ez]}});
  }return out;
});
export const DISTRICT_ART_SOLIDS:readonly ArtSolid[]=DISTRICT_FIXTURES.map(f=>f.solid);

/**
 * The observatory's form: a parapet ring, a colonnade tall enough that the summit view (whose eye
 * stands behind the building, about 4.3 above its floor) looks out beneath the dome's ring beam,
 * and a hemispherical ribbed dome.
 */
export const OBSERVATORY_FORM={parapet:1.1,columns:4.8,domeRise:1,
  /** The telescope pier's offset from the centre (world x, z): toward the back, so the summit view looks over it. */
  pier:[0,-1.2] as const};
/** The summit observatory (the contract's site): a drum the camera and a body stop at. */
export const SUMMIT_OBSERVATORY={at:SUMMIT_OBSERVATORY_SITE.at,radius:SUMMIT_OBSERVATORY_SITE.radius,spring:3.75};
const [ox,,oz]=SUMMIT_OBSERVATORY.at,orad=SUMMIT_OBSERVATORY.radius,oy=footGround(ox,oz,0,orad,orad),obsDoor=DOOR_APRONS.find(a=>a.site==='observatory')?.facing??0;
const pav=GOAL_PAVILION_SITE,pavYaw=DOOR_APRONS.find(a=>a.site==='pavilion')?.facing??0,pc=Math.cos(pavYaw),ps=Math.sin(pavYaw),pg=footGround(pav.at[0],pav.at[2],pavYaw,pav.half[0]+1,pav.half[1]+1);
/** The goal pavilion's columns (local [x, z]), leaving out any that would stand in a race branch's corridor. */
export const PAVILION_COLUMNS:readonly (readonly [number,number])[]=([[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[-1,1],[-1,0]] as const).map(([a,b])=>[a*pav.half[0],b*pav.half[1]] as const)
  .filter(([lx,lz])=>{const x=pav.at[0]+lx*pc+lz*ps,z=pav.at[2]+lz*pc-lx*ps;return SKILL_BRANCHES.every(br=>nearestOnRoute(x,z,br.points).distance>br.halfWidth+.7);});
export const SUMMIT_ART_SOLIDS:readonly ArtSolid[]=[
  // The open observatory: its parapet ring (a gateway left at the door), columns and the telescope pier.
  ...Array.from({length:16},(_,k)=>k).flatMap(k=>{const a=(k+.5)/16*Math.PI*2,door=Math.atan2(Math.cos(obsDoor),Math.sin(obsDoor)),off=Math.atan2(Math.sin(a-door),Math.cos(a-door));
    if(Math.abs(off)<.3)return [];return [box(`summit-art:parapet:${k}`,ox+Math.cos(a)*(orad-.2),oz+Math.sin(a)*(orad-.2),.55,.55,oy.min,oy.max+.15+1.1)];}),
  ...Array.from({length:8},(_,k)=>{const a=k/8*Math.PI*2+Math.PI/16;return box(`summit-art:column:${k}`,ox+Math.cos(a)*(orad-.2),oz+Math.sin(a)*(orad-.2),.16,.16,oy.min,oy.max+.15+OBSERVATORY_FORM.columns);}),
  // The stone pier only (the mount and tube above it stay out of the way of the summit view's camera ray).
  box('summit-art:pier',ox+OBSERVATORY_FORM.pier[0],oz+OBSERVATORY_FORM.pier[1],.55,.55,oy.min,oy.max+.15+1.3),
  // The goal pavilion's columns (its floor is open between them).
  ...PAVILION_COLUMNS.map(([lx,lz],k)=>box(`summit-art:pavilion:${k}`,pav.at[0]+lx*pc+lz*ps,pav.at[2]+lz*pc-lx*ps,.25,.25,pg.min,pg.max+3.4)),
];
