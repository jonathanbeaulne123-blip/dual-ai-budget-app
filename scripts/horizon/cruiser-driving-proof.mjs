import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.CRUISER_PROOF_URL??'http://127.0.0.1:5206',out=process.env.CRUISER_PROOF_DIR??'/tmp/island-cruiser-proof';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
const report={method:'Rendered runtime, real-time analog inputs through the same input API as the ride pad. Diagnostic restore only sets each scenario start. No accelerated simulation.',rows:[],errors};
try{
 await page.goto(`${origin}/horizon-review.html?world=horizon&tier=lite&sun=13:02`,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.__harbour?.stats().firstInteractiveMs,null,{timeout:180000});
 for(const scenario of [{id:'S1',start:75,end:94,throttle:.65},{id:'town.storefront',start:5,end:13,throttle:.35},{id:'home-entrance',throttle:.35}]){
  const initial=await page.evaluate(scenario=>{
   const r=window.__harbour,bed=r.world.beds.find(b=>b.id===scenario.id),points=bed?bed.points.slice(scenario.start,scenario.end+1):[[1484,14,1165],[1486,14,1165],[1488,14,1165],[1490,14,1165]];
   const p=points[0],q=points[1],yaw=Math.atan2(q[0]-p[0],q[2]-p[2]);r.restore({world:'horizon:horizon-geo-1',geo:'horizon-geo-1',place:'court',x:p[0],y:p[1],z:p[2],yaw});window.__cruiserPoints=points;return r.body();
  },scenario);
  for(let i=0;i<60;i++){await page.getByRole('button',{name:'Ride',exact:true}).click();if(await page.evaluate(()=>!!window.__harbour.cruiserState()))break;await page.waitForTimeout(500);}
  assert.ok(await page.evaluate(()=>window.__harbour.cruiserState()),`mounted ${scenario.id}`);await page.waitForTimeout(900);
  await page.evaluate(scenario=>{
   const r=window.__harbour,points=window.__cruiserPoints;let index=1,stopping=false,last=r.cruiserState(),travel=0,maxSpeed=0,contacts=0;
   window.__cruiserResult=null;const begin=performance.now();
   const timer=setInterval(()=>{
    const s=r.cruiserState();if(!s){clearInterval(timer);window.__cruiserResult={error:'ownership lost'};return;}
    travel+=Math.hypot(s.x-last.x,s.z-last.z);last=s;const speed=Math.hypot(s.vx,s.vz);maxSpeed=Math.max(maxSpeed,speed);if(s.contact)contacts++;
    while(index<points.length-1&&Math.hypot(points[index][0]-s.x,points[index][2]-s.z)<2)index++;
    const to=points[index],distance=Math.hypot(to[0]-s.x,to[2]-s.z),err=Math.atan2(Math.sin(Math.atan2(to[0]-s.x,to[2]-s.z)-s.yaw),Math.cos(Math.atan2(to[0]-s.x,to[2]-s.z)-s.yaw));
    if(index===points.length-1&&distance<speed*speed/32+.8)stopping=true;
    r.input({forward:stopping?-1:scenario.throttle,strafe:stopping?0:Math.max(-1,Math.min(1,-err*1.8))});
    if((stopping&&speed<.02)||performance.now()-begin>100000){r.input({forward:0,strafe:0});clearInterval(timer);window.__cruiserResult={id:scenario.id,travel,maxSpeed,contacts,seconds:(performance.now()-begin)/1000,index,count:points.length,endDistance:distance,stopped:stopping&&speed<.02,body:s};}
   },70);
  },scenario);
  await page.waitForFunction(()=>window.__cruiserResult,null,{timeout:110000});const row=await page.evaluate(()=>window.__cruiserResult);report.rows.push({...row,initial});console.log(JSON.stringify(row));assert.ok(row.stopped&&row.endDistance<2&&row.maxSpeed<=16.001,scenario.id);
  await page.waitForTimeout(300);await page.screenshot({path:`${out}/live-${scenario.id}.png`});await page.getByRole('button',{name:'Get off',exact:true}).click();assert.equal(await page.evaluate(()=>window.__harbour.cruiserState()),null);
 }
 assert.deepEqual(errors,[]);report.pass=true;
}catch(e){report.failure=String(e.stack??e);console.error(report.failure);process.exitCode=1;await page.waitForTimeout(300);await page.screenshot({path:`${out}/live-failure.png`}).catch(()=>{});}
finally{await writeFile(`${out}/live-driving.json`,JSON.stringify(report,null,2));await browser.close();}
