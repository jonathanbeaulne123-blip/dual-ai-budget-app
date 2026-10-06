// The Green (STORY place 2, module `lakeside`) evidence: the Old Oak and its fixtures, the labyrinth, the Lantern Ring,
// Stillwater's shore and the Glasshouse surroundings, Sketchbook pages E and K, the porch (the Glasshouse stair's foot),
// signature poses at best hour and night, × Classic / Taylor / Newfoundland × full / lite, and an aerial. Headless
// SwiftShader on the review harness (look poses via __harbour.world.views + shot()); not device evidence (CONTRACT §2.21).
// Starts its own vite dev server (unless --url) and kills it at the end; writes JPEGs (quality 72) and captures.json.
//   node scripts/horizon/capture-green.mjs --out docs/horizon/evidence/waters-way-lakeside [--port 5202] [--only porch,hero] [--themes classic] [--tiers full]
import {chromium} from '@playwright/test';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';

const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:fallback;};
const output=resolve(opt('out','docs/horizon/evidence/waters-way-lakeside')),port=Number(opt('port','5202'));
const only=opt('only')?.split(',').filter(Boolean)??null,themes=(opt('themes')??'classic,taylor,newfoundland').split(','),tiers=(opt('tiers')??'full,lite').split(',');
const DATE=opt('date','2026-06-21'),VIEW={width:1280,height:800};
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await mkdir(output,{recursive:true});
const started=Date.now(),log=(...m)=>console.log(`[${((Date.now()-started)/1000).toFixed(0).padStart(5)}s]`,...m);

// The poses (eye, target, vertical fov), the hours, and where each is shot: `all` = every theme × tier; `classic` = Classic
// full only; `key` = every theme on full, and Classic lite.
const OAK=[1125,16.1,1165];
const POSES=[
  {id:'porch',label:'Porch: the Glasshouse stair\'s foot landing, south over the Green to the Old Oak',eye:[1007,23.7,953],target:[1110,26,1150],fov:58,hours:['10:00','22:30'],set:'all'},
  {id:'hero',label:'The Old Oak over the meadow, the sea behind',eye:[1090,20.2,1082],target:[1126,27,1170],fov:60,hours:['12:00'],set:'all'},
  {id:'canopy',label:'Under the crown: the ring bench, the limbs, the rope swing',eye:[1104,17.7,1153],target:[1125,22,1166],fov:72,hours:['11:00'],set:'key'},
  {id:'clock',label:'The oak, its ring bench, the Oak Clock (January north), the swing and the tables',eye:[1050,58,1115],target:[1122,12,1166],fov:50,hours:['11:00'],set:'key'},
  {id:'labyrinth',label:'The turf labyrinth, entrance toward the Year Walk; the stair-and-ramp behind',eye:[1062,42,1040],target:[1090,19,1004],fov:52,hours:['10:00'],set:'key'},
  {id:'apiary',label:'The apiary in the clover, the kites over the April station',eye:[985,19,1185],target:[960,24,1110],fov:58,hours:['10:00'],set:'classic'},
  {id:'rim',label:'The south-west rim: the windpump, hay bales, the windsock, the oak beyond',eye:[884,10.6,1262],target:[1040,17,1200],fov:62,hours:['17:30'],set:'classic'},
  {id:'pavilion',label:'The Meadow Pavilion on the west rim, open toward the Bight',eye:[870,19.5,1040],target:[846,19,1063],fov:58,hours:['19:30','22:30'],set:'classic'},
  {id:'night',label:'Night: the Lantern Ring draws the protected circle; the oak against the sky',eye:[1065,18.9,1110],target:[1125,22,1162],fov:62,hours:['22:30'],set:'key'},
  {id:'E',label:'Page E framing from the Crown (noon): the Green below, the oak on its rim',eye:[1318,172,476],target:[870,20,860],fov:55,hours:['12:30','22:30'],set:'key',page:'E'},
  {id:'K',label:'Page K: the Glasshouse at dusk over Stillwater (the shore, no trees between)',eye:[994,57,770],target:[1120,52,815],fov:55,hours:['20:50','12:30'],set:'key',page:'K'},
  {id:'fallswatch',label:'From Fallswatch on the west buttress: the oak on the Green below (the sight chain)',eye:[1086,96.9,694.3],target:[1125,40,1165],fov:30,hours:['07:30'],set:'classic'},
  {id:'aerial',label:'Aerial from the south-west: the Green, the oak, the labyrinth, the Lantern Ring',eye:[820,230,1420],target:[1040,15,1060],fov:45,hours:['12:00','22:30'],set:'classic'},
];
const wants=(p,theme,tier)=>(!only||only.includes(p.id))&&(p.set==='all'||(p.set==='classic'&&theme==='classic'&&tier==='full')||(p.set==='key'&&(tier==='full'||theme==='classic')));

