// Saved production-prism study only. No checkout or asset changes.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const ROOT=resolve(process.argv[2]),SNAP=resolve(process.argv[3]),OUT=resolve(process.argv[4]);mkdirSync(OUT);
const req=createRequire(ROOT+'/package.json'),{default:Module}=await import('file://'+req.resolve('manifold-3d'));
const kernel=await Module();kernel.setup();
const bytes=gunzipSync(readFileSync(SNAP+'/cuts.json.gz')),cuts=JSON.parse(bytes),rows=[];
const report=()=>writeFileSync(OUT+'/study.json',JSON.stringify({status:'UNACCEPTED OFFLINE STUDY',sourceSha256:createHash('sha256').update(bytes).digest('hex'),rows,limits:'Boolean results use local Float32 input. These are unaccepted candidates requiring surface error, envelope, movement, topology and visual proof.'},null,2));
for(const s of cuts.solids.filter(s=>/^stillwaterTunnel\.(floor|roof|walls|footings)$/.test(s.id))){
 const t0=performance.now(),P=s.positions,I=s.indices,n=P.length/3,lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let k=0;k<P.length;k++){lo[k%3]=Math.min(lo[k%3],P[k]);hi[k%3]=Math.max(hi[k%3],P[k]);}
 const origin=lo.map((v,j)=>Math.round((v+hi[j])/2)),row={id:s.id,inputTriangles:I.length/3,origin,pieces:n/8};
 const owned=[];
 try{
  if(n%8||I.length/36!==n/8)throw Error('Not exact raw prism inventory');
  const chunks=[];
  for(let k=0;k<I.length;k+=36){
   const ids=I.slice(k,k+36),used=[...new Set(ids)],map=new Map(used.map((id,j)=>[id,j]));
   if(used.length!==8)throw Error('Raw prism has wrong vertex count');
   const props=Float32Array.from(used.flatMap(id=>P.slice(id*3,id*3+3).map((v,j)=>v-origin[j])));
   const m=new kernel.Manifold(new kernel.Mesh({numProp:3,vertProperties:props,triVerts:Uint32Array.from(ids.map(i=>map.get(i)))}));
   owned.push(m);chunks.push(m);
  }
  const result=kernel.Manifold.union(chunks);owned.push(result);
  const mesh=result.getMesh(),positions=Array.from(mesh.vertProperties,(v,j)=>v+origin[j%3]),indices=Array.from(mesh.triVerts);
  row.status=result.status();row.outputTriangles=indices.length/3;row.vertices=positions.length/3;row.volume=result.volume();row.bounds=result.boundingBox();
  writeFileSync(OUT+'/'+s.id+'.json',JSON.stringify({...s,positions,indices}));
 }catch(error){row.error=String(error);}finally{owned.reverse().forEach(m=>m.delete());}
 row.wallMs=performance.now()-t0;rows.push(row);report();console.log(JSON.stringify(row));
}
