// Read-only served-data diagnostic. Root runs serially; never fits source geometry.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
const ROOT=resolve(process.argv[2]??process.cwd());
const OUT=resolve(process.argv[3]??'/tmp/mountain-ground-collar-samples');
const PROOF=resolve(process.argv[4]??'/tmp/mountain-funicular-served-ground-proof-2');
mkdirSync(OUT);process.chdir(ROOT);
const started=performance.now(),stages=[],hash=b=>createHash('sha256').update(b).digest('hex');
const stage=(name,details={})=>{const q={name,elapsedMs:performance.now()-started,...details};stages.push(q);writeFileSync(OUT+'/stages.json',JSON.stringify(stages,null,2));console.log(JSON.stringify(q));};
process.on('uncaughtException',error=>{writeFileSync(OUT+'/failure.json',JSON.stringify({message:error.message,stack:error.stack},null,2));console.error(error.stack);process.exitCode=2;});
const reportBytes=readFileSync(PROOF+'/ground-preflight.json'),report=JSON.parse(reportBytes),canonicalBytes=readFileSync(PROOF+'/canonical-ground.json'),canonical=JSON.parse(canonicalBytes),bundleBytes=readFileSync(PROOF+'/runtime-bundle.mjs');
if(hash(bundleBytes)!==report.actualBundleSha256)throw Error('Frozen preflight bundle hash mismatch');
const worldFile=resolve(ROOT,'public/horizon/world/horizon-geo-1.json.gz'),terrainFile=resolve(ROOT,'public/horizon/terrain/horizon-geo-1.bin'),nativeFile=resolve(ROOT,'src/harbour/horizon/land/mountainV2/v2-data.json');
const worldBytes=readFileSync(worldFile),terrainBytes=readFileSync(terrainFile),nativeBytes=readFileSync(nativeFile),assetProvenance={worldGzipSha256:hash(worldBytes),terrainSha256:hash(terrainBytes),nativeDataSha256:hash(nativeBytes)};
for(const [key,value] of Object.entries(assetProvenance))if(value!==report.assetProvenance[key])throw Error('Served/native asset changed since ground preflight: '+key);
const provenance={bundleSha256:hash(bundleBytes),preflightReportSha256:hash(reportBytes),canonicalMeshSha256:hash(canonicalBytes),assetProvenance,sourceFitterImported:false,sourceFitterCalled:false,sourceGraph:report.actualInputHashes,shadowSources:report.shadowSources};
writeFileSync(OUT+'/provenance.json',JSON.stringify(provenance,null,2));
const api=await import(pathToFileURL(PROOF+'/runtime-bundle.mjs').href),ab=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),world=api.parseHorizonDefinition(ab(worldBytes)),field=api.decodeTerrainAsset(ab(terrainBytes),'full'),native=JSON.parse(nativeBytes);
const regionOptions={horizonGround:(x,z)=>api.sampleTerrain(field,x,z),yield:api.terraceBedExclusion(world.collision.beds),exclude:api.mouthExclusion(world.collision.mouths)};
// Intentionally no walkingJoinSolids: the actual pre-join physical/native terrain is the baseline.
const region=api.createRegionGeography(regionOptions),core=canonical.proof.bounds,WIDTH=1.5,outer={x0:core.x0-WIDTH,x1:core.x1+WIDTH,z0:core.z0-WIDTH,z1:core.z1+WIDTH},OFFSET=[1308,54,764];
const inBox=(x,z,b)=>x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1;
function indexMesh(mesh){
 const positions=mesh.positions,indices=mesh.indices,cells=new Map(),cell=1;
 for(let k=0;k<indices.length;k+=3){const ids=indices.slice(k,k+3),xs=ids.map(i=>positions[3*i]),zs=ids.map(i=>positions[3*i+2]);
  for(let x=Math.floor(Math.min(...xs)-1e-9);x<=Math.floor(Math.max(...xs)+1e-9);x++)for(let z=Math.floor(Math.min(...zs)-1e-9);z<=Math.floor(Math.max(...zs)+1e-9);z++){const key=x+':'+z,list=cells.get(key)??[];list.push(k);cells.set(key,list);}}
 return (x,z)=>{let found=null;for(const k of cells.get(Math.floor(x/cell)+':'+Math.floor(z/cell))??[]){
   const a=indices[k]*3,b=indices[k+1]*3,c=indices[k+2]*3,ax=positions[a],az=positions[a+2],bx=positions[b],bz=positions[b+2],cx=positions[c],cz=positions[c+2],D=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(D)<1e-14)continue;
   const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/D,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/D,w=1-u-v;if(Math.min(u,v,w)<-1e-10)continue;
   const y=u*positions[a+1]+v*positions[b+1]+w*positions[c+1];if(!found||y>found.y)found={y,face:mesh.sourceFaceIds?.[k/3]??k/3};
  }return found;};
}
const canonicalAt=indexMesh(canonical),tiers={};
for(const tier of ['full','lite']){
 stage('prepare-old-ground',{tier});const begin=performance.now(),prepared=api.prepareRegionGround(tier,region.contains,field.step,new Map(),region.groundCeiling),R=prepared.render,positions=[],indices=[],sourceVertexIds=[],sourceFaceIds=[],remap=new Map();
 for(let k=0;k<R.indices.length;k+=3){const ids=Array.from(R.indices.slice(k,k+3)),xs=ids.map(i=>R.positions[i*3]),zs=ids.map(i=>R.positions[i*3+2]);if(Math.max(...xs)<outer.x0||Math.min(...xs)>outer.x1||Math.max(...zs)<outer.z0||Math.min(...zs)>outer.z1)continue;
  for(const id of ids){let local=remap.get(id);if(local===undefined){local=positions.length/3;remap.set(id,local);sourceVertexIds.push(id);positions.push(R.positions[id*3],R.positions[id*3+1],R.positions[id*3+2]);}indices.push(local);}sourceFaceIds.push(k/3);
 }
 const mesh={tier,coordinateSystem:'native Mountain coordinates; Horizon offset [1308,54,764]',bounds:outer,positions,indices,sourceVertexIds,sourceFaceIds,triangles:indices.length/3,originalRenderTriangles:R.indices.length/3,prepareMs:performance.now()-begin};
 const bytes=gzipSync(JSON.stringify(mesh),{level:9});writeFileSync(OUT+'/old-'+tier+'-local-mesh.json.gz',bytes);tiers[tier]={mesh,at:indexMesh(mesh),sha256:hash(bytes)};stage('old-ground-ready',{tier,triangles:mesh.triangles,prepareMs:mesh.prepareMs});
}
const relevantPaths=native.nativePlanning.walks.filter(w=>w.points.length>1&&w.points.slice(1).some((b,i)=>{const a=w.points[i],r=w.halfWidth+.3;return Math.max(a[0],b[0])+r>=outer.x0+OFFSET[0]&&Math.min(a[0],b[0])-r<=outer.x1+OFFSET[0]&&Math.max(a[2],b[2])+r>=outer.z0+OFFSET[2]&&Math.min(a[2],b[2])-r<=outer.z1+OFFSET[2];}));
writeFileSync(OUT+'/published-paths.json',JSON.stringify({coordinateSystem:'original Horizon coordinates',scope:'Published nativePlanning polylines and widths; not reconstructed art or a controller trace',paths:relevantPaths},null,2));
const valueCache=new Map();
function sample(x,z){
 const key=x.toPrecision(14)+':'+z.toPrecision(14),cached=valueCache.get(key);if(cached)return cached;
 const physical=region.provider.ground(x+OFFSET[0],z+OFFSET[2])-OFFSET[1],f=tiers.full.at(x,z),l=tiers.lite.at(x,z),inside=inBox(x,z,core),q=inside?canonicalAt(x,z):null;
 if(!Number.isFinite(physical)||!f||!l||(inside&&!q))throw Error('Missing actual physical/render floor at '+JSON.stringify({x,z,physical,f,l,inside,q}));
 const row=[x,z,physical,inside?q.y:physical,f.y,l.y,inside?1:0,region.contains(x+OFFSET[0],z+OFFSET[2])?1:0];valueCache.set(key,row);return row;
}
function extrema(rows){const result={samples:rows.length,full:{maxError:0,worst:null},lite:{maxError:0,worst:null},tierDisagreement:{max:0,worst:null}};
 for(const r of rows){for(const [tier,i]of [['full',4],['lite',5]]){const error=Math.abs(r[i]-r[2]);if(error>result[tier].maxError){result[tier].maxError=error;result[tier].worst=r;}}const diff=Math.abs(r[4]-r[5]);if(diff>result.tierDisagreement.max){result.tierDisagreement={max:diff,worst:r};}}
 return result;}
