import { HORIZON_MANIFEST as M, requireScaleFactor } from '../../world/manifest';
import type { BedCut, HeightQuery, LandCuts, StructureSolid, XY, XYZ } from '../interfaces';
import { box, distance, districtAt, mitredSlab, nearestOnPath, slab, solid, prism } from '../structures/mesh';
import { isCorridorRoad } from '../corridor/reaches';

/** Closed wall with a true 1:6 face, rather than a wide rectangular fence.
 * A cut leans into the hill; a fill widens toward the ground below the road. */
export function batteredWall(out:StructureSolid,a:XYZ,b:XYZ,offset:number,side:number,low:number,top:number,cut:boolean):void {
  const length=Math.hypot(b[0]-a[0],b[2]-a[2]);if(length<1e-7||top<=low)return;
  const nx=-(b[2]-a[2])/length,nz=(b[0]-a[0])/length,lean=(top-low)/6;
  const topOffset=offset+(cut?side*lean:0),bottomOffset=offset+(cut?0:side*lean);
  const corners=(height:number,o:number):XYZ[]=>[[a,-1],[a,1],[b,1],[b,-1]].map(([v,k])=>{const p=v as XYZ,amount=o+(k as number)*.25;return[p[0]+nx*amount,height,p[2]+nz*amount];});
  const start=out.positions.length;prism(out,corners(top,topOffset),low);
  corners(low,bottomOffset).forEach((p,i)=>out.positions.splice(start+i*3,3,...p));
}

export function bed(id:string, profile:string, points:XYZ[], terrainCut=true):BedCut {
  const s=requireScaleFactor(), road=profile==='road',spur=profile==='spur',skate=profile==='skateMain';
  const width=road?M.profiles.road.surface_m:spur?M.profiles.spur.surface_m:skate?M.profiles.skateMain.surface_m[1]!:profile==='boardwalk'?3:profile==='rail'?2.8:profile==='cable'?.1:profile==='cave'?8:profile==='stair'?3:2.5;
  return {id,kind:road||spur?'road':skate?'skate':profile as BedCut['kind'],profile,surface:road||spur||skate?'paved':profile==='boardwalk'?'boardwalk':profile==='rail'?'rail':profile==='cable'?'metal':profile==='cave'?'wetStone':'gravel',points,width:width*s,shoulder:road?s:0,blend:15*s,clearHeight:road?5*s:spur?4*s:profile==='rail'?3.2*s:profile==='cave'?6*s:2.4,maxGrade:skate?.18:profile==='cable'||profile==='rail'||profile==='cave'?10:.12,terrainCut,structureIds:[],districtIds:[...new Set(points.map(p=>districtAt(p[0]!,p[2]!)))]};
}
/** Plan distance from a point to a polyline. */
export function planDistance(p:XY,line:readonly XY[]):number {
  if(line.length===1)return distance(p,line[0]!);
  let best=Infinity;for(let i=1;i<line.length;i++){const a=line[i-1]!,b=line[i]!,dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t));}
  return best;
}
/** The walking ground just beyond a bed edge: the terrain, or a pad surface there that is
 * not above the bed (a pad above the bed is a wall to retain, not ground). */
/** Wave 6: a raised landing/platform deck (a floor slab, not a pad) is ground to the bed edge beside it — page B's lamp
 * gallery ramp ran on across its landing slab and railed its own mouth (the drop was read to the sea under the slab). */
