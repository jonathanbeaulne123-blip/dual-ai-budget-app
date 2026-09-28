// Actual runtime input ownership, touch brake and retained camera choice.
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const output=process.env.HEARTH_ARTIFACTS_DIR??'/tmp/hearth-offshore-fleet';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto((process.env.HORIZON_FLEET_URL??'http://127.0.0.1:5198')+'/horizon-review.html?world=horizon&tier=lite&sun=13:02&date=2026-06-21');
 await page.waitForFunction(()=>window.__harbour?.stats().chunksLoaded?.length===14,null,{timeout:120000});
 await page.evaluate(()=>{const h=__harbour;h.restore({x:1523.5,y:1.2,z:1276,yaw:Math.PI/2,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'});if(!h.fleetAction('board-dinghy-0'))throw Error('Boarding failed');h.input({forward:1});h.simulateMotion(2);});
 const brake=page.getByRole('button',{name:'Brake',exact:true});await brake.waitFor();await page.locator('.horizon-stage').focus();await page.evaluate(()=>{__harbour.input({forward:1});__harbour.simulateMotion(1);});const box=await brake.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 const held=await page.evaluate(()=>{const h=__harbour,speed=h.fleetState().vessels[1].speed;h.simulateMotion(1);return{input:h.moverInput(),speedBefore:speed,speedAfter:h.fleetState().vessels[1].speed,focused:document.activeElement?.className};});
 if(!held.input.jump||held.speedAfter>=held.speedBefore||held.focused!=='horizon-stage')throw Error('Brake lost ownership '+JSON.stringify(held));await page.mouse.move(2,400);await page.mouse.up();const released=await page.evaluate(()=>{__harbour.simulateMotion(.1);return __harbour.moverInput().jump;});if(released)throw Error('Brake stuck after release');
 const setup=await page.evaluate(async()=>{const h=__harbour,M=await import('/src/harbour/horizon/movers/fleet/model.ts'),L=await import('/src/harbour/horizon/movers/fleet/layout.ts');h.restore({...M.toWorld(h.fleetState().vessels[3],L.HELM),yaw:0,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'});h.fleetAction('helm');h.fleetAction('anchor');h.cyclePerspective();return h.fleetState().perspective;});if(setup!=='first-person')throw Error('Camera setup failed');await page.waitForTimeout(100);
 const before=await page.evaluate(()=>({q:__harbour.camera.quaternion.toArray(),yaw:__harbour.body().yaw}));await page.evaluate(()=>{__harbour.input({forward:1,strafe:.8});__harbour.simulateMotion(3);__harbour.input({forward:0,strafe:0});});await page.waitForTimeout(100);
 const after=await page.evaluate(()=>({q:__harbour.camera.quaternion.toArray(),yaw:__harbour.body().yaw}));if(Math.abs(after.yaw-before.yaw)<.05||after.q.some((v,i)=>Math.abs(v-before.q[i])>.001))throw Error('First person changed with helm yaw '+JSON.stringify({before,after}));
 await page.evaluate(()=>{__harbour.fleetAction('anchor');__harbour.fleetAction('leave-helm');__harbour.simulateMotion(10);});if(await page.evaluate(()=>__harbour.fleetState().perspective)!=='first-person')throw Error('Leaving helm changed camera');
 await page.locator('.horizon-stage').focus();await page.keyboard.down('Space');const landed=await page.evaluate(()=>{__harbour.simulateMotion(1.8);return{body:__harbour.body(),mode:__harbour.moverState()};});if(landed.mode.attached)throw Error('Held jump reopened after landing');await page.keyboard.up('Space');
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(output+'/controls-proof.json',JSON.stringify({held,released,before,after,landed,errors},null,2));console.log('CONTROLS',JSON.stringify({held,released,before,after,landed,errors}));
}finally{await browser.close();}
