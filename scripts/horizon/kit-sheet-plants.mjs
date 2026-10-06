// Corridor planting kit sheet (ROAD.md §4.6): renders scripts/horizon/kit-sheet-plants.html — four road-strip panels
// (palm grove + flower-bed verge, maple avenue, wind-bent pine + heath, prairie drifts) drawn by the real
// `createCorridorPlanting` — for each dressing × season × tier, and a Mountain v2 comparison crop. Headless Chromium
// (SwiftShader) on a vite dev server it starts itself; not device evidence (CONTRACT §2.21).
//   node scripts/horizon/kit-sheet-plants.mjs [--out docs/horizon/evidence/road/plants] [--only classic_summer_full,...] [--set road|ww|oak]
// `--set ww`: the Water's Way stands (kit/plants/sample.ts sampleStand: marsh, woods, warm coast, prairie + orchard);
// `--set oak`: the Old Oak from 95 eu and under its crown. Both add spring and autumn in every dressing.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0?args[i+1]:f;};
const out=resolve(opt('out','docs/horizon/evidence/road/plants')),view=opt('view','wide'),port=Number(opt('port','5213')),only=opt('only')?.split(',')??null,set=opt('set','road');
await mkdir(out,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:['ignore','pipe','pipe']});let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const kill=()=>{if(server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}}};process.on('exit',kill);
const origin=`http://127.0.0.1:${port}`;{const until=Date.now()+120000;let up=false;while(Date.now()<until&&!up){try{up=(await fetch(`${origin}/scripts/horizon/kit-sheet-plants.html`)).ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}if(!up){console.error(serverLog);throw new Error('vite did not start');}}
const combos=[];
for(const theme of ['classic','taylor','newfoundland'])for(const [season,month] of [['summer',7],['winter',1]])for(const tier of ['full','lite'])combos.push({theme,season,month,tier,id:`${theme}_${season}_${tier}`});
// Extra: the other two seasons in Classic full (spring bud / blossom, autumn tint and fade).
combos.push({theme:'classic',season:'spring',month:5,tier:'full',id:'classic_spring-may_full'},{theme:'classic',season:'autumn',month:10,tier:'full',id:'classic_autumn_full'});
if(set!=='road')for(const theme of ['taylor','newfoundland'])combos.push({theme,season:'spring',month:5,tier:'full',id:`${theme}_spring-may_full`},{theme,season:'autumn',month:10,tier:'full',id:`${theme}_autumn_full`});
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[],errors=[];
try{
  for(const c of combos.filter(c=>!only||only.includes(c.id))){
    const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
    page.on('pageerror',e=>errors.push(`${c.id}: ${e.message}`));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')if(!/404|deprecated/.test(m.text()))errors.push(`${c.id}: ${m.text()}`);});
    await page.goto(`${origin}/scripts/horizon/kit-sheet-plants.html?theme=${c.theme}&season=${c.season}&month=${c.month}&tier=${c.tier}&view=${view}&set=${set}`,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__sheet?.ready,null,{timeout:180000});
    const file=`${set==='road'?'plants':set==='ww'?'ww-plants':'ww-oak'}_${c.id}${view==='close'?'_close':''}.png`;await page.locator('#sheet').screenshot({path:resolve(out,file)});
    const stats=await page.evaluate(()=>window.__sheet.stats);records.push({file,...c,stats});console.log(file);
    await page.close();
  }
}finally{await browser.close();kill();}
await writeFile(resolve(out,set==='road'?'sheet.json':`${set}-sheet.json`),JSON.stringify({sha,method:'headless Chromium (SwiftShader), scripts/horizon/kit-sheet-plants.html; not device evidence',records,errors},null,1)+'\n');
console.log('errors',errors.length);if(errors.length)console.log(errors.slice(0,20).join('\n'));
process.exit(0);
