import {captureEvidence,captureSelection} from './capture-evidence.mjs';
// Actual Horizon renderer, observed clock and physically seated review cameras.
// Headless Chromium/SwiftShader only; these images do not establish device acceptance.
import {chromium} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const authored=process.argv.includes('--authored-pages');
if(authored&&process.argv.includes('--joins'))throw new Error('Use separate output runs for authored pages and joins');
const out=resolve(process.argv.slice(2).find(x=>!x.startsWith('--'))??'docs/horizon/evidence/mountain-road/after/captures');mkdirSync(out,{recursive:false}); // A new directory prevents overwriting prior evidence.
const orientations=authored?captureSelection('ORIENTATIONS','landscape,portrait',['landscape','portrait']):['review'];
const viewports={review:{width:1100,height:720},landscape:{width:1440,height:900},portrait:{width:390,height:844}};
if(orientations.some(o=>!viewports[o]))throw new Error('Unknown capture orientation');
const worldBytes=readFileSync('public/horizon/world/horizon-geo-1.json'),world=JSON.parse(worldBytes);
const sourceFiles=['scripts/horizon/capture-mountain-finish.mjs','src/harbour/horizon/world/lens.ts','src/harbour/horizon/world/views.ts','src/harbour/horizon/runtime/index.ts','src/harbour/horizon/runtime/corridorArt.ts','src/harbour/horizon/runtime/roadLights.ts','src/harbour/horizon/runtime/corridorPlanting.ts','src/harbour/horizon/kit/road/lamps.ts','src/harbour/horizon/regions/mountainV2/geography.ts'];
const sourceHashes=Object.fromEntries(sourceFiles.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const source=JSON.parse(readFileSync('src/harbour/horizon/land/mountainV2/v2-data.json'));
const inv=JSON.parse(readFileSync('docs/horizon/evidence/mountain-road/before/inventory.json'));
const chain=world.roadChains.find(c=>c.id==='mountain-road'),road=world.beds.find(b=>b.id==='mountainV2.road').points,link=world.beds.find(b=>b.id==='spur stillwater').points;
const nearest=(points,p)=>points.reduce((a,q,i)=>Math.hypot(q[0]-p[0],q[2]-p[2])<Math.hypot(points[a][0]-p[0],points[a][2]-p[2])?i:a,0);
const rider=(id,p,points=chain.points,reverse=false)=>{
 const i=nearest(points,p),eye=points[i],direction=reverse?-1:1;let target=points[Math.max(0,Math.min(points.length-1,i+direction*4))];
 // At a route end, continue its terminal tangent. Keep the eye on the authored surface;
 // clamping both indices to the end would otherwise give the camera no look direction.
 if(Math.hypot(target[0]-eye[0],target[2]-eye[2])<.01){
  let j=i-direction;while(j>=0&&j<points.length&&Math.hypot(points[j][0]-eye[0],points[j][2]-eye[2])<.01)j-=direction;
  if(j<0||j>=points.length)throw new Error(`View ${id} has no distinct route tangent`);
  const before=points[j],distance=Math.hypot(eye[0]-before[0],eye[2]-before[2]);target=eye.map((v,k)=>v+(v-before[k])*8/distance);
 }
 return{id,eye:[...eye],target:[...target],seat:true};
};
const joins=[];
for(const j of inv.joins)for(const reverse of[false,true])joins.push(rider(j.id+(reverse?'-down':'-up'),j.at,chain.points,reverse));
for(const h of inv.hairpins)for(const reverse of[false,true])joins.push(rider(h.id+(reverse?'-down':'-up'),h.at,road,reverse));
for(const b of source.road.bridges)for(const [end,p]of [['a',b.axis[0]],['b',b.axis.at(-1)]])for(const reverse of[false,true])joins.push(rider(`${b.id}-${end}-${reverse?'down':'up'}`,p,road,reverse));
for(const mouth of world.collision.mouths.filter(m=>/^(mountainRoadTunnel|stillwaterTunnel)\.portal/.test(m.id))){const x=mouth.outline.reduce((n,p)=>n+p[0],0)/mouth.outline.length,z=mouth.outline.reduce((n,p)=>n+p[1],0)/mouth.outline.length;for(const reverse of[false,true])joins.push(rider(`${mouth.id}-${reverse?'back':'out'}`,[x,mouth.floor,z],mouth.id.startsWith('stillwater')?link:chain.points,reverse));}
for(const [id,p]of [['stillwater-foot',link[0]],['stillwater-green',link.at(-1)]])for(const reverse of[false,true])joins.push(rider(`${id}-${reverse?'back':'out'}`,p,link,reverse));
const orchard=source.nativePlanning.surfaces.find(s=>s.id==='orchard-lane').points;
for(const [id,index]of[['orchard-entry',0],['orchard-bridge-start',8],['orchard-bridge-fairing-end',26]])for(const reverse of[false,true])joins.push(rider(`${id}-${reverse?'back':'out'}`,orchard[index],orchard,reverse));
const funicularFoot=source.nativePlanning.walks.find(w=>w.id==='path:station:funicular:town~road:foot').points;
for(const reverse of[false,true])joins.push(rider(`funicular-foot-${reverse?'back':'out'}`,funicularFoot[reverse?funicularFoot.length-1:0],funicularFoot,reverse));
const matrix=[rider('library-drive',[1340,94,584],road),{id:'mountain-air',eye:[1480,290,890],target:[1260,95,625]},rider('stillwater-drive',link[Math.floor(link.length*.46)],link)];
const authoredPages=world.views.filter(v=>/^[A-L]$/.test(v.id));
if(authored&&('ABCDEFGHIJKL'.split('').some(id=>authoredPages.filter(v=>v.id===id).length!==1)))throw new Error('Expected every unique authored page A–L');
const tiers=captureSelection('TIERS','full,lite',['full','lite']),themes=captureSelection('THEMES','classic,taylor,newfoundland',['classic','taylor','newfoundland']),times=captureSelection('TIMES','day,night',['day','night']);
const evidence=captureEvidence({out,origin:process.env.HORIZON_REVIEW_URL??'http://127.0.0.1:5209',assets:['public/horizon/world/horizon-geo-1.json','public/horizon/world/horizon-geo-1.json.gz','public/horizon/terrain/horizon-geo-1.bin'],liveSources:[...sourceFiles,'src/harbour/horizon/review.tsx']});
const records=[],errors=[];let browser;
const launch=()=>chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const save=()=>writeFileSync(out+'/captures.json',JSON.stringify({method:'Actual Horizon renderer; static physically seated camera poses; headless Chromium SwiftShader, not device evidence',revision,sourceHashes,mode:authored?'authored-pages':process.argv.includes('--joins')?'joins':'matrix',viewports,authoredViews:authored?authoredPages:null,worldSha256:createHash('sha256').update(worldBytes).digest('hex'),scope:{tiers,themes,times,orientations},provenance:'provenance.json',records,errors},null,2));
try{
 await evidence.start();
 for(const tier of tiers)for(const theme of themes)for(const orientation of orientations){
  // Each variant gets a fresh GPU process: long SwiftShader sequences otherwise
  // retain context resources after page close on the8GB review machine.
  browser=await launch();
  const viewport=viewports[orientation];
  const page=await browser.newPage({viewport,timezoneId:'America/Toronto',reducedMotion:'no-preference'});await evidence.watch(page,{label:`${tier}/${theme}/${orientation}`,required:['public/horizon/world/','public/horizon/terrain/']});page.on('pageerror',e=>errors.push({tier,theme,orientation,error:e.message}));
  await page.setExtraHTTPHeaders({'Cache-Control':'no-cache'});await page.goto(`${process.env.HORIZON_REVIEW_URL??'http://127.0.0.1:5209'}/horizon-review.html?world=horizon&tier=${tier}&theme=${theme}&date=2026-06-21&sun=13:00&diagnostics=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__harbour?.stats().firstInteractiveMs!==null&&!!window.__harbour,null,{timeout:180000});
  await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls{visibility:hidden!important}'});
  for(const time of times){
   const poses=authored?authoredPages:process.argv.includes('--joins')?(tier==='full'&&theme==='classic'&&time==='day'?joins:[]):matrix;
   for(const pose of poses){
    try{
     let actual=await page.evaluate(({pose,time,authored})=>{const h=window.__harbour;if(authored){const p=h.world.views.find(v=>v.id===pose.id);if(!p)throw new Error('Missing authored page '+pose.id);for(const k of['eye','target','fovDegrees','aspect','portrait'])if(JSON.stringify(p[k])!==JSON.stringify(pose[k]))throw new Error('Served authored camera differs: '+pose.id+' '+k);if(!h.shot(p.id))throw new Error('Authored shot refused');h.setDate(new Date(time==='day'?'2026-06-21T13:00:00-04:00':'2026-06-21T23:00:00-04:00'));return{...p,paintCount:h.stats().paintCount};}const p={...pose,eye:[...pose.eye],target:[...pose.target]};if(p.seat)for(const a of[p.eye,p.target])a[1]+=1.65;
      // First arrive at the source pose so streamed/native floors become drawn.
      // Only the second, settled shot below is labelled physically seated.
      const view={...p,label:p.id,fovDegrees:58,radius:500,portrait:null},index=h.world.views.findIndex(v=>v.id===p.id);if(index<0)h.world.views.push(view);else h.world.views[index]=view;if(!h.shot(p.id))throw new Error('Review shot refused');h.setDate(new Date(time==='day'?'2026-06-21T13:00:00-04:00':'2026-06-21T23:00:00-04:00'));return{...p,paintCount:h.stats().paintCount};
     },{pose,time,authored});
     let settled=await page.evaluate(()=>window.__harbour.settle(45000));if(settled.pending?.length||settled.region?.building)throw Error('Capture did not settle: '+JSON.stringify(settled));await page.waitForTimeout(500);
     if(!authored&&pose.seat){
      actual=await page.evaluate(pose=>{const h=window.__harbour,p={...pose,eye:[...pose.eye],target:[...pose.target]},supports=[];for(const [name,a]of[['eye',p.eye],['target',p.target]]){const floor=h.geography.surface(a[0],a[2],a[1],.5);if(!floor||!Number.isFinite(floor.y))throw new Error('No settled floor beneath rider '+name);supports.push({name,x:a[0],z:a[2],floor:floor.y,surface:floor.id??null});a[1]=floor.y+1.65;}const index=h.world.views.findIndex(v=>v.id===p.id);if(index<0)throw new Error('Missing provisional review pose');h.world.views[index]={...p,label:p.id,fovDegrees:58,radius:500,portrait:null};if(!h.shot(p.id))throw new Error('Seated review shot refused');return{...p,supports,paintCount:h.stats().paintCount};},pose);
      settled=await page.evaluate(()=>window.__harbour.settle(45000));if(settled.pending?.length||settled.region?.building)throw Error('Seated capture did not settle: '+JSON.stringify(settled));
     }
     await page.waitForFunction(paints=>{const h=window.__harbour,s=h.stats(),c=h.corridorRenderStatus?.(),q=s.chunks?.queued;return !!c&&!c.building&&s.paintCount>paints+1&&!s.region?.building&&(!s.chunks||(Array.isArray(q?.route)&&Array.isArray(q?.view)&&q.route.length===0&&q.view.length===0));},actual.paintCount,{timeout:60000});const finalSettled=await page.evaluate(()=>window.__harbour.settle(1));if(finalSettled.pending?.length||finalSettled.region?.building)throw new Error('Final capture did not settle: '+JSON.stringify(finalSettled));
     const stats=await page.evaluate(()=>{const h=window.__harbour,s=h.stats();return{region:s.region,draw:s.drawSamples?.at(-1),resident:s.chunks?.resident,inspector:h.inspect?.(),clock:h.inspect?.().clock,renderer:s.renderer,lights:h.roadLights?.(),camera:s.camera,aspect:h.camera.aspect,corridor:h.corridorRenderStatus?.()};});
     const expected=time==='day'?'2026-06-21T17:00:00.000Z':'2026-06-22T03:00:00.000Z';if(stats.clock!==expected)throw new Error(`World clock ${stats.clock} does not match ${expected}`);
     if(!authored&&pose.seat){actual.seatProof=await page.evaluate(()=>{const h=window.__harbour,eye=h.camera.position,floor=h.geography.surface(eye.x,eye.z,eye.y-1.65,.5);if(!floor||Math.abs(eye.y-floor.y-1.65)>1e-6)throw new Error('Observed camera is not1.65m above its final drawn floor');return{eye:[eye.x,eye.y,eye.z],floor:floor.y,height:eye.y-floor.y};});}
     if(authored){const port=stats.aspect<1,expected=port?(pose.portrait??pose):pose;for(const k of['eye','target'])if(stats.camera[k].some((n,i)=>Math.abs(n-(expected[k]??pose[k])[i])>1e-7))throw new Error('Runtime changed authored '+k);const horizontal=port?Math.max(45,expected.fovDegrees??pose.fovDegrees):pose.fovDegrees,aspect=port?stats.aspect:(pose.aspect??16/9),fov=2*Math.atan(Math.tan(horizontal*Math.PI/360)/aspect)*180/Math.PI;if(Math.abs(stats.camera.fov-fov)>1e-7)throw new Error('Runtime changed authored FOV');}
     const file=`${theme}-${tier}-${time}-${orientation}-${pose.id.replace(/[^a-z0-9-]/gi,'-')}.jpg`;
     await page.locator('.horizon-stage canvas').screenshot({path:out+'/'+file,type:'jpeg',quality:86,timeout:60000});records.push({file,sha256:createHash('sha256').update(readFileSync(out+'/'+file)).digest('hex'),theme,tier,time,orientation,viewport,pose:actual,settled,stats});save();console.log(file);
    }catch(e){errors.push({pose:pose.id,tier,theme,time,orientation,error:e.message});save();}
   }
  }
  await evidence.preparePageClose(page);await page.close();await browser.close();browser=undefined;
 }
}catch(e){errors.push({fatal:true,error:e.message});}finally{const expected=authored?tiers.length*themes.length*times.length*orientations.length*12:process.argv.includes('--joins')?(tiers.includes('full')&&themes.includes('classic')&&times.includes('day')?joins.length:0):tiers.length*themes.length*times.length*orientations.length*matrix.length;if(!expected||records.length!==expected)errors.push({error:'Incomplete selected capture inventory',expected,actual:records.length});await evidence.finish(errors);save();await browser?.close();if(errors.length)process.exitCode=1;}
