import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const output=resolve(process.argv[2]??'/tmp/horizon-walk-proof'),url=process.env.HORIZON_REVIEW_URL??'http://127.0.0.1:5197';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},timezoneId:'America/Toronto'});
 await page.goto(`${url}/horizon-review.html?world=horizon&sun=13:02&date=2026-06-21`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__harbour?.stats,null,{timeout:120000});
 await page.waitForTimeout(1000);
 const ids=await page.evaluate(()=>window.__harbour.world.hosts.map(h=>h.id));
 const rows=[];
 for(const id of (process.env.HORIZON_HOSTS?.split(',')??ids)){
  const row=await page.evaluate(id=>{
   const h=window.__harbour,host=h.world.hosts.find(p=>p.id===id);h.pause(true);window.__horizonDoor=null;
   h.restore({world:'horizon:horizon-geo-1',geo:'horizon-geo-1',place:'court',x:1455,y:12,z:1175,yaw:0});
   const plan=h.walkTo([host.door.xy[0],host.door.height,host.door.xy[1]]),before=performance.now(),walk=plan?h.simulateWalk(plan.seconds+30):null;
   const body=h.body(),door=window.__horizonDoor;
   return{id,plan:plan?{length:plan.length,seconds:plan.seconds,offBedDistance:plan.offBedDistance,bedIds:plan.bedIds}:null,walk,body,event:door,passed:door?.host===id,simulationWallMs:performance.now()-before};
  },id);
  rows.push(row);console.log(JSON.stringify(row));
 }
 await writeFile(resolve(output,'doors.json'),JSON.stringify({method:'Accelerated fixed-step simulation of the runtime walking/collision/door callback. No teleport during each path. This is not manual device acceptance or an app financial-tool integration test.',rows},null,2));
}finally{await browser.close();}
