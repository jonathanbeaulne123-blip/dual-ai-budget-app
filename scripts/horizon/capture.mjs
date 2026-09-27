import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const output=resolve(process.argv[2]??'/tmp/horizon-captures'),url=process.env.HORIZON_REVIEW_URL??'http://127.0.0.1:5197',modulePath=resolve(tmpdir(),`horizon-capture-${process.pid}.mjs`);
await mkdir(resolve(output,'pages'),{recursive:true});await mkdir(resolve(output,'perf'),{recursive:true});
await build({entryPoints:['scripts/horizon/capture-entry.ts'],outfile:modulePath,bundle:true,format:'esm',platform:'node',logLevel:'warning'});
const {solarPosition,solarReviewDate}=await import(pathToFileURL(modulePath).href);await unlink(modulePath);
const date='2026-06-21',zone='America/Toronto',reference=new Date(`${date}T12:00:00-04:00`),sun=solarPosition(reference,{timeZone:zone}),world=JSON.parse(await readFile('public/horizon/world/horizon-geo-1.json','utf8'));
const clocks={'dawn':sun.sunrise,'morning':sun.sunrise+180,'noon':sun.solarNoon,'afternoon':sun.solarNoon+180,'golden hour':sun.sunset-60,'sunset':sun.sunset,'dusk':sun.sunset+30,'night':22*60};
const clock=word=>{const minutes=Math.round(clocks[word.replace(/\s*\(.*\)/,'')]);if(!Number.isFinite(minutes))throw new Error(`Unknown best-hour word ${word}`);return`${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;};
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),terrainSha=createHash('sha256').update(await readFile('public/horizon/terrain/horizon-geo-1.bin')).digest('hex');
const lightShots=[];
const browser=await chromium.launch({headless:true,...(process.env.HORIZON_CAPTURE_GPU==='metal'?{args:['--use-angle=metal','--enable-gpu']}: {})}),records=[],errors=[];
try{
 for(const tier of ['full','lite']){
  const page=await browser.newPage({viewport:tier==='full'?{width:1440,height:900}:{width:390,height:844},timezoneId:zone,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push({tier,error:e.message}));
  await page.goto(`${url}/horizon-review.html?world=horizon&tier=${tier}&date=${date}&sun=13:02`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:120000});
  await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls{visibility:hidden!important}'});
  for(const view of world.views.filter(v=>!process.env.HORIZON_PAGES||process.env.HORIZON_PAGES.split(',').includes(v.id))){
   for(const [role,word]of [['best',view.bestHour],['also',view.also]]){
    const hhmm=clock(word),iso=solarReviewDate(reference,`?date=${date}&sun=${hhmm}`,{dev:true,timeZone:zone}).toISOString();
    await page.evaluate(({id,iso})=>{window.__harbour.shot(id);window.__harbour.setDate(new Date(iso));},{id:view.id,iso});
    // Delayed district eviction is part of the runtime: retain its real 4-second grace period.
    await page.waitForTimeout(5300);
    await page.waitForFunction(()=>{const s=window.__harbour.stats();return s.stream.at(-1)?.pending.length===0;},null,{timeout:30000});
    const file=`${view.id}_${hhmm.replace(':','-')}_classic_${tier}.png`;
    await page.locator('.horizon-stage canvas').screenshot({path:resolve(output,'pages',file),timeout:120000});
    const stats=await page.evaluate(()=>window.__harbour.stats());
    const record={file,id:view.id,label:view.label,tier,role,word,clock:hhmm,date,timeZone:zone,pose:{eye:view.eye,target:view.target,fovDegrees:view.fovDegrees,portrait:view.portrait,camera:stats.camera},proof:view.proof,renderer:stats.renderer,firstInteractiveMs:stats.firstInteractiveMs,assetLoadMs:stats.assetLoadMs,frameIntervals:stats.frames.slice(-20),draw:stats.drawSamples.at(-1),stream:stats.stream.slice(-5)};
    records.push(record);console.log(JSON.stringify({file,draw:record.draw,projectionPass:view.proof?.pass}));
   }
  }
  // The review's light probes on the same page (P28 night at 02:00 on the phone; P29 page A at 09:00 and 17:00 on the laptop).
  const extra=tier==='lite'?[['A','02:00'],['C','02:00'],['L','02:00']]:[['A','09:00'],['A','17:00']];
  for(const [id,hhmm] of extra){
   const iso=solarReviewDate(reference,`?date=${date}&sun=${hhmm}`,{dev:true,timeZone:zone}).toISOString();
   await page.evaluate(({id,iso})=>{window.__harbour.shot(id);window.__harbour.setDate(new Date(iso));},{id,iso});
   await page.waitForTimeout(5300);
   await page.waitForFunction(()=>{const s=window.__harbour.stats();return s.stream.at(-1)?.pending.length===0;},null,{timeout:30000});
   const file=`${id}_${hhmm.replace(':','-')}_light_${tier}.png`;
   await page.locator('.horizon-stage canvas').screenshot({path:resolve(output,'pages',file),timeout:120000});
   lightShots.push({file,id,tier,clock:hhmm,camera:(await page.evaluate(()=>window.__harbour.stats())).camera});
  }
  await page.close();
 }
 await writeFile(resolve(output,'pages','captures.json'),JSON.stringify({sha,workingTreeClean:!dirty,terrainSha,clockRule:'LIGHT §1; nearest minute, 21 June 2026, America/Toronto. Night=22:00. Portrait (390 × 844) holds the page’s horizontal FOV (MANIFEST v1.7 viewRule.portrait: portrait.fov_deg ≥ 45°, portrait.target); landscape keeps the 16:9 vertical FOV.',solarReference:sun,records,errors},null,2));
 const verdicts=['# Greybox page captures','',`Revision ${world.geographyRevision}; source ${sha}; clean ${!dirty}; terrain SHA-256 ${terrainSha}.`,'','Automated geometric verdicts are not Jonathan’s visual approval. Portrait framing must also be judged from its image. Page descriptions referring to future props, planting or vehicles retain an explicit deferred-subject list.','',...records.map(r=>{const q=r.proof,ok=r.tier==='lite'?q?.passPortrait:q?.passLandscape;return`- ${r.file}: ID-buffer proof ${ok?'passes':'FAILS'} (${r.tier==='lite'?'portrait':'16:9'}); ${(q?.subjects??[]).map(s=>`${s.id} ${r.tier==='lite'?s.portraitPixels??'–':s.pixels} px`).join(', ')}; visual review pending.`;})];
 await writeFile(resolve(output,'pages','VERDICTS.md'),verdicts.join('\n')+'\n');
 await writeFile(resolve(output,'perf','capture-performance.json'),JSON.stringify({sha,terrainSha,method:'Automated headless Chromium; renderer recorded per page. Software renderer timings do not establish physical Mac/iPhone acceptance.',records:records.map(({proof,pose,...r})=>r)},null,2));
}finally{await browser.close();}
// P28 (night value and lip contrast) and P29 (shade that moves) on the captures above, classed by the world ray caster
// from the runtime camera: the delivery measures what the review measured (Auditor 5; LIGHT §4, §2).
{const sharp=(await import('sharp')).default,entry=resolve(tmpdir(),`horizon-capture-ray-${process.pid}.mjs`);
 await build({stdin:{contents:"export {createRayCaster} from './src/harbour/horizon/world/raycast.ts';export {decodeTerrainAsset} from './src/harbour/horizon/land/terrain/asset.ts';",resolveDir:process.cwd(),loader:'ts'},outfile:entry,bundle:true,platform:'node',format:'esm',logLevel:'warning'});
 const {createRayCaster,decodeTerrainAsset}=await import(pathToFileURL(entry).href);await unlink(entry);
 const bin=await readFile('public/horizon/terrain/horizon-geo-1.bin'),field=decodeTerrainAsset(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),'full'),ray=createRayCaster(field,{solids:world.geometry.solids,waters:world.collision.waters,mouths:world.collision.mouths});
 const lin=c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;},Y=(d,i)=>.2126*lin(d[i])+.7152*lin(d[i+1])+.0722*lin(d[i+2]),Lstar=y=>y>.008856?116*Math.cbrt(y)-16:903.3*y;
 const load=async shot=>{const {data,info}=await sharp(resolve(output,'pages',shot.file)).removeAlpha().raw().toBuffer({resolveWithObject:true});const c=shot.camera,eye=c.eye;let f=c.target.map((t,i)=>t-eye[i]);const fl=Math.hypot(...f);f=f.map(a=>a/fl);const hz=Math.hypot(f[0],f[2]),r=[-f[2]/hz,0,f[0]/hz],u=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]],vtan=Math.tan(c.fov*Math.PI/360),htan=vtan*info.width/info.height;
  return {data,W:info.width,H:info.height,hit:(px,py)=>{const nx=(px+.5)/info.width*2-1,ny=1-(py+.5)/info.height*2;let d=[0,1,2].map(k=>f[k]+r[k]*nx*htan+u[k]*ny*vtan);const dl=Math.hypot(...d);d=d.map(a=>a/dl);return ray.first(eye,d,400);}};};
 const p28=[];for(const shot of lightShots.filter(q=>q.clock==='02:00')){const {data,W,H,hit}=await load(shot),hist=new Array(101).fill(0);for(let i=0;i<W*H;i++)hist[Math.max(0,Math.min(100,Math.round(Lstar(Y(data,i*3)))))]++;
  const mode=hist.indexOf(Math.max(...hist));let acc=0,median=0;for(let k=0;k<=100;k++){acc+=hist[k];if(acc>=W*H/2){median=k;break;}}
  const Sx=2,GW=Math.floor(W/Sx),GH=Math.floor(H/Sx),cls=new Array(GW*GH).fill('');for(let gy=0;gy<GH;gy++)for(let gx=0;gx<GW;gx++){const h=hit(gx*Sx+1,gy*Sx+1);cls[gy*GW+gx]=h.kind!=='solid'?h.kind:/marker/.test(h.id)?'marker':/edges|kerbs|parapet|rails|retaining/.test(h.id)?'edge':'solid';}
  const contrast={};for(const c of ['marker','edge']){const ratios=[];for(let gy=2;gy<GH-2;gy++)for(let gx=2;gx<GW-2;gx++){if(cls[gy*GW+gx]!==c)continue;let nb=null;for(const [dx,dy] of [[0,2],[0,-2],[2,0],[-2,0],[0,3],[3,0]]){const k=(gy+dy)*GW+gx+dx;if(cls[k]&&cls[k]!==c){nb=k;break;}}if(nb===null)continue;const a=Y(data,((gy*Sx+1)*W+gx*Sx+1)*3),b=Y(data,((Math.floor(nb/GW)*Sx+1)*W+(nb%GW)*Sx+1)*3);ratios.push((Math.max(a,b)+.05)/(Math.min(a,b)+.05));}
   ratios.sort((a,b)=>a-b);contrast[c]=ratios.length?{n:ratios.length,median:+ratios[Math.floor(ratios.length/2)].toFixed(2),shareBelow3:+(ratios.filter(x=>x<3).length/ratios.length).toFixed(3)}:{n:0};}
  p28.push({file:shot.file,id:shot.id,mode,median,modeIn12to35:mode>=12&&mode<=35,contrast,edgeLip3to1:contrast.edge.n?contrast.edge.median>=3:null});}
 let p29=null;const [a9,a17]=['09:00','17:00'].map(c=>lightShots.find(q=>q.id==='A'&&q.clock===c));
 if(a9&&a17){const A=await load(a9),B=await load(a17),L=(d,i)=>Lstar(Y(d,i)),la=[],lb=[],ids=[];for(let y=Math.floor(A.H*.35);y<A.H;y+=2)for(let x=0;x<A.W;x+=2){const i=(y*A.W+x)*3;la.push(L(A.data,i));lb.push(L(B.data,i));const h=A.hit(x,y);ids.push(h.kind==='solid'?h.sourceId.split('.').slice(0,2).join('.'):h.kind);}
  const med=v=>[...v].sort((p,q)=>p-q)[Math.floor(v.length/2)],ma=med(la),mb=med(lb),J=keep=>{let n1=0,n2=0,both=0;for(let k=0;k<la.length;k++){if(!keep(ids[k]))continue;const da=la[k]<ma-12,db=lb[k]<mb-12;n1+=da;n2+=db;both+=da&&db;}return +(both/(n1+n2-both||1)).toFixed(3);};
  const shared={};let changed=0;for(let k=0;k<la.length;k++){if(la[k]<ma-12&&lb[k]<mb-12)shared[ids[k]]=(shared[ids[k]]??0)+1;if(Math.abs((la[k]-ma)-(lb[k]-mb))>8)changed++;}const total=Object.values(shared).reduce((q,v)=>q+v,0)||1;
  p29={files:[a9.file,a17.file],shadeShare09:+(la.filter(v=>v<ma-12).length/la.length).toFixed(3),shadeShare17:+(lb.filter(v=>v<mb-12).length/lb.length).toFixed(3),shadeOverlapJaccard:J(()=>true),withoutHosts:J(id=>!id.startsWith('host.')),terrainOnly:J(id=>id==='terrain'),pixelsChanged:+(changed/la.length).toFixed(3),sharedShadeByFirstHit:Object.fromEntries(Object.entries(shared).sort((p,q)=>q[1]-p[1]).slice(0,8).map(([k,v])=>[k,+(v/total).toFixed(3)])),pass:J(()=>true)<=.6};}
 await writeFile(resolve(output,'pages','light-probes.json'),JSON.stringify({sha,terrainSha,method:'P28: 02:00 21 June lite 390×844, CIE L* histogram mode/median (12–35) and edge-lip contrast (median ≥ 3:1) of ID-classed edge pixels (world ray caster, runtime camera) against their neighbours. P29: page A full at 09:00 vs 17:00, lower 65 %: shade = L* 12 below the frame median; Jaccard of the shade sets ≤ 0.6, with the shared shade by first-hit id.',p28,p29},null,2));
 console.log(JSON.stringify({p28:p28.map(r=>({id:r.id,mode:r.mode,edge:r.contrast.edge.median})),p29:p29&&{J:p29.shadeOverlapJaccard,withoutHosts:p29.withoutHosts}}));}
