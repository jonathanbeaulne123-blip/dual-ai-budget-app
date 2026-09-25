import {DAM_SOLIDS} from './damSolids.ts';
import {STATION_SOLIDS,DISTRICT_ART_SOLIDS,SUMMIT_ART_SOLIDS} from './artGeometry.ts';
import {mountainBaseHeight,SKILL_BRANCHES,MOUNTAIN_ROAD,TOWN_LANE_HALF_WIDTH,ROAD_HALF_WIDTH,nearestOnRoute,ORCHARD_LANE_LINE,EDGE_SOLIDS,type Point3} from './definition.ts';
import {TOWN_LANE_DECK} from './course.ts';
import {PATH_EDGES,mountainWalkPlan} from './pathGraph.ts';
import {TRANSPORT_LINES} from './transport.ts';
import {ORCHARD_LANE_HALF_WIDTH} from './roadLine.ts';
export {SKILL_BRANCHES} from './definition.ts';
export type WorldSurface={id:string;points:readonly Point3[];halfWidth:number;material:'path'|'wood'|'metal';walkable:boolean;kind?:'road'|'lane'|'stair'|'bridge'|'promenade'|'platform'|'branch'};
const platform=(kind:string,id:string,p:{at:Point3;yaw:number;half:readonly[number,number]}):WorldSurface=>{
  const dx=Math.sin(p.yaw)*p.half[0],dz=Math.cos(p.yaw)*p.half[0];
  return {id:`station:${kind}:${id}`,points:[[p.at[0]-dx,p.at[1],p.at[2]-dz],[p.at[0]+dx,p.at[1],p.at[2]+dz]],halfWidth:p.half[1],material:kind==='gondola'?'metal':'wood',walkable:true,kind:'platform'};
};
/** Every walkable deck: roads, lanes, stairs, the dam promenade, station platforms and skill branches.
 * Ground paths are cut into the terrain itself and need no deck. */
export const WORLD_SURFACES:readonly WorldSurface[]=[
  // The town lane is paving on the town ground; only its canal bridge is a deck.
  {id:'town-race-road',points:TOWN_LANE_DECK,halfWidth:TOWN_LANE_HALF_WIDTH,material:'path',walkable:true,kind:'bridge'},
  {id:'mountain-road',points:MOUNTAIN_ROAD,halfWidth:ROAD_HALF_WIDTH,material:'path',walkable:true,kind:'road'},
  {id:'orchard-lane',points:ORCHARD_LANE_LINE.samples.filter((_,i,all)=>i%2===0||i===all.length-1).map(s=>s.at),halfWidth:ORCHARD_LANE_HALF_WIDTH,material:'path',walkable:true,kind:'lane'},
  ...PATH_EDGES.filter(e=>e.kind!=='path').map(e=>({id:`path:${e.id}`,points:e.points,halfWidth:e.halfWidth,material:(e.kind==='promenade'?'metal':e.kind==='bridge'?'wood':'path') as WorldSurface['material'],walkable:true,kind:e.kind as WorldSurface['kind']})),
  ...Object.values(TRANSPORT_LINES).flatMap(line=>line.stations.map(s=>platform(line.kind,s.id,s.platform))),
  ...SKILL_BRANCHES.map(b=>({id:b.id,points:b.points,halfWidth:b.halfWidth,material:b.material,walkable:true,kind:'branch' as const})),
];
export type SurfaceRequest={x:number;z:number;y?:number;supportId?:string|null;stepHeight?:number};
export type WorldSurfaceHit={id:string;y:number;nx:number;ny:number;nz:number;material:'path'|'wood'|'metal'|'grass';slope:number};

