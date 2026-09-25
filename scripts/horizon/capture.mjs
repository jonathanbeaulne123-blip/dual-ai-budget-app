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
const browser=await chromium.launch({headless:true}),records=[],errors=[];
try{
 for(const tier of ['full','lite']){
  const page=await browser.newPage({viewport:tier==='full'?{width:1440,height:900}:{width:390,height:844},timezoneId:zone,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push({tier,error:e.message}));
  await page.goto(`${url}/horizon-review.html?world=horizon&tier=${tier}&date=${date}&sun=13:02`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__harbour?.stats().firstInteractiveMs!==null&&window.__harbour?.stats,null,{timeout:120000});
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
    const record={file,id:view.id,label:view.label,tier,role,word,clock:hhmm,date,timeZone:zone,pose:{eye:view.eye,target:view.target,fovDegrees:view.fovDegrees},proof:view.proof,renderer:stats.renderer,firstInteractiveMs:stats.firstInteractiveMs,assetLoadMs:stats.assetLoadMs,frameIntervals:stats.frames.slice(-20),draw:stats.drawSamples.at(-1),stream:stats.stream.slice(-5)};
    records.push(record);console.log(JSON.stringify({file,draw:record.draw,projectionPass:view.proof?.pass}));
   }
  }
  await page.close();
 }
 await writeFile(resolve(output,'pages','captures.json'),JSON.stringify({sha,workingTreeClean:!dirty,terrainSha,clockRule:'LIGHT §1; nearest minute, 21 June 2026, America/Toronto. Night=22:00. Portrait preserves the authored vertical FOV and crops horizontal view.',solarReference:sun,records,errors},null,2));
 const verdicts=['# Greybox page captures','',`Revision ${world.geographyRevision}; source ${sha}; clean ${!dirty}; terrain SHA-256 ${terrainSha}.`,'','Automated geometric verdicts are not Jonathan’s visual approval. Portrait framing must also be judged from its image. Page descriptions referring to future props, planting or vehicles retain an explicit deferred-subject list.','',...records.map(r=>`- ${r.file}: ${r.proof?.pass?'geometric framing passes; visual review pending':'geometric framing conflict — '+r.proof?.subjects.filter(s=>!s.inFrame||s.occludedBy).map(s=>`${s.id} ${!s.inFrame?'outside frame':`occluded by ${s.occludedBy}`}`).join('; ')}.`)];
 await writeFile(resolve(output,'pages','VERDICTS.md'),verdicts.join('\n')+'\n');
 await writeFile(resolve(output,'perf','capture-performance.json'),JSON.stringify({sha,terrainSha,method:'Automated headless Chromium; renderer recorded per page. Software renderer timings do not establish physical Mac/iPhone acceptance.',records:records.map(({proof,pose,...r})=>r)},null,2));
}finally{await browser.close();}
