/** The Ore Line's existing south mouth joins the carried road at grade. Only
 * Horizon's lining, apron and exposed ground change; rail points and native
 * Mountain surfaces remain authoritative. */
import {HORIZON_MANIFEST as M} from '../../world/manifest';
import type {BedCut,HeightQuery,LandCuts,StructureSolid,XY,XYZ} from '../interfaces';
import {mountainRoadSource} from '../mountainV2/roadSource';
import {clamp,distance,mix,nearestOnPath,plan,prism,solid} from '../structures/mesh';

const door=M.underground.doors.southPortal;
const mouth=[door.xy[0]!-8,door.xy[0]!+8,door.xy[1]!-9,door.xy[1]!+9] as const;
const inMouth=(x:number,z:number,margin=0)=>x>=mouth[0]-margin&&x<=mouth[1]+margin&&z>=mouth[2]-margin&&z<=mouth[3]+margin;
const lerp=(a:XYZ,b:XYZ,t:number):XYZ=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];

type CrossingPlane={gx:number;gz:number;c:number};
const crossingProfiles=new WeakMap<LandCuts,{x:number;z:number;planes:CrossingPlane[]}>();
function crossingProfile(cuts:LandCuts){
  const cached=crossingProfiles.get(cuts);if(cached)return cached;
  const ore=cuts.beds.find(b=>b.id==='ORE');if(!ore)return null;
  const end=ore.points.at(-1)!,previous=ore.points.at(-2)!,l=distance(plan(previous),plan(end)),ux=(end[0]-previous[0])/l,uz=(end[2]-previous[2])/l,grade=(end[1]-previous[1])/l;
  const corners=[[-3.8,-.54],[-3.8,.54],[0,.54],[0,-.54]].map(([s,w])=>({x:ux*s!-uz*w!,z:uz*s!+ux*w!,y:end[1]+.115+grade*s!}));
  const planes:CrossingPlane[]=[{gx:grade*ux,gz:grade*uz,c:end[1]+.115}];
  for(let i=0;i<16;i++){
    const x=Math.cos(i*Math.PI/8),z=Math.sin(i*Math.PI/8),G=.115;
    planes.push({gx:-G*x,gz:-G*z,c:Math.max(...corners.map(p=>p.y+G*(x*p.x+z*p.z)))});
  }
  const profile={x:end[0],z:end[2],planes};crossingProfiles.set(cuts,profile);return profile;
}
const planeAt=(p:CrossingPlane,x:number,z:number,profile:{x:number;z:number})=>p.c+p.gx*(x-profile.x)+p.gz*(z-profile.z);
/** A faceted stone apron, at most 11.5% absolute grade. Its central 1.08 x 3.8m
 * infill is 5mm below the fixed rail heads; each surrounding facet descends to
 * the road. Explicit facet intersections keep the rendered mesh within 12%. */
export function oreCrossingTop(cuts:LandCuts,x:number,z:number):number {
  const p=crossingProfile(cuts);return p?Math.min(...p.planes.map(q=>planeAt(q,x,z,p))):-Infinity;
}

/** Extend the exact lower road plane for just the 2m paved transition beyond its
 * edge. This is a mesh shaping function, never a runtime surface candidate. */
export function oreStationFloor(cuts:LandCuts,x:number,z:number,height:number):number{
  if(!cuts.beds.some(b=>b.id==='mountainV2.road'))return height;
  const {floor,points}=mountainRoadSource(),at=floor(x,z,height+1),crossing=oreCrossingTop(cuts,x,z);
  if(at)return Math.max(crossing,Math.min(height,at.y));
  const near=nearestOnPath([x,z],points);if(Math.abs(near.at[1]-height)>1.5||near.distance>8)return Math.max(height,crossing);
  let outside=0,inside=1;
  for(let k=0;k<24;k++){
    const t=(outside+inside)/2;
    if(floor(mix(x,near.at[0],t),mix(z,near.at[2],t),height+1))inside=t;else outside=t;
  }
  const X=mix(x,near.at[0],inside),Z=mix(z,near.at[2],inside),edge=floor(X,Z,height+1);if(!edge)return Math.max(height,crossing);
  const t=clamp(Math.hypot(x-X,z-Z)/2,0,1),road=edge.y+edge.gx*(x-X)+edge.gz*(z-Z);
  return Math.max(crossing,Math.min(height,mix(road,height,t*t*(3-2*t))));
}

