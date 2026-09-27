import { HORIZON_MANIFEST as M, requireScaleFactor } from '../../world/manifest';
import type { BedCut, HeightQuery, LandCuts, StructureSolid, XY, XYZ } from '../interfaces';
import { box, distance, districtAt, nearestOnPath, slab, solid, prism } from '../structures/mesh';

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
function groundBeyond(cuts:LandCuts,base:HeightQuery,x:number,z:number,h:number):number {
  let ground=base(x,z);
  for(const p of cuts.pads){
    if(p.underground||p.centre[1]>h+.6||p.centre[1]<=ground)continue;
    const angle=p.rotationDegrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),dx=x-p.centre[0],dz=z-p.centre[2];
    if(Math.abs(dx*c+dz*s)<=p.size[0]/2&&Math.abs(-dx*s+dz*c)<=p.size[1]/2)ground=p.centre[1];
  }
  return ground;
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
export function emitBedGeometry(b:BedCut,cuts:LandCuts,base:HeightQuery,thresholds:XY[]=[]):void {
  if(b.kind==='cable'||b.kind==='cave')return;
  const district=b.districtIds[0]!??'harbour',deck=solid(`${b.id}.bed`,'bed',b.surface,'deck',[b.id],district);
  const kerbs=solid(`${b.id}.kerbs`,'kerb','stone','wall',[b.id],district),rails=solid(`${b.id}.edges`,'parapet','stone','rail',[b.id],district),retaining=solid(`${b.id}.retaining`,'retainingWall','rock','wall',[b.id],district);
  const shoulders=solid(`${b.id}.shoulders`,'shoulder','gravel','deck',[b.id],district);
  const segments=b.surfaceSegments?.map((v,i)=>solid(`${b.id}.surface.${i}`,'bed',v.surface,'deck',[b.id],district));
  const runs=new Map<number,{on:boolean;count:number;last?:XYZ;nx:number;nz:number;edge:number}>([[-1,{on:false,count:0,nx:0,nz:0,edge:0}],[1,{on:false,count:0,nx:0,nz:0,edge:0}]]);
  for(let i=1;i<b.points.length;i++){
    const a=b.points[i-1]!,p=b.points[i]!,dx=p[0]!-a[0]!,dz=p[2]!-a[2]!,len=Math.hypot(dx,dz);if(len<1e-6)continue;
    const mid:XY=[(a[0]!+p[0]!)/2,(a[2]!+p[2]!)/2],h=(a[1]!+p[1]!)/2,nx=-dz/len,nz=dx/len;
    // Carried inside another bed's own structure: no second deck, edge or wall here.
    if(b.carried?.some(line=>planDistance(mid,line)<1))continue;
    const shared=b.sharedEdges?sharedSides(b,cuts,mid,h,nx,nz):undefined;
    const target=segments?segments[Math.min(segments.length-1,Math.floor((i-1)/(b.points.length-1)*segments.length))]!:deck;
    slab(target!,a,p,b.width,b.kind==='road'||b.kind==='skate'?.6:.35);
    const joinedPad=cuts.pads.some(p=>{if(p.underground||p.kind==='host'||Math.abs(p.centre[1]-h)>.6)return false;const angle=p.rotationDegrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),x=mid[0]-p.centre[0],z=mid[1]-p.centre[2];return Math.abs(x*c+z*s)<=p.size[0]/2+b.width/2&&Math.abs(-x*s+z*c)<=p.size[1]/2+b.width/2;});
    // A pad only lifts the kerb: a guard stays wherever the ground beyond the edge (terrain or a
    // pad surface) drops more than body height. Junction mouths are opened later along the
    // joining route's own corridor (junctions.ts), never as a circle around the pad.
    const gap=joinedPad||thresholds.some(t=>distance(mid,t)<5);
    // W5-A (R2-05): edges are decided every EDGE_PIECE eu, not once per segment (the 340 m airstrip segment read one drop at
    // its middle and left 56 m of a 3.8 eu edge bare), and the drop is the larger of 1.0 and 1.5 eu beyond the edge.
    const pieces=len>2.4*EDGE_PIECE?Math.ceil(len/EDGE_PIECE):1,at=(t:number):XYZ=>[a[0]+(p[0]-a[0])*t,a[1]+(p[1]-a[1])*t,a[2]+(p[2]-a[2])*t];
    for(const side of [-1,1]){
      if(shared?.has(side)){if(b.shoulder)slab(shoulders,a,p,b.shoulder,.6,side*(b.width/2+b.shoulder/2));continue;}
      const edge=b.width/2+b.shoulder;
      if(b.shoulder)slab(shoulders,a,p,b.shoulder,.6,side*(b.width/2+b.shoulder/2));
      if(!gap&&b.kind==='road')slab(kerbs,a,p,.25,.15,side*b.width/2,.15);
      for(let k=0;k<pieces;k++){
        const pa=at(k/pieces),pb=at((k+1)/pieces),pm:XY=[(pa[0]+pb[0])/2,(pa[2]+pb[2])/2],ph=(pa[1]+pb[1])/2;
        const drop=Math.max(...[1,1.5].map(o=>ph-groundBeyond(cuts,base,pm[0]+nx*side*(edge+o),pm[1]+nz*side*(edge+o),ph)));
        const run=runs.get(side)!,post=(q:XYZ)=>box(rails,[q[0]+nx*side*edge,q[2]+nz*side*edge],q[1]+1.05,[.12,.12],q[1]-.1);
        if(drop>1.25){
          if(b.kind==='road'){
            slab(rails,pa,pb,.35,1,side*edge,1);slab(rails,pa,pb,.5,.15,side*edge,1.15);
          }else{
            slab(rails,pa,pb,.09,.09,side*edge,1.05);
            // Posts at every rail run's start and end and at least every other piece between: no run without a post.
            if(!run.on||run.count%2===0)post(pa);run.on=true;run.count++;run.last=pb;run.nx=nx;run.nz=nz;run.edge=edge;
          }
        }else if(run.on){post(pa);run.on=false;run.count=0;}
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
export function heightOnBeds(cuts:LandCuts,p:XY,base:HeightQuery,maxDistance=15):number {
  let distance=Infinity,height=base(...p);
  for(const b of cuts.beds){if(b.kind==='cable'||b.kind==='cave'||b.kind==='rail')continue;const n=nearestOnPath(p,b.points);if(n.distance<Math.min(distance,maxDistance)){distance=n.distance;height=n.at[1]!;}}
  return height;
}
export function addFlatPad(cuts:LandCuts,id:string,kind:import('../interfaces').PadCut['kind'],p:XY,height:number,size:XY,rotation=0,underground=false):import('../interfaces').PadCut {
  const pad={id,kind,centre:[p[0]!,height,p[1]!] as unknown as XYZ,size,rotationDegrees:rotation,margin:0,blend:6,underground};cuts.pads.push(pad);
  const deck=solid(`${id}.slab`,'pad','stone','floor',[],districtAt(...p));box(deck,p,height,size,height-.35,rotation);cuts.solids.push(deck);return pad;
}
