// The Water's Way · PR 4 · the Flats & the Bight: look-pose captures of the place on the review harness (SwiftShader, not
// device evidence). Starts its own vite dev server (unless --url is given), poses the runtime's own look camera through
// `__harbour.world.views` + `shot()`, waits for the stream to settle, and writes JPEGs (≤ 1024 px wide) plus captures.json.
// Usage: node scripts/horizon/capture-flats.mjs [--port 5207] [--out docs/horizon/evidence/waters-way-flats] [--only H,porch]
import {chromium} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:d;};
const output=resolve(opt('out','docs/horizon/evidence/waters-way-flats')),port=Number(opt('port','5207')),only=opt('only')?.split(',').filter(Boolean)??null;
const DATE='2026-06-21',GOLDEN='19:50',NIGHT='22:40',VIEW={width:1280,height:800};
await mkdir(output,{recursive:true});
const started=Date.now(),log=(...m)=>console.log(`[${((Date.now()-started)/1000).toFixed(0).padStart(5)}s]`,...m);
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();

let server=null,origin=opt('url');
if(!origin){
  origin=`http://127.0.0.1:${port}`;
  server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:['ignore','pipe','pipe']});
  let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
  const until=Date.now()+180000;let up=false;
  while(Date.now()<until&&!up){try{const r=await fetch(`${origin}/horizon-review.html`);up=r.ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}
  if(!up){console.error(serverLog);killServer();throw new Error('vite did not start');}
  log('vite up at',origin);
}
function killServer(){if(server&&server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}}}
process.on('exit',killServer);process.on('SIGINT',()=>{killServer();process.exit(130);});

const world=JSON.parse(await readFile('public/horizon/world/horizon-geo-1.json','utf8')),H=world.views.find(v=>v.id==='H');
// The poses: the Sketchbook page H (D-WW86), the porch (the hangar's bench, seated eye), the signatures and one aerial.
const POSES=[
  {id:'H',label:'page H: the strip up to the windsock and the balloon, the west sea',eye:H.eye,target:H.target,fov:H.fovDegrees},
  {id:'porch',label:'the porch: from the hangar\'s bench toward the Bight Bridge\'s arch, the strip on the right',eye:[449.5,39.0,616.5],target:[540,25,1000],fov:55},
  {id:'elevator',label:'the grain elevator over the station, from the apron',eye:[432,41.2,652],target:[396,50,704],fov:55},
  {id:'quonset',label:'THE hangar: the Quonset\'s open mouth on the apron',eye:[436,41,566],target:[400,42,590],fov:55},
  {id:'station',label:'the prairie station from the arrival court',eye:[366,40.2,640],target:[394,40.5,668],fov:55},
  {id:'final',label:'on final: the geoglyph in the approach, the strip ahead',eye:[417,65,400],target:[438,38,720],fov:50},
  {id:'stargazing',label:'the stargazing deck and the observatory in the dark tip',eye:[458,41.5,394],target:[479,39,381],fov:55},
  {id:'wash',label:'the Wash Arch over the Wash Run, the hoodoos beyond',eye:[503,42,452],target:[480,42,520],fov:55},
  {id:'hoodoos',label:'the hoodoo cluster on the Wash\'s east bank',eye:[510,43,628],target:[483,42,678],fov:55},
  {id:'bight',label:'the Bight Shore plots over the lagoon',eye:[640,24,1000],target:[760,14,990],fov:55},
  {id:'aerial',label:'aerial: the Flats arm from the south-west',eye:[230,240,930],target:[450,32,640],fov:50},
];
const PLAN=[
  ...POSES.map(p=>({pose:p.id,theme:'classic',tier:'full',time:GOLDEN})),
  ...['H','porch','elevator','quonset','stargazing','hoodoos','aerial'].map(id=>({pose:id,theme:'classic',tier:'full',time:NIGHT})),
  ...['taylor','newfoundland'].flatMap(theme=>['H','porch','elevator','quonset','station','wash'].map(id=>({pose:id,theme,tier:'full',time:GOLDEN}))),
  ...['taylor','newfoundland'].flatMap(theme=>['H','elevator'].map(id=>({pose:id,theme,tier:'full',time:NIGHT}))),
  ...['H','porch','elevator'].flatMap(id=>[GOLDEN,NIGHT].map(time=>({pose:id,theme:'classic',tier:'lite',time}))),
].filter(s=>!only||only.includes(s.pose));

const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[],errors=[];
try{
  for(const theme of ['classic','taylor','newfoundland'])for(const tier of ['full','lite']){
    const shots=PLAN.filter(s=>s.theme===theme&&s.tier===tier);if(!shots.length)continue;
    const page=await browser.newPage({viewport:VIEW,timezoneId:'America/Toronto',deviceScaleFactor:1});page.setDefaultTimeout(600000);
    page.on('pageerror',e=>errors.push({theme,tier,message:e.message}));
    await page.goto(`${origin}/horizon-review.html?world=horizon&tier=${tier}&theme=${theme}&date=${DATE}&sun=${GOLDEN}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:600000});
    await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls,.horizon-airport{visibility:hidden!important}'});
    log('ready',theme,tier);
    for(const s of shots){
      const p=POSES.find(q=>q.id===s.pose);
      await page.evaluate(({p})=>{const w=window.__harbour,views=w.world.views,id='FLATS_'+p.id,v={id,label:p.label,eye:p.eye,target:p.target,fovDegrees:p.fov,aspect:1,radius:260,portrait:null},i=views.findIndex(x=>x.id===id);if(i>=0)views[i]=v;else views.push(v);return w.shot(id);},{p});
      await page.evaluate(({hhmm,DATE})=>{const [h,m]=hhmm.split(':').map(Number);const d=new Date(`${DATE}T12:00:00-04:00`);d.setHours(h,m,0,0);window.__harbour.setDate(d);},{hhmm:s.time,DATE});
      const settled=await page.evaluate(()=>window.__harbour.settle?window.__harbour.settle(300000):null).catch(e=>String(e));
      await page.waitForTimeout(5000);
      const file=`${s.pose}_${s.time.replace(':','-')}_${theme}_${tier}.jpg`;
      await page.locator('.horizon-stage canvas').screenshot({path:join(output,file),type:'jpeg',quality:72,timeout:240000});
      const stats=await page.evaluate(()=>{const st=window.__harbour.stats(),d=st.drawSamples?.at(-1)??null;return{drawCalls:d?.calls??null,triangles:d?.triangles??null};});
      records.push({file,pose:s.pose,label:p.label,theme,tier,time:s.time,date:DATE,eye:p.eye,target:p.target,fovDegrees:p.fov,settled,stats});log(file,JSON.stringify(stats));
    }
    await page.close();
  }
}finally{await browser.close();killServer();}
await writeFile(join(output,'captures.json'),JSON.stringify({sha,method:'headless Chromium, SwiftShader (--use-angle=swiftshader): not device evidence. Look poses via __harbour.world.views + shot(); 21 June 2026, America/Toronto.',records,errors},null,1));
console.log(JSON.stringify({shots:records.length,errors:errors.length}));