/** The same station footprint, cut exactly at the real road edge. Mixed grid
 * cells cannot protrude over the separately faceted level crossing. */
export function oreStationApron(cuts:LandCuts,p:XY,height:number):void{
  if(!cuts.beds.some(b=>b.id==='mountainV2.road'))return;
  const id='oreStation.southPortal.slab',out=solid(id,'pad','stone','floor',[],'crown');
  const top=(x:number,z:number):XYZ=>[x,oreStationFloor(cuts,x,z,height),z],{rows}=mountainRoadSource();
  const faces:{points:readonly [XYZ,XYZ,XYZ];x0:number;x1:number;z0:number;z1:number}[]=[];
  for(let i=1;i<rows.length;i++){
    if(Math.abs(rows[i]![0]![1]-height)>1.5)continue;
    for(let k=1;k<rows[i]!.length;k++)for(const points of [[rows[i-1]![k-1]!,rows[i]![k-1]!,rows[i]![k]!],[rows[i-1]![k-1]!,rows[i]![k]!,rows[i-1]![k]!]] as const){
      const x0=Math.min(...points.map(q=>q[0])),x1=Math.max(...points.map(q=>q[0])),z0=Math.min(...points.map(q=>q[2])),z1=Math.max(...points.map(q=>q[2]));
      if(x1>=p[0]-5&&x0<=p[0]+5&&z1>=p[1]-3&&z0<=p[1]+3)faces.push({points,x0,x1,z0,z1});
    }
  }
  const subtract=(polygon:XYZ[],triangle:readonly [XYZ,XYZ,XYZ]):XYZ[][]=>{
    const [a,b,c]=triangle,sign=Math.sign((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]));if(!sign)return[polygon];
    let left=polygon;const outside:XYZ[][]=[];
    for(let edge=0;edge<3&&left.length>=3;edge++){
      const a=triangle[edge]!,b=triangle[(edge+1)%3]!,side=(p:XYZ)=>sign*((b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]));
      const inside:XYZ[]=[],kept:XYZ[]=[];
      for(let i=0;i<left.length;i++){
        const a=left[i]!,b=left[(i+1)%left.length]!,da=side(a),db=side(b),ia=da>=0,ib=db>=0;
        (ia?inside:kept).push(a);
        if(ia!==ib){const q=lerp(a,b,da/(da-db));inside.push(q);kept.push(q);}
      }
      if(kept.length>=3)outside.push(kept);left=inside;
    }
    return outside;
  };
  const append=(polygon:XYZ[])=>{
    const q=polygon.filter((p,i)=>distance(plan(p),plan(polygon[(i+polygon.length-1)%polygon.length]!))>1e-8);
    const area=q.reduce((sum,p,i)=>{const next=q[(i+1)%q.length]!;return sum+p[0]*next[2]-p[2]*next[0];},0);if(q.length<3||Math.abs(area)<1e-8)return;if(area>0)q.reverse();
    const start=out.positions.length/3;
    // Re-evaluate every newly clipped point on the actual edge; interpolating
    // its old cell height recreated a10.93mm overlap and a13.18% hidden ramp.
    for(const p of q){const y=oreStationFloor(cuts,p[0],p[2],height);out.positions.push(p[0],y,p[2],p[0],y-.35,p[2]);}
    for(let i=1;i<q.length-1;i++)out.indices.push(start,start+i*2,start+(i+1)*2,start+1,start+(i+1)*2+1,start+i*2+1);
    for(let i=0;i<q.length;i++){const a=start+i*2,b=start+(i+1)%q.length*2;out.indices.push(a,a+1,b+1,a,b+1,b);}
  };
  for(let x=p[0]-5;x<p[0]+5-.01;x+=.5)for(let z=p[1]-3;z<p[1]+3-.01;z+=.5){
    const corners=[top(x,z),top(x,z+.5),top(x+.5,z+.5),top(x+.5,z)];
    if(corners.every(q=>mountainRoadSource().floor(q[0],q[2],height+1)))continue;
    let pieces=[corners];
    for(const face of faces){if(face.x1<x||face.x0>x+.5||face.z1<z||face.z0>z+.5)continue;pieces=pieces.flatMap(q=>subtract(q,face.points));if(!pieces.length)break;}
    for(const piece of pieces)append(piece);
  }
  cuts.solids=cuts.solids.map(s=>s.id===id?out:s);
}

