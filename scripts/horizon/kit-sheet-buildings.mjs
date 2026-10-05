// Building grammar kit sheet (kit/buildings): renders scripts/horizon/kit-sheet-buildings.html — every fixture record
// of each neighbourhood group drawn by the real `drawBuilding` — for each dressing × day/night (× tier). Headless
// Chromium (SwiftShader) on a vite dev server it starts itself; not device evidence (CONTRACT §2.21).
//   node scripts/horizon/kit-sheet-buildings.mjs [--out /home/claude/scratch/evidence/buildings] [--only harbour_classic_day_full,...]
//     [--groups harbour,crown] [--themes classic] [--tods day,night] [--tiers full] [--view close] [--collide]
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0?args[i+1]:f;};
const out=resolve(opt('out','/home/claude/scratch/evidence/buildings')),port=Number(opt('port','5231')),only=opt('only')?.split(',')??null,view=opt('view','wide'),collide=args.includes('--collide');
const groups=opt('groups','harbour,crown,hollow,scholars,landing,flats,shared').split(','),themes=opt('themes','classic,taylor,newfoundland').split(','),tods=opt('tods','day,night').split(','),tiers=opt('tiers','full').split(',');
await mkdir(out,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:['ignore','pipe','pipe']});let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const kill=()=>{if(server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}}};process.on('exit',kill);
const origin=`http://127.0.0.1:${port}`;{const until=Date.now()+120000;let up=false;while(Date.now()<until&&!up){try{up=(await fetch(`${origin}/scripts/horizon/kit-sheet-buildings.html`)).ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}if(!up){console.error(serverLog);throw new Error('vite did not start');}}
const combos=[];for(const group of groups)for(const theme of themes)for(const tod of tods)for(const tier of tiers)combos.push({group,theme,tod,tier,id:`${group}_${theme}_${tod}_${tier}`});
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[],errors=[];
try{
  for(const c of combos.filter(c=>!only||only.includes(c.id))){
    const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
    page.on('pageerror',e=>errors.push(`${c.id}: ${e.message}`));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')if(!/404|deprecated/.test(m.text()))errors.push(`${c.id}: ${m.text()}`);});
    await page.goto(`${origin}/scripts/horizon/kit-sheet-buildings.html?group=${c.group}&theme=${c.theme}&tod=${c.tod}&tier=${c.tier}&view=${view}${collide?'&collide=1':''}`,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__sheet?.ready,null,{timeout:180000});
    const file=`buildings_${c.id}${view==='close'?'_close':''}${collide?'_collide':''}.png`;await page.locator('#sheet').screenshot({path:resolve(out,file)});
    records.push({file,...c,stats:await page.evaluate(()=>window.__sheet.stats)});console.log(file);
    await page.close();
  }
}finally{await browser.close();kill();}
await writeFile(resolve(out,'sheet.json'),JSON.stringify({sha,method:'headless Chromium (SwiftShader), scripts/horizon/kit-sheet-buildings.html; not device evidence',records,errors},null,1)+'\n');
console.log('errors',errors.length);if(errors.length)console.log(errors.slice(0,20).join('\n'));
process.exit(0);
