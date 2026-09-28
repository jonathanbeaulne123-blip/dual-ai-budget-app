import {chromium} from '@playwright/test';
import {writeFile,copyFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.CRUISER_PROOF_DIR??'/tmp/island-cruiser-proof';await mkdir(out,{recursive:true});
const origin=process.env.CRUISER_PROOF_URL??'http://127.0.0.1:5206',browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
try{
 await page.goto(`${origin}/horizon-review.html?world=horizon&tier=lite`,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.__harbour?.stats().firstInteractiveMs,null,{timeout:180000});
 await page.evaluate(()=>window.__harbour.restore({world:'horizon:horizon-geo-1',geo:'horizon-geo-1',place:'court',x:1400,y:24,z:1060,yaw:1.8041}));
 for(let i=0;i<60;i++){const ok=await page.evaluate(()=>window.__harbour.cruiserState()||window.__harbour.toggleCruiser());if(ok)break;await page.waitForTimeout(1000);}
 const report=await page.evaluate(async()=>{
  const {createCruiserState,stepCruiser,cruiserSpeed,validCruiserPosition}=await import('/src/harbour/horizon/movers/cruiser/sim.ts');
  const r=window.__harbour;r.pause(true);const g=r.geography,rows=[];
  for(const [id,startIndex,endIndex,seconds,throttle] of [['V01',0,150,45,1],['S1',66,104,40,.8],['town.storefront',5,15,20,.4]]){
   const bed=r.world.beds.find(b=>b.id===id);if(!bed){rows.push({id,error:'No bed'});continue;}const points=bed.points.map((p,i)=>id==='V01'&&i>=85&&i<=140?[p[0]+1.5*Math.min(1,(i-85)/10,(140-i)/10),p[1],p[2]]:p),p=points[startIndex],q=points[startIndex+1],at={x:p[0],y:p[1],z:p[2],yaw:Math.atan2(q[0]-p[0],q[2]-p[2])};
   const valid=validCruiserPosition(g,at);if(!valid){rows.push({id,error:'Start not clear',at,surface:g.surface(at.x,at.z,at.y),blocker:g.blocker(at.x,at.z,at.y,.46)});continue;}
   let s=createCruiserState(valid),index=startIndex+1,travel=0,contacts=0,air=0,maxSpeed=0,still=0,longestStop=0,steps=0,stopping=false;
   for(let i=0;i<seconds*120&&index<=endIndex;i++){
    while(index<endIndex&&Math.hypot(points[index][0]-s.x,points[index][2]-s.z)<3)index++;
    const to=points[index],angle=Math.atan2(Math.sin(Math.atan2(to[0]-s.x,to[2]-s.z)-s.yaw),Math.cos(Math.atan2(to[0]-s.x,to[2]-s.z)-s.yaw));
    const remaining=Math.hypot(to[0]-s.x,to[2]-s.z);
    if(index===endIndex&&remaining<cruiserSpeed(s)**2/32+1)stopping=true;
    const next=stepCruiser(s,{forward:stopping?-1:Math.abs(angle)>1?.3:throttle,steer:stopping?0:Math.max(-1,Math.min(1,-angle*1.8)),jump:false},g);
    const moved=Math.hypot(next.x-s.x,next.z-s.z);travel+=moved;still=moved<.001?still+1:0;longestStop=Math.max(longestStop,still/120);steps++;if(!Object.values(next).filter(v=>typeof v==='number').every(Number.isFinite))throw Error('Non-finite body');contacts+=next.contact?1:0;air+=next.grounded?0:1;maxSpeed=Math.max(maxSpeed,cruiserSpeed(next));s=next;
    if(stopping&&cruiserSpeed(s)<.01)break;
   }
   rows.push({id,startIndex,endIndex,stopped:stopping&&cruiserSpeed(s)<.01,endDistance:Math.hypot(points[endIndex][0]-s.x,points[endIndex][2]-s.z),index,pointCount:points.length,seconds:steps/120,travel,contacts,air,maxSpeed,longestStop,body:s,progress:index-startIndex,detour:id==='V01'?'1.5m to the east around solid raised layby corner; no runtime road assistance':null});
  }
  return {method:'Fixed-step scripted steering over the rendered Horizon geography, separate from real-time keyboard browser proof.',rows};
 });
 report.errors=errors;report.pass=report.rows.every(row=>row.stopped&&row.endDistance<2&&row.maxSpeed<=16.001&&row.longestStop<.25)&&errors.length===0;console.log(JSON.stringify(report,null,2));await copyFile(`${out}/routes.json`,`${out}/routes-exploration.json`).catch(()=>{});await writeFile(`${out}/routes.json`,JSON.stringify(report,null,2));assert.ok(report.pass,'bounded routes finish and brake beside their endpoint');
}finally{await browser.close();}