type FloorTop={x0:number;x1:number;z0:number;z1:number;tris:number[][]};
const floorTops=new WeakMap<StructureSolid,FloorTop>();
const floorLists=new WeakMap<readonly StructureSolid[],{length:number;floors:StructureSolid[]}>();
/** The floor's up-facing triangles (a rotated slab's box would cover ground beside it). */
function floorTop(s:StructureSolid):FloorTop{
  let f=floorTops.get(s);if(f)return f;f={x0:Infinity,x1:-Infinity,z0:Infinity,z1:-Infinity,tris:[]};const p=s.positions;
  for(let i=0;i<s.indices.length;i+=3){const t=[0,1,2].map(k=>s.indices[i+k]!*3),a=t.map(j=>[p[j]!,p[j+1]!,p[j+2]!]);
    const ux=a[1]![0]!-a[0]![0]!,uz=a[1]![2]!-a[0]![2]!,vx=a[2]![0]!-a[0]![0]!,vz=a[2]![2]!-a[0]![2]!,uy=a[1]![1]!-a[0]![1]!,vy=a[2]![1]!-a[0]![1]!,ny=uz*vx-ux*vz,n=Math.hypot(uy*vz-uz*vy,ny,ux*vy-uy*vx);
    if(n<1e-9||ny/n<.9)continue;f.tris.push(a.flat());for(const q of a){f.x0=Math.min(f.x0,q[0]!);f.x1=Math.max(f.x1,q[0]!);f.z0=Math.min(f.z0,q[2]!);f.z1=Math.max(f.z1,q[2]!);}}
  floorTops.set(s,f);return f;
}
function floorAt(cuts:LandCuts,x:number,z:number,h:number):number {
  // A regeneration pass (junctions.ts settleBedEdges) emits into an empty solid list: it names the real one as floorSource.
  const source=(cuts as LandCuts&{floorSource?:StructureSolid[]}).floorSource??cuts.solids;
  let top=-Infinity,list=floorLists.get(source);
  if(!list||list.length!==source.length){list={length:source.length,floors:source.filter(s=>s.role==='floor'&&s.walkable&&/\.slab$/.test(s.id))};floorLists.set(source,list);}
  for(const s of list.floors){const f=floorTop(s);if(x<f.x0||x>f.x1||z<f.z0||z>f.z1)continue;
    for(const t of f.tris){const [ax,ay,az,bx,by,bz,cx,cy,cz]=t as [number,number,number,number,number,number,number,number,number],det=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(det)<1e-9)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/det,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/det;if(u<-1e-6||v<-1e-6||u+v>1+1e-6)continue;
      const y=u*ay+v*by+(1-u-v)*cy;if(y<=h+.6)top=Math.max(top,y);}}
  return top;
}
function groundBeyond(cuts:LandCuts,base:HeightQuery,x:number,z:number,h:number):number {
  let ground=Math.max(base(x,z),floorAt(cuts,x,z,h));
  for(const p of cuts.pads){
    if(p.underground||p.centre[1]>h+.6||p.centre[1]<=ground)continue;
    const angle=p.rotationDegrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),dx=x-p.centre[0],dz=z-p.centre[2];
    if(Math.abs(dx*c+dz*s)<=p.size[0]/2&&Math.abs(-dx*s+dz*c)<=p.size[1]/2)ground=p.centre[1];
  }
  return ground;
}
/** Wave 6: (x, z) lies on a surface pad (not a host pad) at `level` (± 0.3). */
function onPlaza(cuts:LandCuts,x:number,z:number,level:number):boolean {
  return cuts.pads.some(p=>{if(p.underground||p.kind==='host'||Math.abs(p.centre[1]-level)>.3)return false;const angle=p.rotationDegrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),dx=x-p.centre[0],dz=z-p.centre[2];return Math.abs(dx*c+dz*s)<=p.size[0]/2&&Math.abs(-dx*s+dz*c)<=p.size[1]/2;});
}
/** Wave 6: walkable batters — per side, runs of cross-sections (bed edge point → plaza foot, BATTER_RUN eu of run per eu of rise;
 * ≈ 9.5°); consecutive sections share their corners (mitred at bends), so no wedge gap or proud end face is left for a
 * body to catch on (the first cut, one prism per piece, left 0.2 eu wedges and end faces at every bend). */
