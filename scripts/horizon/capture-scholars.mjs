// The Water's Way, Scholars' Edge (story place 7, layout B): review captures of the dressed place on the runtime review page.
// Headless Chromium with SwiftShader on the review harness — not device evidence (CONTRACT §2.21). Starts its own vite dev
// server (port 5208 unless --port/--url) and kills it at the end. JPEGs into docs/horizon/evidence/waters-way-scholars/.
//   node scripts/horizon/capture-scholars.mjs [--out dir] [--port n] [--url origin] [--only a,b] [--themes classic,taylor] [--tiers full,lite]
// Poses are look poses through the runtime's own `world.views` + `shot()` (as capture-road.mjs); the clock through
// `setDate` at 21 June 2026, America/Toronto: golden hour = sunset − 60 min (capture.mjs's clock words), night = 02:00.
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import {mkdir,writeFile,unlink,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {execFileSync,spawn} from 'node:child_process';

const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0?args[i+1]:f;};
const output=resolve(opt('out','docs/horizon/evidence/waters-way-scholars')),port=Number(opt('port','5208')),only=opt('only')?.split(',')??null;
const themes=(opt('themes','classic,taylor,newfoundland')).split(','),tiers=(opt('tiers','full,lite')).split(',');
const DATE='2026-06-21',ZONE='America/Toronto',VIEW={full:{width:1200,height:750},lite:{width:1200,height:750}},QUALITY=Number(opt('quality','70'));
await mkdir(output,{recursive:true});
const entry=resolve(tmpdir(),`scholars-capture-${process.pid}.mjs`);
await build({entryPoints:['scripts/horizon/capture-entry.ts'],outfile:entry,bundle:true,format:'esm',platform:'node',logLevel:'warning'});
const {solarPosition,solarReviewDate}=await import(pathToFileURL(entry).href);await unlink(entry);
const reference=new Date(`${DATE}T12:00:00-04:00`),sun=solarPosition(reference,{timeZone:ZONE});
const hhmm=m=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(Math.round(m)%60).padStart(2,'0')}`;
const CLOCK={golden:hhmm(sun.sunset-60),dusk:hhmm(sun.sunset+30),night:'02:00',noon:hhmm(sun.solarNoon)};
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const started=Date.now(),log=(...m)=>console.log(`[${((Date.now()-started)/1000).toFixed(0).padStart(5)}s]`,...m);

// The poses (eye, target, vertical FOV); `when` the clocks each is shot at per theme/tier (`all` = every theme and tier).
const LIB=[740,48,400];
const POSES=[
  // The porch pose: the Bight lookout deck (eye 53.6) across the Bight toward the Flats; best hour and 02:00 (STYLE porch rule).
  {id:'porch',label:'the Bight lookout, across the Bight to the Flats',eye:[744.4,53.6,510.9],target:[560,26,760],fov:60,radius:240,when:{classic:['golden','night'],taylor:['golden','night'],newfoundland:['golden','night']},lite:['golden','night']},
  // From the deck back over the woods to Westwatch (the loop closes): the view cone cut through the canopy.
  {id:'westwatch',label:'from the lookout to Westwatch over the woods',eye:[746.6,53.6,507.4],target:[1036,90,318],fov:50,radius:240,when:{classic:['golden']}},
  // Courtyard B on the south-west gable, into the sun window (SPEC porch B terrace pose).
  {id:'courtyard',label:'courtyard B in the sun window',eye:[725.4,49.65,438],target:[700.9,51.2,410.6],fov:60,radius:200,when:{classic:['golden','night'],taylor:['golden'],newfoundland:['golden']},lite:['golden']},
  // The Library from the courtyard's far corner: the verdigris roofs and the reading-room windows.
  {id:'library',label:'the Library from the courtyard',eye:[709,49.7,421.5],target:[748,55,404],fov:58,radius:200,when:{classic:['golden','night'],taylor:['golden'],newfoundland:['golden']}},
  // The garden walk with its bollards, looking back to the Library.
  {id:'gardenwalk',label:'the garden walk to the Library',eye:[812,49.1,478],target:[758,52.5,418],fov:58,radius:200,when:{classic:['golden','night']}},
  // Under the canopy by the cove walk.
  {id:'woods',label:'in the woods by the cove walk',eye:[730,46.6,344],target:[690,47,322],fov:62,radius:200,when:{classic:['golden']}},
  // From the Bight below: the cliff, the lookout, the woods' skyline.
  {id:'fromBight',label:'Scholars\' Edge from the Bight',eye:[690,6,690],target:[744,50,452],fov:50,radius:320,when:{classic:['golden']}},
  // The aerial.
  {id:'aerial',label:'aerial over Scholars\' Edge',eye:[648,112,572],target:[748,45,420],fov:50,radius:320,when:{classic:['golden']},lite:['golden']},
];

let server=null,origin=opt('url');
function killServer(){if(server&&server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}}}
process.on('exit',killServer);process.on('SIGINT',()=>{killServer();process.exit(130);});
if(!origin){
  origin=`http://127.0.0.1:${port}`;
  server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:['ignore','pipe','pipe']});
  let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
  const until=Date.now()+180000;let up=false;
  while(Date.now()<until&&!up){try{const r=await fetch(`${origin}/horizon-review.html`);up=r.ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}
  if(!up){console.error(serverLog);killServer();throw new Error('vite did not start');}
  log('vite up at',origin);
}
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[],errors=[];
try{
  for(const theme of themes)for(const tier of tiers){
    const jobs=POSES.filter(p=>!only||only.includes(p.id)).flatMap(p=>(tier==='lite'?(theme==='classic'?p.lite??[]:[]):p.when[theme]??[]).map(w=>({p,w})));
    if(!jobs.length)continue;
    const page=await browser.newPage({viewport:VIEW[tier],timezoneId:ZONE,deviceScaleFactor:1});page.setDefaultTimeout(900000);
    page.on('pageerror',e=>errors.push({theme,tier,message:e.message}));
    await page.goto(`${origin}/horizon-review.html?world=horizon&tier=${tier}&theme=${theme}&date=${DATE}&sun=${CLOCK.golden}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:600000});
    await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls,.horizon-inspector{visibility:hidden!important}'});
    log(theme,tier,'interactive');
    for(const {p,w} of jobs){
      const iso=solarReviewDate(reference,`?date=${DATE}&sun=${CLOCK[w]}`,{dev:true,timeZone:ZONE}).toISOString();
      await page.evaluate(({p,iso})=>{const h=window.__harbour,views=h.world.views,v={id:'SCH_'+p.id,label:p.label,eye:p.eye,target:p.target,fovDegrees:p.fov,aspect:1,radius:p.radius,portrait:null},i=views.findIndex(x=>x.id===v.id);if(i>=0)views[i]=v;else views.push(v);h.shot(v.id);h.setDate(new Date(iso));},{p,iso});
      await page.evaluate(()=>window.__harbour.settle(300000));
      await page.waitForFunction(()=>{const h=window.__harbour,d=h.dressingRenderStatus?.(),c=h.corridorRenderStatus?.();return (!d||!d.building)&&(!c||!c.building);},null,{timeout:900000}).catch(e=>errors.push({theme,tier,pose:p.id,message:'wait: '+String(e).slice(0,200)}));
      await page.waitForTimeout(4000);
      const file=`${p.id}_${w}_${theme}_${tier}.jpg`;
      await page.locator('.horizon-stage canvas').screenshot({path:join(output,file),type:'jpeg',quality:QUALITY,timeout:300000});
      const stats=await page.evaluate(()=>{const s=window.__harbour.stats(),d=s.drawSamples.at(-1)??null;return{draw:d,dressing:window.__harbour.dressingRenderStatus?.()};});
      records.push({file,pose:p.id,label:p.label,theme,tier,clock:CLOCK[w],when:w,eye:p.eye,target:p.target,fov:p.fov,draw:stats.draw,dressing:stats.dressing?.districts?.scholars??null});
      log(file,JSON.stringify(stats.draw),JSON.stringify(stats.dressing?.districts?.scholars??null));
    }
    await page.close();
  }
}finally{await browser.close();killServer();}
await writeFile(join(output,'captures.json'),JSON.stringify({sha,date:DATE,timeZone:ZONE,clocks:CLOCK,method:'headless Chromium (SwiftShader) on horizon-review.html; look poses via __harbour.world.views + shot(); not device evidence.',records,errors},null,1));
log('done',records.length,'shots',errors.length,'errors');
