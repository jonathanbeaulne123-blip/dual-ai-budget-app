// Little Harbour evidence (The Water's Way PR 3, STYLE §2.1 "cobblestone Italy"): the porch / page A to the dam, the belfry
// pages (north to the dam, south over the roofs), from the water, the square, the bocce green, the market lane, a vicolo,
// the upper street, Lantern Row at night and an aerial, in Classic, Taylor's Scrapbook and Newfoundland, full and lite.
// Headless SwiftShader on the review harness: NOT device evidence (CONTRACT §2.21). Starts its own vite dev server (unless
// --url is given) and kills it at the end. Writes JPEGs (sharp, q 74) and captures.json.
//   node scripts/horizon/capture-harbour.mjs --out docs/horizon/evidence/waters-way-harbour --port 5204
// Options: --out <dir> · --port <n> · --url <origin> · --only <comma list of pose ids> · --themes classic,taylor,newfoundland
//          · --tiers full,lite · --width 1280 --height 800
import {chromium} from '@playwright/test';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import sharp from 'sharp';

const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:fallback;};
const output=resolve(opt('out','docs/horizon/evidence/waters-way-harbour')),port=Number(opt('port','5204')),only=opt('only')?.split(',').filter(Boolean)??null;
const themes=(opt('themes','classic,taylor,newfoundland')).split(','),tiers=(opt('tiers','full,lite')).split(',');
const VIEW={width:Number(opt('width','1280')),height:Number(opt('height','800'))},DATE='2026-06-21',GOLDEN='19:55',DUSK='21:05',NIGHT='22:30',NOON='13:00';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await mkdir(output,{recursive:true});
const started=Date.now(),log=(...m)=>console.log(`[${((Date.now()-started)/1000).toFixed(0).padStart(5)}s]`,...m);

// The poses (protos/harbour SPEC §12, retargeted to the built town). fov = vertical degrees.
const DAM=[1318,108,560];
const POSES=[
  {id:'porch',label:'Porch / page A: the square\'s north-west edge to Mountain v2\'s glass dam',eye:[1432,13.6,1166],target:DAM,fov:50,hours:[GOLDEN,NIGHT],themes:'all',lite:true},
  {id:'belfry',label:'From the belfry (north): the dam the square cannot see',eye:[1423,34.3,1185.5],target:DAM,fov:55,hours:[GOLDEN],themes:'all'},
  {id:'belfrySouth',label:'Over the roofs (belfry south): the town to the quay',eye:[1423,34.3,1188.8],target:[1470,2,1320],fov:62,hours:[GOLDEN],themes:'all',lite:true},
  {id:'mouth',label:'From the water: the town climbing from Lantern Row to the campanile',eye:[1545,16,1425],target:[1452,20,1190],fov:44,hours:[GOLDEN,DUSK],themes:'all',lite:true},
  {id:'square',label:'The piazza: brick, travertine rays, the Court\'s inlay, the campanile and the palazzo',eye:[1481,13.7,1201],target:[1436,16,1160],fov:62,hours:[GOLDEN,NIGHT],themes:'all',lite:true},
  {id:'lanternRow',label:'Lantern Row at night from the ferry pier',eye:[1470,2.7,1347],target:[1452,9,1268],fov:60,hours:[NIGHT],themes:'all'},
  {id:'bocce',label:'Bocce on the small green, the palazzo behind',eye:[1471,13.9,1156],target:[1453.5,12.4,1147],fov:55,hours:[GOLDEN],themes:'classic'},
  {id:'market',label:'Down Town Weave through the market lane',eye:[1449.5,11.2,1219],target:[1468,7.5,1258],fov:60,hours:[NOON],themes:'classic'},
  {id:'vicolo',label:'A cobbled lane (quayLink) with laundry overhead',eye:[1409.3,12.8,1226],target:[1401.3,9.4,1278],fov:60,hours:[NOON],themes:'classic'},
  {id:'upper',label:'The upper street, down to the piazza',eye:[1471.5,19.6,1050],target:[1466,15,1125],fov:58,hours:[NOON],themes:'classic'},
  {id:'aerial',label:'Aerial from the harbour mouth',eye:[1630,150,1450],target:[1462,12,1185],fov:42,hours:[GOLDEN,NIGHT],themes:'classic',lite:true},
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
  for(const tier of tiers)for(const theme of themes){
    const poses=POSES.filter(p=>(!only||only.includes(p.id))&&(p.themes==='all'||p.themes===theme)&&(tier==='full'||p.lite));
    if(!poses.length)continue;
    const page=await browser.newPage({viewport:VIEW,timezoneId:'America/Toronto',deviceScaleFactor:1});page.setDefaultTimeout(600000);
    page.on('pageerror',e=>errors.push({theme,tier,message:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({theme,tier,message:m.text().slice(0,300)});});
    await page.goto(`${origin}/horizon-review.html?world=horizon&tier=${tier}&theme=${theme}&date=${DATE}&sun=${GOLDEN}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:300000});
    await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls,.horizon-inspector{visibility:hidden!important}'});
    log('page',theme,tier);
    for(const p of poses)for(const hhmm of p.hours){
      try{
        await page.evaluate(({p,DATE,hhmm})=>{const w=window.__harbour,views=w.world.views,i=views.findIndex(v=>v.id===`H_${p.id}`);const v={id:`H_${p.id}`,label:p.label,eye:p.eye,target:p.target,fovDegrees:p.fov,aspect:1,radius:260,portrait:null};if(i>=0)views[i]=v;else views.push(v);w.shot(`H_${p.id}`);const [H,M]=hhmm.split(':').map(Number);const d=new Date(`${DATE}T12:00:00-04:00`);d.setHours(H,M,0,0);w.setDate(d);},{p,DATE,hhmm});
        await page.evaluate(()=>window.__harbour.settle(300000));
        await page.waitForFunction(()=>{const s=window.__harbour.dressingRenderStatus?.();return !s||!s.building;},null,{timeout:300000}).catch(()=>{});
        await page.waitForTimeout(4500);
        await page.evaluate(()=>window.__harbour.settle(120000));await page.waitForTimeout(1500);
        const png=join(output,`_tmp.png`),file=`${p.id}_${hhmm.replace(':','-')}_${theme}_${tier}.jpg`;
        await page.locator('.horizon-stage canvas').screenshot({path:png,timeout:240000});
        await sharp(png).jpeg({quality:74,mozjpeg:true}).toFile(join(output,file));await rm(png);
        const stats=await page.evaluate(()=>{const s=window.__harbour.stats(),d=s.drawSamples.at(-1)??null;return{drawCalls:d?.calls??null,triangles:d?.triangles??null,dressing:window.__harbour.dressingRenderStatus?.()?.districts??null,camera:s.camera};});
        records.push({file,id:p.id,label:p.label,theme,tier,time:hhmm,date:DATE,eye:p.eye,target:p.target,fov:p.fov,stats});log(file,'draw',stats.drawCalls,'tri',stats.triangles);
      }catch(e){errors.push({theme,tier,pose:p.id,message:String(e).slice(0,300)});log('FAILED',p.id,theme,tier,String(e).slice(0,160));}
    }
    await page.close();
  }
}finally{await browser.close();killServer();}
await writeFile(join(output,'captures.json'),JSON.stringify({sha,renderer:'headless Chromium, SwiftShader (not device evidence)',view:VIEW,records,errors},null,1));
log('done',records.length,'captures',errors.length,'errors');