/** Spatial buckets of surface segments, so a query touches only the decks near it. */
type SurfaceIndex={cells:Map<number,number[]>};
const indices=new WeakMap<readonly WorldSurface[],SurfaceIndex>(),SC=12,key=(cx:number,cz:number)=>(cx+4096)*8192+(cz+4096);
function surfaceIndex(surfaces:readonly WorldSurface[]):SurfaceIndex{
  const cached=indices.get(surfaces);if(cached)return cached;
  const cells=new Map<number,number[]>();
  surfaces.forEach((s,si)=>{
    let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const p of s.points){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[2]);z1=Math.max(z1,p[2]);}
    const r=s.halfWidth+1;
    for(let cx=Math.floor((x0-r)/SC);cx<=Math.floor((x1+r)/SC);cx++)for(let cz=Math.floor((z0-r)/SC);cz<=Math.floor((z1+r)/SC);cz++){
      // Only cells the polyline actually passes near.
      const mx=(cx+.5)*SC,mz=(cz+.5)*SC;if(nearestOnRoute(mx,mz,s.points).distance>r+SC*.72)continue;
      const k=key(cx,cz),b=cells.get(k)??[];b.push(si);cells.set(k,b);
    }
  });
  const index={cells};indices.set(surfaces,index);return index;
}
const near=(x:number,z:number,surfaces:readonly WorldSurface[])=>surfaceIndex(surfaces).cells.get(key(Math.floor(x/SC),Math.floor(z/SC)))??[];
/** Nearest point on a deck, or null past its ends: a deck ends square, it does not continue as a flat disc. */
function onDeck(x:number,z:number,points:readonly Point3[]){
  const p=nearestOnRoute(x,z,points),n=points.length;
  if(p.index===0&&p.t===0){const a=points[0]!,b=points[1]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;if(((x-a[0])*dx+(z-a[2])*dz)/l<-.35)return null;}
  if(p.index===n-2&&p.t===1){const a=points[n-2]!,b=points[n-1]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;if(((x-b[0])*dx+(z-b[2])*dz)/l>.35)return null;}
  return p;
}

/** A bridge deck whose square end lands on the bank at ground level eases into the bank over its end
 * segment (an approach slab): a flat deck on a cross-sloped bank would otherwise meet it with a riser of
 * up to a tenth on one side, a wall to a board rolling on or off either way. Decks whose ends stand clear
 * of the ground (on a platform, a road, a rim) are untouched. */