type BatterSection={top:XYZ;foot:XYZ;at:XY};
/** Run per unit of rise: 6 (≈ 9.5°) keeps every triangle of a mitred, twisted strip under the collision's 18° flat-face limit. */
export const BATTER_RUN=6;
function batterSection(runs:Map<number,BatterSection[][]>,side:number,p:XYZ,nx:number,nz:number,edge:number,level:number,start:boolean):void {
  const list=runs.get(side)!,run=list.at(-1)!,run1=Math.max(.8,BATTER_RUN*(p[1]-level)),last=run.at(-1);
  const make=(ax:number,az:number):BatterSection=>({at:[p[0],p[2]],top:[p[0]+ax*edge,p[1],p[2]+az*edge],foot:[p[0]+ax*(edge+run1),level,p[2]+az*(edge+run1)]});
  // A piece's start joins the run only where the previous piece ended (mitred); otherwise it starts a new run. Its end always extends it.
  if(start&&last&&Math.hypot(last.at[0]-p[0],last.at[1]-p[2])>=1e-6){list.push([make(nx*side,nz*side)]);return;}
  if(start&&last){
    // Mitre: the shared section takes the mean of the two normals.
    const ox=(last.top[0]-p[0]),oz=(last.top[2]-p[2]),ol=Math.hypot(ox,oz)||1,mx=ox/ol+nx*side,mz=oz/ol+nz*side,ml=Math.hypot(mx,mz)||1;run[run.length-1]=make(mx/ml,mz/ml);return;
  }
  run.push(make(nx*side,nz*side));
}
function batterSolid(id:string,runs:Map<number,BatterSection[][]>,district:string):StructureSolid|null {
  const out=solid(id,'shoulder','gravel','deck',[id.replace(/\.batter$/,'')],district);
  // One 8-vertex prism per section pair (later bake passes treat solids as prisms of 8 vertices): shared, mitred corners, so
  // neighbouring end faces coincide inside the strip; bottoms 0.1 under the plaza.
  for(const list of runs.values())for(const run of list)for(let i=1;i<run.length;i++){
    const a=run[i-1]!,b=run[i]!,q:XYZ[]=[a.top,b.top,b.foot,a.foot],area=q.reduce((sum,p,k)=>{const n=q[(k+1)%4]!;return sum+p[0]*n[2]-n[0]*p[2];},0);
    prism(out,area<0?q:[...q].reverse(),Math.min(a.foot[1],b.foot[1])-.1);
  }
  return out.indices.length?out:null;
}
/** Sides (+1/-1 of the segment normal) this segment shares with a neighbouring bed at the same height. */
function sharedSides(b:BedCut,cuts:LandCuts,mid:XY,h:number,nx:number,nz:number):Set<number> {
  const sides=new Set<number>();
  for(const e of b.sharedEdges??[]){
    if(planDistance(mid,e.at)>1)continue;const other=cuts.beds.find(x=>x.id===e.other);if(!other)continue;
    const n=nearestOnPath(mid,other.points);if(Math.abs(n.at[1]-h)>1)continue;const side=Math.sign((n.at[0]-mid[0])*nx+(n.at[2]-mid[1])*nz);if(side)sides.add(side);
  }
  return sides;
}
/** Plan length (eu) over which a bed edge's guard and retaining decision is taken, and the most a rail runs between posts. */
export const EDGE_PIECE=2.5;
/** Integrator 3: road-kind beds that are not carriageways take the walk's open posted rail at a drop, not the road's solid
 * parapet: the airstrip's west edge over the Year Walk (a 1 m stone parapet 17 m from page H's eye hid all 638 of the
 * west sea's rays at 1440 × 900). */
