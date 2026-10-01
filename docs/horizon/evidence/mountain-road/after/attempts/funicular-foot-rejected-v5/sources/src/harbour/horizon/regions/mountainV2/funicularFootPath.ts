/** Horizon placement of one repaired ground path. Native route/road/plant art
 * remains untouched. Gravel triangles are clipped to the exact highest drawn
 * host/apron/ground triangles; old floating ribbon and verge stones are replaced. */
import type {StructureSolid,XYZ} from '../../land/interfaces.ts';
import type {PreparedGround} from './ground.ts';
import type {GroundPathPlacement} from '../../../mountain/art/routeArt.ts';
import {shade,mix,type V3} from '../../../art/cardScene.ts';
import {hash2} from '../../../art/cardKit.ts';
import {MOUNTAIN_V2_OFFSET as O} from './placement.ts';
import {funicularFootStationTop} from '../../land/mountainV2/funicularFootStation.ts';

type Point=[number,number];type Face={p:XYZ[];box:readonly[number,number,number,number];order:number};
export type FootPathArtProof={discardedFans?:{area:number;altitude:number}[];ribbon:XYZ[][];stones:{x:number;z:number;bottom:number;top:number;support:number[]}[]};
const eps=1e-8;
const cross=(a:Point,b:Point,p:Point)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
// Work in a local frame: absolute shoelace products around kilometre-scale
// coordinates can turn a zero-area clipping residue into a valid polygon.
const area=(p:Point[])=>{const a=p[0];if(!a)return 0;let sum=0;for(let i=1;i<p.length-1;i++)sum+=cross(a,p[i]!,p[i+1]!);return sum;};
const clean=(p:Point[])=>{const out:Point[]=[];for(const q of p){const last=out[out.length-1];if(!last||Math.hypot(q[0]-last[0],q[1]-last[1])>eps)out.push(q);}if(out.length>1&&Math.hypot(out[0]![0]-out[out.length-1]![0],out[0]![1]-out[out.length-1]![1])<=eps)out.pop();return out;};
function split(poly:Point[],distance:(p:Point)=>number):[Point[],Point[]]{
 const inside:Point[]=[],outside:Point[]=[];
 for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!,da=distance(a),db=distance(b),ia=da>=0,ib=db>=0;(ia?inside:outside).push(a);if(ia!==ib){const t=da/(da-db),p:Point=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];inside.push(p);outside.push(p);}}
 return[clean(inside),clean(outside)];
}
const valid=(p:Point[])=>p.length>=3&&Math.abs(area(p))>1e-10;
function planes(p:Point[]):((q:Point)=>number)[]{const sign=Math.sign(area(p));return p.map((a,i)=>{const b=p[(i+1)%p.length]!;return q=>sign*cross(a,b,q);});}
function intersect(p:Point[],boundary:((p:Point)=>number)[]):Point[]{for(const d of boundary){p=split(p,d)[0];if(!valid(p))return[];}return p;}
function subtract(p:Point[],boundary:((p:Point)=>number)[]):Point[][]{let kept=p;const result:Point[][]=[];for(const d of boundary){const pair=split(kept,d);kept=pair[0];if(valid(pair[1]))result.push(pair[1]);if(!valid(kept))return result;}return result;}
function yAt(face:Face,x:number,z:number):number{
 const[a,b,c]=face.p as [XYZ,XYZ,XYZ],D=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/D,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/D;
 return u*a[1]+v*b[1]+(1-u-v)*c[1];
}
function resample(points:readonly XYZ[]):XYZ[]{const out:XYZ[]=[points[0]!];let carry=0;for(let i=1;i<points.length;i++){const a=points[i-1]!,c=points[i]!,l=Math.hypot(c[0]-a[0],c[2]-a[2]);let t=1-carry;while(t<l){const u=t/l;out.push([a[0]+(c[0]-a[0])*u,a[1]+(c[1]-a[1])*u,a[2]+(c[2]-a[2])*u]);t++;}carry=l-(t-1);}out.push(points[points.length-1]!);return out;}
export function funicularFootPathPlacement(solids:readonly StructureSolid[],ground:PreparedGround,proof?:FootPathArtProof):GroundPathPlacement{
 const faces:Face[]=[];
 const append=(p:XYZ[])=>{
  const[a,b,c]=p as [XYZ,XYZ,XYZ],ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);if(ny<=1e-9)return;
  const box=[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[2])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[2]))] as const;
  if(box[2]<1282||box[0]>1294||box[3]<720||box[1]>731||Math.max(...p.map(v=>v[1]))>58)return;
  faces.push({p,box,order:faces.length});
 };
 const gp=ground.lattice.positions;for(let k=0;k<ground.index.length;k+=3)append([0,1,2].map(j=>{const i=ground.index[k+j]!;return[gp[i*3]!+O.x,gp[i*3+1]!+O.y,gp[i*3+2]!+O.z] as XYZ;}));
 for(const s of solids){if(!s.walkable)continue;for(let k=0;k<s.indices.length;k+=3)append([0,1,2].map(j=>{const i=s.indices[k+j]!;return[s.positions[i*3]!,s.positions[i*3+1]!,s.positions[i*3+2]!] as XYZ;}));}
 // The native station's actual planked rectangle is another drawn host.
 // Its art extends .05m beyond the platform contract at each edge. Preserve
 // those corners and paint over this real deck, not over its lower lawn.
 for(const tri of funicularFootStationTop())append(tri);
 const boundaries=new Map(faces.map(f=>[f,planes(f.p.map(p=>[p[0],p[2]] as Point))]));
 const support=(x:number,z:number):number=>{let h=-Infinity;for(const f of faces)if(boundaries.get(f)!.every(d=>d([x,z])>=-eps))h=Math.max(h,yAt(f,x,z));if(!Number.isFinite(h))throw new Error(`Missing drawn Foot path support ${x},${z}`);return h;};
 return(b,pal,tier,path)=>{
  if(path.id!=='path:station:funicular:town~road:foot')return false;
  const pts=resample(path.points),frames=pts.map((p,i)=>{const a=pts[Math.max(0,i-1)]!,c=pts[Math.min(pts.length-1,i+1)]!,dx=c[0]-a[0],dz=c[2]-a[2],l=Math.hypot(dx,dz)||1;return{p,side:[dz/l,-dx/l] as Point};});
  const across=[-path.halfWidth,-path.halfWidth+.35,path.halfWidth-.35,path.halfWidth];
  const point=(i:number,k:number):Point=>{const f=frames[i]!;return[f.p[0]+f.side[0]*across[k]!+O.x,f.p[2]+f.side[1]*across[k]!+O.z];};
  for(let i=1;i<frames.length;i++)for(let k=0;k<3;k++){
   const band=[point(i-1,k),point(i,k),point(i,k+1),point(i-1,k+1)],clip=planes(band),color=shade(k===1?pal.gravel:mix(pal.gravel,pal.verge,.5),.95+hash2(i,k)*.08);
   const candidates=faces.filter(f=>f.box[0]<=Math.max(...band.map(p=>p[0]))&&f.box[2]>=Math.min(...band.map(p=>p[0]))&&f.box[1]<=Math.max(...band.map(p=>p[1]))&&f.box[3]>=Math.min(...band.map(p=>p[1])));
   for(const f of candidates){let pieces=[intersect(f.p.map(p=>[p[0],p[2]] as Point),clip)].filter(valid);
    for(const other of candidates){if(other===f)continue;
     const higher=(q:Point)=>yAt(other,q[0],q[1])-yAt(f,q[0],q[1])+(other.order>f.order?1e-10:-1e-10);
     // Subtract only the actual higher planar part of the overlapping triangle.
     // A centroid-only owner test could leave a floating edge over a lower host.
     pieces=pieces.flatMap(p=>{
      if(!p.some(q=>higher(q)>0))return[p];
      const boundary=[...boundaries.get(other)!,higher];
      // Subtract only positive-area overlap. Splitting a disjoint polygon by
      // extended triangle lines would multiply fragments without removing any
      // visible area, turning this one short path into minutes of build work.
      return valid(intersect(p,boundary))?subtract(p,boundary):[p];
     });if(!pieces.length)break;
    }
    for(const poly of pieces)for(let j=1;j<poly.length-1;j++){
     let q=[poly[0]!,poly[j]!,poly[j+1]!];const determinant=area(q),longest=Math.max(...q.map((p,i)=>Math.hypot(p[0]-q[(i+1)%3]![0],p[1]-q[(i+1)%3]![1]))),altitude=longest?Math.abs(determinant)/longest:0;
     // A valid polygon can still produce duplicate-point or microscopic fan
     // triangles. Apply the existing plan-area and coordinate eps to each
     // emitted triangle, retaining all positive-area visible fragments.
     if(!valid(q)||altitude<=eps){proof?.discardedFans?.push({area:Math.abs(determinant)/2,altitude});continue;}
     if(determinant>0)q=[q[0]!,q[2]!,q[1]!];
     const left=point(i-1,k),right=point(i-1,k+1),dx=right[0]-left[0],dz=right[1]-left[1],den=dx*dx+dz*dz;
     const lift=(p:Point)=>{const u=Math.max(0,Math.min(1,((p[0]-left[0])*dx+(p[1]-left[1])*dz)/den));return .04+.01*(k===1?1:k===0?u:1-u);};
     const triangle=q.map(p=>[p[0],yAt(f,p[0],p[1])+lift(p),p[1]] as XYZ);
     proof?.ribbon.push(triangle);b.tri(...triangle.map(p=>[p[0]-O.x,p[1]-O.y,p[2]-O.z] as V3) as [V3,V3,V3],color,'flat');
    }
   }
  }
  const every=tier==='full'?1.7:3.4;let next=0,acc=0;
  for(let i=1;i<frames.length;i++){acc++;if(acc<next)continue;next=acc+every;const f=frames[i]!,side=(i%2?1:-1)*(path.halfWidth+.12),x=f.p[0]+f.side[0]*side,z=f.p[2]+f.side[1]*side,yaw=Math.atan2(f.side[0],f.side[1])+hash2(i,3)*.6,hx=.22+hash2(i,1)*.1,hz=.16;
   const heights=[[-hx,-hz],[-hx,hz],[hx,-hz],[hx,hz]].map(([u,v])=>support(x+O.x+u!*Math.cos(yaw)+v!*Math.sin(yaw),z+O.z-u!*Math.sin(yaw)+v!*Math.cos(yaw)));
   const bottom=Math.min(...heights)-.15,top=Math.max(...heights)+.05+hash2(i,2)*.04;
   proof?.stones.push({x:x+O.x,z:z+O.z,bottom,top,support:heights});b.box(x,z,yaw,hx,hz,bottom-O.y,top-O.y,shade(pal.coping,.92),pal.stone,b.pencil);
  }
  return true;
 };
}