/** Keep the existing portal frame's plan placement outside the lower road. */
export function orePortalFrame(cuts:LandCuts,ore:readonly XYZ[]):{at:XYZ;normal:XY}{
  const road=cuts.beds.find(b=>b.id==='mountainV2.road')!;
  for(let i=ore.length-1;i>0;i--){
    const a=ore[i]!,b=ore[i-1]!,l=distance(plan(a),plan(b));
    for(let d=0;d<=l;d+=.25){const p=lerp(a,b,d/l);
      if(nearestOnPath(plan(p),road.points).distance>road.width/2+3)return {at:p,normal:[-(a[2]-b[2])/l,(a[0]-b[0])/l]};
    }
  }
  throw new Error('Ore portal has no frame position clear of the Mountain Road');
}

/** The one-metre-deep lintel clears the uphill rail bed at its whole footprint. */
export function orePortalLintelRise(cuts:LandCuts,ore:readonly XYZ[]):number{
  const a=ore.at(-2)!,b=ore.at(-1)!,l=distance(plan(a),plan(b)),u:XY=[(b[0]-a[0])/l,(b[2]-a[2])/l],frame=orePortalFrame(cuts,ore);
  let rise=Math.abs(b[1]-a[1])/l*.5;
  for(const d of [-.5,.5])for(let w=-1.95;w<=1.95;w+=.15){
    const x=frame.at[0]+u[0]*d-u[1]*w,z=frame.at[2]+u[1]*d+u[0]*w;
    rise=Math.max(rise,oreCrossingTop(cuts,x,z)-frame.at[1]);
  }
  return rise+.002;
}

/** A closed paving course within the actual road triangles and at most 18m
 * downhill / 10m uphill. Clip every ramp facet against its neighbours and the
 * native road plane: no triangle straddles two grades and invents a steeper lip. */
