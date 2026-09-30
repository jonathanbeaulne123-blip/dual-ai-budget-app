/** Current bridge inventory views. Headless SwiftShader builder evidence, never device proof.
 * No runtime/source/bake writes. Proposals are not rendered here. */
import {chromium} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),opt=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const out=opt('--out','docs/horizon/evidence/bridges/before/site-views'),origin=opt('--url','http://127.0.0.1:5197');mkdirSync(out,{recursive:true});
const w=JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))),cast=JSON.parse(readFileSync('docs/horizon/evidence/bridges/design/cast.json'));
const inventory=JSON.parse(readFileSync('docs/horizon/evidence/bridges/before/static-probes/audit.json'));
const pathAt=(p,s)=>{for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],l=Math.hypot(b[0]-a[0],b[2]-a[2]);if(s<=l||i===p.length-1){const t=Math.max(0,Math.min(1,s/(l||1)));return a.map((v,k)=>v+(b[k]-v)*t);}s-=l;}return p[0];};
const records=[],errors=[],sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
const page=await browser.newPage({viewport:{width:1000,height:650},timezoneId:'America/Toronto'});page.on('pageerror',e=>errors.push(e.message));
await page.goto(origin+'/horizon-review.html?world=horizon&tier=full&date=2026-06-21&sun='+opt('--sun','13:00'),{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__harbour?.stats().firstInteractiveMs!==null&&!!window.__harbour,null,{timeout:180000});
await page.waitForFunction(()=>{const s=window.__harbour.stats();return !s.chunks||s.chunksLoaded.length===s.chunks.total;},null,{timeout:240000});
await page.evaluate(theme=>window.__harbour.setTheme(theme),opt('--theme','classic'));
await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls{visibility:hidden!important}'});
for(const theme of opt('--themes',opt('--theme','classic')).split(','))for(const sun of opt('--suns',opt('--sun','13:00')).split(',')){
await page.evaluate(({theme,sun})=>{window.__harbour.setTheme(theme);window.__harbour.setDate(new Date('2026-06-21T'+sun+':00-04:00'));},{theme,sun});
for(const c of cast){
 if(opt('--only','')&&!opt('--only','').split(',').includes(c.id))continue;
 const ss=w.geometry.solids.filter(s=>s.id.startsWith(c.id+'.')&&s.role==='deck'),p=ss.flatMap(s=>s.positions);if(!p.length){errors.push('No deck solids '+c.id);continue;}
 const axis=[0,1,2].map(k=>p.filter((_,i)=>i%3===k)),min=axis.map(a=>Math.min(...a)),max=axis.map(a=>Math.max(...a)),x=(min[0]+max[0])/2,z=(min[2]+max[2])/2,y=max[1];
 const span=Math.max(max[0]-min[0],max[2]-min[2]),distance=Math.max(45,span*.65);
 const row=inventory.rows.find(r=>r.id===c.id),bed=w.collision.beds.find(b=>b.id===row?.route);
 const deckEye=pathAt(bed.points,row.from+8),deckTarget=pathAt(bed.points,Math.min(row.to-2,row.from+28));deckEye[1]+=1.6;deckTarget[1]+=1.6;
 for(const [kind,eye,target] of [
 ['deck-height',deckEye,deckTarget],
 ['below',[x+distance*.6,Math.max(2,y-8),z+distance*.7],[x,y-1,z]],
 ['air',[x+distance*.6,y+distance*.85,z+distance*.7],[x,y,z]]]){
 if(opt('--kinds','')&&!opt('--kinds','').split(',').includes(kind))continue;
 const id='BRIDGE_BASELINE_'+c.id+'_'+kind;
 await page.evaluate(v=>{const h=window.__harbour;h.world.views.push(v);h.shot(v.id);},{id,label:c.name+' '+kind,eye,target,fovDegrees:58,aspect:1,radius:Math.max(120,span),portrait:null});
 await page.evaluate(()=>window.__harbour.settle(60000));
 await page.waitForTimeout(5500);
 let stats=await page.evaluate(()=>window.__harbour.stats());
 if(stats.stream.at(-1)?.pending?.length){await page.evaluate(()=>window.__harbour.settle(60000));await page.waitForTimeout(5500);stats=await page.evaluate(()=>window.__harbour.stats());}
 if(stats.stream.at(-1)?.pending?.length){errors.push('UNSETTLED '+c.id+' '+kind);continue;}
 const file=(args.includes('--themes')||args.includes('--suns')?theme+'-'+sun.replace(':','')+'-':'')+c.id+'-'+kind+'.png';const clip=await page.locator('.horizon-stage canvas').boundingBox();if(!clip)throw new Error('Missing stage bounds');await page.screenshot({path:out+'/'+file,clip,timeout:90000});
 const rec={id:c.id,kind,file,eye,target,bridgeArt:await page.evaluate(()=>window.__harbour.bridgeArt()),theme,sun,draw:stats.drawSamples.at(-1),pending:stats.stream.at(-1)?.pending,renderer:stats.renderer,region:stats.region,mode:stats.mode};records.push(rec);console.log(c.id,kind,rec.draw?.calls,rec.pending);
 writeFileSync(out+'/captures.json',JSON.stringify({sha,dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),worldSha256:createHash('sha256').update(readFileSync('public/horizon/world/horizon-geo-1.json.gz')).digest('hex'),method:'Headless Chrome SwiftShader. Current geometry only; no device evidence. Below pose is not necessarily on navigable water. Air pose is not a flown controller.',records,errors},null,2));
 }
}
}}finally{await browser.close();}
