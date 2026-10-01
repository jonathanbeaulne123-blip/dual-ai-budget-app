/** D-MR22: approved source-owned Orchard junction and initial b0 height fairing.
 * The main road and all plan coordinates are immutable inputs. Generated clipping keeps
 * their actual triangles, rather than projecting the crossing onto a coarse centreline.
 * Bridge cross-sections remain flat; the existing masonry builder owns their construction.
 * Reproduction: docs/horizon/evidence/mountain-road/proposals/orchard-bridge-approach/generation/README.md.
 */
import data from './orchardJunction.generated.json';
import type {Point3} from './math.ts';
import type {RoadLine} from './roads.ts';
export const ORCHARD_JUNCTION_END_ROW=data.fixedFromRow;
export const ORCHARD_BRIDGE_ART_START_ROW=data.bridgeArtFromRow;
export const ORCHARD_JUNCTION_POINTS=data.points as unknown as readonly Point3[];
export const ORCHARD_JUNCTION_TRIANGLES=data.triangles;
export const ORCHARD_JUNCTION_BANDS=data.bands;
export const ORCHARD_JUNCTION_COLUMNS=data.columns;
export const ORCHARD_JUNCTION_OWNERSHIP=data.ownership;
type Hit={y:number;gx:number;gz:number};
type Face={p:Point3;q:Point3;r:Point3;ux:number;uz:number;vx:number;vz:number;det:number;gx:number;gz:number;index:number};
const size=2,cells=new Map<string,Face[]>(),faces:Face[]=[];
for(let index=0;index<data.triangles.length;index++){
 const ids=data.triangles[index]!,p=ORCHARD_JUNCTION_POINTS[ids[0]!]!,q=ORCHARD_JUNCTION_POINTS[ids[1]!]!,r=ORCHARD_JUNCTION_POINTS[ids[2]!]!;
 const ux=q[0]-p[0],uz=q[2]-p[2],vx=r[0]-p[0],vz=r[2]-p[2],det=ux*vz-uz*vx;
 if(Math.abs(det)<1e-12)throw new Error('Degenerate generated Orchard junction face');
 const gx=((q[1]-p[1])*vz-(r[1]-p[1])*uz)/det,gz=(ux*(r[1]-p[1])-vx*(q[1]-p[1]))/det;
 const face={p,q,r,ux,uz,vx,vz,det,gx,gz,index};faces.push(face);
 for(let x=Math.floor(Math.min(p[0],q[0],r[0])/size);x<=Math.floor(Math.max(p[0],q[0],r[0])/size);x++)for(let z=Math.floor(Math.min(p[2],q[2],r[2])/size);z<=Math.floor(Math.max(p[2],q[2],r[2])/size);z++){
  const key=`${x}:${z}`,bucket=cells.get(key)??[];bucket.push(face);cells.set(key,bucket);
 }
}
export function orchardJunctionAt(x:number,z:number,ceiling=Infinity):Hit|null{
 let hit:Hit|null=null;
 for(const f of cells.get(`${Math.floor(x/size)}:${Math.floor(z/size)}`)??[]){
  const px=x-f.p[0],pz=z-f.p[2],u=(px*f.vz-pz*f.vx)/f.det,v=(f.ux*pz-f.uz*px)/f.det;
  if(u< -1e-8||v< -1e-8||u+v>1+1e-8)continue;
  const y=f.p[1]+f.gx*px+f.gz*pz;if(y>ceiling+1e-8||(hit&&hit.y>=y))continue;hit={y,gx:f.gx,gz:f.gz};
 }return hit;
}
/** Canonical route/navigation height follows the same chosen surface, while the
 * authored copy remains available to keep bridge spans/edge classification stable. */
export function applyOrchardCentreProfile(points:readonly Point3[]):readonly Point3[]{
 if(data.expectedLane.some((p,i)=>!points[i]||points[i]!.some((v,k)=>v!==p.at[k])))throw new Error('Regenerate Orchard junction: lane centre changed');
 return points.map((p,i)=>{if(i>=data.fixedFromRow)return p;const y=i>=8?(data.bridgeRowY as Record<string,number>)[i]:orchardJunctionAt(p[0],p[2])?.y;if(y===undefined)throw new Error(`Missing Orchard centre ${i}`);return [p[0],Math.abs(y-p[1])<1e-12?p[1]:y,p[2]] as Point3;});
}
/** A stale generated mesh is a build error, never a silent new route/bridge shape. */
export function applyOrchardJunctionProfile(line:RoadLine,main:RoadLine):RoadLine{
 const matches=(actual:RoadLine['samples'][number],expected:typeof data.expectedLane[number])=>actual.halfWidth===expected.halfWidth&&actual.at.every((v,i)=>v===expected.at[i])&&actual.normal.every((v,i)=>v===expected.normal[i]);
 if(line.id!=='orchard-lane'||data.expectedLane.some((p,i)=>!matches(line.samples[i]!,p))||data.expectedRoad.some(pair=>{const [i,p]=pair as unknown as [number,typeof data.expectedLane[number]];return !matches(main.samples[i]!,p);}))throw new Error('Regenerate Orchard junction: source geometry changed');
 const samples=line.samples.map((s,i)=>{
  if(i>=data.fixedFromRow)return {...s};
  const h=i>=data.bridgeArtFromRow?(data.bridgeRowY as Record<string,number>)[i]:orchardJunctionAt(s.at[0],s.at[2])?.y;
  if(h===undefined)throw new Error(`Missing Orchard profile row ${i}`);
  return {...s,at:[s.at[0],Math.abs(h-s.at[1])<1e-12?s.at[1]:h,s.at[2]] as Point3};
 });
 let length=0;
 for(let i=0;i<samples.length;i++){
  const p=samples[i]!,a=samples[Math.max(0,i-1)]!,b=samples[Math.min(samples.length-1,i+1)]!;
  if(i)length+=Math.hypot(p.at[0]-a.at[0],p.at[1]-a.at[1],p.at[2]-a.at[2]);
  const dx=b.at[0]-a.at[0],dy=b.at[1]-a.at[1],dz=b.at[2]-a.at[2],distance=Math.hypot(dx,dy,dz)||1;
  p.s=length;p.grade=dy/(Math.hypot(dx,dz)||1);p.tangent=[dx/distance,dy/distance,dz/distance];
 }return {...line,length,samples};
}
/** The source edge/guard plan stays fixed; only its foundation follows the chosen deck. */
export function orchardEdgeHeight(lineId:string,x:number,z:number,fallback:number):number{return lineId==='orchard-lane'?(orchardJunctionAt(x,z)?.y??fallback):fallback;}