export function addOreLevelCrossing(cuts:LandCuts):void {
  const profile=crossingProfile(cuts);if(!profile)return;
  const {rows,points}=mountainRoadSource(),at=nearestOnPath([door.xy[0]!,door.xy[1]!],points).along;
  const out=solid('oreStation.southPortal.crossing','levelCrossing','stone','floor',['mountainV2.road','ORE'],'crown'),vertices=new Map<string,number>(),edges=new Map<string,{a:number;b:number;count:number}>();
  const clip=(polygon:readonly XYZ[],value:(p:XYZ)=>number):XYZ[]=>{
    const result:XYZ[]=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!,fa=value(a),fb=value(b),inside=fa>=-1e-9;
      if(inside)result.push(a);if(inside!==(fb>=-1e-9))result.push(lerp(a,b,fa/(fa-fb)));
    }
    return result;
  };
  const vertex=(p:XYZ,top:number)=>{
    const key=`${p[0].toFixed(7)}:${p[2].toFixed(7)}`,existing=vertices.get(key);if(existing!==undefined)return existing;
    const id=out.positions.length/3;out.positions.push(p[0],top,p[2],p[0],p[1]-.12,p[2]);vertices.set(key,id);return id;
  };
  const edge=(a:number,b:number)=>{const key=a<b?`${a}:${b}`:`${b}:${a}`,e=edges.get(key);if(e)e.count++;else edges.set(key,{a,b,count:1});};
  let along=0;
  for(let i=1;i<rows.length;i++){
    const a=points[i-1]!,b=points[i]!,l=distance(plan(a),plan(b)),s0=along,s1=along+l;along=s1;
    if(s1<at-18||s0>at+10)continue;
    const station=(p:XYZ)=>s0+((p[0]-a[0])*(b[0]-a[0])+(p[2]-a[2])*(b[2]-a[2]))/l;
    for(let k=1;k<rows[i]!.length;k++)for(const triangle of [[rows[i-1]![k-1]!,rows[i]![k-1]!,rows[i]![k]!],[rows[i-1]![k-1]!,rows[i]![k]!,rows[i-1]![k]!] ] as const){
      const boundary=clip(clip(triangle,p=>station(p)-(at-18)),p=>at+10-station(p));if(boundary.length<3)continue;
      if(boundary.some(p=>(Math.abs(station(p)-(at-18))<1e-5||Math.abs(station(p)-(at+10))<1e-5)&&oreCrossingTop(cuts,p[0],p[2])>p[1]+1e-5))throw new Error('Ore crossing does not close inside its approved 28m road reach');
      for(const plane of profile.planes){
        let polygon=clip(boundary,p=>planeAt(plane,p[0],p[2],profile)-p[1]);
        for(const other of profile.planes){if(other===plane)continue;polygon=clip(polygon,p=>planeAt(other,p[0],p[2],profile)-planeAt(plane,p[0],p[2],profile));if(polygon.length<3)break;}
        if(polygon.length<3)continue;
        const q=polygon.map(p=>vertex(p,planeAt(plane,p[0],p[2],profile))).filter((v,k,all)=>v!==all[(k+all.length-1)%all.length]);if(q.length<3)continue;
        const p=(i:number)=>out.positions.slice(q[i]!*3,q[i]!*3+3),A=p(0),B=p(1),C=p(2),ny=(B[2]!-A[2]!)*(C[0]!-A[0]!)-(B[0]!-A[0]!)*(C[2]!-A[2]!);
        if(Math.abs(ny)<1e-10)continue;if(ny<0)q.reverse();
        for(let k=1;k<q.length-1;k++)out.indices.push(q[0]!,q[k]!,q[k+1]!,q[0]!+1,q[k+1]!+1,q[k]!+1);
        for(let k=0;k<q.length;k++)edge(q[k]!,q[(k+1)%q.length]!);
      }
    }
  }
  for(const {a,b,count}of edges.values())if(count===1)out.indices.push(a,a+1,b+1,a,b+1,b);
  if(out.indices.length)cuts.solids.push(out);
}

/** End roof and walls at the existing portal frame, retaining the earlier road
 * underpass. The floor continues as a closed stone apron down to the road. */
