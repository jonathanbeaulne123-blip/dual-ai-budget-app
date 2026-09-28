// A validated saved tender supplies the initial fixture; swimming and shore movement are live.
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const output=process.env.HEARTH_ARTIFACTS_DIR??'/tmp/hearth-offshore-fleet';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{const ids=['kayak','dinghy','motorboat','yacht'],vessels=ids.map((id,i)=>({id,x:id==='yacht'?1620:id==='motorboat'?1528:1527,y:0,z:[1269,1276,1283,1340][i],yaw:0,speed:0,turn:0,anchor:true,moored:false,seat:0,passenger:false}));Object.assign(vessels[1],{x:860,z:1486,yaw:Math.PI});localStorage.setItem('hearth:horizon-fleet:review:v1',JSON.stringify({version:1,vessels,doors:[],body:{x:860,y:.4,z:1486.7,yaw:Math.PI},aboard:'dinghy',pilot:'dinghy',local:{x:0,y:.4,z:-.7,yaw:0}}));});
 await page.goto((process.env.HORIZON_FLEET_URL??'http://127.0.0.1:5198')+'/horizon-review.html?world=horizon&tier=lite&sun=13:02&date=2026-06-21');await page.waitForFunction(()=>window.__harbour?.stats().chunksLoaded?.length===14,null,{timeout:120000});
 const proof=await page.evaluate(()=>{const h=__harbour;if(h.moverState().mode!=='dinghy')throw Error('Tender fixture not restored');if(!h.fleetAction('leave-dinghy'))throw Error('Cannot enter water');h.simulateMotion(.1);const wet={body:h.body(),swimming:h.fleetState().swimming};if(!wet.swimming)throw Error('Fixture did not start swimming '+JSON.stringify(wet));h.look(Math.atan2(Math.sin(Math.PI-h.body().yaw),Math.cos(Math.PI-h.body().yaw)),0);h.input({forward:1});h.simulateMotion(4);h.input({forward:0});const ashore={body:h.body(),swimming:h.fleetState().swimming};if(ashore.swimming||ashore.body.y<0||Math.abs(ashore.body.x-wet.body.x)>1||Math.hypot(ashore.body.x-wet.body.x,ashore.body.z-wet.body.z)>12)throw Error('Shore transition failed '+JSON.stringify({wet,ashore}));return{wet,ashore};});
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(output+'/shore-proof.json',JSON.stringify({proof,errors},null,2));console.log('SHORE',JSON.stringify({proof,errors}));
}finally{await browser.close();}