const edges=new Map<string,{a:Point3;b:Point3;count:number;face:Face}>();
for(const f of faces){const ids=data.triangles[f.index]!;for(let k=0;k<3;k++){
 const i=ids[k]!,j=ids[(k+1)%3]!,key=i<j?`${i}:${j}`:`${j}:${i}`,old=edges.get(key);
 if(old)old.count++;else edges.set(key,{a:ORCHARD_JUNCTION_POINTS[i]!,b:ORCHARD_JUNCTION_POINTS[j]!,count:1,face:f});
}}
export const ORCHARD_JUNCTION_OPEN_EDGES=[...edges.values()].filter(e=>e.count===1&&data.bands[e.face.index]!<=8&&data.ownership[e.face.index]==='blend').map(e=>({a:e.a,b:e.b,column:data.columns[e.face.index]!-1}));
const boundary=[...edges.values()].filter(e=>e.count===1);
const bounds={x0:Math.min(...data.points.map(p=>p[0]!))-1.5,x1:Math.max(...data.points.map(p=>p[0]!))+1.5,z0:Math.min(...data.points.map(p=>p[2]!))-1.5,z1:Math.max(...data.points.map(p=>p[2]!))+1.5};
/** Continuous cut only: no raised terrain, invented bridge floor or hidden ceiling.
 * The 2:1 batter returns to existing terrain within1.5m of the actual footprint. */
export function orchardGroundCeiling(x:number,z:number):number|null{
 if(x<bounds.x0||x>bounds.x1||z<bounds.z0||z>bounds.z1)return null;
 const top=orchardJunctionAt(x,z);if(top)return top.y-.08;
 let best:{distance:number;y:number}|null=null;
 for(const e of boundary){const dx=e.b[0]-e.a[0],dz=e.b[2]-e.a[2],t=Math.max(0,Math.min(1,((x-e.a[0])*dx+(z-e.a[2])*dz)/(dx*dx+dz*dz||1))),distance=Math.hypot(x-e.a[0]-dx*t,z-e.a[2]-dz*t);
  if(distance<=1.5&&(!best||distance<best.distance))best={distance,y:e.a[1]+(e.b[1]-e.a[1])*t};
 }return best?best.y-.08+best.distance*2:null;
}
/** Exact plan clipping for rendered terrain: sampling only lattice vertices can leave
 * a coarse terrain triangle above a narrow cut. Lowering its vertices by the worst
 * overlap excess makes every intersection polygon lie below the real road plane.
 * Lower-only updates cannot invalidate a triangle already visited. The returned
 * displacements are evidence for the explicitly approved local ground work. */
export function capOrchardGroundLattice(lattice:{positions:Float32Array;indices:Uint32Array}){
 const P=lattice.positions,I=lattice.indices,original=P.slice(),affected=new Set<number>();
 const point=(i:number):Point3=>[P[i*3]!,P[i*3+1]!,P[i*3+2]!];
 const clip=(poly:Point3[],a:Point3,b:Point3,sign:number)=>{
  const output:Point3[]=[];for(let i=0;i<poly.length;i++){
   const p=poly[i]!,q=poly[(i+1)%poly.length]!,cross=(v:Point3)=>sign*((b[0]-a[0])*(v[2]-a[2])-(b[2]-a[2])*(v[0]-a[0])),u=cross(p),v=cross(q);
   if(u>=-1e-10)output.push(p);if((u>=0)!==(v>=0)){const t=u/(u-v);output.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t]);}
  }return output;
 };
 for(let i=0;i<I.length;i+=3){const ids=[I[i]!,I[i+1]!,I[i+2]!],initial=ids.map(point),near=new Set<Face>();
  for(let x=Math.floor(Math.min(...initial.map(p=>p[0]))/size);x<=Math.floor(Math.max(...initial.map(p=>p[0]))/size);x++)for(let z=Math.floor(Math.min(...initial.map(p=>p[2]))/size);z<=Math.floor(Math.max(...initial.map(p=>p[2]))/size);z++)for(const f of cells.get(`${x}:${z}`)??[])near.add(f);
  for(const f of near){let poly=ids.map(point);for(const [a,b]of [[f.p,f.q],[f.q,f.r],[f.r,f.p]]){poly=clip(poly,a!,b!,Math.sign(f.det));if(!poly.length)break;}
   let excess=0;for(const p of poly)excess=Math.max(excess,p[1]-(f.p[1]+f.gx*(p[0]-f.p[0])+f.gz*(p[2]-f.p[2])-.08));
   if(excess>0)for(const id of ids){P[id*3+1]=P[id*3+1]!-excess-1e-5;affected.add(id);}
  }
 }
 return [...affected].map(i=>({index:i,at:point(i),delta:P[i*3+1]!-original[i*3+1]!}));
}
