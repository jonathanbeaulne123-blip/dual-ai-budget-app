// Phase 0, read-only review poses. Headless SwiftShader, never device evidence.
import {chromium} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const out=resolve('docs/horizon/evidence/mountain-road/before/captures');mkdirSync(out,{recursive:true});
const inv=JSON.parse(readFileSync('docs/horizon/evidence/mountain-road/before/inventory.json'));
const world=JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json'));
const poses=[];
const road=world.beds.find(b=>b.id==='mountainV2.road').points,v03=world.beds.find(b=>b.id==='V03').points;
function rider(id,at,points=road){const ix=points.reduce((a,p,i)=>Math.hypot(p[0]-at[0],p[2]-at[2])<Math.hypot(points[a][0]-at[0],points[a][2]-at[2])?i:a,0);const a=points[Math.max(0,ix-2)],b=points[Math.min(points.length-1,ix+2)],l=Math.hypot(b[0]-a[0],b[2]-a[2])||1;const dx=(b[0]-a[0])/l,dz=(b[2]-a[2])/l;poses.push({id,eye:[at[0]-dx*6,at[1]+1.9,at[2]-dz*6],target:[at[0]+dx*15,at[1]+1.9,at[2]+dz*15],kind:'rider-height',at});}
for(const j of inv.joins)rider(j.id,j.at,/Prow|V03|Canal/.test(j.id)?v03:road);
for(const h of inv.hairpins)rider(h.id,h.at);
for(const [id,x] of [['tunnel-east',1477.95],['tunnel-west',1404.85]]){const p=v03.reduce((a,p)=>Math.abs(p[0]-x)<Math.abs(a[0]-x)?p:a,v03[0]);rider(id,p,v03);}
for(const [id,p] of [['blocker-foot',[1281.47,54.87,717.04]],['blocker-ore-portal',[1350.46,66.9,681.95]],['blocker-library',[1386.69,87.64,597.86]],['blocker-dam',[1286.49,123.85,541.57]]])rider(id,p);
poses.push(...[
{id:'stillwater-gap',eye:[1275,64,715],target:[1200,54,765]},
{id:'hollow-gap',eye:[1238,105,630],target:[1000,40,600]},
{id:'north-throat-gap',eye:[1330,164,450],target:[1300,110,300]},
{id:'shoulder-gap',eye:[1390,92,628],target:[1450,69,650]},
{id:'scholars-gap',eye:[1220,123,565],target:[940,46,460]},
{id:'undercroft-context',eye:[1120,105,570],target:[1090,40,540]},
{id:'chain-aerial',eye:[1630,450,1010],target:[1320,100,605]},
].map(p=>({...p,kind:'gap-overview'})));
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const savedPath=resolve(out,'captures.json');const saved=existsSync(savedPath)?JSON.parse(readFileSync(savedPath)):{};
const records=saved.records??[],errors=saved.errors??[];const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const save=()=>writeFileSync(resolve(out,'captures.json'),JSON.stringify({sha,method:'headless Chromium SwiftShader; static camera poses; not real controller or device evidence',limits:['rider-height labels are nominal: eye is anchor y+1.9, shifted 6m back without surface seating','sun fields record the URL request; stats.inspector.clock is the observed clock, which differs on reduced-motion captures','native bridge anchors use nearest exported samples, not exact abutments'],records,errors},null,2));
try{const page=await browser.newPage({viewport:{width:640,height:420},reducedMotion:'reduce',timezoneId:'America/Toronto'});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5209/horizon-review.html?world=horizon&tier=full&theme=classic&date=2026-06-21&sun=13:00&diagnostics=1');
await page.waitForFunction(()=>window.__harbour?.stats().firstInteractiveMs!==null&&!!window.__harbour,null,{timeout:180000});
await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls{visibility:hidden!important}'});
for(const p of poses.filter(p=>!records.some(r=>r.id===p.id))){try{await page.evaluate(p=>{const h=window.__harbour;h.world.views.push({...p,label:p.id,fovDegrees:58,radius:240,portrait:null});h.shot(p.id);},p);
await page.evaluate(()=>window.__harbour.settle(300000));await page.waitForTimeout(1200);
const stats=await page.evaluate(()=>{const h=window.__harbour,s=h.stats();return{region:s.region,render:s.drawSamples?.at(-1),resident:s.chunks?.resident,pending:s.stream?.at(-1)?.pending,inspector:h.inspect?.()};});
const file=p.id.replace(/[^a-z0-9-]/gi,'-')+'.jpg';await page.locator('.horizon-stage canvas').screenshot({path:resolve(out,file),type:'jpeg',quality:83,timeout:60000});records.push({...p,file,viewport:{width:640,height:420},reducedMotion:true,theme:'classic',tier:'full',sun:'13:00',stats});save();console.log(file);
}catch(e){errors.push(p.id+': '+e.message);save();}}
}catch(e){errors.push('run: '+e.message);save();console.error(e.message);}finally{await browser.close();save();}