export const OPEN_RAIL_ROADS=new Set(['strip']);
export function emitBedGeometry(b:BedCut,cuts:LandCuts,base:HeightQuery,thresholds:XY[]=[]):void {
  if(b.kind==='cable'||b.kind==='cave')return;
  // Road main (ROAD.md §1, D-R1): a corridor road's kerbs, guards and retaining walls are the corridor's (land/corridor, built at
  // the end of the bake against the final ground and replacing this bed's strip too); only its provisional deck and shoulders
  // are emitted here, for the passes that run before the corridor (crossings, grounding).
  const corridorEdges=isCorridorRoad(b);
  const district=b.districtIds[0]!??'harbour',deck=solid(`${b.id}.bed`,'bed',b.surface,'deck',[b.id],district);
  const kerbs=solid(`${b.id}.kerbs`,'kerb','stone','wall',[b.id],district),rails=solid(`${b.id}.edges`,'parapet','stone','rail',[b.id],district),retaining=solid(`${b.id}.retaining`,'retainingWall','rock','wall',[b.id],district);
  const shoulders=solid(`${b.id}.shoulders`,'shoulder','gravel','deck',[b.id],district);
  const segments=b.surfaceSegments?.map((v,i)=>solid(`${b.id}.surface.${i}`,'bed',v.surface,'deck',[b.id],district));
  const runs=new Map<number,{on:boolean;count:number;last?:XYZ;nx:number;nz:number;edge:number}>([[-1,{on:false,count:0,nx:0,nz:0,edge:0}],[1,{on:false,count:0,nx:0,nz:0,edge:0}]]);
  const batters=new Map<number,BatterSection[][]>([[-1,[[]]],[1,[[]]]]),endBatter=(side:number)=>{const list=batters.get(side)!;if(list.at(-1)!.length)list.push([]);};
  // road (L1): a corner of this bed's deck that lies on a higher-ranked road's paved area (within 0.6 of its height) takes that
  // road's surface there: one surface where a spur, a walk or a skate lane joins or crosses a road (a joining bed was level across
  // its width while the road under it climbed: 0.2–0.45 lips at every oblique join).
  const onHost=hostSurface(b,cuts);
  const carriedSeg=b.points.map((p,i)=>{if(!i)return false;const a=b.points[i-1]!,mid:XY=[(a[0]!+p[0]!)/2,(a[2]!+p[2]!)/2];return !!b.carried?.some(line=>planDistance(mid,line)<1);});
  for(let i=1;i<b.points.length;i++){
    const a=b.points[i-1]!,p=b.points[i]!,dx=p[0]!-a[0]!,dz=p[2]!-a[2]!,len=Math.hypot(dx,dz);if(len<1e-6)continue;
    const mid:XY=[(a[0]!+p[0]!)/2,(a[2]!+p[2]!)/2],h=(a[1]!+p[1]!)/2,nx=-dz/len,nz=dx/len;
    // Carried inside another bed's own structure: no second deck, edge or wall here.
    if(carriedSeg[i])continue;
    const shared=b.sharedEdges?sharedSides(b,cuts,mid,h,nx,nz):undefined;
    const target=segments?segments[Math.min(segments.length-1,Math.floor((i-1)/(b.points.length-1)*segments.length))]!:deck;
    // road (L1): the deck is one continuous ribbon: mitred pieces share their corners (per-segment rectangles left 0.2–0.3 eu
    // cracks to the ground on the outside of every bend).
    mitredSlab(target!,b.points,i,b.width,b.kind==='road'||b.kind==='skate'?.6:.35,0,0,j=>!!carriedSeg[j],onHost);
    const joinedPad=cuts.pads.some(p=>{if(p.underground||p.kind==='host'||Math.abs(p.centre[1]-h)>.6)return false;const angle=p.rotationDegrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),x=mid[0]-p.centre[0],z=mid[1]-p.centre[2];return Math.abs(x*c+z*s)<=p.size[0]/2+b.width/2&&Math.abs(-x*s+z*c)<=p.size[1]/2+b.width/2;});
    // A pad only lifts the kerb: a guard stays wherever the ground beyond the edge (terrain or a
    // pad surface) drops more than body height. Junction mouths are opened later along the
    // joining route's own corridor (junctions.ts), never as a circle around the pad.
    const gap=joinedPad||thresholds.some(t=>distance(mid,t)<5);
    // W5-A (R2-05): edges are decided every EDGE_PIECE eu, not once per segment (the 340 m airstrip segment read one drop at
    // its middle and left 56 m of a 3.8 eu edge bare), and the drop is the larger of 1.0 and 1.5 eu beyond the edge.
    const pieces=len>2.4*EDGE_PIECE?Math.ceil(len/EDGE_PIECE):1,at=(t:number):XYZ=>[a[0]+(p[0]-a[0])*t,a[1]+(p[1]-a[1])*t,a[2]+(p[2]-a[2])*t];
    for(const side of [-1,1]){
      if(shared?.has(side)){if(b.shoulder)mitredSlab(shoulders,b.points,i,b.shoulder,.6,side*(b.width/2+b.shoulder/2),0,j=>!!carriedSeg[j],onHost);continue;}
      const edge=b.width/2+b.shoulder;
      if(b.shoulder)mitredSlab(shoulders,b.points,i,b.shoulder,.6,side*(b.width/2+b.shoulder/2),0,j=>!!carriedSeg[j],onHost);
      if(corridorEdges)continue;
      if(!gap&&b.kind==='road')slab(kerbs,a,p,.25,.15,side*b.width/2,.15);
      for(let k=0;k<pieces;k++){
        const pa=at(k/pieces),pb=at((k+1)/pieces),pm:XY=[(pa[0]+pb[0])/2,(pa[2]+pb[2])/2],ph=(pa[1]+pb[1])/2;
        const drop=Math.max(...[1,1.5].map(o=>ph-groundBeyond(cuts,base,pm[0]+nx*side*(edge+o),pm[1]+nz*side*(edge+o),ph)));
        const run=runs.get(side)!,post=(q:XYZ)=>box(rails,[q[0]+nx*side*edge,q[2]+nz*side*edge],q[1]+1.05,[.12,.12],q[1]-.1);
        if(drop>1.25){
          if(b.kind==='road'&&!OPEN_RAIL_ROADS.has(b.id)){
            slab(rails,pa,pb,.35,1,side*edge,1);slab(rails,pa,pb,.5,.15,side*edge,1.15);
          }else{
            slab(rails,pa,pb,.09,.09,side*edge,1.05);
            // Posts at every rail run's start and end and at least every other piece between: no run without a post.
            if(!run.on||run.count%2===0)post(pa);run.on=true;run.count++;run.last=pb;run.nx=nx;run.nz=nz;run.edge=edge;
          }
        }else if(run.on){post(pa);run.on=false;run.count=0;}
        // Wave 6: a walk rising less than a guard's drop out of a plaza of its own tier (candidate 4: the home approach 0.4–0.8
        // over the square beside page A's pose; its retaining wall and bed lip stopped the first step) meets the plaza with a
        // walkable batter (1:6, under the collision's 18° flat-face rule), not a wall or a lip: the route joins the plaza along its length.
        if(drop>.3&&drop<=1.25&&b.kind!=='road'&&[1,1.5,BATTER_RUN*drop].every(o=>onPlaza(cuts,pm[0]+nx*side*(edge+o),pm[1]+nz*side*(edge+o),ph-drop))){batterSection(batters,side,pa,nx,nz,edge,ph-drop,true);batterSection(batters,side,pb,nx,nz,edge,ph-drop,false);continue;}
        endBatter(side);
        if(b.terrainCut&&!b.terrainExclusions?.some(e=>distance(pm,e.at)<e.radius)&&Math.abs(drop)>.5){
          const low=Math.min(ph-.6,base(pm[0]+nx*side*(edge+1),pm[1]+nz*side*(edge+1)))-.2;
          const top=Math.max(ph,low+Math.abs(drop));
          batteredWall(retaining,pa,pb,side*(edge+.5),side,low,top,drop<0);
        }
      }
    }
  }
  for(const [side,run]of runs)if(run.on&&run.last)box(rails,[run.last[0]+run.nx*side*run.edge,run.last[2]+run.nz*side*run.edge],run.last[1]+1.05,[.12,.12],run.last[1]-.1);
  // A road circles several districts. Stream its local prisms with the district underneath them.
  {const batter=batterSolid(`${b.id}.batter`,batters,district);if(batter)cuts.solids.push(batter);}
  for(const piece of [...(segments??[deck]),kerbs,rails,retaining,shoulders])if(piece.indices.length){
    const districts=new Map<string,StructureSolid>();
    for(let vertex=0;vertex<piece.positions.length/3;vertex+=8){
      let x=0,z=0;for(let k=0;k<8;k++){x+=piece.positions[(vertex+k)*3]!/8;z+=piece.positions[(vertex+k)*3+2]!/8;}
      const districtId=districtAt(x,z);let part=districts.get(districtId);if(!part){part={...piece,id:`${piece.id}.${districtId}`,districtId,positions:[],indices:[]};districts.set(districtId,part);}
      const offset=part.positions.length/3;part.positions.push(...piece.positions.slice(vertex*3,(vertex+8)*3));
      const indexStart=vertex/8*36;part.indices.push(...piece.indices.slice(indexStart,indexStart+36).map(i=>i-vertex+offset));
    }
    cuts.solids.push(...districts.values());
  }
}
/** road (L1): the rank of a bed as a surface others join: the Drive, then the Green Road and the Mountain Road, the Bight spur, other
 * roads (spurs, service drives), skate lines, then foot routes. A bed's corner lying on a higher-ranked road takes its surface. */
