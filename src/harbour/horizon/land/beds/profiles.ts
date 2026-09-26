import { HORIZON_MANIFEST as M, requireScaleFactor } from '../../world/manifest';
import type { BedCut, HeightQuery, LandCuts, StructureSolid, XY, XYZ } from '../interfaces';
import { box, distance, districtAt, nearestOnPath, slab, solid } from '../structures/mesh';

export function bed(id:string, profile:string, points:XYZ[], terrainCut=true):BedCut {
  const s=requireScaleFactor(), road=profile==='road',spur=profile==='spur',skate=profile==='skateMain';
  const width=road?M.profiles.road.surface_m:spur?M.profiles.spur.surface_m:skate?M.profiles.skateMain.surface_m[1]!:profile==='boardwalk'?3:profile==='rail'?2.8:profile==='cable'?.1:profile==='cave'?8:profile==='stair'?3:2.5;
  return {id,kind:road||spur?'road':skate?'skate':profile as BedCut['kind'],profile,surface:road||spur||skate?'paved':profile==='boardwalk'?'boardwalk':profile==='rail'?'rail':profile==='cable'?'metal':profile==='cave'?'wetStone':'gravel',points,width:width*s,shoulder:road?s:0,blend:15*s,clearHeight:road?5*s:spur?4*s:profile==='rail'?3.2*s:profile==='cave'?6*s:2.4,maxGrade:skate?.18:profile==='cable'||profile==='rail'||profile==='cave'?10:.12,terrainCut,structureIds:[],districtIds:[...new Set(points.map(p=>districtAt(p[0]!,p[2]!)))]};
}
export function emitBedGeometry(b:BedCut,cuts:LandCuts,base:HeightQuery,thresholds:XY[]=[]):void {
  if(b.kind==='cable'||b.kind==='cave')return;
  const district=b.districtIds[0]!??'harbour',deck=solid(`${b.id}.bed`,'bed',b.surface,'deck',[b.id],district);
  const kerbs=solid(`${b.id}.kerbs`,'kerb','stone','wall',[b.id],district),rails=solid(`${b.id}.edges`,'parapet','stone','rail',[b.id],district),retaining=solid(`${b.id}.retaining`,'retainingWall','rock','wall',[b.id],district);
  const shoulders=solid(`${b.id}.shoulders`,'shoulder','gravel','deck',[b.id],district);
  const segments=b.surfaceSegments?.map((v,i)=>solid(`${b.id}.surface.${i}`,'bed',v.surface,'deck',[b.id],district));
  for(let i=1;i<b.points.length;i++){
    const a=b.points[i-1]!,p=b.points[i]!,dx=p[0]!-a[0]!,dz=p[2]!-a[2]!,len=Math.hypot(dx,dz);if(len<1e-6)continue;
    const mid:XY=[(a[0]!+p[0]!)/2,(a[2]!+p[2]!)/2],h=(a[1]!+p[1]!)/2,nx=-dz/len,nz=dx/len;
    const target=segments?segments[Math.min(segments.length-1,Math.floor((i-1)/(b.points.length-1)*segments.length))]!:deck;
    slab(target!,a,p,b.width,b.kind==='road'||b.kind==='skate'?.6:.35);
    const joinedPad=cuts.pads.some(p=>{if(p.underground||p.kind==='host'||Math.abs(p.centre[1]-h)>.6)return false;const angle=p.rotationDegrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),x=mid[0]-p.centre[0],z=mid[1]-p.centre[2];return Math.abs(x*c+z*s)<=p.size[0]/2+b.width/2&&Math.abs(-x*s+z*c)<=p.size[1]/2+b.width/2;});
    const gap=joinedPad||thresholds.some(t=>distance(mid,t)<5);
    for(const side of [-1,1]){
      const edge=b.width/2+b.shoulder,drop=h-base(mid[0]!+nx*side*(edge+1.5),mid[1]!+nz*side*(edge+1.5));
      if(b.shoulder)slab(shoulders,a,p,b.shoulder,.6,side*(b.width/2+b.shoulder/2));
      if(!gap&&b.kind==='road')slab(kerbs,a,p,.25,.15,side*b.width/2,.15);
      if(!gap&&drop>1.25){
        if(b.kind==='road'){
          slab(rails,a,p,.35,1,side*edge,1);slab(rails,a,p,.5,.15,side*edge,1.15);
        }else{
          slab(rails,a,p,.09,.09,side*edge,1.05);
          if(i%2===0)box(rails,[mid[0]!+nx*side*edge,mid[1]!+nz*side*edge],h+1.05,[.12,.12],h-.1);
        }
      }
      if(b.terrainCut&&!joinedPad&&Math.abs(drop)>.5){
        const low=Math.min(h-.6,base(mid[0]!+nx*side*(edge+1),mid[1]!+nz*side*(edge+1)))-.2;
        const top=Math.max(h,low+Math.abs(drop));
        // The wall widens into the earth at 1:6, so cuts have a visible battered face.
        box(retaining,[mid[0]!+nx*side*(edge+.25),mid[1]!+nz*side*(edge+.25)],top,[Math.max(.5,(top-low)/6),len+.05],low,Math.atan2(dz,dx)*180/Math.PI-90);
      }
    }
  }
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
