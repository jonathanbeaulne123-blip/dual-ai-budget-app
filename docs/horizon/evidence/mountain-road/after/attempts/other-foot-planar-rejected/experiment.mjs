// Saved-mesh numerical experiment only. No world import, meshoptimizer, or checkout writes.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const INPUT=process.argv[2]&&resolve(process.argv[2]),OUT=process.argv[3]&&resolve(process.argv[3]);
if(!INPUT||!OUT)throw Error('Usage: node experiment.mjs SOURCE_SOLID_ARRAY_JSON FRESH_OUT [MAX_SECONDS=90] [MAX_REMOVALS=2000]');
if(existsSync(OUT))throw Error('Output must be fresh');mkdirSync(OUT,{recursive:true});
const maxSeconds=Number(process.argv[4]??90),maxRemovals=Number(process.argv[5]??2000);
if(!(maxSeconds>0&&maxSeconds<=600&&maxRemovals>0&&maxRemovals<=10000))throw Error('Invalid bounded limits');
const raw=readFileSync(INPUT),loaded=JSON.parse(raw),source=Array.isArray(loaded)?loaded[0]:loaded;
if(Array.isArray(loaded)&&loaded.length!==1)throw Error('Expected one logical solid');
const P=source.positions,origin=source.renderOrigin,EPS=1e-9,PLANE=1e-11,AREA=1e-14;
if(!origin||origin.length!==3||!origin.every(Number.isFinite))throw Error('Missing logical render origin');
if(!P.every(Number.isFinite)||source.indices.length%3)throw Error('Invalid input mesh');
const pt=i=>P.slice(i*3,i*3+3),sub=(a,b)=>a.map((v,j)=>v-b[j]),dot=(a,b)=>a.reduce((n,v,j)=>n+v*b[j],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a);
const normal=(f,positions=P)=>{const p=f.map(i=>positions.slice(i*3,i*3+3));return cross(sub(p[1],p[0]),sub(p[2],p[0]));};
const unit=n=>{const l=norm(n);return n.map(v=>v/l);},edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`,faceKey=f=>[...f].sort((a,b)=>a-b).join(':');
const positionsByVariant=[P,P.map(v=>Number(v.toFixed(9))),P.map((v,i)=>Math.fround(Number(v.toFixed(9))-origin[i%3])+origin[i%3])];
const variantNames=['double','bake9','bake9-localFloat32'];
function faceGate(f,referenceNormal){
 for(let k=0;k<positionsByVariant.length;k++){
  const n=normal(f,positionsByVariant[k]),length=norm(n);
  if(!Number.isFinite(length)||length<=AREA||dot(n,referenceNormal)<=0)return false;
  if(referenceNormal[1]>1e-9&&(n[1]<1e-8||Math.atan2(Math.hypot(n[0],n[2]),n[1])*180/Math.PI>40+1e-7))return false;
 }return true;
}
const faces=new Map(),incident=new Map(),edges=new Map(),faceKeys=new Map();let nextId=0;
function changeEdge(a,b,delta){const key=edgeKey(a,b),e=edges.get(key)??{count:0,balance:0};e.count+=delta;e.balance+=delta*(a<b?1:-1);if(e.count)edges.set(key,e);else edges.delete(key);}
function add(f){const id=nextId++;faces.set(id,f);for(const v of f){const s=incident.get(v)??new Set();s.add(id);incident.set(v,s);}for(let j=0;j<3;j++)changeEdge(f[j],f[(j+1)%3],1);const key=faceKey(f);faceKeys.set(key,(faceKeys.get(key)??0)+1);return id;}
function remove(id){const f=faces.get(id);faces.delete(id);for(const v of f)incident.get(v).delete(id);for(let j=0;j<3;j++)changeEdge(f[j],f[(j+1)%3],-1);const key=faceKey(f),n=faceKeys.get(key)-1;if(n)faceKeys.set(key,n);else faceKeys.delete(key);}
for(let i=0;i<source.indices.length;i+=3)add(source.indices.slice(i,i+3));
const originalFaces=[...faces.values()].map(f=>[...f]);
function topology(){return [...edges].filter(([,e])=>e.count!==2||e.balance!==0).map(([key,e])=>({key,...e}));}
function variantAudit(F){return positionsByVariant.map((positions,k)=>{let maxTopDegrees=0,invalid=0,tops=0;const witnesses=[];for(const f of F){const ref=normal(f),n=normal(f,positions),l=norm(n);let reason=null;if(l<=AREA||!Number.isFinite(l)||dot(ref,n)<=0)reason='collapsed or orientation changed';if(ref[1]>1e-9||unit(ref)[1]>.5){tops++;const grade=Math.atan2(Math.hypot(n[0],n[2]),n[1])*180/Math.PI;maxTopDegrees=Math.max(maxTopDegrees,grade);if(n[1]<1e-8)reason='top below runtime determinant';else if(grade>40+1e-7)reason='top exceeds40deg';}if(reason){invalid++;if(witnesses.length<10)witnesses.push({f,n,reason});}}return{variant:variantNames[k],tops,maxTopDegrees,invalid,witnesses};});}
const baseline={triangles:faces.size,vertices:P.length/3,topology:topology(),variants:variantAudit(originalFaces)};
if(baseline.topology.length||baseline.variants[0].witnesses.some(w=>w.reason!=='top below runtime determinant')){writeFileSync(OUT+'/baseline-failure.json',JSON.stringify(baseline,null,2));throw Error('Input has a topology, orientation or grade failure; no geometry changed');}
// Every original crease is protected as a geometric segment. A vertex on that
// segment may disappear only when exactly two plane runs meet collinearly.
function star(v){
 const ids=[...incident.get(v)??[]];if(ids.length<3||ids.length>24)return null;
 const next=new Map(),faceFor=new Map();
 for(const id of ids){const f=faces.get(id),k=f.indexOf(v),a=f[(k+1)%3],b=f[(k+2)%3];if(next.has(a))return null;next.set(a,b);faceFor.set(a,id);}
 const first=Math.min(...next.keys()),ring=[first];let at=next.get(first);
 while(at!==first&&next.has(at)&&ring.length<=next.size){ring.push(at);at=next.get(at);}if(at!==first||ring.length!==next.size)return null;
 return{ids,ring,ordered:ring.map(a=>faceFor.get(a))};
}
function planeGroups(st,v){
 const anchor=pt(v),groups=[],assignment=new Map();
 const ordered=[...st.ids].sort((a,b)=>norm(normal(faces.get(b)))-norm(normal(faces.get(a))));
 for(const id of ordered){const f=faces.get(id),n=normal(f);let g=groups.findIndex(g=>dot(n,g.n)>0&&f.every(i=>Math.abs(dot(g.n,sub(pt(i),anchor)))<=PLANE));
  if(g<0){if(groups.length===2)return null;g=groups.length;groups.push({n:unit(n),faces:[]});}groups[g].faces.push(id);assignment.set(id,g);
 }return{groups,labels:st.ordered.map(id=>assignment.get(id))};
}
const axes=n=>Math.abs(n[0])>=Math.abs(n[1])&&Math.abs(n[0])>=Math.abs(n[2])?[1,2]:Math.abs(n[1])>=Math.abs(n[2])?[0,2]:[0,1];
const area2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function triangulate(poly,plane){
 const ax=axes(plane),base=pt(poly[0]),xy=i=>ax.map(k=>P[i*3+k]-base[k]),xyCache=new Map(poly.map(i=>[i,xy(i)]));
 const polygonSign=Math.sign(poly.reduce((s,a,i)=>{const b=poly[(i+1)%poly.length],A=xyCache.get(a),B=xyCache.get(b);return s+A[0]*B[1]-A[1]*B[0];},0));if(!polygonSign)return null;
 let visits=0;
 function solve(ids){
  if(++visits>2000)return null;
  if(ids.length===3){const n=normal(ids);return dot(n,plane)>AREA&&faceGate(ids,plane)?[ids]:null;}
  const ears=[];
  for(let k=0;k<ids.length;k++){
   const f=[ids[(k+ids.length-1)%ids.length],ids[k],ids[(k+1)%ids.length]],q=f.map(i=>xyCache.get(i)),a=area2(...q)*polygonSign,n=normal(f);
   if(a<=AREA||dot(n,plane)<=AREA||!faceGate(f,plane))continue;
   // Boundary-collinear neighbours block the ear too: retain the exact polygon.
   if(ids.some(i=>!f.includes(i)&&q.every((p,j)=>area2(p,q[(j+1)%3],xyCache.get(i))*polygonSign>=-1e-14)))continue;
   const l=Math.max(...f.map((v,j)=>norm(sub(pt(v),pt(f[(j+1)%3])))));ears.push({k,f,score:norm(n)/(l*l)});
  }
  ears.sort((a,b)=>b.score-a.score||a.k-b.k);
  for(const e of ears){const rest=solve(ids.filter((_,i)=>i!==e.k));if(rest)return[e.f,...rest];}return null;
 }return solve(poly);
}
function replacement(st,v){
 const grouped=planeGroups(st,v);if(!grouped)return null;const{groups,labels}=grouped;
 if(groups.length===1){const f=triangulate(st.ring,groups[0].n);return f?{faces:f,planes:1,seam:null}:null;}
 const transitions=labels.map((g,i)=>g!==labels[(i+labels.length-1)%labels.length]?i:-1).filter(i=>i>=0);if(transitions.length!==2)return null;
 const [ia,ib]=transitions,a=st.ring[ia],b=st.ring[ib],A=pt(a),B=pt(b),V=pt(v),d=sub(B,A),l2=dot(d,d),t=dot(sub(V,A),d)/l2;
 if(!(t>0&&t<1)||norm(sub(V,A.map((n,i)=>n+d[i]*t)))>PLANE)return null;
 const chain=(start,end)=>{const p=[st.ring[start]];for(let i=(start+1)%st.ring.length;i!==end;i=(i+1)%st.ring.length)p.push(st.ring[i]);p.push(st.ring[end]);return p;};
 const p=triangulate(chain(ia,ib),groups[labels[ia]].n),q=triangulate(chain(ib,ia),groups[labels[ib]].n);
 return p&&q?{faces:[...p,...q],planes:2,seam:[a,v,b]}:null;
}
function validTopology(oldIds,newFaces){
 const changes=new Map(),oldKeys=new Map();
 const collect=(f,d)=>{const fk=faceKey(f);oldKeys.set(fk,(oldKeys.get(fk)??0)+d);for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3],key=edgeKey(a,b),e=changes.get(key)??{count:0,balance:0};e.count+=d;e.balance+=d*(a<b?1:-1);changes.set(key,e);}};
 for(const id of oldIds)collect(faces.get(id),-1);for(const f of newFaces)collect(f,1);
 for(const[key,d]of changes){const e=edges.get(key)??{count:0,balance:0},count=e.count+d.count;if(count!==0&&(count!==2||e.balance+d.balance!==0))return false;}
 for(const[key,d]of oldKeys)if((faceKeys.get(key)??0)+d>1)return false;return true;
}
// Independent double common refinement. Intersections are computed in a local
// projection frame. Plane difference is affine, so its max on each overlap is
// attained at one of these polygon vertices (not just sampled face centroids).
function clip(poly,tri){let out=poly,sign=Math.sign(area2(...tri));for(let k=0;k<3&&out.length;k++){
 const a=tri[k],b=tri[(k+1)%3],next=[];
 for(let i=0;i<out.length;i++){const A=out[i],B=out[(i+1)%out.length],da=sign*area2(a,b,A),db=sign*area2(a,b,B);if(da>=0)next.push(A);if((da>=0)!==(db>=0)){const t=da/(da-db);next.push(A.map((v,j)=>v+(B[j]-v)*t));}}out=next;
 }return out;}
const polyArea=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0))/2;
function refine(A,B,tolerance=EPS){let maxError=0,maxCoverageError=0;const failures=[];
 for(const f of A){const N=normal(f),ax=axes(N),drop=[0,1,2].find(k=>!ax.includes(k)),origin=pt(f[0]),proj=i=>ax.map(k=>P[i*3+k]-origin[k]),poly=f.map(proj),area=Math.abs(area2(...poly))/2;let covered=0;
  if(area<=AREA){failures.push({f,reason:'projection area'});continue;}
  const lift=(tri,p)=>{const n=normal(tri),a=pt(tri[0]);return a[drop]-(n[ax[0]]*(p[0]+origin[ax[0]]-a[ax[0]])+n[ax[1]]*(p[1]+origin[ax[1]]-a[ax[1]]))/n[drop];};
  for(const g of B){const n=normal(g);if(dot(N,n)<=0||Math.abs(n[drop])<AREA)continue;
   const other=g.map(proj);if(Math.max(...other.map(p=>p[0]))<Math.min(...poly.map(p=>p[0]))||Math.min(...other.map(p=>p[0]))>Math.max(...poly.map(p=>p[0]))||Math.max(...other.map(p=>p[1]))<Math.min(...poly.map(p=>p[1]))||Math.min(...other.map(p=>p[1]))>Math.max(...poly.map(p=>p[1])))continue;
   const overlap=clip(poly,other);if(overlap.length<3)continue;const overlapArea=polyArea(overlap);if(overlapArea<=1e-20)continue;
   let error=0;for(const p of overlap)error=Math.max(error,Math.abs(lift(f,p)-lift(g,p)));
   if(error>tolerance)continue;covered+=overlapArea;maxError=Math.max(maxError,error);
  }
  const miss=Math.abs(covered-area);maxCoverageError=Math.max(maxCoverageError,miss);
  if(miss>Math.max(1e-15,area*1e-9))failures.push({f,reason:'coverage',area,covered,miss});
 }return{maxError,maxCoverageError,failures};}
const started=performance.now(),cpu=process.cpuUsage(),operations=[],rejections={},queue=[...incident.keys()].sort((a,b)=>a-b),queued=new Set(queue);let cursor=0,attempts=0;
const reject=reason=>rejections[reason]=(rejections[reason]??0)+1;
while(cursor<queue.length&&operations.length<maxRemovals&&performance.now()-started<maxSeconds*1000&&attempts<50000){
 const v=queue[cursor++];queued.delete(v);attempts++;const st=star(v);if(!st){reject('star');continue;}const next=replacement(st,v);if(!next){reject('plane-or-triangulation');continue;}
 if(next.faces.length>=st.ids.length||!validTopology(st.ids,next.faces)){reject('topology');continue;}
 const old=st.ids.map(id=>faces.get(id)),forward=refine(old,next.faces,PLANE*4),backward=refine(next.faces,old,PLANE*4);
 if(forward.failures.length||backward.failures.length){reject('local-common-refinement');continue;}
 for(const id of st.ids)remove(id);for(const f of next.faces)add(f);
 operations.push({vertex:v,planes:next.planes,seam:next.seam,removed:old,added:next.faces,maxLocalError:Math.max(forward.maxError,backward.maxError)});
 for(const n of st.ring)if(!queued.has(n)){queued.add(n);queue.push(n);}
 if(operations.length%100===0)writeFileSync(OUT+'/progress.json',JSON.stringify({operations:operations.length,triangles:faces.size,attempts,wallMs:performance.now()-started}));
}
const finalFaces=[...faces.values()],candidate={...source,positions:[...P],indices:finalFaces.flat(),renderOrigin:[...origin]};
// Spatially filter original/candidate pairs without changing comparison order.
function index(F){const cell=.5,cells=new Map();for(let i=0;i<F.length;i++){const p=F[i].map(pt),lo=[0,1,2].map(k=>Math.floor((Math.min(...p.map(v=>v[k]))-EPS)/cell)),hi=[0,1,2].map(k=>Math.floor((Math.max(...p.map(v=>v[k]))+EPS)/cell));for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const key=`${x},${y},${z}`,list=cells.get(key)??[];list.push(i);cells.set(key,list);}}return f=>{const p=f.map(pt),lo=[0,1,2].map(k=>Math.floor((Math.min(...p.map(v=>v[k]))-EPS)/cell)),hi=[0,1,2].map(k=>Math.floor((Math.max(...p.map(v=>v[k]))+EPS)/cell)),set=new Set();for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)for(const i of cells.get(`${x},${y},${z}`)??[])set.add(i);return[...set].sort((a,b)=>a-b).map(i=>F[i]);};}
function globalProof(A,B){const candidates=index(B),out={maxError:0,maxCoverageError:0,failureCount:0,witnesses:[]};for(const f of A){const r=refine([f],candidates(f));out.maxError=Math.max(out.maxError,r.maxError);out.maxCoverageError=Math.max(out.maxCoverageError,r.maxCoverageError);out.failureCount+=r.failures.length;if(out.witnesses.length<20)out.witnesses.push(...r.failures.slice(0,20-out.witnesses.length));}return out;}
const proof={sourceToCandidate:globalProof(originalFaces,finalFaces),candidateToSource:globalProof(finalFaces,originalFaces)},badEdges=topology(),variants=variantAudit(finalFaces),sha=b=>createHash('sha256').update(b).digest('hex');
const report={status:'UNACCEPTED_SAVED_MESH_EXPERIMENT',inputSha256:sha(raw),experimentSha256:sha(readFileSync(new URL(import.meta.url))),input:INPUT,baseline,after:{triangles:faces.size,referencedVertices:new Set(finalFaces.flat()).size,retainedPositionValues:candidate.positions.length,removedTriangles:originalFaces.length-faces.size,removedVertices:operations.length},constraints:{planeDistance:PLANE,finalGeometryTolerance:EPS,topMaxDegrees:40,minTopDeterminant:1e-8,originalPositionArrayExact:JSON.stringify(P)===JSON.stringify(candidate.positions),logicalOriginExact:JSON.stringify(origin)===JSON.stringify(candidate.renderOrigin)},proof,topologyFailures:badEdges,variants,attempts,rejections,bounded:{maxSeconds,maxRemovals,maxAttempts:50000,remainingQueue:queue.length-cursor},numericalGatesPass:!badEdges.length&&!variants.some(v=>v.invalid)&&!proof.sourceToCandidate.failureCount&&!proof.candidateToSource.failureCount,wallMs:performance.now()-started,cpu:process.cpuUsage(cpu),limits:['Numerical saved-mesh checks only; not accepted production geometry.','Original doubles retained; no Float32 deduplication or geometry optimizer.','Common refinement uses stated area-roundoff tolerance max(1e-15, projected area * 1e-9); all measured plane differences are <=1e-9.','Unreferenced original vertices remain in positions deliberately; only indices change.','Every actual surface/contact/ceiling/movement/art/host ownership and budget gate remains required.']};
writeFileSync(OUT+'/candidate.json',JSON.stringify([candidate]));writeFileSync(OUT+'/operations.json',JSON.stringify(operations));writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,numericalGatesPass:report.numericalGatesPass,before:baseline.triangles,after:faces.size,removals:operations.length,wallMs:report.wallMs},null,2));
