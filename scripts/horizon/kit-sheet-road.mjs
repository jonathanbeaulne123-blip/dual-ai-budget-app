// Road kit render sheet (ROAD.md §4, track K): the synthetic corridor fixture (`src/harbour/horizon/kit/road/fixture.ts`)
// drawn with the real road kit, the real district-card path for the corridor solids, the Horizon terrain material, sky dome,
// fog and sun/moon rig (`kit/road/sheet.ts` via `sheet.html`), in headless Chromium (SwiftShader). Day and night, three
// dressings, driver-height views and aerials. Not device evidence; not the island (a fixture, fictional geometry).
//   node scripts/horizon/kit-sheet-road.mjs [--out docs/horizon/evidence/road/kit] [--port 5199] [--url <origin>] [--only a,b] [--tier full|lite]
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';

const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0?args[i+1]:f;};
const output=resolve(opt('out','docs/horizon/evidence/road/kit')),port=Number(opt('port','5199')),only=opt('only')?.split(',')??null,tier=opt('tier','full');
const VIEW={width:1280,height:800};
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await mkdir(output,{recursive:true});
const started=Date.now(),log=(...m)=>console.log(`[${((Date.now()-started)/1000).toFixed(0).padStart(4)}s]`,...m);

let server=null,origin=opt('url');
function killServer(){if(server&&server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}}}
process.on('exit',killServer);process.on('SIGINT',()=>{killServer();process.exit(130);});
if(!origin){
  origin=`http://127.0.0.1:${port}`;
  server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:['ignore','pipe','pipe']});
  let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
  const until=Date.now()+120000;let up=false;
  while(Date.now()<until&&!up){try{const r=await fetch(`${origin}/src/harbour/horizon/kit/road/sheet.html`);up=r.ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}
  if(!up){console.error(serverLog);killServer();throw new Error('vite did not start');}
  log('vite up at',origin);
}

// The sheet: [file stem, pose, time, theme]. Day 13:00, night 22:30 (the road capture convention).
const DAY='13:00',NIGHT='22:30',themes=['classic','taylor','newfoundland'];
const shots=[];
for(const theme of themes){
  shots.push([`${theme}_driver-developed_day`,'driver-developed',DAY,theme],[`${theme}_driver-coastal_day`,'driver-coastal',DAY,theme],[`${theme}_driver-mountain_day`,'driver-mountain',DAY,theme],[`${theme}_aerial_day`,'aerial',DAY,theme],[`${theme}_driver-developed_night`,'driver-developed',NIGHT,theme]);
}
shots.push(['classic_parapet-close_day','parapet-close',DAY,'classic'],['classic_kerbside_day','kerbside',DAY,'classic'],['classic_stop_day','stop','17:30','classic'],['classic_driver-mountain-back_day','driver-mountain-back','16:00','classic'],['classic_aerial-sea_day','aerial-sea',DAY,'classic'],['classic_aerial_night','aerial',NIGHT,'classic'],['classic_driver-coastal_night','driver-coastal',NIGHT,'classic'],['taylor_kerbside_night','kerbside',NIGHT,'taylor'],['newfoundland_stop_day','stop','17:30','newfoundland']);

const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[],errors=[];
try{
  const page=await browser.newPage({viewport:VIEW,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|404 \(Not Found\)/.test(m.text()))errors.push(m.text());});
  await page.goto(`${origin}/src/harbour/horizon/kit/road/sheet.html?tier=${tier}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__roadSheet,null,{timeout:180000});
  let current='classic';
  for(const [stem,pose,time,theme] of shots){
    if(only&&!only.some(o=>stem.includes(o)))continue;
    if(theme!==current){await page.evaluate(t=>window.__roadSheet.theme(t),theme);current=theme;}
    const light=await page.evaluate(([p,t])=>{window.__roadSheet.pose(p);return window.__roadSheet.time(t);},[pose,time]);
    const info=await page.evaluate(()=>window.__roadSheet.render());
    const file=`${stem}_${tier}.png`;await page.locator('#sheet canvas').screenshot({path:resolve(output,file)});
    records.push({file,pose,time,theme,tier,elevation:+light.elevation.toFixed(2),night:+light.night.toFixed(2),drawCalls:info.calls,triangles:info.triangles,corridorArt:info.art});log(file,info.calls,'calls',info.triangles,'tris');
  }
  await page.close();
}finally{await browser.close();killServer();}
await writeFile(resolve(output,`sheet-${tier}.json`),JSON.stringify({sha,tier,method:'headless Chromium (SwiftShader) on the vite dev server; a synthetic fixture, not the island; not device evidence',view:VIEW,records,errors},null,1)+'\n');
log('errors',errors.length,errors.slice(0,5));