function approachSlab(surface:WorldSurface,p:ReturnType<typeof nearestOnRoute>,x:number,z:number,ground:(x:number,z:number)=>number,gy:number,gx:number,gz:number){
  const pts=surface.points,n=pts.length;if(surface.kind!=='bridge'||n<2)return null;
  // Measured along each end segment's own direction (not by which segment is nearest, which can switch
  // early beside a bend and would cut the slab short).
  for(const [e,f] of [[0,1],[n-1,n-2]] as const){
    const end=pts[e]!,q=pts[f]!,sx=q[0]-end[0],sz=q[2]-end[2],len=Math.hypot(sx,sz)||1,along=((x-end[0])*sx+(z-end[2])*sz)/len;
    if(along>=len||Math.abs(end[1]-ground(end[0],end[2]))>.3)continue;
    const w=Math.max(0,along/len),k=w*w*(3-2*w),dk=w>0?6*w*(1-w)/len:0,lift=p.point[1]-gy;
    return {y:gy+lift*k,gx:gx+(p.gradientX-gx)*k+lift*dk*sx/len,gz:gz+(p.gradientZ-gz)*k+lift*dk*sz/len};
  }
  return null;
}
export function queryWorldSurface(input:SurfaceRequest,ground:(x:number,z:number)=>number,surfaces:readonly WorldSurface[]=WORLD_SURFACES):WorldSurfaceHit{
  const gy=ground(input.x,input.z),e=.06,gx=(ground(input.x+e,input.z)-ground(input.x-e,input.z))/(2*e),gz=(ground(input.x,input.z+e)-ground(input.x,input.z-e))/(2*e);
  let height=gy,dx=gx,dz=gz,id='terrain',material:WorldSurfaceHit['material']='grass';
  const ceiling=input.y===undefined?Infinity:input.y+(input.stepHeight??.48);
  let preferred=false;
  for(const si of near(input.x,input.z,surfaces)){const surface=surfaces[si]!,p=onDeck(input.x,input.z,surface.points);if(!p)continue;
    const slab=p.distance<=surface.halfWidth+1e-6?approachSlab(surface,p,input.x,input.z,ground,gy,gx,gz):null;
    if(slab){p.point=[p.point[0],slab.y,p.point[2]];p.gradientX=slab.gx;p.gradientZ=slab.gz;}
    const supported=surface.id===input.supportId&&input.y!==undefined&&Math.abs(p.point[1]-input.y)<1;
    if(p.distance>surface.halfWidth+1e-6||p.point[1]>ceiling||p.point[1]<gy-.12||(!supported&&p.point[1]<height-.12))continue;
    if(preferred&&!supported)continue;if(supported)preferred=true;
    height=p.point[1];dx=p.gradientX;dz=p.gradientZ;id=surface.id;material=surface.material;
  }
  const inv=1/Math.hypot(dx,1,dz);return {id,y:height,nx:-dx*inv,ny:inv,nz:-dz*inv,material,slope:Math.hypot(dx,dz)};
}
export type WorldSolid={id:string;min:Point3;max:Point3};
const branchById=new Map(SKILL_BRANCHES.map(b=>[b.id,b]));
/** Undersides are independent of the supporting floor, including at stacked crossings. */
export function worldCeilingAt(x:number,z:number,feet:number,radius=.2,surfaces:readonly WorldSurface[]=WORLD_SURFACES):number{
  let ceiling=Infinity;
  for(const si of near(x,z,surfaces)){const s=surfaces[si]!,p=onDeck(x,z,s.points);if(!p)continue;
    // A branch mouth is an open road junction, not an overhead bridge slab.
    const branch=branchById.get(s.id),ends=branch?[branch.points[0]!,branch.points[branch.points.length-1]!]:[];
    const junction=p.point[1]-feet<3&&ends.some(at=>Math.hypot(x-at[0],z-at[2])<18);
    if(!junction&&p.distance<=s.halfWidth+radius&&p.point[1]>feet+.48)ceiling=Math.min(ceiling,p.point[1]-.28);
  }
  return ceiling;
}
// Abutment body walls would block the authored maintenance shortcut; retain its corridor.
export const WORLD_SOLIDS:readonly WorldSolid[]=[...DAM_SOLIDS.filter(s=>s.id.startsWith('dam:plinth:')),...STATION_SOLIDS,...DISTRICT_ART_SOLIDS,...SUMMIT_ART_SOLIDS,...SKILL_BRANCHES.flatMap(s=>s.points.flatMap((p,i)=>{
  if(i%8!==0)return [];const a=s.points[Math.max(0,i-1)]!,b=s.points[Math.min(s.points.length-1,i+1)]!,dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
  return [-1,1].flatMap(side=>{const x=p[0]+dz/l*(s.halfWidth+.4)*side,z=p[2]-dx/l*(s.halfWidth+.4)*side,y=mountainBaseHeight(x,z);
    if(nearestOnRoute(x,z).distance<ROAD_HALF_WIDTH+1||p[1]-y<1)return [];
    return [{id:`${s.id}:support:${i}:${side}`,min:[x-.12,y,z-.12] as Point3,max:[x+.12,p[1]-.25,z+.12] as Point3}];
  });
}))];
/** Parapets, bridge rails and retaining walls as thin oriented slabs (the camera and bodies stop at them). */
function edgeHit(x:number,y:number,z:number,radius:number):boolean{
  for(const s of EDGE_SOLIDS){
    if(y<s.bottom||y>s.top)continue;
    const ax=s.a[0],az=s.a[1],dx=s.b[0]-ax,dz=s.b[1]-az,l=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(l||1)));
    if(Math.hypot(x-ax-dx*t,z-az-dz*t)<s.thickness/2+radius)return true;
  }
  return false;
}
export function worldCollisionAt(x:number,y:number,z:number,radius=.2):boolean{
  return near(x,z,WORLD_SURFACES).some(si=>{const s=WORLD_SURFACES[si]!,p=onDeck(x,z,s.points);return !!p&&p.distance<s.halfWidth+radius&&y>p.point[1]-.28&&y<p.point[1]+.08;})||
    WORLD_SOLIDS.some(s=>x>s.min[0]-radius&&x<s.max[0]+radius&&z>s.min[2]-radius&&z<s.max[2]+radius&&y>s.min[1]&&y<s.max[1])||(z<-40&&edgeHit(x,y,z,radius));
}
/** Walk the path graph (roads, paths, stairs, bridges); never a straight tap route through the gorge. */
export function mountainWalkRoute(from:{x:number;z:number},to:{x:number;z:number}):{x:number;z:number}[]|null{
  if(from.z>-45&&to.z>-45)return null;
  const plan=mountainWalkPlan(from,to);if(!plan)return null;
  const out:{x:number;z:number}[]=[];
  for(const p of plan.points){const last=out[out.length-1];if(!last||Math.hypot(p[0]-last.x,p[2]-last.z)>=1.2)out.push({x:p[0],z:p[2]});}
  const end=out[out.length-1];if(!end||end.x!==to.x||end.z!==to.z)out.push({x:to.x,z:to.z});
  return out;
}
