// Parent-only execution. Reuses saved v16 solids and exact served field; no candidate rebuild.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual,inspect} from 'node:util';
import {performance} from 'node:perf_hooks';
const ROOT=resolve(process.argv[2]??process.cwd()),DATA=resolve(process.argv[3]??'/tmp/mountain-funicular-foot-candidate-proof-v16'),OUT=resolve(process.argv[4]??'/tmp/mountain-face-bounds-observed');
if(existsSync(OUT))throw Error('Refusing to overwrite '+OUT);mkdirSync(OUT);process.chdir(ROOT);
const geoFile=resolve(ROOT,'src/harbour/horizon/runtime/geography.ts'),beforeFile='/tmp/mountain-face-bounds/geography-before.ts',candidateFile='/tmp/mountain-face-bounds/geography-candidate.ts',sha=b=>createHash('sha256').update(b).digest('hex'),save=(n,x)=>writeFileSync(resolve(OUT,n),JSON.stringify(x,null,2));
const original=readFileSync(beforeFile,'utf8'),candidate=readFileSync(candidateFile,'utf8');if(readFileSync(geoFile,'utf8')!==original)throw Error('Baseline geography source drifted; regenerate candidate against current file');
const dataFiles=['candidate-solid.json','before-source-solids.json','walkers.json','raw-sweeps.json','asset-provenance.json'],hashes=Object.fromEntries(dataFiles.map(p=>[resolve(DATA,p),sha(readFileSync(resolve(DATA,p)))]));
const terrainPath=resolve(ROOT,'public/horizon/terrain/horizon-geo-1.bin'),terrainBytes=readFileSync(terrainPath),provenance=JSON.parse(readFileSync(resolve(DATA,'asset-provenance.json'),'utf8'));
if(sha(terrainBytes)!==provenance.terrainSha256)throw Error('Current terrain differs from saved v16 field; supply matching assets before execution');
const report={source:{baseline:sha(original),candidate:sha(candidate),inputHashes:hashes,terrainSha256:sha(terrainBytes)},method:'Exact deep equality on all returned fields, preserved original face/order, saved v16 triangles and actual terrain. Static query parity first; unchanged synthetic dynamic providers and streamed additions separately. CPU wall timings use uninstrumented source, no GPU.',mismatches:[],timing:[],limits:['Saved v16 geometry is not final accepted funicular geometry.','Finite regression corpus is not an exhaustive floating-point proof.','Fresh full movement/art runner speed and all results must still be measured before adopting this optimization.','Indexed solid XZ positions/indices are immutable after addSolids, as required already by bucket ownership and precomputed normals.']};
try{
 const {build}=createRequire(resolve(ROOT,'package.json'))('esbuild');const apis=[];
 for(const[label,code]of[['before',original],['candidate',candidate]]){
  const result=await build({stdin:{contents:`export {createHorizonGeography} from ${JSON.stringify(geoFile)}; export {decodeTerrainAsset} from ${JSON.stringify(resolve(ROOT,'src/harbour/horizon/land/terrain/asset.ts'))};`,resolveDir:ROOT,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'error',metafile:true,nodePaths:[resolve(ROOT,'node_modules')],plugins:[{name:'frozen-geography',setup(b){b.onLoad({filter:/[\\/]runtime[\\/]geography\.ts$/},args=>resolve(args.path)===geoFile?{contents:code,loader:'ts',resolveDir:dirname(geoFile)}:null);}}]});
  const path=resolve(OUT,label+'.mjs');writeFileSync(path,result.outputFiles[0].text);save(label+'-metafile.json',result.metafile);report.source[label+'BundleSha256']=sha(result.outputFiles[0].text);apis.push(await import(pathToFileURL(path).href));
 }
 const A=apis[0],B=apis[1],ab=terrainBytes.buffer.slice(terrainBytes.byteOffset,terrainBytes.byteOffset+terrainBytes.byteLength),field=A.decodeTerrainAsset(ab,'full'),prior=JSON.parse(readFileSync(resolve(DATA,'before-source-solids.json'),'utf8')),added=JSON.parse(readFileSync(resolve(DATA,'candidate-solid.json'),'utf8')),solids=[...prior,added];
 const cuts={beds:[],pads:[],solids,mouths:[],waters:[],diagnostics:[]};let t=performance.now();const old=A.createHorizonGeography(field,cuts);report.timing.push({kind:'build-before',ms:performance.now()-t});t=performance.now();const next=B.createHorizonGeography(field,cuts);report.timing.push({kind:'build-candidate',ms:performance.now()-t});
 report.index={before:old.indexStats,candidate:next.indexStats,addedActiveReferenceBytes:next.indexStats.referenceBytes-old.indexStats.referenceBytes};
 const points=[],keys=new Set(),add=(p,label)=>{if(p.length!==3||!p.every(Number.isFinite))return;const key=p.map(v=>v.toPrecision(14)).join(',');if(!keys.has(key)){keys.add(key);points.push({p:[...p],label});}};
 for(const walk of JSON.parse(readFileSync(resolve(DATA,'walkers.json'),'utf8')))for(const frame of walk.trace??[])add(frame.p,'saved walker '+walk.id);
 for(const sweep of JSON.parse(readFileSync(resolve(DATA,'raw-sweeps.json'),'utf8')))for(const f of sweep.failures??[]){if(Number.isFinite(f.floor?.y))add([f.x,f.floor.y,f.z],'saved sweep failure');}
 // Distributed face centroids plus barycentric-fringe witnesses from actual v16.
 const I=added.indices,P=added.positions,step=Math.max(1,Math.floor(I.length/3/160));
 for(let n=0;n<I.length/3;n+=step){const tri=[0,1,2].map(k=>P.slice(I[n*3+k]*3,I[n*3+k]*3+3));for(const weights of[[1/3,1/3,1/3],[-.999e-6,1+1.998e-6,-.999e-6],[1.000002,-.000001,-.000001]])add([0,1,2].map(k=>tri.reduce((s,p,j)=>s+p[k]*weights[j],0)),'actual triangle '+n+' barycentric '+weights.join(','));}
 const xs=added.positions.filter((_,i)=>i%3===0),zs=added.positions.filter((_,i)=>i%3===2),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 for(let i=0;i<81;i++){const x=minX+(maxX-minX)*(i%9)/8,z=minZ+(maxZ-minZ)*Math.floor(i/9)/8;add([x,55.3,z],'regular local bucket grid');}
 const calls=[];
 for(const {p:[x,y,z],label} of points){calls.push({method:'surface',args:[x,z,y,.48],label},{method:'surface',args:[x,z,undefined,.48],label},{method:'ceiling',args:[x,z,y],label},{method:'contact',args:[x,z,y,.3],label},{method:'contact',args:[x,z,y,.3,[1,0],false,.65],label},{method:'contact',args:[x,z,y,.3,[-1,0],false,1.25],label},{method:'contact',args:[x,z,y,.01,[0,1],false,1.4],label});}
 save('query-corpus.json',calls);
 const compare=(g,h,list,label)=>{for(let i=0;i<list.length;i++){const c=list[i],a=g[c.method](...c.args),b=h[c.method](...c.args);if(!isDeepStrictEqual(a,b))report.mismatches.push({label,index:i,query:c,before:inspect(a,{depth:null}),after:inspect(b,{depth:null})});}};
 t=performance.now();compare(old,next,calls,'saved-v16');report.timing.push({kind:'exact-parity',queries:calls.length,ms:performance.now()-t});
 // Timing order alternates, one complete warm-up before retained medians.
 const timingCalls=calls.filter((_,i)=>i%3===0);for(const g of[old,next])for(const c of timingCalls)g[c.method](...c.args);
 for(let round=0;round<4;round++)for(const[label,g]of(round%2?[['candidate',next],['before',old]]:[['before',old],['candidate',next]])){t=performance.now();let checksum=0;for(const c of timingCalls){const hit=g[c.method](...c.args);checksum+=hit===null?0:typeof hit==='number'?(Number.isFinite(hit)?hit:0):(hit.y??hit.nx??1);}report.timing.push({kind:label,round,queries:timingCalls.length,ms:performance.now()-t,checksum});}
 // Exact tie/contact order, barycentric fringe, vertical/skinny faces, CELL edges,
 // and chunk growth. Both implementations receive the same references/order.
 const triangle=(id,points,walkable=true)=>({id,kind:'parity',positions:points.flat(),indices:[0,1,2],surface:'stone',role:walkable?'deck':'wall',walkable,bedIds:[]});
 const shapes=[triangle('tie-first',[[312,300,312],[312,300,313],[313,300,312]]),triangle('tie-last',[[312,300,312],[312,300,313],[313,300,312]]),triangle('ceiling',[[312,300.8,312],[313,300.8,312],[312,300.8,313]],false),triangle('vertical-first',[[312.5,299,312],[312.5,302,312],[312.5,302,313]],false),triangle('vertical-last',[[312.5,299,312],[312.5,302,312],[312.5,302,313]],false),triangle('thin-certified-or-fallback',[[313,301,312],[313,301,312.00000002],[314,301,312]])];
 const c0=A.createHorizonGeography(field,{...cuts,solids:[]}),c1=B.createHorizonGeography(field,{...cuts,solids:[]});c0.addSolids(shapes.slice(0,2));c1.addSolids(shapes.slice(0,2));
 const special=[];for(const x of[311.999999,312,312.25,312.499999,312.5,312.500001,312.999999,313,313.5])for(const z of[311.999999,312,312.00000001,312.25,312.5,313.000001])for(const radius of[0,.000001,.01,.3,.6]){special.push({method:'surface',args:[x,z,300,.48]},{method:'ceiling',args:[x,z,300]},{method:'contact',args:[x,z,300,radius]},{method:'contact',args:[x,z,300,radius,[1,0],false,.65]});}
 compare(c0,c1,special,'stream-stage-one');c0.addSolids(shapes.slice(2));c1.addSolids(shapes.slice(2));compare(c0,c1,special,'stream-stage-two');
 const dynamic={surface(){return{id:'dynamic-equal-tie',y:300,nx:0,ny:1,nz:0,material:'stone',slope:0};},ceiling(){return 300.8;},contact(){return{id:'dynamic-first',nx:-1,nz:0};}};const remove0=c0.addDynamic(dynamic),remove1=c1.addDynamic(dynamic);compare(c0,c1,special,'dynamic-order');remove0();remove1();compare(c0,c1,special,'dynamic-removed');
 // Force a typed-array growth after initial indexing; prior bounds must survive.
 const growth=Array.from({length:1100},(_,i)=>triangle('grow-'+i,[[800+i%10,250,800],[800+i%10,250,800.5],[800.5+i%10,250,800]]));c0.addSolids(growth);c1.addSolids(growth);compare(c0,c1,special,'after-capacity-growth');
 report.queries={saved:calls.length,synthetic:special.length*5,uniqueSavedPoints:points.length};
}catch(error){report.executionError={message:error.message,stack:error.stack};}
report.source.changedInputs=Object.entries(hashes).filter(([p,h])=>sha(readFileSync(p))!==h).map(([p])=>p);if(readFileSync(geoFile,'utf8')!==original)report.source.changedInputs.push(geoFile);if(sha(readFileSync(terrainPath))!==report.source.terrainSha256)report.source.changedInputs.push(terrainPath);
report.parityPassed=!report.executionError&&!report.mismatches.length&&!report.source.changedInputs.length;save('report.json',report);console.log(JSON.stringify({parityPassed:report.parityPassed,mismatches:report.mismatches.length,executionError:report.executionError?.message,queries:report.queries,index:report.index,timing:report.timing},null,2));process.exitCode=report.parityPassed?0:1;