const columns=['nativeX','nativeZ','prejoinAnalyticGroundY','currentCanonicalGroundYInsideCoreElseBaseline','oldFullDrawnY','oldLiteDrawnY','insideCore','regionContains'];
const grid=[],nx=Math.round((outer.x1-outer.x0)/.1),nz=Math.round((outer.z1-outer.z0)/.1);
for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++)grid.push(sample(outer.x0+(outer.x1-outer.x0)*ix/nx,outer.z0+(outer.z1-outer.z0)*iz/nz));
writeFileSync(OUT+'/ground-samples.json.gz',gzipSync(JSON.stringify({columns,gridStep:.1,core,outer,rows:grid}),{level:9}));stage('uniform-samples',{samples:grid.length});
const rings=[];
for(const width of [0,.25,.5,.75,1,1.25,1.5]){
 const B={x0:core.x0-width,x1:core.x1+width,z0:core.z0-width,z1:core.z1+width},rows=[];
 for(const axis of [0,2])for(const fixed of axis===0?[B.x0,B.x1]:[B.z0,B.z1]){const lo=axis===0?B.z0:B.x0,hi=axis===0?B.z1:B.x1,n=Math.ceil((hi-lo)/.02);for(let i=0;i<=n;i++){const t=lo+(hi-lo)*i/n;rows.push(sample(axis===0?fixed:t,axis===0?t:fixed));}}
 rings.push({width,bounds:B,summary:extrema(rows),rows});
}
writeFileSync(OUT+'/candidate-ring-samples.json.gz',gzipSync(JSON.stringify({columns,alongStepMaximum:.02,rings}),{level:9}));stage('candidate-rings',{rings:rings.length,samples:rings.reduce((s,r)=>s+r.rows.length,0)});
const pathRows=[],pathSummary=[];
for(let pi=0;pi<relevantPaths.length;pi++){
 const w=relevantPaths[pi],rows=[];let arc=0;
 const offsetSet=new Set([-w.halfWidth-.3,-w.halfWidth,-Math.max(0,w.halfWidth-.3),0,Math.max(0,w.halfWidth-.3),w.halfWidth,w.halfWidth+.3]);for(let o=-w.halfWidth;o<=w.halfWidth+1e-9;o+=.2)offsetSet.add(Math.min(w.halfWidth,o));const offsets=[...offsetSet].sort((a,b)=>a-b);
 for(let k=1;k<w.points.length;k++){const a=w.points[k-1],b=w.points[k],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);if(length<1e-9)continue;const n=Math.ceil(length/.1);
  for(let i=0;i<=n;i++){const t=i/n;for(const off of offsets){const x=a[0]+dx*t+dz/length*off-OFFSET[0],z=a[2]+dz*t-dx/length*off-OFFSET[2];if(!inBox(x,z,outer))continue;const r=sample(x,z);rows.push(r);pathRows.push([pi,k-1,arc+length*t,off,...r]);}}arc+=length;
 }
 pathSummary.push({id:w.id,kind:w.kind,halfWidth:w.halfWidth,samples:rows.length,all:extrema(rows),collar:extrema(rows.filter(r=>!r[6]))});
}
writeFileSync(OUT+'/published-width-samples.json.gz',gzipSync(JSON.stringify({columns:['publishedPathIndex','segmentIndex','planArc','lateralOffset',...columns],pathIds:relevantPaths.map(w=>w.id),alongStepMaximum:.1,lateralStepMaximum:.2,extraOffsets:'exact edges, body-safe centers halfWidth minus0.3, and external halfWidth plus0.3',rows:pathRows}),{level:9}));
const drift=[];for(const [file,key]of [[worldFile,'worldGzipSha256'],[terrainFile,'terrainSha256'],[nativeFile,'nativeDataSha256']])if(hash(readFileSync(file))!==assetProvenance[key])drift.push(file);if(hash(readFileSync(PROOF+'/runtime-bundle.mjs'))!==provenance.bundleSha256)drift.push('frozen bundle');if(hash(readFileSync(PROOF+'/canonical-ground.json'))!==provenance.canonicalMeshSha256)drift.push('canonical mesh');if(hash(readFileSync(PROOF+'/ground-preflight.json'))!==provenance.preflightReportSha256)drift.push('preflight report');
const summary={status:'MEASUREMENT ONLY; no candidate geometry or acceptance claim',elapsedMs:performance.now()-started,core,outer,collarWidth:WIDTH,sourceDrift:drift,provenance,oldMeshes:Object.fromEntries(Object.entries(tiers).map(([k,v])=>[k,{triangles:v.mesh.triangles,prepareMs:v.mesh.prepareMs,sha256:v.sha256}])),uniform:extrema(grid),collar:extrema(grid.filter(r=>!r[6])),rings:rings.map(({width,bounds,summary})=>({width,bounds,...summary})),publishedPaths:pathSummary,limits:['No source fitter or asset geometry mutation. Uses the frozen served-asset preflight runtime bundle and rejects changed assets.','All physical/render heights are exact queries at the listed samples; finite0.1m grids and0.02m ring samples do not bound the unsampled analytical field.','Published plan-width ribbons are source metadata, not proof of generated path-art coverage or controller success.','The saved preflight mesh defines the current core floor only; no proposed collar height or triangulation is implemented.','Inherited baseline physical-to-drawn errors are recorded separately for each detail tier. No6cm threshold has been waived.']};
writeFileSync(OUT+'/summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify({elapsedMs:summary.elapsedMs,sourceDrift:drift,rings:summary.rings.map(r=>({width:r.width,full:r.full.maxError,lite:r.lite.maxError,betweenTiers:r.tierDisagreement.max})),paths:pathSummary.map(p=>({id:p.id,collarSamples:p.collar.samples,full:p.collar.full.maxError,lite:p.collar.lite.maxError}))},null,2));process.exitCode=drift.length?2:0;
