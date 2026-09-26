#!/usr/bin/env node
// Local builder evidence only. Run from the final, clean Horizon checkout.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const args=process.argv.slice(2),option=(key,fallback)=>{const n=args.indexOf(key);return n<0?fallback:args[n+1];};
if(args.includes('--help')){
 console.log('Usage: node /tmp/horizon-extra-evidence.mjs [--root CHECKOUT] [--out DIRECTORY] [--url http://127.0.0.1:5197] [--allow-dirty] [--plan-only]\nRequires the existing development review server. Outputs pages/, probes/, perf/, index.html and run.json. Default requires a clean checkout; --allow-dirty labels builder-only evidence. --plan-only checks the baked definition and prints planned captures without launching a browser.');
 process.exit(0);
}
const root=resolve(option('--root',process.cwd())),output=resolve(option('--out',`/tmp/horizon-extra-evidence-${new Date().toISOString().replace(/[:.]/g,'-')}`)),base=option('--url','http://127.0.0.1:5197');
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname))throw Error('This evidence helper only uses the local review server.');
const require=createRequire(join(root,'package.json')),{chromium}=require('@playwright/test');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...parameters)=>execFileSync('git',parameters,{cwd:root,encoding:'utf8'}).trim();
const snapshot=()=>({head:git('rev-parse','HEAD'),status:git('status','--porcelain'),diffSha:sha(git('diff','--binary','HEAD'))});
const startState=snapshot(),worldBytes=await readFile(join(root,'public/horizon/world/horizon-geo-1.json')),world=JSON.parse(worldBytes);
const artifactHashes={world:sha(worldBytes),terrain:sha(await readFile(join(root,'public/horizon/terrain/horizon-geo-1.bin'))),cards:sha(await readFile(join(root,'public/horizon/world/horizon-cards.json')))};
const required=(value,label)=>{if(!value)throw Error(`Missing baked ${label}`);return value;};
const namedView=id=>required(world.views.find(v=>v.id===id),`view ${id}`);
const square=required(world.collision.pads.find(p=>p.id==='town.square'),'town.square');
const span=required(world.collision.beds.find(b=>b.id==='structure.highSpan'),'High Span route');
const tunnel=required(world.collision.beds.find(b=>b.id==='prowTunnel'),'Prow Tunnel route');
const adit=required(world.underground.doors.find(d=>d.id==='adit'),'Undercroft adit');
if(world.hosts.length!==7)throw Error(`Expected seven host doors, received ${world.hosts.length}`);
const mixPoint=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function routePose(id,bed){
 const feet=mixPoint(bed.points[0],bed.points.at(-1),.25),ahead=mixPoint(bed.points[0],bed.points.at(-1),.65);
 return{id,label:id,source:`collision.beds:${bed.id}`,feet,eye:[feet[0],feet[1]+1.6,feet[2]],target:[ahead[0],ahead[1]+1.25,ahead[2]],anchors:[{id:`${bed.id}.floor`,point:feet,kind:'floor'}]};
}
const nightPoses=[
 {id:'square',label:'Square',source:'collision.pads:town.square',feet:square.centre,eye:[square.centre[0],square.centre[1]+1.6,square.centre[2]],target:[square.centre[0]-15,square.centre[1]+1.2,square.centre[2]-20],anchors:[{id:'square.floor',kind:'floor',point:[square.centre[0]-2,square.centre[1],square.centre[2]-3]}]},
 routePose('bridge-high-span',span),routePose('tunnel-prow',tunnel),
 {id:'undercroft-deep',label:'Undercroft / the Deep',source:'world.views:G',shot:'G',anchors:[{id:'deep-jetty.floor',kind:'floor',point:[1300,required(world.collision.pads.find(p=>p.id==='threshold.deepJetty'),'Deep jetty').centre[1],438]}]},
 {id:'undercroft-adit',label:'Undercroft adit',source:'underground.doors:adit',feet:[adit.xy[0],adit.height,adit.xy[1]],eye:[adit.xy[0]-5,adit.height+1.6,adit.xy[1]+3],target:[adit.xy[0]+5,adit.height+1.25,adit.xy[1]-3],anchors:[{id:'adit.threshold',kind:'threshold',point:[adit.xy[0],adit.height,adit.xy[1]]}]},
 ...world.hosts.map(h=>({id:`door-${h.id}`,label:`${h.id} door`,source:`world.hosts:${h.id}.arrivalEye/arrivalTarget`,feet:h.returnAt,eye:h.arrivalEye,target:h.arrivalTarget,hostId:h.id,anchors:[{id:h.door.id,kind:'threshold',point:[h.door.xy[0],h.door.height,h.door.xy[1]]}]})),
];
const plan={comparison:['E, full, 13:02, hideBuildings=1','L0 Journey from the exact E camera, full, 13:02, hideBuildings=1'],night:nightPoses.map(p=>({id:p.id,source:p.source,eye:p.eye??namedView(p.shot).eye,target:p.target??namedView(p.shot).target})),rapidModes:{cycles:10,transitions:20,spacingMs:100},districtShots:['A','K','E','H'],clock:{date:'2026-06-21',timeZone:'America/Toronto',night:'02:00',nightIso:'2026-06-21T06:00:00.000Z'},coldWarm:'Fresh context/browser HTTP cache cleared once; then same-context reload with the actual server cache/revalidation policy.'};
if(args.includes('--plan-only')){console.log(JSON.stringify({root,startState,artifactHashes,plan},null,2));process.exit(0);}
if(startState.status&&!args.includes('--allow-dirty'))throw Error('Checkout is dirty. Commit the final candidate or explicitly use --allow-dirty for labelled builder evidence.');
for(const part of ['pages','probes','perf'])await mkdir(join(output,part),{recursive:true});
const results=[],errors=[],loads=[],network=[],pendingBodies=[];
const run={startedAt:new Date().toISOString(),root,base,startState,artifactHashes,plan,method:'Headless Chromium local builder capture. A 390 px viewport is not an iPhone. SwiftShader or other software renderer timing is not physical Mac/iPhone acceptance.',physicalDeviceAcceptance:'not performed',visualApproval:'pending',nightContrastAcceptance:'pending: paired, visibility-verified foreground/background regions for every door, marker and edge lip are not available',LstarModeAcceptance:'pending: a few visible geometric anchor pixels cannot establish a perceptual histogram mode',results,errors,loads,network};
const save=(path,value)=>writeFile(join(output,path),JSON.stringify(value,null,2)+'\n');
await save('run.json',run);
const browser=await chromium.launch({headless:true,...(process.env.HORIZON_CAPTURE_GPU==='metal'?{args:['--use-angle=metal','--enable-gpu']}: {})});
const contextOptions=tier=>({viewport:tier==='full'?{width:1440,height:900}:{width:390,height:844},deviceScaleFactor:1,timezoneId:'America/Toronto',reducedMotion:'no-preference'});
const reviewUrl=(tier,clock,hide=false)=>`${base}/horizon-review.html?world=horizon&tier=${tier}&date=2026-06-21&sun=${clock}&hideBuildings=${hide?'1':'0'}`;
const log=value=>console.log(JSON.stringify(value));
const summarise=values=>{const rows=values.filter(Number.isFinite).sort((a,b)=>a-b);return{count:rows.length,min:rows[0]??null,median:rows[Math.floor(rows.length*.5)]??null,p95:rows[Math.min(rows.length-1,Math.floor(rows.length*.95))]??null,max:rows.at(-1)??null};};
function watch(page,label){
 page.on('pageerror',error=>errors.push({label,type:'pageerror',message:error.message}));
 page.on('console',message=>{if(['error','warning'].includes(message.type()))errors.push({label,type:message.type(),message:message.text().slice(0,2000)});});
 page.on('response',response=>{
  const url=response.url();if(!/^\/horizon\/(?:world|terrain)\//.test(new URL(url).pathname))return;
  const record={label,url,status:response.status(),fromServiceWorker:response.fromServiceWorker()};network.push(record);
  pendingBodies.push((async()=>{try{const headers=await response.allHeaders();record.headers={cacheControl:headers['cache-control'],etag:headers.etag,contentEncoding:headers['content-encoding'],contentLength:headers['content-length']};if(/horizon-geo-1\.json\.gz/.test(url)){record.bodyVerification='Separate post-ready browser fetch; the decoded definition exceeds the inspector body cache.';return;}let bytes=await response.body();if(/horizon-geo-1\.json\.gz/.test(url)&&bytes[0]===31&&bytes[1]===139)bytes=gunzipSync(bytes);record.sha256=sha(bytes);record.bytes=bytes.length;const key=/\.bin/.test(url)?'terrain':/cards/.test(url)?'cards':'world';record.matchesDisk=record.sha256===artifactHashes[key];}catch(error){record.bodyError=error.message;}})());
 });
}
async function ready(page){
 await page.waitForFunction(()=>window.__harbour?.stats?.().firstInteractiveMs!=null,null,{timeout:120000});
}
async function settle(page,milliseconds=5500){
 await page.waitForTimeout(milliseconds);
 await page.waitForFunction(()=>{const s=window.__harbour.stats();return s.mode==='journey'||s.stream.at(-1)?.pending?.length===0;},null,{timeout:45000});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function recordLoad(page,label){
 const record=await page.evaluate(()=>({stats:window.__harbour.stats(),navigation:performance.getEntriesByType('navigation').map(x=>x.toJSON()),resources:performance.getEntriesByType('resource').filter(x=>/\/horizon\/(world|terrain)\//.test(x.name)).map(x=>x.toJSON())}));
 record.servedAssets=await page.evaluate(async expected=>{const rows=[];for(const [key,path] of [['world','world/horizon-geo-1.json.gz'],['terrain','terrain/horizon-geo-1.bin'],['cards','world/horizon-cards.json']]){const response=await fetch('/horizon/'+path),bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');rows.push({key,url:response.url,status:response.status,bytes:bytes.byteLength,sha256:hash,matchesDisk:hash===expected[key]});}return rows;},artifactHashes);record.assetVerificationMethod='Browser fetch after the load timings were sampled; separate from inspector response bodies. Source and on-disk hashes are also checked for stability across the complete run.';
 record.label=label;record.frameSummaryMs=summarise(record.stats.frames);record.softwareRenderer=/SwiftShader|llvmpipe|software|lavapipe/i.test(record.stats.renderer);loads.push(record);log({load:label,renderer:record.stats.renderer,assetLoadMs:record.stats.assetLoadMs,firstInteractiveMs:record.stats.firstInteractiveMs});
}
async function groundPixels(page,png,anchors){
 if(!anchors?.length)return{status:'pending',reason:'No named geometry anchors were supplied for this view.'};
 try{return await page.evaluate(async({image,anchors})=>{
  const h=window.__harbour,THREE=await import('/node_modules/three/build/three.module.js');
  const img=new Image();img.src=`data:image/png;base64,${image}`;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
  h.scene.updateMatrixWorld(true);h.camera.updateMatrixWorld(true);const meshes=[];h.scene.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;meshes.push(o);});
  const ray=new THREE.Raycaster(),linear=c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
  return{status:'descriptive-visible-pixels-only',contrastAcceptance:'pending: no validated foreground/background pair',histogramModeAcceptance:'pending',samples:anchors.map(anchor=>{
   const point=new THREE.Vector3(...anchor.point),ndc=point.clone().project(h.camera),p={...anchor,ndc:ndc.toArray()};
   if(Math.abs(ndc.x)>1||Math.abs(ndc.y)>1||ndc.z<-1||ndc.z>1)return{...p,status:'pending',reason:'Anchor outside frame'};
   ray.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),h.camera);const hit=ray.intersectObjects(meshes,false)[0];
   if(!hit||hit.point.distanceTo(point)>.3)return{...p,status:'pending',reason:'Nearest visible mesh does not verify this anchor pixel',nearestHit:hit?{point:hit.point.toArray(),distanceToAnchor:hit.point.distanceTo(point),object:hit.object.name}:null};
   const x=Math.max(0,Math.min(canvas.width-1,Math.round((ndc.x+1)*canvas.width/2))),y=Math.max(0,Math.min(canvas.height-1,Math.round((1-ndc.y)*canvas.height/2))),rgb=Array.from(ctx.getImageData(x,y,1,1).data),Y=.2126*linear(rgb[0])+.7152*linear(rgb[1])+.0722*linear(rgb[2]);
   return{...p,status:'measured',pixel:[x,y],rgba:rgb,relativeLuminance:Y,Lstar:Y>216/24389?116*Math.cbrt(Y)-16:(24389/27)*Y,hit:{point:hit.point.toArray(),distanceToAnchor:hit.point.distanceTo(point),object:hit.object.name},scope:'One actual screenshot pixel at a ray-verified geometric anchor; not a whole-door readability or contrast pass'};
  })};
 },{image:png.toString('base64'),anchors});}catch(error){return{status:'pending',reason:`Visibility-grounded pixel probe unavailable: ${error.message}`};}
}
async function capture(page,id,tier,detail={}){
 const file=`${id}_classic_${tier}.png`,png=await page.locator('.horizon-stage canvas').screenshot({path:join(output,'pages',file),timeout:120000,style:'.horizon-toolbar,.horizon-status,.horizon-touch-controls{visibility:hidden!important}'});
 const {stats,actualCamera}=await page.evaluate(()=>{const h=window.__harbour,c=h.camera;c.updateMatrixWorld(true);return{stats:h.stats(),actualCamera:{eye:c.position.toArray(),quaternion:c.quaternion.toArray(),direction:c.getWorldDirection(c.position.clone()).toArray(),projectionMatrix:c.projectionMatrix.toArray(),fov:c.fov}};}),record={id,file,tier,...detail,renderer:stats.renderer,softwareRenderer:/SwiftShader|llvmpipe|software|lavapipe/i.test(stats.renderer),camera:stats.camera,actualCamera,body:stats.body,mode:stats.mode,draw:stats.drawSamples.at(-1),shadowRequests:stats.shadowRequests??[],shadowMetric:'Invalidation requests; multiple requests in one frame may coalesce. Not certified GPU shadow passes.',frameSummaryMs:summarise(stats.frames.slice(-120)),stream:stats.stream.slice(-12),visualVerdict:'pending human review'};
 if(detail.night)record.pixelEvidence=await groundPixels(page,png,detail.anchors);
 results.push(record);await save(`probes/${id}-${tier}.json`,record);await save(`perf/${id}-${tier}.json`,{frames:stats.frames,drawSamples:stats.drawSamples,stream:stats.stream,collisionIndex:stats.collisionIndex,shadowRequests:stats.shadowRequests??[],shadowMetric:'Invalidation requests, not GPU pass counts',renderer:stats.renderer,method:run.method});
 await save('run.json',run);log({capture:file,draw:record.draw,renderer:record.renderer});return record;
}
async function fixedPose(page,pose){
 if(pose.shot){await page.evaluate(id=>window.__harbour.shot(id),pose.shot);return;}
 await page.evaluate(pose=>{const h=window.__harbour;h.shot('A');h.restore({world:'horizon:horizon-geo-1',geo:h.world.geographyRevision,place:'court',x:pose.feet[0],y:pose.feet[1],z:pose.feet[2],yaw:Math.atan2(pose.target[0]-pose.eye[0],pose.target[2]-pose.eye[2])});h.setMode('look');},pose);
 await page.waitForTimeout(1300);
 await page.evaluate(pose=>{const h=window.__harbour;h.camera.position.set(...pose.eye);h.camera.fov=50;h.camera.lookAt(...pose.target);h.camera.updateProjectionMatrix();h.setDate(new Date('2026-06-21T06:00:00.000Z'));},pose);
}
try{
 const fullContext=await browser.newContext(contextOptions('full')),full=await fullContext.newPage();watch(full,'full-comparison');const cdp=await fullContext.newCDPSession(full);await cdp.send('Network.clearBrowserCache');
 await full.goto(reviewUrl('full','13:02',true),{waitUntil:'domcontentloaded',timeout:120000});await ready(full);await settle(full);await recordLoad(full,'full-cold');
 await full.reload({waitUntil:'domcontentloaded',timeout:120000});await ready(full);await settle(full);await recordLoad(full,'full-warm-reload');
 await full.evaluate(()=>window.__harbour.shot('E'));await settle(full);const e=await capture(full,'E_13-02_hide-buildings','full',{clock:'13:02',hideBuildings:true,source:'world.views:E'});
 await full.evaluate(()=>window.__harbour.setMode('journey'));await settle(full,1500);
 await capture(full,'L0_13-02_hide-buildings_whole-island','full',{clock:'13:02',hideBuildings:true,source:'Journey L0 default whole-island camera',comparisonWith:e.file});
 await full.evaluate(camera=>{const h=window.__harbour;h.camera.position.set(...camera.eye);h.camera.fov=camera.fov;h.camera.lookAt(...camera.target);h.camera.updateProjectionMatrix();},e.camera);
 await settle(full,600);const l0=await capture(full,'L0_13-02_hide-buildings_E-camera','full',{clock:'13:02',hideBuildings:true,source:'Journey L0 with exact E eye, target and vertical FOV',comparisonWith:e.file});
 const sameCamera=['eye','quaternion','projectionMatrix'].every(k=>e.actualCamera[k].every((v,i)=>Math.abs(v-l0.actualCamera[k][i])<1e-5));
 await save('probes/E-L0-camera-parity.json',{sameCamera,E:e.actualCamera,L0:l0.actualCamera,note:'Exact camera transform and projection compare scale representations. The runtime-reported orbit target is stale after a review-only direct camera pose; actual transform is authoritative here. Silhouette/art approval remains pending.'});
 await fullContext.close();

 const liteContext=await browser.newContext(contextOptions('lite')),lite=await liteContext.newPage();watch(lite,'lite-night');const liteCdp=await liteContext.newCDPSession(lite);await liteCdp.send('Network.clearBrowserCache');
 await lite.goto(reviewUrl('lite','02:00'),{waitUntil:'domcontentloaded',timeout:120000});await ready(lite);await settle(lite);await recordLoad(lite,'lite-cold');
 await lite.reload({waitUntil:'domcontentloaded',timeout:120000});await ready(lite);await settle(lite);await recordLoad(lite,'lite-warm-reload');
 for(const pose of nightPoses){await fixedPose(lite,pose);await settle(lite);await capture(lite,`${pose.id}_02-00`,'lite',{night:true,clock:'02:00',source:pose.source,requestedPose:pose.shot?namedView(pose.shot):pose,anchors:pose.anchors,navigationProof:'Fixed geometric inspection position; not a completed walk to this destination'});}

 await lite.evaluate(feet=>{const h=window.__harbour;h.shot('A');h.restore({world:'horizon:horizon-geo-1',geo:h.world.geographyRevision,place:'court',x:feet[0],y:feet[1],z:feet[2],yaw:0});},square.centre);
 await settle(lite,1500);
 const shadowBefore=await lite.evaluate(()=>({at:performance.now(),requests:window.__harbour.stats().shadowRequests??[]}));
 const toggles=[],toggleStartedAt=Date.now();
 for(let cycle=1;cycle<=10;cycle++)for(const mode of ['Look','Walk']){await lite.getByRole('button',{name:mode,exact:true}).click();await lite.waitForTimeout(100);toggles.push(await lite.evaluate(({cycle,expected})=>{const h=window.__harbour,s=h.stats();return{cycle,expected,mode:h.mode(),time:performance.now(),body:h.body(),camera:s.camera,finite:[...s.camera.eye,...s.camera.target,...Object.values(h.body())].every(Number.isFinite),resident:s.stream.at(-1)?.resident,pending:s.stream.at(-1)?.pending};},{cycle,expected:mode.toLowerCase()}));}
 await settle(lite,1500);const finalToggle=await lite.evaluate(()=>({mode:window.__harbour.mode(),stats:window.__harbour.stats()}));
 await save('probes/rapid-walk-look.json',{cycles:10,transitions:20,requestedSpacingMs:100,wallMs:Date.now()-toggleStartedAt,toggles,shadowBefore,shadowDuringAndAfter:(finalToggle.stats.shadowRequests??[]).filter(r=>r.at>=shadowBefore.at),shadowMetric:'Invalidation requests; district loads or the regular 60-second sun cadence can legitimately request updates. Multiple same-frame requests may coalesce, so these are not certified GPU pass counts.',finiteAndModeChecks:!!toggles.length&&toggles.every(x=>x.finite&&x.mode===x.expected)&&finalToggle.mode==='walk',final:finalToggle,note:'Real UI mode buttons at a fixed body position in headless Chromium. This does not establish phone control feel.'});
 await capture(lite,'rapid-walk-look-final_02-00','lite',{clock:'02:00',night:true,anchors:nightPoses[0].anchors});

 const traversal=[];
 for(const id of plan.districtShots){await lite.evaluate(id=>window.__harbour.shot(id),id);await settle(lite);const record=await capture(lite,`district-traversal-${id}_02-00`,'lite',{clock:'02:00',source:`world.views:${id}`});traversal.push(record);}
 await save('probes/four-district-shot-traversal.json',{shots:plan.districtShots,expectedDistricts:['harbour','lakeside','crown','flats'],records:traversal,residentUnion:[...new Set(traversal.flatMap(r=>r.stream.flatMap(s=>s.resident)))],method:'Shot relocation through actual runtime streaming. No claim of walked travel between districts.'});
 await liteContext.close();
}catch(error){errors.push({type:'run-failure',message:error.stack??error.message});process.exitCode=1;}
finally{
 await Promise.allSettled(pendingBodies);await browser.close();run.finishedAt=new Date().toISOString();run.endState=snapshot();run.sourceUnchanged=run.startState.head===run.endState.head&&run.startState.status===run.endState.status&&run.startState.diffSha===run.endState.diffSha;
 run.artifactHashesEnd={world:sha(await readFile(join(root,'public/horizon/world/horizon-geo-1.json'))),terrain:sha(await readFile(join(root,'public/horizon/terrain/horizon-geo-1.bin'))),cards:sha(await readFile(join(root,'public/horizon/world/horizon-cards.json')))};
 run.artifactsUnchanged=Object.keys(artifactHashes).every(k=>artifactHashes[k]===run.artifactHashesEnd[k]);run.servedAssetsMatchDisk=loads.length===4&&loads.every(r=>r.servedAssets?.length===3&&r.servedAssets.every(a=>a.matchesDisk));run.complete=results.length===20&&!errors.some(e=>e.type==='run-failure');
 await save('run.json',run);await save('perf/cold-warm-assets.json',{method:plan.coldWarm,loads,network,softwareRendererLimit:run.method});
 const escape=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const cards=results.map(r=>`<figure><a href="pages/${r.file}"><img src="pages/${r.file}" alt="${escape(r.id)}"></a><figcaption>${escape(r.id)} · ${escape(r.renderer)} · visual approval pending</figcaption></figure>`).join('\n');
 await writeFile(join(output,'index.html'),`<!doctype html><meta charset="utf-8"><title>Horizon extra local evidence</title><style>body{font:16px system-ui;background:#f7f3e8;color:#302d26;margin:24px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0}img{width:100%;height:auto}figcaption{padding:8px 0}p{max-width:90ch}</style><h1>Horizon extra local evidence</h1><p>${escape(run.method)}</p><p>Source ${escape(startState.head)}; clean ${!startState.status}; source unchanged during capture ${run.sourceUnchanged}; served assets match disk ${run.servedAssetsMatchDisk}. Night contrast and L* histogram acceptance remain pending. Camera positions are recorded, not claimed as physical walks.</p><p><a href="run.json">Run and probe index</a> · <a href="perf/cold-warm-assets.json">Cold/warm asset and frame evidence</a></p><main>${cards}</main>`);
 log({output,complete:run.complete,sourceUnchanged:run.sourceUnchanged,servedAssetsMatchDisk:run.servedAssetsMatchDisk,captures:results.length,errors:errors.length,physicalDeviceAcceptance:'not performed'});
 if(!run.sourceUnchanged||!run.artifactsUnchanged||!run.servedAssetsMatchDisk||!run.complete)process.exitCode=1;
}
