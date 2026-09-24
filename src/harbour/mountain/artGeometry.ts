import {TRANSPORT_STOPS,DISTRICTS,FOOTPATHS,RESERVED_PLOTS,SKILL_BRANCHES,RIVER,BASIN,nearestOnRoute,mountainBaseHeight,type Point3,type District} from './definition.ts';

/** Shared structural boxes: the renderer and collision query read these exact bounds. */
export type ArtSolid={id:string;min:Point3;max:Point3};
export const STATION_SOLIDS:readonly ArtSolid[]=Object.entries(TRANSPORT_STOPS).flatMap(([kind,stops])=>stops.flatMap(stop=>{
  const [x,y,z]=stop.at,id=`station-art:${kind}:${stop.id}`;
  // Clear platform is 6 × 4. Posts stand outside it; both ends remain open.
  const posts=[-1,1].flatMap(side=>[-1,1].map(end=>({id:`${id}:post:${side}:${end}`,min:[x+side*3.35-.1,y,z+end*2.35-.1] as Point3,max:[x+side*3.35+.1,y+3.6,z+end*2.35+.1] as Point3})));
  const fins=Array.from({length:7},(_,n)=>({id:`${id}:fin:${n}`,min:[x-3+n-.075,y+3.68,z-2.425] as Point3,max:[x-3+n+.075,y+3.82,z+2.425] as Point3}));
  const lintels=[-1,1].map(side=>({id:`${id}:lintel:${side}`,min:[x+side*3.35-.13,y+3.47,z-2.48] as Point3,max:[x+side*3.35+.13,y+3.73,z+2.48] as Point3}));
  return [...posts,...fins,...lintels];
}));

export type DistrictFixture={id:string;district:string;kind:'tree'|'rock'|'bed'|'bench';at:Point3;size:number;height:number;solid:ArtSolid};
/** Clear an object's full footprint, not just its centre, around every travel corridor. */
export function districtArtClear(d:District,x:number,z:number,radius=1){
  return Math.hypot(x-d.at[0],z-d.at[2])>10+radius&&Math.hypot(x-(d.at[0]-7),z-(d.at[2]+6))>7+radius&&
    nearestOnRoute(x,z).distance>5.4+radius&&nearestOnRoute(x,z,RIVER).distance>3.5+radius&&Math.hypot(x-BASIN.x,z-BASIN.z)>BASIN.radius+2+radius&&
    FOOTPATHS.every(p=>nearestOnRoute(x,z,p.points).distance>2.5+radius)&&SKILL_BRANCHES.every(p=>nearestOnRoute(x,z,p.points).distance>p.halfWidth+1+radius)&&
    Object.values(TRANSPORT_STOPS).flat().every(s=>Math.hypot(x-s.at[0],z-s.at[2])>6+radius)&&
    RESERVED_PLOTS.every(p=>Math.abs(x-p.at[0])>p.half[0]+2+radius||Math.abs(z-p.at[2])>p.half[1]+2+radius);
}
export const DISTRICT_FIXTURES:readonly DistrictFixture[]=DISTRICTS.flatMap(d=>{
  const out:DistrictFixture[]=[];let seed=d.id.split('').reduce((n,c)=>n+c.charCodeAt(0),17);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<18;i++){
    const a=i*2.399,r=13+random()*15,x=d.at[0]+Math.cos(a)*r,z=d.at[2]+Math.sin(a)*r;
    const kind=i%7===0?'bench':d.biome==='woods'||d.biome==='orchard'?'tree':d.biome==='garden'?'bed':d.biome==='alpine'||d.biome==='summit'?'rock':null;
    if(!kind||!districtArtClear(d,x,z,kind==='tree'?2:1.8))continue;
    const y=mountainBaseHeight(x,z);if(y<1||Math.abs(y-mountainBaseHeight(x+1.5,z))>.8||Math.abs(y-mountainBaseHeight(x,z+1.5))>.8)continue;
    const size=kind==='rock'?.8+random():kind==='tree'?1.4+random()*.7:1;
    const height=kind==='tree'?(d.biome==='woods'?5.5:3)+random()*1.2:kind==='rock'?size*.8:kind==='bench'?1.3:.32;
    const hx=kind==='tree'?.2:kind==='rock'?size:kind==='bed'?1.5:1.4,hz=kind==='tree'?.2:kind==='rock'?size*.8:kind==='bed'?.75:.6;
    const id=`district-art:${d.id}:${i}`;
    out.push({id,district:d.id,kind,at:[x,y,z],size,height,solid:{id,min:[x-hx,y,z-hz],max:[x+hx,y+height,z+hz]}});
  }return out;
});
export const DISTRICT_ART_SOLIDS:readonly ArtSolid[]=DISTRICT_FIXTURES.map(f=>f.solid);

/** Existing summit pavilion address, now recognisable as an open observatory. */
export const SUMMIT_OBSERVATORY={at:[5,110,-276] as Point3,radius:4.7,spring:4.1};
export const SUMMIT_ART_SOLIDS:readonly ArtSolid[]=[
  ...[-3,3].flatMap(dx=>[-2.5,2.5].map(dz=>({id:`summit-art:post:${dx}:${dz}`,min:[5+dx-.11,110,-276+dz-.11] as Point3,max:[5+dx+.11,114,-276+dz+.11] as Point3}))),
  // The dome occupies overhead space; there is no new supported roof/landing.
  {id:'summit-art:dome',min:[.3,114.1,-280.7],max:[9.7,118.8,-271.3]},
];
