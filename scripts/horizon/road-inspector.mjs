// Road main: the `=` inspector as evidence (brief §9). Mounts the cruiser at named Horizon Drive stations in the running
// review page (?diagnostics=1), rides a few metres with the live controller, opens the inspector and records its snapshot
// (position, the corridor station under the rider — road, reach, context, sides — frame ms p50/p95, draw calls, triangles,
// lights) plus a screenshot, at 1280 × 800 and at phone widths (390, 320) for the overlay's own legibility.
// Headless SwiftShader on the review harness: frame times are SwiftShader's, not a device's (CONTRACT §2.21).
//   node scripts/horizon/road-inspector.mjs --out docs/horizon/evidence/road/inspector [--port 5243]
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0?args[i+1]:f;};
const out=resolve(opt('out','docs/horizon/evidence/road/inspector')),port=Number(opt('port','5243'));
await mkdir(out,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
let server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:'ignore'});
const origin=`http://127.0.0.1:${port}`;
{const until=Date.now()+120000;let up=false;while(Date.now()<until&&!up){try{up=(await fetch(`${origin}/horizon-review.html`)).ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}if(!up)throw new Error('vite did not start');}
const kill=()=>{if(server&&server.exitCode===null)try{process.kill(-server.pid,'SIGTERM');}catch{}};process.on('exit',kill);
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],records=[],started=Date.now(),log=(...m)=>console.log(`[${((Date.now()-started)/1000).toFixed(0).padStart(4)}s]`,...m);
// Named stations on Horizon Drive (plan points; the rider is placed on the nearest bed point, keep-right).
const SPOTS=[
  {label:'harbour-gate-developed',at:[1470,1043]},
  {label:'prow-gallery-structure',at:[1592,890]},
  {label:'crown-coast',at:[1300,300]},
  {label:'bight-bridge-deck',at:[560,1100]},
  {label:'long-sands-boulevard',at:[1050,1396]},
];
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},timezoneId:'America/Toronto'});page.setDefaultTimeout(600000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));});
  await page.goto(`${origin}/horizon-review.html?world=horizon&tier=full&date=2026-06-21&sun=21:40&diagnostics=1&sha=${sha}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:300000});
  await page.waitForFunction(()=>{const c=window.__harbour.stats().chunks;return !c||window.__harbour.stats().chunksLoaded?.length===c.total;},null,{timeout:600000}).catch(e=>errors.push('chunks '+String(e).slice(0,200)));
  log('loaded');
  let n=0;
  for(const spot of SPOTS){
    try{
      const placed=await page.evaluate(({spot})=>{const h=window.__harbour,P=h.world.beds.find(b=>b.id==='V01').points;let bi=0,bd=Infinity;P.forEach((p,i)=>{const d=Math.hypot(p[0]-spot.at[0],p[2]-spot.at[1]);if(d<bd){bd=d;bi=i;}});
        const a=P[bi],b=P[Math.min(P.length-1,bi+1)],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1,r=[-dz/l,dx/l],yaw=Math.atan2(dx,dz);
        if(h.cruiserState())h.toggleCruiser();h.setCruiserSkin('vespa');
        h.restore({world:'horizon:horizon-geo-1',geo:h.world.geographyRevision,place:'court',x:a[0]+r[0]*2,y:a[1],z:a[2]+r[1]*2,yaw});return{index:bi};},{spot});
      await page.evaluate(()=>window.__harbour.settle(300000));
      let mounted=false;for(let i=0;i<30&&!mounted;i++){mounted=await page.evaluate(()=>!!(window.__harbour.cruiserState()||window.__harbour.toggleCruiser()));if(!mounted)await page.waitForTimeout(1000);}
      if(!mounted)throw new Error('cruiser did not mount');
      // A short straight ride with the live controller (no assist), then hold still for the snapshot.
      await page.evaluate(()=>{const h=window.__harbour;for(let i=0;i<20;i++){h.input({forward:.6,strafe:0});h.simulateMotion(.1);}for(let i=0;i<30;i++){h.input({forward:-1,strafe:0});h.simulateMotion(.1);}h.input({forward:0,strafe:0});});
      await page.evaluate(()=>window.__harbour.settle(300000));await page.waitForTimeout(3000);
      await page.evaluate(()=>{const h=window.__harbour;if(!document.querySelector('[data-horizon-inspector]')||document.querySelector('[data-horizon-inspector]')?.hidden)h.toggleInspector();});
      await page.waitForTimeout(1500);
      const snap=await page.evaluate(()=>window.__harbour.inspect());
      const file=`inspector_${String(++n).padStart(2,'0')}_${spot.label}.png`;
      await page.screenshot({path:join(out,file)});
      records.push({label:spot.label,file,placed,snapshot:snap});log(file,JSON.stringify({station:snap?.station,frame:snap?.frame??snap?.frameMs}).slice(0,300));
    }catch(e){errors.push(`${spot.label}: ${String(e).slice(0,300)}`);log('FAILED',spot.label,String(e).slice(0,200));}
  }
  // The overlay at phone widths (the last spot's view).
  for(const [w,h] of [[390,844],[320,640]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(2000);const file=`inspector_overlay_${w}.png`;await page.screenshot({path:join(out,file)});records.push({label:`overlay-${w}`,file});log(file);}
}finally{await browser.close();kill();}
await writeFile(join(out,'inspector.json'),JSON.stringify({sha,generated:new Date().toISOString(),method:'headless Chromium (SwiftShader) review page ?diagnostics=1; cruiser via restore + toggleCruiser + input/simulateMotion; snapshot = __harbour.inspect(). Frame times are SwiftShader, not device evidence.',records,errors},null,1));
log('done',records.length,'records',errors.length,'errors');
