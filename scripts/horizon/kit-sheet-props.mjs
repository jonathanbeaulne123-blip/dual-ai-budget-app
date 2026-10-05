// Prop kit sheet (kit/props): renders scripts/horizon/kit-sheet-props.html — every PropKind drawn by the real `drawProp`
// in four labelled panels — for each dressing × tier (day) and each dressing at night (full). Headless Chromium
// (SwiftShader) on a vite dev server it starts itself; not device evidence (CONTRACT §2.21).
//   node scripts/horizon/kit-sheet-props.mjs [--out /path] [--only classic_full,...] [--view close] [--port 5214]
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0?args[i+1]:f;};
const out=resolve(opt('out','docs/horizon/evidence/kit/props')),port=Number(opt('port','5214')),only=opt('only')?.split(',')??null,view=opt('view','wide'),focus=opt('focus'),r=opt('r','2.6'),ty=opt('ty','0.8');
await mkdir(out,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:['ignore','pipe','pipe']});let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const kill=()=>{if(server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}}};process.on('exit',kill);
const origin=`http://127.0.0.1:${port}`;{const until=Date.now()+120000;let up=false;while(Date.now()<until&&!up){try{up=(await fetch(`${origin}/scripts/horizon/kit-sheet-props.html`)).ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}if(!up){console.error(serverLog);throw new Error('vite did not start');}}
const combos=[];
for(const pg of [1,2])for(const theme of ['classic','taylor','newfoundland']){for(const tier of ['full','lite'])combos.push({pg,theme,tier,night:0,id:`p${pg}_${theme}_${tier}`});combos.push({pg,theme,tier:'full',night:1,id:`p${pg}_${theme}_full_night`});}
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[],errors=[];
try{
  for(const c of combos.filter(c=>!only||only.includes(c.id))){
    const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
    page.on('pageerror',e=>errors.push(`${c.id}: ${e.message}`));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')if(!/404|deprecated/.test(m.text()))errors.push(`${c.id}: ${m.text()}`);});
    await page.goto(`${origin}/scripts/horizon/kit-sheet-props.html?theme=${c.theme}&tier=${c.tier}&night=${c.night}&view=${view}&page=${c.pg}${focus?`&focus=${focus}&r=${r}&ty=${ty}`:''}`,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__sheet?.ready,null,{timeout:180000});
    const file=`ww-props_${c.id}${view==='close'?'_close':''}${focus?`_focus-${focus.replace(/,/g,'-')}`:''}.png`;await page.locator('#sheet').screenshot({path:resolve(out,file)});
    const stats=await page.evaluate(()=>window.__sheet.stats);records.push({file,...c,stats});console.log(file);
    await page.close();
  }
}finally{await browser.close();kill();}
await writeFile(resolve(out,'props-sheet.json'),JSON.stringify({sha,method:'headless Chromium (SwiftShader), scripts/horizon/kit-sheet-props.html; not device evidence',records,errors},null,1)+'\n');
console.log('errors',errors.length);if(errors.length)console.log(errors.slice(0,20).join('\n'));
process.exit(0);
