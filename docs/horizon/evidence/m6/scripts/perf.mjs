// M6 per-frame timing during a flight, full and ?tier=lite, and the CPU cost of the mover per step (the builders'
// geography.blocked hot spot near pads). Also samples the camera's roll every frame (FLIGHT §4: horizon-locked).
// Needs the vite server on 5199. Headless Chromium renders with SwiftShader (CPU): the frame times are an upper bound
// for this 2-core container, not a device measurement; the mover's CPU cost per step is the comparable number.
import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const here=dirname(fileURLToPath(import.meta.url)),out=resolve(here,'..');await mkdir(out,{recursive:true});
const BASE=process.env.HORIZON_URL??'http://127.0.0.1:5199';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const frames=(page,n=3)=>page.evaluate(n=>new Promise(r=>{let k=0;const f=()=>{if(++k>=n)r();else requestAnimationFrame(f);};requestAnimationFrame(f);}),n);
const stats=a=>{const s=[...a].sort((x,y)=>x-y),q=p=>s[Math.min(s.length-1,Math.floor(p*(s.length-1)))];return{n:s.length,mean:+(s.reduce((x,y)=>x+y,0)/Math.max(1,s.length)).toFixed(2),p50:+q(.5).toFixed(2),p95:+q(.95).toFixed(2),max:+(s.at(-1)??0).toFixed(2)};};
async function run(label,query,viewport){
  const context=await browser.newContext({viewport,timezoneId:'America/Toronto'}),page=await context.newPage();
  await page.goto(`${BASE}/horizon-review.html?world=horizon&sun=11:00${query}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__harbour?.stats&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:240000});
  // Instrument geography.blocked (the env and the flight cam call it through the runtime's geography object).
  await page.evaluate(()=>{const g=window.__harbour.geography,orig=g.blocked.bind(g);window.__blocked={calls:0,ms:0};g.blocked=(...a)=>{const t=performance.now();try{return orig(...a);}finally{window.__blocked.calls++;window.__blocked.ms+=performance.now()-t;}};
    const h=window.__harbour,t=h.world.thresholds.find(t=>t.id==='crownLaunch');h.setMode('walk');h.restore({world:'horizon:horizon-geo-1',geo:'horizon-geo-1',place:'court',x:t.at[0],y:t.height,z:t.at[1],yaw:Math.PI});});
  await page.waitForTimeout(1500);await frames(page,6);
  const walk=await page.evaluate(()=>window.__harbour.stats().frames.slice(-10));
  await page.locator('.horizon-offer',{hasText:'Run off'}).first().click({timeout:180000});
  await page.locator('.horizon-stage').focus();await page.keyboard.down('w');
  await page.waitForFunction(()=>window.__horizonFlight?.phase()==='flight'||window.__horizonFlight?.phase()==='flare',null,{timeout:300000,polling:100});
  await page.keyboard.up('w');
  // Real-time flight: bank right, then left, through the runtime's own frames (input() → the mover hook each frame).
  const real=await page.evaluate(async()=>{
    const h=window.__harbour,cam=h.camera,rows=[];let last=performance.now();window.__blocked.calls=0;window.__blocked.ms=0;
    const V=cam.position.constructor;
    for(let i=0;i<40;i++){
      h.input({bar:0,bank:i<20?.8:-.8});
      await new Promise(r=>requestAnimationFrame(r));
      const now=performance.now(),right=new V(1,0,0).applyQuaternion(cam.quaternion),p=window.__horizonFlight.probe();
      rows.push({frameMs:now-last,rollDeg:Math.asin(Math.max(-1,Math.min(1,right.y)))*180/Math.PI,bankDeg:p.bank*180/Math.PI,y:p.y,agl:window.__horizonFlight.hud().height,phase:p.phase,fov:cam.fov});last=now;
    }
    const b={...window.__blocked};return{rows,blocked:b,draw:h.stats().drawSamples.at(-1)};
  });
  // CPU cost of the mover per 1/60 s step (sim + env + flight cam), runtime paused so no rendering: near the pad vs. high.
  const cpu=await page.evaluate(()=>{
    const h=window.__harbour,c=window.__horizonFlight;h.pause(true);const res=[];
    for(const [name,n,bank] of [['low near the Crown (first 4 s after the frames above)',240,.3],['next 20 s descending off the Crown',1200,0]]){
      window.__blocked.calls=0;window.__blocked.ms=0;const times=[];
      for(let i=0;i<n&&!c.finished();i++){const t=performance.now();c.update(1/60,{forward:0,strafe:0,run:false,bar:0,bank,pull:false,look:[0,0]});times.push(performance.now()-t);}
      const p=c.probe();res.push({name,steps:times.length,meanMs:times.reduce((a,b)=>a+b,0)/Math.max(1,times.length),maxMs:Math.max(...times),blockedCalls:window.__blocked.calls,blockedMs:window.__blocked.ms,blockedMsPerCall:window.__blocked.ms/Math.max(1,window.__blocked.calls),end:{y:p.y,x:p.x,z:p.z,agl:c.hud().height}});
    }
    h.pause(false);return res;
  });
  const renderer=await page.evaluate(()=>window.__harbour.stats().renderer);
  await context.close();
  return{label,query,viewport,renderer,walkFramesMs:stats(walk),flightFramesMs:stats(real.rows.slice(2).map(r=>r.frameMs)),rollDegMaxAbs:Math.max(...real.rows.map(r=>Math.abs(r.rollDeg))),bankDegRange:[Math.min(...real.rows.map(r=>r.bankDeg)),Math.max(...real.rows.map(r=>r.bankDeg))],fov:[...new Set(real.rows.map(r=>+r.fov.toFixed(2)))],blockedDuringRealFrames:{...real.blocked,perFrame:real.blocked.calls/real.rows.length,msPerFrame:real.blocked.ms/real.rows.length},draw:real.draw,moverCpuPerStep:cpu,rows:real.rows};
}
const result={sha:execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim(),generated:new Date().toISOString(),note:'Headless Chromium 140 / SwiftShader (CPU WebGL) on a 2-core container. Frame times are this container\'s upper bound, not a phone or a Mac. moverCpuPerStep isolates the M6 controller (sim + env + flight cam) from rendering.',runs:[]};
try{
  result.runs.push(await run('full','',{width:1100,height:800}));
  result.runs.push(await run('lite','&tier=lite',{width:390,height:844}));
}finally{await writeFile(resolve(out,'perf.json'),JSON.stringify(result,null,1));await browser.close();}
for(const r of result.runs)console.log(r.label,JSON.stringify({walk:r.walkFramesMs,flight:r.flightFramesMs,roll:r.rollDegMaxAbs,bank:r.bankDegRange,fov:r.fov,blocked:r.blockedDuringRealFrames,cpu:r.moverCpuPerStep}));
