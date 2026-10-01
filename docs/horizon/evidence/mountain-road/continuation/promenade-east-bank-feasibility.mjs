/** Prepared only. Run AFTER root releases the serial lane:
 * node /tmp/promenade-east-bank-feasibility.mjs '/absolute/checkout' --execute
 * Read-only checkout; all output stays under /tmp/promenade-east-bank-feasibility.
 * This measures the proposed envelope. It does NOT claim a built mesh/controller pass. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const ROOT=resolve(process.argv[2]??process.cwd());
if(!process.argv.includes('--execute'))throw Error('Prepared probe is disabled. Root must release the execution slot before --execute.');
const OUT='/tmp/promenade-east-bank-feasibility';mkdirSync(OUT,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const {build}=createRequire(resolve(ROOT,'package.json'))('esbuild');
const exports=[
 ['groundHeightAt','src/harbour/scene/ground.ts'],
 ['PATH_EDGES,MOUNTAIN_PATH_GRAPH','src/harbour/mountain/pathGraph.ts'],
 ['SKILL_BRANCHES','src/harbour/mountain/course.ts'],
 ['MOUNTAIN_ROAD_LINE,EDGE_RUNS,EDGE_SOLIDS','src/harbour/mountain/roads.ts'],
 ['worldDeckAt,worldCeilingAt,worldCollisionAt,queryWorldSurface,WORLD_SURFACES','src/harbour/mountain/surfaces.ts'],
 ['createRegionGeography,terraceBedExclusion,mouthExclusion,REGION_SURFACES,REGION_ROAD,REGION_SOLIDS','src/harbour/horizon/regions/mountainV2/geography.ts'],
 ['drawnRoadFloor','src/harbour/horizon/regions/mountainV2/drawnRoadFloor.ts'],
 ['MOUNTAIN_V2_OFFSET','src/harbour/horizon/regions/mountainV2/placement.ts'],
 ['createHorizonGeography,HORIZON_BODY_HEIGHT,HORIZON_STEP_HEIGHT,HORIZON_WALKABLE_DEGREES','src/harbour/horizon/runtime/geography.ts'],
 ['sampleTerrain','src/harbour/horizon/land/terrain/index.ts'],
 ['decodeTerrainAsset','src/harbour/horizon/land/terrain/asset.ts'],
];
const bundle=await build({stdin:{contents:exports.map(([names,file])=>`export {${names}} from './${file}';`).join('\n'),resolveDir:ROOT,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'error',nodePaths:[join(ROOT,'node_modules')],loader:{'.png':'empty','.jpg':'empty','.svg':'empty','.css':'empty','.glb':'empty','.wav':'empty','.mp3':'empty'}});
const a=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const raw=readFileSync(join(ROOT,'public/horizon/world/horizon-geo-1.json')),world=JSON.parse(raw),terrain=readFileSync(join(ROOT,'public/horizon/terrain/horizon-geo-1.bin'));
const field=a.decodeTerrainAsset(terrain.buffer.slice(terrain.byteOffset,terrain.byteOffset+terrain.byteLength),'full'),O=a.MOUNTAIN_V2_OFFSET;
const H=p=>[p[0]+O.x,p[1]+O.y,p[2]+O.z],N=p=>[p[0]-O.x,p[1]-O.y,p[2]-O.z];
const region=a.createRegionGeography({horizonGround:(x,z)=>a.sampleTerrain(field,x,z),yield:a.terraceBedExclusion(world.collision.beds),exclude:a.mouthExclusion(world.collision.mouths)});
const cuts={...world.collision,solids:world.geometry.solids,diagnostics:world.diagnostics??[]},g=a.createHorizonGeography(field,cuts);g.addDynamic(region.provider);
const plan=JSON.parse(readFileSync('/tmp/promenade-east-bank-plan.json','utf8')),crest=a.PATH_EDGES.find(e=>e.id==='promenade:dam-crest');
if(!crest)throw Error('Current native crest is missing.');
const road=a.MOUNTAIN_ROAD_LINE.samples[plan.joinRoadSample];if(!road)throw Error('Current road join sample is missing.');
const P=plan.pointsHorizon.map(p=>[...p]);
const sourceDrift={crest:Math.hypot(...P[0].map((v,i)=>v-H(crest.points.at(-1))[i])),road:Math.hypot(...P.at(-1).map((v,i)=>v-(H(road.at)[i]+(i===1?.05:0))))};
if(sourceDrift.crest>1e-5||sourceDrift.road>1e-5)throw Error('Source anchors moved: inspect and revise the one candidate before probing '+JSON.stringify(sourceDrift));
const HALF=plan.width/2,R=.3,BODY=a.HORIZON_BODY_HEIGHT,THICKNESS=.3;
const pointDistance=(p,q)=>Math.hypot(p[0]-q[0],p[2]-q[2]);
const near=(p,line)=>{let best=null;for(let i=1;i<line.length;i++){const u=line[i-1],v=line[i],dx=v[0]-u[0],dz=v[2]-u[2],t=Math.max(0,Math.min(1,((p[0]-u[0])*dx+(p[2]-u[2])*dz)/(dx*dx+dz*dz||1))),q=u.map((x,k)=>x+t*(v[k]-x)),d=pointDistance(p,q);if(!best||d<best.distance)best={distance:d,at:q,segment:i-1,t};}return best;};
const bounds={minX:Math.min(...P.map(p=>p[0]))-4,maxX:Math.max(...P.map(p=>p[0]))+4,minZ:Math.min(...P.map(p=>p[2]))-4,maxZ:Math.max(...P.map(p=>p[2]))+4};
const relevant=points=>points.some(p=>p[0]>=bounds.minX-15&&p[0]<=bounds.maxX+15&&p[2]>=bounds.minZ-15&&p[2]<=bounds.maxZ+15);
const paths=a.MOUNTAIN_PATH_GRAPH.edges.map(e=>({...e,points:e.points.map(H)})).filter(e=>relevant(e.points));
const surfaces=a.REGION_SURFACES.filter(s=>relevant(s.points.map(H))).map(s=>({surface:s,exact:s.landingRows?a.drawnRoadFloor(s.landingRows):null}));
const branch=a.SKILL_BRANCHES.find(s=>s.id==='dam-promenade');
if(!branch?.landingRows)throw Error('Current exact dam branch landing rows are required; no coarse-band fallback.');
const branchExact=a.drawnRoadFloor(branch.landingRows),roadExact=a.drawnRoadFloor(a.REGION_ROAD.landingRows);
const stations=[],parts=[];let arc=0;
for(let i=1;i<P.length;i++){const p=P[i-1],q=P[i],dx=q[0]-p[0],dz=q[2]-p[2],length=Math.hypot(dx,dz),n=Math.ceil(length/.1),grade=(q[1]-p[1])/length;
 const part={segment:i-1,from:arc,to:arc+length,grade,steps:i<=2?Math.ceil(Math.abs(q[1]-p[1])/.17):0,insideExistingRoad:i===P.length-1};parts.push(part);
 for(let k=0;k<=n;k++){const t=k/n,at=p.map((v,j)=>v+t*(q[j]-v)),treadY=part.steps?p[1]+(q[1]-p[1])*Math.min(part.steps,Math.floor(t*part.steps+1e-10))/part.steps:at[1];stations.push({s:arc+t*length,segment:i-1,t,at,normal:[-dz/length,dx/length],travel:[dx/length,dz/length],treadY,insideExistingRoad:part.insideExistingRoad});}arc+=length;}
// Both one-sided section frames at every turn remain in stations. Sample the whole
// corner landing disk too, so a sharp bend cannot hide an outside-width intrusion.
const locations=[];
for(const st of stations)for(const lateral of [-HALF,-HALF+.15,-HALF+R,-.6,0,.6,HALF-R,HALF-.15,HALF]){
 const p=[st.at[0]+st.normal[0]*lateral,st.at[1],st.at[2]+st.normal[1]*lateral];locations.push({...st,at:p,lateral,kind:'section',bodyCheck:Math.abs(lateral)<=HALF-R+1e-9});
}
for(let i=1;i<P.length-1;i++)for(const radius of [0,.45,.9,HALF])for(let k=0;k<(radius?24:1);k++){
 const angle=k/24*Math.PI*2,p=P[i];locations.push({s:parts[i-1].to,segment:i-1,t:1,at:[p[0]+Math.cos(angle)*radius,p[1],p[2]+Math.sin(angle)*radius],treadY:p[1],normal:null,travel:[1,0],lateral:radius,kind:'turn-landing',bodyCheck:radius<=HALF-R+1e-9,insideExistingRoad:i===P.length-2});
}
const finite=v=>Number.isFinite(v)?v:null;
function context(p,bodyCheck,travel){
 const [x,y,z]=p,[nx,ny,nz]=N(p),nativeGround=a.groundHeightAt(nx,nz)+O.y,ground=g.ground(x,z),floor=g.surface(x,z,y,.48),ceiling=g.ceiling(x,z,y),water=g.waterLevel(x,z,y),directWater=region.waterLevel(x,z);
 const otherDecks=[];
 for(const {surface,exact} of surfaces){const q=exact?exact(nx,nz):a.worldDeckAt(surface,nx,nz);if(!q)continue;const actual=q.y??q.point[1];if(!exact&&q.distance>q.halfWidth+1e-6)continue;otherDecks.push({id:surface.id,y:actual+O.y,exactTriangles:!!exact,drawTopLift:surface.id==='mountain-road'||surface.id==='orchard-lane'?.05:surface.kind==='branch'?.02:0});}
 const contacts=bodyCheck?{stationary:g.contact(x,z,y,R),forward:g.contact(x,z,y,R,travel),reverse:g.contact(x,z,y,R,[-travel[0],-travel[1]]),native:a.worldCollisionAt(nx,ny,nz,R)}:null;
 const bodyBelow=otherDecks.filter(d=>d.y>y+.48&&d.y-.28-y<BODY),coveredLower=otherDecks.filter(d=>d.y<y-.48).map(d=>({...d,newUndersideClearance:y-THICKNESS-d.y,requiresOpenBay:true}));
 const roadFloor=roadExact(nx,nz),branchFloor=branchExact(nx,nz);
 return{nativeGround,ground,bakedGround:a.sampleTerrain(field,x,z),floor,ceiling:finite(ceiling),headroom:finite(ceiling-y),water,directWater,waterFreeboard:directWater===null?null:y-directWater,terrainIntrusion:Math.max(0,ground-y),supportDepth:Math.max(0,y-THICKNESS-ground),contacts,otherDecks,bodyBelow,coveredLower,road:roadFloor?{...roadFloor,y:roadFloor.y+O.y,drawnY:roadFloor.y+O.y+.05}:null,branch:branchFloor?{...branchFloor,y:branchFloor.y+O.y,drawnY:branchFloor.y+O.y+.02}:null};
}
const samples=locations.map(q=>{const smooth=context(q.at,q.bodyCheck,q.travel),tread=q.treadY!==q.at[1]?context([q.at[0],q.treadY,q.at[2]],q.bodyCheck,q.travel):smooth;return{...q,smooth,tread};});
const lowerPathChecks=[];
// Existing routes are not declared walkable from names or metadata alone. Record
// original source height AND actual composed support/headroom/contact/water.
for(const st of stations.filter(s=>!s.insideExistingRoad))for(const path of paths){
 const p=near(st.at,path.points);if(!p||p.distance>HALF+path.halfWidth+R)continue;
 const c=context(p.at,true,st.travel);lowerPathChecks.push({connectorStation:st.s,pathId:path.id,pathKind:path.kind,sourceAt:p.at,planDistance:p.distance,sourceUndersideClearance:st.at[1]-THICKNESS-p.at[1],actual:c,actualUndersideClearance:c.floor?st.at[1]-THICKNESS-c.floor.y:null,mayBeBlockedBySolidFill:c.floor!==null&&c.floor.y<st.at[1]-.48});
}
const footings=[];
for(let s=0;s<parts.at(-1).from;s+=3){const st=stations.reduce((best,q)=>Math.abs(q.s-s)<Math.abs(best.s-s)?q:best);for(const side of [-1,1]){
 const lateral=side*(HALF-.25),p=[st.at[0]+st.normal[0]*lateral,st.at[1],st.at[2]+st.normal[1]*lateral],ctx=context(p,false,st.travel),bottom=ctx.ground-.3,top=p[1]-THICKNESS;
 const pathConflicts=paths.map(path=>({path,p:near(p,path.points)})).filter(({path,p})=>p&&p.distance<=path.halfWidth+.18+R&&p.at[1]+BODY>bottom&&p.at[1]<top).map(({path,p})=>({id:path.id,kind:path.kind,at:p.at,planDistance:p.distance}));
 footings.push({s:st.s,side,at:p,bottom,top,height:Math.max(0,top-bottom),water:ctx.directWater,submergedFooting:ctx.directWater!==null&&bottom<ctx.directWater,underDecks:ctx.coveredLower,pathConflicts});
}}
const hard=[];
for(const q of samples){if(q.insideExistingRoad)continue;for(const mode of ['smooth','tread']){const c=q[mode],why=[];
 if(c.terrainIntrusion>.02)why.push('terrain-above-proposed-floor');
 if(c.directWater!==null&&c.directWater>q.at[1]-(mode==='tread'?q.at[1]-q.treadY:0)+.02)why.push('submerged-floor');
 if(c.headroom!==null&&c.headroom<BODY)why.push('headroom');
 if(q.bodyCheck&&[c.contacts?.stationary,c.contacts?.forward,c.contacts?.reverse].some(Boolean))why.push('existing-body-contact');
 if(c.bodyBelow.length)why.push('existing-upper-deck');
 if(c.coveredLower.some(d=>d.newUndersideClearance<BODY))why.push('would-block-lower-deck');
 if(why.length)hard.push({s:q.s,kind:q.kind,lateral:q.lateral,at:q.at,mode,why,context:c});
}}
const spanRuns=[];let run=null;
for(const st of stations.filter(s=>!s.insideExistingRoad)){
 const row=samples.filter(q=>q.kind==='section'&&q.segment===st.segment&&q.t===st.t),open=row.length&&row.every(q=>q.smooth.supportDepth>1),wet=row.some(q=>q.smooth.directWater!==null);
 if(open){if(!run)run={from:st.s,to:st.s,maxDepth:0,overWater:false};run.to=st.s;run.maxDepth=Math.max(run.maxDepth,...row.map(q=>q.smooth.supportDepth));run.overWater||=wet;}else if(run){spanRuns.push({...run,length:run.to-run.from});run=null;}
}if(run)spanRuns.push({...run,length:run.to-run.from});
const bridgeLike=spanRuns.filter(r=>r.length>6||r.overWater),flaggedFootings=footings.filter(f=>f.pathConflicts.length||f.underDecks.length);
const max=(get)=>Math.max(...samples.filter(q=>!q.insideExistingRoad).map(get)),report={
 status:'ENVELOPE FEASIBILITY ONLY; NO CONSTRUCTED CANDIDATE OR CONTROLLER PASS',createdAt:new Date().toISOString(),worldSha256:sha(raw),terrainSha256:sha(terrain),runtimeBundleSha256:sha(bundle.outputFiles[0].text),candidatePlanSha256:sha(readFileSync('/tmp/promenade-east-bank-plan.json')),sourceDrift,
 actualCrest:{id:crest.id,points:crest.points.map(H),halfWidth:crest.halfWidth},points:P,width:plan.width,parts,
 contracts:{bodyHeight:BODY,bodyRadius:R,stepHeight:a.HORIZON_STEP_HEIGHT,walkableDegrees:a.HORIZON_WALKABLE_DEGREES,proposedDeckThickness:THICKNESS,nativeRoadUnchanged:true,nativeKerbUnchanged:true,kerbTopAboveQueryRoad:.22,kerbTopAbovePaintedRoad:.17},
 summary:{samples:samples.length,hardFailures:hard.length,maxTerrainIntrusion:max(q=>q.smooth.terrainIntrusion),maxSupportDepth:max(q=>q.smooth.supportDepth),maxNativeVsHorizonGroundDifference:max(q=>Math.abs(q.smooth.nativeGround-q.smooth.ground)),minimumFiniteHeadroom:Math.min(...samples.map(q=>q.smooth.headroom??Infinity)),lowerPathChecks:lowerPathChecks.length,flaggedFootings:flaggedFootings.length,bridgeLikeRuns:bridgeLike.length},
 bridgeLikeRuns:bridgeLike,spanRuns,footings,lowerPathChecks,failures:hard,samples,
 currentBranch:{id:branch.id,landingRows:branch.landingRows.map(row=>row.map(H)),segments:branch.segments.map(s=>({kind:s.kind,points:s.points.map(H),landingRows:s.landingRows?.map(row=>row.map(H))}))},
 limitations:['This is the one candidate plan, not a built connector. Existing-floor mismatch is expected where new support is owed; terrain intrusion is a separate failure.','Tread envelopes quantize first two climbs at<=.17m rise, without yet adding flight-end level landings or a complete corner mesh. Smooth and tread conflicts are both retained.','Exact branch landing rows and current native APIs are used; no coarse snapshot band is substituted.','Existing kerb is preserved; its drawn .22m top is reported separately because it is absent from native body EDGE_SOLIDS. Do not claim a physical step pass from an absent query shape.','Support columns are conservative proposed .36m footprints every3m, not finished structural art. Any flagged lower route needs an open bay or moved footing, never silent solid fill.','Any long unsupported or water-crossing run is flagged for an explicit span/support contract; no landmark span is authorized by this probe.','Actual ground draw lattice, a closed candidate mesh, highest face/grade/closure, real walking both directions and captures remain required before acceptance.']};
writeFileSync(join(OUT,'results.json'),JSON.stringify(report,null,2));writeFileSync(join(OUT,'summary.json'),JSON.stringify({...report,samples:undefined,failures:hard.slice(0,15),lowerPathChecks:undefined,currentBranch:undefined},null,2));
console.log(JSON.stringify(report.summary,null,2));