export function surfaceRank(b:Pick<BedCut,'id'|'kind'|'profile'>):number {
  if(b.id==='V01')return 6;if(b.id==='VG'||b.id==='V03')return 5;if(b.id==='VBS')return 4;
  if(b.kind==='road')return 3;if(b.kind==='skate')return 2;return 1;
}
type HostIndex={cells:Map<string,{bed:BedCut;a:XYZ;b:XYZ}[]>;beds:readonly BedCut[]};
/** road (L1): a joining deck's corner within this of a road's paved edge also takes the road's surface (a lip-free apron). */
const HOST_APRON=.6;
const HOST_CELL=16,hostIndices=new WeakMap<LandCuts,{key:string;index:HostIndex}>();
/** road (L1): the top height for a deck corner of `b` at p: the surface of the highest-ranked road (above b's own rank) whose
 * paved area (width/2 + shoulder) holds p and whose height there is within 0.6 of the corner's own; else the corner's own. Road
 * decks are level across their width, so a host's surface at p is its centreline height at the nearest point. */
export function hostSurface(b:BedCut,cuts:LandCuts):((p:XYZ)=>number)|undefined {
  if(['cable','cave','rail'].includes(b.kind)||b.id.startsWith('structure.')||!b.terrainCut)return undefined;
  const rank=surfaceRank(b),hosts=cuts.beds.filter(h=>h!==b&&h.kind==='road'&&h.terrainCut&&!h.id.startsWith('structure.')&&!h.id.startsWith('mountainV2.')&&h.width<=12&&surfaceRank(h)>rank);
  if(!hosts.length)return undefined;
  const key=hosts.map(h=>`${h.id}:${h.points.length}:${h.points[0]?.[1]}:${h.points.at(-1)?.[1]}`).join('|');let cached=hostIndices.get(cuts);
  if(!cached||cached.key!==key||cached.index.beds.length!==hosts.length||cached.index.beds.some((h,i)=>h!==hosts[i])){
    const cells=new Map<string,{bed:BedCut;a:XYZ;b:XYZ}[]>();
    for(const h of hosts){const r=h.width/2+h.shoulder+HOST_APRON;for(let i=1;i<h.points.length;i++){const a=h.points[i-1]!,e=h.points[i]!;
      for(let x=Math.floor((Math.min(a[0],e[0])-r)/HOST_CELL);x<=Math.floor((Math.max(a[0],e[0])+r)/HOST_CELL);x++)for(let z=Math.floor((Math.min(a[2],e[2])-r)/HOST_CELL);z<=Math.floor((Math.max(a[2],e[2])+r)/HOST_CELL);z++){const k=`${x}:${z}`;(cells.get(k)??cells.set(k,[]).get(k)!).push({bed:h,a,b:e});}}}
    cached={key,index:{cells,beds:hosts}};hostIndices.set(cuts,cached);}
  const index=cached.index;
  return (p:XYZ)=>{
    let best:{h:number;rank:number}|undefined;
    for(const s of index.cells.get(`${Math.floor(p[0]/HOST_CELL)}:${Math.floor(p[2]/HOST_CELL)}`)??[]){
      if(surfaceRank(s.bed)<=rank)continue;const dx=s.b[0]-s.a[0],dz=s.b[2]-s.a[2],l=dx*dx+dz*dz||1,t=((p[0]-s.a[0])*dx+(p[2]-s.a[2])*dz)/l;
      // Only the segment whose span holds the point's foot (an end cap would read a host's closing segment far past its end).
      if(t<-.02||t>1.02)continue;
      const d=Math.hypot(p[0]-s.a[0]-dx*t,p[2]-s.a[2]-dz*t);if(d>s.bed.width/2+s.bed.shoulder+HOST_APRON)continue;const h=s.a[1]+(s.b[1]-s.a[1])*t;if(Math.abs(h-p[1])>=.6)continue;
      const r=surfaceRank(s.bed);if(!best||r>best.rank||r===best.rank&&Math.abs(h-p[1])<Math.abs(best.h-p[1]))best={h,rank:r};}
    return best?best.h:p[1];
  };
}
/** road (L1): the deck corner test used by emitBedGeometry: the host's surface at the corner's plan point, measured against the
 * bed's own height at the segment's point nearest the corner (the corner itself carries the bed's centreline height). */
export function heightOnBeds(cuts:LandCuts,p:XY,base:HeightQuery,maxDistance=15):number {
  let distance=Infinity,height=base(...p);
  for(const b of cuts.beds){if(b.kind==='cable'||b.kind==='cave'||b.kind==='rail')continue;const n=nearestOnPath(p,b.points);if(n.distance<Math.min(distance,maxDistance)){distance=n.distance;height=n.at[1]!;}}
  return height;
}
export function addFlatPad(cuts:LandCuts,id:string,kind:import('../interfaces').PadCut['kind'],p:XY,height:number,size:XY,rotation=0,underground=false):import('../interfaces').PadCut {
  const pad={id,kind,centre:[p[0]!,height,p[1]!] as unknown as XYZ,size,rotationDegrees:rotation,margin:0,blend:6,underground};cuts.pads.push(pad);
  const deck=solid(`${id}.slab`,'pad','stone','floor',[],districtAt(...p));box(deck,p,height,size,height-.35,rotation);cuts.solids.push(deck);return pad;
}
