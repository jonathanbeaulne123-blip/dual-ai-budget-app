// Root-only: exact current source build, no stale Crown solids, no browser or asset bake.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const ROOT=resolve(process.argv[2]??process.cwd()),OUT=resolve(process.argv[3]??'/tmp/mountain-summit-prebake-observed');
if(existsSync(OUT))throw Error('Refusing to overwrite '+OUT);mkdirSync(OUT);process.chdir(ROOT);
const sha=b=>createHash('sha256').update(b).digest('hex'),save=(name,obj)=>writeFileSync(resolve(OUT,name),JSON.stringify(obj,null,2));
const paths=['src/harbour/horizon/regions/mountainV2/drawnRoadGround.ts','src/harbour/horizon/regions/mountainV2/drawnRoadFloor.ts','src/harbour/horizon/regions/mountainV2/geography.ts','src/harbour/horizon/regions/mountainV2/ground.ts','src/harbour/horizon/land/mountainV2/joins.ts','src/harbour/horizon/land/structures/build.ts','src/harbour/mountain/roads.ts','src/harbour/mountain/surfaces.ts','src/harbour/scene/ground.ts','test/horizon-mountain-footway-joins.test.ts','public/horizon/world/horizon-geo-1.json','public/horizon/terrain/horizon-geo-1.bin','public/mountain/terrain/hearth-mountain-geo-2.bin'];
const hashes=()=>Object.fromEntries(paths.map(p=>[p,sha(readFileSync(resolve(ROOT,p)))]));const beforeHashes=hashes();save('source-before.json',beforeHashes);
const groundPath=paths[0],current=readFileSync(resolve(ROOT,groundPath),'utf8'),line=current.split('\n').filter(l=>l.includes('side(x,z)*insideSign')&&l.includes('return null'));
if(line.length!==1)throw Error('Update explicit legacy comparator after terminal source changes');
const legacy=current.replace(line[0],'  // Comparator only: before terminal ownership correction.').replace('export function drawnRoadGroundCeiling','export function legacyRoadGroundCeiling').replace("'./drawnRoadFloor.ts'",JSON.stringify(resolve(ROOT,paths[1])));
writeFileSync(resolve(OUT,'legacy-ground.ts'),legacy);
const test=readFileSync(resolve(ROOT,'test/horizon-mountain-footway-joins.test.ts'),'utf8'),from=test.indexOf('const station:XYZ[]='),to=test.indexOf('const before=fixture()',from);
if(from<0||to<0)throw Error('Source fixture extraction changed');
const fixtureSource=test.slice(from,to).replace('function fixture():LandCuts','export function fixture():LandCuts');
const imports=[['fitMountainHorizonJoins','src/harbour/horizon/land/mountainV2/joins.ts'],['bed,addFlatPad,emitBedGeometry','src/harbour/horizon/land/beds/profiles.ts'],['buildStair','src/harbour/horizon/land/structures/build.ts'],['baseHeight,sampleTerrain','src/harbour/horizon/land/terrain/index.ts'],['decodeTerrainAsset','src/harbour/horizon/land/terrain/asset.ts'],['createHorizonGeography','src/harbour/horizon/runtime/geography.ts'],['createRegionGeography,REGION_ROAD','src/harbour/horizon/regions/mountainV2/geography.ts'],['prepareRegionGround','src/harbour/horizon/regions/mountainV2/ground.ts'],['drawnRoadGroundCeiling','src/harbour/horizon/regions/mountainV2/drawnRoadGround.ts'],['drawnRoadFloor','src/harbour/horizon/regions/mountainV2/drawnRoadFloor.ts'],['solidTopAt','src/harbour/horizon/world/geometry.ts'],['groundHeightAt','src/harbour/scene/ground.ts']];
const adapter=imports.map(([n,p])=>`import {${n}} from ${JSON.stringify(resolve(ROOT,p))}; export {${n}};`).join('\n')+`\nimport type {LandCuts,XYZ} from ${JSON.stringify(resolve(ROOT,'src/harbour/horizon/land/interfaces.ts'))};\nexport {legacyRoadGroundCeiling} from './legacy-ground.ts';\n${fixtureSource}`;
writeFileSync(resolve(OUT,'adapter.ts'),adapter);
let report={method:'Rebuilt source joins from original pre-fit test fixture; served Crown solids never imported into fixture. Actual full/lite prepareRegionGround lattices with separate caches. Legacy comparator removes only the new terminal ownership guard; no slopes, thresholds or controllers changed.',beforeHashes,failures:[],limits:['Pre-bake analytic and actual ground-lattice checks; no GPU render.','This probe does not claim full-route walking completion.','Legacy comparator is the immediately preceding Horizon ceiling, not native historical baseline.']};
try{
 const {build}=createRequire(resolve(ROOT,'package.json'))('esbuild');const bundled=await build({entryPoints:[resolve(OUT,'adapter.ts')],bundle:true,platform:'node',format:'esm',write:false,logLevel:'error',metafile:true,nodePaths:[resolve(ROOT,'node_modules')],loader:{'.png':'empty','.jpg':'empty','.svg':'empty','.css':'empty','.glb':'empty','.wav':'empty','.mp3':'empty'}});
 writeFileSync(resolve(OUT,'runtime.mjs'),bundled.outputFiles[0].text);save('bundle-metafile.json',bundled.metafile);
 report.bundleInputHashes=Object.fromEntries(Object.keys(bundled.metafile.inputs).map(p=>{const file=resolve(ROOT,p);return[file,sha(readFileSync(file))];}));
 const A=await import(pathToFileURL(resolve(OUT,'runtime.mjs')).href),O={x:1308,y:54,z:764};
 const b=readFileSync(resolve(ROOT,'public/horizon/terrain/horizon-geo-1.bin')),field=A.decodeTerrainAsset(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 const region=A.createRegionGeography({horizonGround:(x,z)=>A.sampleTerrain(field,x,z)}),road=A.REGION_ROAD,oldCap=A.legacyRoadGroundCeiling(road),cap=A.drawnRoadGroundCeiling(road),floor=A.drawnRoadFloor(road.landingRows);
 const oldGround=(x,z)=>Math.min(A.groundHeightAt(x,z),oldCap(x,z)??Infinity),newGround=(x,z)=>Math.min(A.groundHeightAt(x,z),cap(x,z)??Infinity);
 const composite=(x,z,ground)=>Math.max(ground(x,z),floor(x,z)?.y??-Infinity);
 const end=road.points.at(-1),row=road.landingRows.at(-1),left=row[0],right=row.at(-1),width=road.widths.at(-1),r=width+1.5,ex=right[0]-left[0],ez=right[2]-left[2],len=Math.hypot(ex,ez),tangent=[ex/len,ez/len],normal=[-ez/len,ex/len];
 const witness=[1324.1302169332484-O.x,470.73125184711256-O.z];
 report.stencil=[-.06,0,.06].map(dx=>{const x=witness[0]+dx,z=witness[1];return{x:x+O.x,z:z+O.z,native:A.groundHeightAt(x,z)+O.y,legacy:oldGround(x,z)+O.y,current:newGround(x,z)+O.y,road:floor(x,z),region:region.surface(x+O.x,158.18,z+O.z,.48)};});
 report.boundaries=[];
 for(const kind of['terminal-plane','circle-cutoff'])for(let i=0;i<=(kind==='terminal-plane'?252:720);i++){
  const at=kind==='terminal-plane'?[end[0]+tangent[0]*(-r+i*.05),end[2]+tangent[1]*(-r+i*.05)]:[end[0]+r*Math.cos(i*Math.PI/360),end[2]+r*Math.sin(i*Math.PI/360)],axis=kind==='terminal-plane'?normal:[Math.cos(i*Math.PI/360),Math.sin(i*Math.PI/360)];
  for(const eps of[.00001,.01,.025]){
   const p=[at[0]-axis[0]*eps,at[1]-axis[1]*eps],q=[at[0]+axis[0]*eps,at[1]+axis[1]*eps],measure=fn=>Math.abs(fn(...p)-fn(...q));
   const old=measure((x,z)=>composite(x,z,oldGround)),now=measure((x,z)=>composite(x,z,newGround)),oldRaw=measure(oldGround),nowRaw=measure(newGround),entry={kind,at:[at[0]+O.x,at[1]+O.z],eps,oldSurfaceStep:old,newSurfaceStep:now,oldGroundStep:oldRaw,newGroundStep:nowRaw,roadAtEnds:[floor(...p),floor(...q)],currentRegionAtEnds:[region.surface(p[0]+O.x,undefined,p[1]+O.z),region.surface(q[0]+O.x,undefined,q[1]+O.z)]};
   report.boundaries.push(entry);
   if(eps===.00001&&now>.02&&now>old+1e-5)report.failures.push({kind:'introduced-terminal-surface-discontinuity',...entry});
  }
 }
 report.trueFaces={samples:0,maximumCapError:0};
 for(let i=1;i<road.landingRows.length;i++)for(let k=1;k<row.length;k++)for(const tri of[[road.landingRows[i-1][k-1],road.landingRows[i][k-1],road.landingRows[i][k]],[road.landingRows[i-1][k-1],road.landingRows[i][k],road.landingRows[i-1][k]]]){
  const x=tri.reduce((s,p)=>s+p[0],0)/3,z=tri.reduce((s,p)=>s+p[2],0)/3,f=floor(x,z);if(!f)continue;const error=Math.abs(cap(x,z)-(f.y-.08));report.trueFaces.samples++;report.trueFaces.maximumCapError=Math.max(report.trueFaces.maximumCapError,error);if(error>1e-9||cap(x,z)!==oldCap(x,z))report.failures.push({kind:'changed-true-road-cut',x,z,error});
 }
 const sampleTriangle=(tri,x,z)=>{const[a,b,c]=tri,ux=b[0]-a[0],uz=b[2]-a[2],vx=c[0]-a[0],vz=c[2]-a[2],det=ux*vz-uz*vx;if(Math.abs(det)<1e-12)return null;const u=((x-a[0])*vz-(z-a[2])*vx)/det,v=(ux*(z-a[2])-uz*(x-a[0]))/det;return u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7?a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]):null;};
 const slope=([a,b,c])=>{const u=b.map((v,k)=>v-a[k]),v=c.map((w,k)=>w-a[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return Math.atan2(Math.hypot(n[0],n[2]),Math.abs(n[1]))*180/Math.PI;};
 report.drawn={};
 for(const tier of['full','lite']){
  const prepare=c=>A.prepareRegionGround(tier,region.contains,field.step,new Map(),(x,z)=>{const y=c(x-O.x,z-O.z);return y===null?null:y+O.y;}),old=prepare(oldCap),now=prepare(cap),P=now.lattice.positions,Q=old.lattice.positions,I=now.index;
  const data={changedVertices:[],changedFaces:[],stencil:[],boundaries:[],sourceIndicesEqual:sha(Buffer.from(I.buffer,I.byteOffset,I.byteLength))===sha(Buffer.from(old.index.buffer,old.index.byteOffset,old.index.byteLength))},local=[];
  // A changed source height can legitimately select the existing flatter
  // diagonal. Prove each such change is the same local cell with a changed
  // height; never waive an unrelated index/ownership change.
  data.indexChanges=[];
  if(I.length!==old.index.length)report.failures.push({kind:'ground-index-length-change',tier,before:old.index.length,after:I.length});
  for(let at=0;at<Math.min(I.length,old.index.length);at+=6){
   const a=Array.from(old.index.slice(at,at+6)),b=Array.from(I.slice(at,at+6));if(a.every((v,k)=>v===b[k]))continue;
   const beforeIds=[...new Set(a)].sort((a,b)=>a-b),afterIds=[...new Set(b)].sort((a,b)=>a-b),sameCell=beforeIds.length===4&&JSON.stringify(beforeIds)===JSON.stringify(afterIds);
   const changed=afterIds.filter(j=>P[j*3+1]!==Q[j*3+1]),local=afterIds.every(j=>Math.abs(P[j*3]-end[0])<10&&Math.abs(P[j*3+2]-end[2])<10);
   const slopes=(ix,pos)=>[0,3].map(k=>slope(ix.slice(k,k+3).map(j=>[pos[j*3],pos[j*3+1],pos[j*3+2]])));
   const entry={at,before:a,after:b,sameCell,changed,local,beforeSlopes:slopes(a,Q),afterSlopes:slopes(b,P)};data.indexChanges.push(entry);
   if(!sameCell||!changed.length||!local)report.failures.push({kind:'unrelated-ground-index-change',tier,...entry});
   if(Math.max(...entry.afterSlopes)>40&&Math.max(...entry.afterSlopes)>Math.max(...entry.beforeSlopes)+1e-6)report.failures.push({kind:'new-or-worsened-flipped-cell-slope',tier,...entry});
  }
  for(let i=0;i<P.length;i+=3)if(P[i+1]!==Q[i+1])data.changedVertices.push({index:i/3,at:[P[i]+O.x,P[i+2]+O.z],before:Q[i+1]+O.y,after:P[i+1]+O.y,delta:P[i+1]-Q[i+1]});
  for(let i=0;i<I.length;i+=3){const ids=[I[i],I[i+1],I[i+2]],tri=ids.map(j=>[P[3*j],P[3*j+1],P[3*j+2]]),previous=ids.map(j=>[Q[3*j],Q[3*j+1],Q[3*j+2]]);if(Math.min(...tri.map(p=>p[0]))<end[0]+10&&Math.max(...tri.map(p=>p[0]))>end[0]-10&&Math.min(...tri.map(p=>p[2]))<end[2]+10&&Math.max(...tri.map(p=>p[2]))>end[2]-10)local.push({tri,previous,id:i/3});
   if(ids.some(j=>P[j*3+1]!==Q[j*3+1])){const entry={id:i/3,indices:ids,beforeSlope:slope(previous),afterSlope:slope(tri),before:previous,after:tri};data.changedFaces.push(entry);if(entry.afterSlope>40&&entry.afterSlope>entry.beforeSlope+1e-6)report.failures.push({kind:'new-or-worsened-steep-drawn-face',tier,...entry});}
  }
  const drawn=(x,z,old=false)=>{let hit=null;for(const t of local){const y=sampleTriangle(old?t.previous:t.tri,x,z);if(y!==null&&(hit===null||y>hit))hit=y;}return hit;};
  for(const dx of[-.06,0,.06])data.stencil.push({dx,before:drawn(witness[0]+dx,witness[1],true),after:drawn(witness[0]+dx,witness[1]),analytic:newGround(witness[0]+dx,witness[1])});
  for(const entry of report.boundaries.filter(x=>x.eps===.00001)){
   const x=entry.at[0]-O.x,z=entry.at[1]-O.z,a=drawn(x,z),b=drawn(x,z,true);data.boundaries.push({kind:entry.kind,at:entry.at,before:b,after:a,analytic:newGround(x,z),drawnMinusQuery:a===null?null:a-newGround(x,z)});
  }
  report.drawn[tier]=data;
 }
 // Rebuild original authored treads and all original stair members. Add only the
 // source walk points from metadata; never reuse fitted Crown solids/heights.
 const world=JSON.parse(readFileSync(resolve(ROOT,'public/horizon/world/horizon-geo-1.json'),'utf8')),sourceWalk=world.collision.beds.find(b=>b.id==='walk summit');if(!sourceWalk)throw Error('Missing source summit walk');
 const original=A.fixture();original.beds.push(structuredClone(sourceWalk));const fresh=structuredClone(original);A.fitMountainHorizonJoins(fresh,A.baseHeight);
 const landing=fresh.solids.find(s=>s.id==='crownLaunch.stair.landing'),rail=fresh.solids.find(s=>s.id==='crownLaunch.stair.landingRails');if(!landing||!rail)throw Error('Source join did not construct');
 save('rebuilt-crown-solids.json',fresh.solids.filter(s=>s.id.startsWith('crownLaunch.stair')));
 const preserve={};for(const suffix of['treads','rails','stringers','supports','cheeks']){const id='crownLaunch.stair.'+suffix;preserve[id]=JSON.stringify(original.solids.find(s=>s.id===id))===JSON.stringify(fresh.solids.find(s=>s.id===id));if(!preserve[id])report.failures.push({kind:'original-stair-member-changed',id});}
 preserve.sourceWalk=JSON.stringify(original.beds.find(b=>b.id==='walk summit'))===JSON.stringify(fresh.beds.find(b=>b.id==='walk summit'));
 if(!preserve.sourceWalk)report.failures.push({kind:'source-walk-changed'});
 const g=A.createHorizonGeography(field,{beds:[],pads:[],mouths:[],waters:[],diagnostics:[],solids:[rail]});
 const composed=A.createHorizonGeography(field,fresh);composed.addDynamic(region.provider);
 report.rails={preserve,railTriangles:rail.indices.length/3,landingTriangles:landing.indices.length/3,openingChecks:0,openingContacts:[],retainedBandChecks:0,retainedBandFailures:[],boundaryFloor:[]};
 for(let i=1;i<sourceWalk.points.length;i++){
  const a=sourceWalk.points[i-1],b=sourceWalk.points[i],L=Math.hypot(b[0]-a[0],b[2]-a[2]),nx=-(b[2]-a[2])/L,nz=(b[0]-a[0])/L;
  for(let s=0;s<=L;s+=.05)for(const offset of[-.95,-.5,0,.5,.95]){
   const x=a[0]+(b[0]-a[0])*s/L+nx*offset,z=a[2]+(b[2]-a[2])*s/L+nz*offset,top=A.solidTopAt(landing,x,z);if(top===null)continue;const actual=composed.surface(x,z,undefined),foot=actual?.y??top;
   for(const y of[top,foot]){const contact=g.contact(x,z,y,.3,undefined,false,.65);report.rails.openingChecks++;if(contact)report.rails.openingContacts.push({x,z,y,contact});}
   report.rails.boundaryFloor.push({x,z,landing:top,actual});
  }
 }
 // Each emitted rail slab is a prism with8 vertices: test the BODY member
 // (0.7m thick) rather than the decorative narrow top member or vertical posts.
 const P=rail.positions;for(let k=0;k<P.length;k+=24){const top=Array.from({length:4},(_,j)=>P.slice(k+(j+4)*3,k+(j+4)*3+3)),bottom=Array.from({length:4},(_,j)=>P.slice(k+j*3,k+j*3+3));if(Math.abs(top[0][1]-bottom[0][1]-.7)>1e-7)continue;
  const x=top.reduce((n,p)=>n+p[0],0)/4,z=top.reduce((n,p)=>n+p[2],0)/4,railTop=top.reduce((n,p)=>n+p[1],0)/4,y=railTop-.95;report.rails.retainedBandChecks++;if(!g.contact(x,z,y,.01,undefined,false,.65))report.rails.retainedBandFailures.push({x,z,y});
 }
 if(report.rails.openingChecks===0||report.rails.openingContacts.length)report.failures.push({kind:'rail-blocks-source-walk',checks:report.rails.openingChecks,contacts:report.rails.openingContacts});
 if(report.rails.retainedBandChecks===0||report.rails.retainedBandFailures.length)report.failures.push({kind:'retained-rail-body-band-missing',...report.rails});
 report.bundleSha256=sha(bundled.outputFiles[0].text);
}catch(error){report.executionError={message:error.message,stack:error.stack};}
report.afterHashes=hashes();report.sourceChanged=paths.filter(p=>beforeHashes[p]!==report.afterHashes[p]);
report.bundleInputChanged=Object.entries(report.bundleInputHashes??{}).filter(([p,h])=>sha(readFileSync(p))!==h).map(([p])=>p);report.sourceChanged.push(...report.bundleInputChanged);report.accepted=!report.executionError&&!report.sourceChanged.length&&!report.failures.length;
save('report.json',report);console.log(JSON.stringify({accepted:report.accepted,failures:report.failures.length,executionError:report.executionError?.message,sourceChanged:report.sourceChanged,drawn:Object.fromEntries(Object.entries(report.drawn??{}).map(([k,v])=>[k,{vertices:v.changedVertices.length,faces:v.changedFaces.length}])),rails:report.rails?{openingChecks:report.rails.openingChecks,openingContacts:report.rails.openingContacts.length,retainedBandChecks:report.rails.retainedBandChecks,retainedBandFailures:report.rails.retainedBandFailures.length}:null},null,2));process.exitCode=report.accepted?0:1;
