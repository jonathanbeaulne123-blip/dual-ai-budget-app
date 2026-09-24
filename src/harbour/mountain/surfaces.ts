import {STATION_SOLIDS,DISTRICT_ART_SOLIDS,SUMMIT_ART_SOLIDS} from './artGeometry.ts';
import {mountainBaseHeight,SKILL_BRANCHES,FOOTPATHS,MOUNTAIN_ROAD,TOWN_RACE_ROAD,TRANSPORT_STOPS,ROAD_HALF_WIDTH,nearestOnRoute,type Point3} from './definition.ts';
export {SKILL_BRANCHES} from './definition.ts';
export type WorldSurface={id:string;points:readonly Point3[];halfWidth:number;material:'path'|'wood'|'metal';walkable:boolean};
export const WORLD_SURFACES:readonly WorldSurface[]=[
  {id:'town-race-road',points:TOWN_RACE_ROAD,halfWidth:3.5,material:'path',walkable:true},
  {id:'mountain-road',points:MOUNTAIN_ROAD,halfWidth:ROAD_HALF_WIDTH,material:'path',walkable:true},
  ...FOOTPATHS.map(p=>({id:`path:${p.id}`,points:p.points,halfWidth:1.8,material:'wood' as const,walkable:true})),
  ...Object.entries(TRANSPORT_STOPS).flatMap(([kind,stops])=>stops.map(s=>({id:`station:${kind}:${s.id}`,points:[[s.at[0]-3,s.at[1],s.at[2]],[s.at[0]+3,s.at[1],s.at[2]]] as Point3[],halfWidth:2,material:'path' as const,walkable:true}))),
  ...SKILL_BRANCHES.map(b=>({id:b.id,points:b.points,halfWidth:b.halfWidth,material:b.material,walkable:true})),
];
export type SurfaceRequest={x:number;z:number;y?:number;supportId?:string|null;stepHeight?:number};
export type WorldSurfaceHit={id:string;y:number;nx:number;ny:number;nz:number;material:'path'|'wood'|'metal'|'grass';slope:number};
export function queryWorldSurface(input:SurfaceRequest,ground:(x:number,z:number)=>number,surfaces:readonly WorldSurface[]=WORLD_SURFACES):WorldSurfaceHit{
  const gy=ground(input.x,input.z),e=.06,gx=(ground(input.x+e,input.z)-ground(input.x-e,input.z))/(2*e),gz=(ground(input.x,input.z+e)-ground(input.x,input.z-e))/(2*e);
  let height=gy,dx=gx,dz=gz,id='terrain',material:WorldSurfaceHit['material']='grass';
  const ceiling=input.y===undefined?Infinity:input.y+(input.stepHeight??.48);
  let preferred=false;
  for(const surface of surfaces){const p=nearestOnRoute(input.x,input.z,surface.points);
    const supported=surface.id===input.supportId&&input.y!==undefined&&Math.abs(p.point[1]-input.y)<1;
    if(p.distance>surface.halfWidth+1e-6||p.point[1]>ceiling||p.point[1]<gy-.12||(!supported&&p.point[1]<height-.12))continue;
    if(preferred&&!supported)continue;if(supported)preferred=true;
    height=p.point[1];dx=p.gradientX;dz=p.gradientZ;id=surface.id;material=surface.material;
  }
  const inv=1/Math.hypot(dx,1,dz);return {id,y:height,nx:-dx*inv,ny:inv,nz:-dz*inv,material,slope:Math.hypot(dx,dz)};
}
export type WorldSolid={id:string;min:Point3;max:Point3};
/** Undersides are independent of the supporting floor, including at stacked crossings. */
export function worldCeilingAt(x:number,z:number,feet:number,radius=.2,surfaces:readonly WorldSurface[]=WORLD_SURFACES):number{
  let ceiling=Infinity;
  for(const s of surfaces){const p=nearestOnRoute(x,z,s.points);
    // A branch mouth is an open road junction, not an overhead bridge slab.
    const branch=SKILL_BRANCHES.find(b=>b.id===s.id),ends=branch?[branch.points[0]!,branch.points[branch.points.length-1]!]:[];
    const junction=p.point[1]-feet<3&&ends.some(at=>Math.hypot(x-at[0],z-at[2])<18);
    if(!junction&&p.distance<=s.halfWidth+radius&&p.point[1]>feet+.48)ceiling=Math.min(ceiling,p.point[1]-.28);
  }
  return ceiling;
}
export const WORLD_SOLIDS:readonly WorldSolid[]=[...STATION_SOLIDS,...DISTRICT_ART_SOLIDS,...SUMMIT_ART_SOLIDS,...SKILL_BRANCHES.flatMap(s=>s.points.flatMap((p,i)=>{
  if(i%8!==0)return [];const a=s.points[Math.max(0,i-1)]!,b=s.points[Math.min(s.points.length-1,i+1)]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
  return [-1,1].flatMap(side=>{const x=p[0]+dz/l*(s.halfWidth+.4)*side,z=p[2]-dx/l*(s.halfWidth+.4)*side,y=mountainBaseHeight(x,z);
    if(nearestOnRoute(x,z).distance<ROAD_HALF_WIDTH+1||p[1]-y<1)return [];
    return [{id:`${s.id}:support:${i}:${side}`,min:[x-.12,y,z-.12] as Point3,max:[x+.12,p[1]-.25,z+.12] as Point3}];
  });
}))];
export function worldCollisionAt(x:number,y:number,z:number,radius=.2):boolean{return WORLD_SURFACES.some(s=>{const p=nearestOnRoute(x,z,s.points);return p.distance<s.halfWidth+radius&&y>p.point[1]-.28&&y<p.point[1]+.08;})||WORLD_SOLIDS.some(s=>x>s.min[0]-radius&&x<s.max[0]+radius&&z>s.min[2]-radius&&z<s.max[2]+radius&&y>s.min[1]&&y<s.max[1]);}
/** Follow the authored road; never draw a straight tap route through the gorge. */
export function mountainWalkRoute(from:{x:number;z:number},to:{x:number;z:number}):{x:number;z:number}[]|null{
  if(from.z>-45&&to.z>-45)return null;
  const a=nearestOnRoute(from.x,from.z),b=nearestOnRoute(to.x,to.z),step=a.index<=b.index?1:-1,out:{x:number;z:number}[]=[];
  out.push({x:a.point[0],z:a.point[2]});for(let i=a.index;i!==b.index;i+=step){const p=MOUNTAIN_ROAD[i]!;out.push({x:p[0],z:p[2]});}
  out.push({x:b.point[0],z:b.point[2]},to);return out;
}
