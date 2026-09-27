// Local actual-runtime proof. Start Vite on port 5198; no household or financial fixtures.
import {chromium} from '@playwright/test';

import fs from 'node:fs';
const output=process.env.HEARTH_ARTIFACTS_DIR??'/tmp/hearth-offshore-fleet';fs.mkdirSync(output,{recursive:true});
let browser;
(async()=>{browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu']});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto((process.env.HORIZON_FLEET_URL??'http://127.0.0.1:5198')+'/horizon-review.html?world=horizon&tier=lite&sun=13:02&date=2026-06-21');await page.waitForFunction(()=>window.__harbour?.simulateMotion,null,{timeout:120000});await page.waitForFunction(()=>__harbour.stats().chunksLoaded?.length===14,null,{timeout:120000});
const results=[];
for(const id of ['kayak','dinghy','motorboat']){
 await page.evaluate(id=>{const h=__harbour;h.restore({x:1523.5,y:1.2,z:{kayak:1268,dinghy:1276,motorboat:1283}[id],yaw:Math.PI/2,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'});},id);
 await page.waitForTimeout(300);
 const launch=await page.evaluate(id=>({actions:__harbour.fleetActions(),ok:__harbour.fleetAction('board-'+id+'-0')}),id);console.log('LAUNCH',id,JSON.stringify(launch));
 if(!launch.ok)throw new Error('Board failed '+id);
 const drive=async(x,z)=>page.evaluate(({x,z,id})=>{const h=__harbour;let min=Infinity,steps=0;for(;steps<800;steps++){const v=h.fleetState().vessels.find(v=>v.id===id),d=Math.hypot(x-v.x,z-v.z);min=Math.min(min,d);const goal=Math.atan2(x-v.x,z-v.z),delta=Math.atan2(Math.sin(goal-v.yaw),Math.cos(goal-v.yaw));h.input({forward:d<.4?0:Math.abs(delta)>.7?0:Math.min(.8,d/15),strafe:d<.4?0:Math.max(-1,Math.min(1,delta*2))});h.jumpHold(d<.4);h.simulateMotion(.1);if(d<.6&&Math.abs(v.speed)<.15||d<1.3&&h.fleetActions().some(a=>a.id==='moor-'+id||a.id==='shore-'+id))break;}h.input({forward:0,strafe:0});h.jumpHold(false);return{steps,min,input:h.moverInput(),mode:h.moverState(),body:h.body(),vessel:h.fleetState().vessels.find(v=>v.id===id),actions:h.fleetActions()};},{x,z,id});
 await drive(1620,1307);const outbound=await drive(1620,1314.35);console.log('OUT',id,JSON.stringify(outbound));if(outbound.min>2)throw new Error('Route failed '+id);
 await page.screenshot({path:output+'/approach-'+id+'.png'});
 const boarding=await page.evaluate(id=>({ok:__harbour.fleetAction('moor-'+id),body:__harbour.body()}),id);console.log('BOARD',id,JSON.stringify(boarding));if(!boarding.ok)throw new Error('Moor failed');
 await page.screenshot({path:output+'/yacht-'+id+'.png'});
 const back=await page.evaluate(id=>__harbour.fleetAction('return-'+id),id);if(!back)throw new Error('Return tender failed');
 // Move clear of the yacht stern, then turn and cruise back to the dock.
 await drive(1620,1307);
 const returned=await drive(id==='motorboat'?1528:1527,{kayak:1269,dinghy:1276,motorboat:1283}[id]);
 const dismount=await page.evaluate(id=>({ok:__harbour.fleetAction('shore-'+id),body:__harbour.body(),actions:__harbour.fleetActions()}),id);console.log('HOME',id,JSON.stringify({returned,dismount}));
 if(!dismount.ok)throw new Error('Shore return failed '+id);
 results.push({id,launch:launch.ok,outbound,boarding,returned,dismount});
}
fs.writeFileSync(output+'/journeys.json',JSON.stringify({results,errors},null,2));if(errors.length)throw Error(errors.join('\n'));await browser.close();console.log('DONE',errors);
})().catch(async e=>{console.error(e);process.exitCode=1;await browser?.close();});
