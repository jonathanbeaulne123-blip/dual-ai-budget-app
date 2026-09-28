// Actual Horizon rendering and responsive controls; no financial fixtures.
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const output=process.env.HEARTH_ARTIFACTS_DIR??'/tmp/hearth-offshore-fleet';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu']});
const results=[],errors=[];
try{for(const theme of['classic','taylor','newfoundland']){
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto((process.env.HORIZON_FLEET_URL??'http://127.0.0.1:5198')+'/horizon-review.html?world=horizon&tier=lite&sun=13:02&date=2026-06-21&theme='+theme);
 await page.waitForFunction(()=>window.__harbour?.stats().chunksLoaded?.length===14,null,{timeout:120000});
 await page.evaluate(()=>{__harbour.restore({x:1620,y:3.85,z:1335.5,yaw:Math.PI,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'});});await page.waitForTimeout(350);
 await page.screenshot({path:output+'/galley-'+theme+'.png'});
 const cutaway=await page.evaluate(()=>{const h=__harbour,root=h.scene.getObjectByName('fleet.yacht'),wall=root.getObjectByName('main-side--5.6-cutaway'),before=wall.visible,firstCamera=h.camera.position.clone();h.jump();h.simulateMotion(.25);const during=wall.visible;h.simulateMotion(1);return{before,during,cameraShift:firstCamera.distanceTo(h.camera.position)};});if(cutaway.before||cutaway.during)throw Error('Jump restored cutaway walls');
 await page.locator('.horizon-stage').focus();await page.keyboard.press('c');await page.waitForTimeout(180);await page.screenshot({path:output+'/first-person-'+theme+'.png'});await page.keyboard.press('c');await page.keyboard.press('c');
 const liveTheme=await page.evaluate(()=>{const h=__harbour,before=h.fleetState(),body=h.body(),old=h.scene.getObjectByName('fleet.yacht'),beforeColor=old.getObjectByName('hull').material.color.getHexString(),original=h.settings().theme;let disposed=false;old.getObjectByName('hull').geometry.addEventListener('dispose',()=>{disposed=true;});h.setTheme(original==='taylor'?'newfoundland':'taylor');const next=h.scene.getObjectByName('fleet.yacht'),afterColor=next.getObjectByName('hull').material.color.getHexString();if(next===old||beforeColor===afterColor||old.parent?.parent||!disposed)throw Error('Theme did not replace and dispose fleet art');if(JSON.stringify(h.fleetState())!==JSON.stringify(before)||JSON.stringify(h.body())!==JSON.stringify(body))throw Error('Appearance reset fleet or passenger');h.setTheme(original);return{beforeColor,afterColor,disposed,preservedState:true};});
 const style=await page.locator('.horizon-fleet').evaluate(e=>({color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);const bounds=await page.locator('.horizon-fleet').boundingBox(),toolbar=await page.locator('.horizon-toolbar').boundingBox();if(!toolbar||bounds.y<toolbar.y+toolbar.height+8)throw Error('Fleet panel overlaps world toolbar');if(!bounds||bounds.x<0||bounds.x+bounds.width>390||bounds.y+bounds.height>500)throw Error('Mobile panel overflow');await page.screenshot({path:output+'/phone-'+theme+'.png'});
 results.push({theme,style,cutaway,liveTheme,mobileBounds:bounds,toolbarBounds:toolbar});await page.close();
}if(new Set(results.map(r=>r.style.color)).size!==3)throw Error('Theme treatments flattened');if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(output+'/visual-proof.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify(results));}finally{await browser.close();}