export function openOreRoadJunction(cuts:LandCuts,base:HeightQuery):void{
  const ore=cuts.beds.find(b=>b.id==='ORE');if(!ore||!cuts.beds.some(b=>b.id==='mountainV2.road'))return;
  const frame=orePortalFrame(cuts,ore.points),end=ore.points.at(-1)!,prev=ore.points.at(-2)!,L=distance(plan(prev),plan(end));
  const u:XY=[(end[0]-prev[0])/L,(end[2]-prev[2])/L],station=(p:XYZ)=>(p[0]-frame.at[0])*u[0]+(p[2]-frame.at[2])*u[1];
  for(const id of ['oreTunnel.walls','oreTunnel.roof','oreTunnel.floor','oreTunnel.footings']){
    const original=cuts.solids.find(s=>s.id===id);if(!original)continue;
    const out:StructureSolid={...original,positions:[],indices:[]};
    for(let o=0;o<original.positions.length;o+=24){
      const v=Array.from({length:8},(_,k):XYZ=>[original.positions[o+k*3]!,original.positions[o+k*3+1]!,original.positions[o+k*3+2]!]);
      const a=lerp(v[4]!,v[5]!, .5),b=lerp(v[7]!,v[6]!, .5),s0=station(a),s1=station(b);
      // Only the final straight portal approach is edited, never another Ore leg.
      const begin=id==='oreTunnel.floor'||id==='oreTunnel.roof'?-2:0;
      if(distance(plan(a),plan(end))>20||distance(plan(b),plan(end))>20||Math.min(s0,s1)<-12||Math.max(s0,s1)<=begin){prism(out,v.slice(4),v.slice(0,4).map(p=>p[1]));continue;}
      const split=clamp((begin-s0)/(s1-s0||1),0,1);
      const strip=(from:number,to:number)=>{
        const corners=[lerp(v[4]!,v[7]!,from),lerp(v[5]!,v[6]!,from),lerp(v[5]!,v[6]!,to),lerp(v[4]!,v[7]!,to)];
        prism(out,corners,[mix(v[0]![1],v[3]![1],from),mix(v[1]![1],v[2]![1],from),mix(v[1]![1],v[2]![1],to),mix(v[0]![1],v[3]![1],to)]);
      };
      if(split>0)strip(0,split);
      if(id!=='oreTunnel.floor'&&id!=='oreTunnel.roof')continue;
      const to=id==='oreTunnel.roof'?clamp(-s0/(s1-s0||1),0,1):1,from=s0>=begin?0:split;if(to<=from)continue;
      const along=Math.max(1,Math.ceil(distance(plan(a),plan(b))*(to-from)/.4)),across=id==='oreTunnel.roof'?12:9;
      const q=(t:number,w:number):XYZ=>{const p=lerp(lerp(v[4]!,v[7]!,t),lerp(v[5]!,v[6]!,t),w),h=id==='oreTunnel.roof'?Math.max(p[1],oreStationFloor(cuts,p[0],p[2],p[1]-3.8)+3.8)+.01:oreStationFloor(cuts,p[0],p[2],p[1]);return[p[0],h,p[2]];};
      for(let j=0;j<along;j++)for(let k=0;k<across;k++){
        const t0=mix(from,to,j/along),t1=mix(from,to,(j+1)/along),w0=k/across,w1=(k+1)/across;
        const corners=[q(t0,w0),q(t0,w1),q(t1,w1),q(t1,w0)];prism(out,corners,corners.map(p=>id==='oreTunnel.roof'?p[1]-.6:Math.min(p[1]-.6,base(p[0],p[2])-.25)));
      }
    }
    original.positions=out.positions;original.indices=out.indices;
  }
  // The rail geometry and authored cart route remain fixed. Bearing strips fill
  // only the space below the original rail toes where the apron was lowered.
  const bearings=solid('ORE.southPortal.railBearings','beam','stone','support',['ORE'],'crown'),normal:XY=[-u[1],u[0]],run=distance(plan(frame.at),plan(end)),count=Math.ceil(run/.4);
  for(let j=0;j<count;j++)for(const side of [-.45,.45]){
    const a=lerp(frame.at,end,j/count),b=lerp(frame.at,end,(j+1)/count),q=(p:XYZ,w:number):XYZ=>[p[0]+normal[0]*w,p[1],p[2]+normal[1]*w];
    const corners=[q(a,side-.045),q(a,side+.045),q(b,side+.045),q(b,side-.045)],bottom=corners.map(p=>Math.min(p[1]-.005,oreStationFloor(cuts,p[0],p[2],p[1])-.01));
    if(corners.some((p,i)=>p[1]-bottom[i]!>.011))prism(bearings,corners,bottom);
  }
  if(bearings.indices.length)cuts.solids.push(bearings);
  addOreLevelCrossing(cuts);
  // A real retaining face supports the outer road edge across the exposed mouth.
  // It stays below the road and beyond the existing cart terminal, not across it.
  const retaining=solid('oreStation.southPortal.roadRetaining','retainingWall','stone','support',['mountainV2.road'],'crown'),{samples}=mountainRoadSource();
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1]!,b=samples[i]!;if(a.support==='bridge'||b.support==='bridge'||Math.abs(a.at[1]!-door.h)>1.5)continue;
    const corner=(s:typeof a,w:number):XYZ=>[s.at[0]!+s.normal[0]!*w,s.at[1]!-.02,s.at[2]!+s.normal[2]!*w];
    const A=corner(a,a.hw),B=corner(b,b.hw);if(!inMouth(A[0],A[2])&&!inMouth(B[0],B[2]))continue;
    const corners=[corner(a,a.hw-.2),corner(a,a.hw+.35),corner(b,b.hw+.35),corner(b,b.hw-.2)];
    const [p,q,r]=corners;if((q![2]-p![2])*(r![0]-p![0])-(q![0]-p![0])*(r![2]-p![2])<0)corners.reverse();
    if(corners.some(p=>nearestOnPath(plan(p),ore.points).distance<2.6))throw new Error('Ore retaining face entered the protected cart aperture');
    prism(retaining,corners,corners.map(p=>Math.min(p[1]-.35,base(p[0],p[2])-.25)));
  }
  if(retaining.indices.length)cuts.solids.push(retaining);
}