let server=null,origin=opt('url');
if(!origin){
  origin=`http://127.0.0.1:${port}`;
  server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:['ignore','pipe','pipe']});
  let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
  const until=Date.now()+180000;let up=false;
  while(Date.now()<until&&!up){try{up=(await fetch(`${origin}/horizon-review.html`)).ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}
  if(!up){console.error(serverLog);killServer();throw new Error('vite did not start');}
  log('vite up at',origin);
}
function killServer(){if(server&&server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}}}
process.on('exit',killServer);process.on('SIGINT',()=>{killServer();process.exit(130);});

const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[],errors=[];
try{
  for(const theme of themes)for(const tier of tiers){
    const list=POSES.filter(p=>wants(p,theme,tier));if(!list.length)continue;
    const page=await browser.newPage({viewport:VIEW,timezoneId:'America/Toronto',deviceScaleFactor:1});page.setDefaultTimeout(600000);
    page.on('pageerror',e=>errors.push({theme,tier,message:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({theme,tier,message:m.text().slice(0,300)});});
    await page.goto(`${origin}/horizon-review.html?world=horizon&tier=${tier}&theme=${theme}&date=${DATE}&sun=12:00`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:400000});
    await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls,.horizon-inspector{visibility:hidden!important}'});
    log(theme,tier,'interactive');
    for(const p of list)for(const hhmm of p.hours){
      await page.evaluate(({p,DATE,hhmm})=>{const w=window.__harbour,views=w.world.views,id=p.page??`GREEN_${p.id}`,i=views.findIndex(v=>v.id===id);
        const v={...(i>=0?views[i]:{}),id,label:p.label,eye:p.eye,target:p.target,fovDegrees:p.fov,aspect:1,radius:260,portrait:null};if(i>=0)views[i]=v;else views.push(v);w.shot(id);
        const [H,M]=hhmm.split(':').map(Number),d=new Date(`${DATE}T12:00:00-04:00`);d.setHours(H,M,0,0);w.setDate(d);},{p,DATE,hhmm});
      await page.evaluate(()=>window.__harbour.settle(300000));await page.waitForTimeout(6000);
      await page.waitForFunction(()=>{const s=window.__harbour.stats();return (s.stream.at(-1)?.pending.length??0)===0;},null,{timeout:60000}).catch(()=>errors.push({theme,tier,message:`${p.id} stream pending`}));
      await page.waitForTimeout(2500);
      const png=join(output,`tmp_${p.id}.png`),file=`${p.id}_${hhmm.replace(':','-')}_${theme}_${tier}.jpg`;
      await page.locator('.horizon-stage canvas').screenshot({path:png,timeout:180000});
      execFileSync('convert',[png,'-quality','72',join(output,file)]);await rm(png);
      const stats=await page.evaluate(()=>{const s=window.__harbour.stats(),d=s.drawSamples.at(-1)??null;return{drawCalls:d?.calls??null,triangles:d?.triangles??null,resident:s.chunks?.resident??null};});
      records.push({file,id:p.id,label:p.label,theme,tier,time:hhmm,date:DATE,eye:p.eye,target:p.target,fov:p.fov,stats});log(file,'draw',stats.drawCalls,'tris',stats.triangles);
    }
    await page.close();
  }
}finally{await browser.close();killServer();}
await writeFile(join(output,'captures.json'),JSON.stringify({sha,method:'headless Chromium (SwiftShader) on the review harness, look poses via __harbour.world.views + shot(); not device evidence',records,errors},null,1)+'\n');
log('done',records.length,'shots',errors.length,'errors');if(errors.length)console.log(errors.slice(0,20));
process.exit(0);
