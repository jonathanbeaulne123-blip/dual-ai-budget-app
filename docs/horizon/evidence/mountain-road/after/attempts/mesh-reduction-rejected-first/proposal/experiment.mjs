// UNRUN, bounded saved-asset candidate study. No TS/world generation and no repo writes.
// Output candidates are NOT accepted geometry: independent common-refinement
// error, exact host constraints, movement, art, and budget gates remain required.
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve}from'node:path';import{createRequire}from'node:module';import{createHash}from'node:crypto';import{gunzipSync}from'node:zlib';
const ROOT=resolve(process.argv[2]),OUT=resolve(process.argv[3]);mkdirSync(OUT);
const hash=b=>createHash('sha256').update(b).digest('hex'),bytes=readFileSync(resolve(ROOT,'public/horizon/world/horizon-geo-1.json.gz')),world=JSON.parse(gunzipSync(bytes));
const logical=s=>s.sourceId??s.id.split('@')[0],solids=world.geometry.solids.filter(s=>logical(s)==='mountainV2.funicularFoot.apron');if(solids.length!==1)throw Error('Expected one actual served funicular partition');
const source=solids[0],P=source.positions,I=source.indices,origin=source.renderOrigin;if(!origin||origin.length!==3||!origin.every(Number.isFinite))throw Error('Missing logical renderOrigin');
const pt=i=>P.slice(i*3,i*3+3),cross=ids=>{const[a,b,c]=ids.map(pt),u=b.map((v,j)=>v-a[j]),v=c.map((w,j)=>w-a[j]);return[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];};
const top=[],bottom=[],walls=[];for(let k=0;k<I.length;k+=3){const f=I.slice(k,k+3),n=cross(f);(n[1]>0?top:n[1]<0?bottom:walls).push(f);}
function graph(faces){const edge=new Map();for(let i=0;i<faces.length;i++)for(let j=0;j<3;j++){const a=faces[i][j],b=faces[i][(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;const q=edge.get(key)??{a,b,faces:[],balance:0};q.faces.push(i);q.balance+=a<b?1:-1;edge.set(key,q);}return edge;}
const fullEdges=graph([...top,...bottom,...walls]);if([...fullEdges.values()].some(e=>e.faces.length!==2||e.balance!==0))throw Error('Source not closed oriented manifold');
const locks=new Uint8Array(P.length/3),lockedEdges=[];
for(const [label,faces]of[['top',top],['bottom',bottom]]){
 const E=graph(faces);for(const[key,e]of E){let reason=e.faces.length===1?'actual perimeter':null;
  // Conservatively protect every transition onto or off a flat host patch;
  // before production adoption pass explicit source station/capsule constraint
  // segments too. This experiment may overlock, never infer a seam is removable.
  if(!reason&&label==='top'&&e.faces.length===2){const planes=e.faces.map(i=>{const n=cross(faces[i]);return Math.hypot(n[0],n[2])<=1e-12*Math.abs(n[1]);});if(planes[0]!==planes[1])reason='flat host boundary';}
  if(reason){locks[e.a]=locks[e.b]=1;lockedEdges.push({label,key,reason});}
 }
}
const topology=(faces)=>{const E=graph(faces);return{boundaryEdges:[...E].filter(([,e])=>e.faces.length===1).map(([key])=>key).sort(),nonmanifold:[...E].filter(([,e])=>e.faces.length>2).map(([key])=>key)};},originalTop=topology(top),originalBottom=topology(bottom);
const local=Float32Array.from(P,(v,i)=>v-origin[i%3]),req=createRequire(resolve(ROOT,'package.json')),{MeshoptSimplifier:S}=await import('file://'+req.resolve('meshoptimizer/simplifier'));await S.ready;
const report={status:'UNACCEPTED CANDIDATE STUDY',assetSha256:hash(bytes),sourceId:source.id,logicalSource:logical(source),origin,sourceTriangles:I.length/3,top:top.length,bottom:bottom.length,walls:walls.length,topPerimeterEdges:originalTop.boundaryEdges.length,bottomPerimeterEdges:originalBottom.boundaryEdges.length,lockedVertices:locks.reduce((n,v)=>n+v,0),lockedEdges,candidates:[],limits:['Meshoptimizer error is not a maximum surface-deviation proof.','Output reuses original double vertices; local Float32 is only optimization input.','Every candidate requires independent exact overlay <=1mm top/bottom/thickness, host constraints and movement proof.','No candidate updates source, native assets, lite geometry, or runtime collision.']};
writeFileSync(OUT+'/source-solid.json',JSON.stringify(source));writeFileSync(OUT+'/study.json',JSON.stringify(report,null,2));
for(const error of[0,.00025,.0005]){
 const result=[];let reportedError=0;
 for(const faces of[top,bottom]){const [idx,e]=S.simplifyWithAttributes(Uint32Array.from(faces.flat()),local,3,new Float32Array(),0,[],locks,Math.floor(faces.length*.2)*3,error,['ErrorAbsolute','LockBorder','Sparse']);reportedError=Math.max(reportedError,e);result.push(Array.from({length:idx.length/3},(_,i)=>Array.from(idx.slice(i*3,i*3+3))));}
 const [newTop,newBottom]=result,F=[...newTop,...newBottom,...walls],E=graph(F),badEdges=[...E].filter(([,e])=>e.faces.length!==2||e.balance!==0).map(([key])=>key),newTopGraph=topology(newTop),newBottomGraph=topology(newBottom),boundaryExact=JSON.stringify(originalTop.boundaryEdges)===JSON.stringify(newTopGraph.boundaryEdges)&&JSON.stringify(originalBottom.boundaryEdges)===JSON.stringify(newBottomGraph.boundaryEdges);let maxTopDegrees=0,inverted=0,runtimeInvisible=0;
 for(const f of newTop){const n=cross(f);if(n[1]<=0)inverted++;if(n[1]<1e-8)runtimeInvisible++;maxTopDegrees=Math.max(maxTopDegrees,Math.atan2(Math.hypot(n[0],n[2]),n[1])*180/Math.PI);}
 const candidate={...source,indices:F.flat()};delete candidate.litePositions;delete candidate.liteIndices;delete candidate.liteErrorEu;
 const name=`candidate-${String(error).replace('.','p')}.json`;writeFileSync(OUT+'/'+name,JSON.stringify(candidate));report.candidates.push({name,requestedError:error,reportedError,triangles:F.length,top:newTop.length,bottom:newBottom.length,walls:walls.length,boundaryExact,closed:badEdges.length===0,badEdges,maxTopDegrees,inverted,runtimeInvisible,accepted:false,acceptance:'PENDING independent geometric and runtime gates; no result in this study is a pass'});writeFileSync(OUT+'/study.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.candidates.at(-1)));
}
