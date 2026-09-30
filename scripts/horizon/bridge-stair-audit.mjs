/** Bight's real runtime walker, driven only by ordinary directional input after one initial placement. */
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const out='docs/horizon/evidence/bridges/after/stair';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],worldSha256=createHash('sha256').update(readFileSync('public/horizon/world/horizon-geo-1.json.gz')).digest('hex');
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5197/horizon-review.html?world=horizon&tier=full&date=2026-06-21&sun=13:00');
 await page.waitForFunction(()=>window.__harbour?.stats().chunksLoaded?.length===14,null,{timeout:240000});
 const result=await page.evaluate(()=>{
  const h=window.__harbour,P=(s,o,y)=>[460+.8192319205190405*s+.5734623443633283*o,y,1030+.5734623443633283*s-.8192319205190405*o];
  const routes={ascent:[P(127,7.4,12),P(127,14.4,12),P(104,14.4,24),P(102,14.4,24)],descent:[P(102,14.4,24),P(104,14.4,24),P(127,14.4,12),P(127,7.4,12)],meeting:[P(122,7.4,12),P(122,10.5,12),P(122,7.4,12)]},runs=[];
  for(const [name,points] of Object.entries(routes)){
   const p=points[0];h.input({forward:0,strafe:0});h.restore({world:'horizon:horizon-geo-1',geo:h.world.geographyRevision,place:'court',x:p[0],y:p[1],z:p[2],yaw:0});h.settle(60000);
   const start=h.body(),trace=[],legs=[];
   for(const goal of points.slice(1)){let still=0;
    for(let i=0;i<3000;i++){const b=h.body(),dx=goal[0]-b.x,dz=goal[2]-b.z,d=Math.hypot(dx,dz);if(d<.08)break;
     // Camera yaw is zero after restore: forward is +z, strafe is +x.
     const speed=Math.min(1,d/.1);h.input({forward:dz/d*speed,strafe:dx/d*speed});h.simulateMotion(.05);
     const next=h.body();trace.push([next.x,next.y,next.z]);if(Math.hypot(next.x-b.x,next.z-b.z)<.00001)still++;else still=0;if(still>20)break;
    }
    const b=h.body();legs.push({goal,actual:b,error:Math.hypot(b.x-goal[0],b.y-goal[1],b.z-goal[2])});
   }
   h.input({forward:0,strafe:0});runs.push({name,start,legs,trace,pass:legs.every(l=>l.error<.2)});
  }return runs;
 });
 if(createHash('sha256').update(readFileSync('public/horizon/world/horizon-geo-1.json.gz')).digest('hex')!==worldSha256)errors.push('World changed during replay; invalidate this run');
 writeFileSync(out+'/audit.json',JSON.stringify({method:'Real runtime input/simulateMotion; headless SwiftShader, not device evidence. Fixed approach authored in source; no position reset during a run.',worldSha256,runs:result,errors},null,2));
 console.log(JSON.stringify(result.map(({name,pass,legs})=>({name,pass,legs})),null,2));if(errors.length||result.some(r=>!r.pass))process.exitCode=1;
}finally{await browser.close();}