/** Every full/lite lattice triangle touching the exposed south-mouth road lies
 * below its actual source triangle planes. Only Horizon terrain is lowered;
 * the region's native ground and the upper road underpass remain unchanged. */
export function oreRoadGroundCeiling(beds:readonly BedCut[],rasterMargin=0):(x:number,z:number)=>number{
  if(!beds.some(b=>b.id==='mountainV2.road')||!beds.some(b=>b.id==='ORE'))return()=>Infinity;
  const ore=beds.find(b=>b.id==='ORE')!,{rows}=mountainRoadSource(),triangles:{a:XYZ;gx:number;gz:number;minX:number;maxX:number;minZ:number;maxZ:number}[]=[];
  for(let i=1;i<rows.length;i++){
    if(Math.abs(rows[i]![0]![1]-door.h)>1.5)continue;
    for(let k=1;k<rows[i]!.length;k++)for(const [a,b,c]of [[rows[i-1]![k-1]!,rows[i]![k-1]!,rows[i]![k]!],[rows[i-1]![k-1]!,rows[i]![k]!,rows[i-1]![k]!] ] as const){
      const minX=Math.min(a[0],b[0],c[0]),maxX=Math.max(a[0],b[0],c[0]),minZ=Math.min(a[2],b[2],c[2]),maxZ=Math.max(a[2],b[2],c[2]);
      if(maxX<mouth[0]||minX>mouth[1]||maxZ<mouth[2]||minZ>mouth[3])continue;
      const dx=b[0]-a[0],dz=b[2]-a[2],ex=c[0]-a[0],ez=c[2]-a[2],det=dx*ez-dz*ex;if(Math.abs(det)<1e-9)continue;
      triangles.push({a,gx:((b[1]-a[1])*ez-(c[1]-a[1])*dz)/det,gz:(dx*(c[1]-a[1])-ex*(b[1]-a[1]))/det,minX,maxX,minZ,maxZ});
    }
  }
  return(x,z)=>{
    if(!inMouth(x,z,rasterMargin))return Infinity;
    // A road-only lattice cap can put previously overhead earth inside the cart
    // envelope. Keep that same mouth lattice below the visible Ore floor too.
    const near=nearestOnPath([x,z],ore.points);let value=near.distance<=ore.width/2+rasterMargin?near.at[1]-.25:Infinity;
    for(const t of triangles)if(x>=t.minX-rasterMargin&&x<=t.maxX+rasterMargin&&z>=t.minZ-rasterMargin&&z<=t.maxZ+rasterMargin)
      value=Math.min(value,t.a[1]+t.gx*(x-t.a[0])+t.gz*(z-t.a[2])-.08);
    return value;
  };
}
