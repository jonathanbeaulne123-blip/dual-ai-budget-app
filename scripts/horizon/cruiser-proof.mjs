import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.CRUISER_PROOF_DIR??'/tmp/island-cruiser-proof';await mkdir(out,{recursive:true});
const origin=process.env.CRUISER_PROOF_URL??'http://127.0.0.1:5206';
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--disable-background-networking']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
const report={method:'Real HorizonStage, real key/pointer input and rendered runtime. Review surface, separate from ordinary App proof.',scenarios:[],errors};
const state=()=>page.evaluate(()=>window.__harbour.cruiserState());
const record=async(name)=>{const s=await state();report.scenarios.push({name,state:s});console.log(name,JSON.stringify(s));return s;};
try{
 await page.goto(`${origin}/horizon-review.html?world=horizon&tier=lite&sun=13:02`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__harbour?.stats().firstInteractiveMs!==null&&window.__harbour?.stats().firstInteractiveMs!==undefined,null,{timeout:180000});console.log('Horizon ready');
 await page.evaluate(()=>{const r=window.__harbour;r.restore({world:'horizon:horizon-geo-1',geo:'horizon-geo-1',place:'court',x:1400,y:24,z:1060,yaw:1.8041});});
 for(let i=0;i<40;i++){await page.getByRole('button',{name:'Ride',exact:true}).click();if(await state())break;await page.waitForTimeout(1000);}
 assert.ok(await state(),'mounted through Ride button');await page.waitForTimeout(900);
 await page.locator('.horizon-stage').focus();await page.keyboard.down('w');await page.waitForFunction(()=>{const s=window.__harbour.cruiserState();return Math.hypot(s.vx,s.vz)>11},null,{timeout:30000});await page.keyboard.up('w');
 const road=await record('open-road');assert.ok(Math.hypot(road.x-1400,road.z-1060)>8);
 await page.keyboard.down('s');await page.waitForFunction(()=>{const s=window.__harbour.cruiserState();return Math.hypot(s.vx,s.vz)<.01},null,{timeout:20000});await page.waitForTimeout(350);const stopped=await record('held-brake-no-reverse');assert.equal(stopped.reverse,false);await page.keyboard.up('s');
 await page.screenshot({path:`${out}/vespa-desktop.png`});
 await page.getByLabel('Cruiser style').selectOption('harley');const same=await state();assert.ok(Math.hypot(same.x-stopped.x,same.z-stopped.z)<.05);await page.screenshot({path:`${out}/harley-desktop.png`});
 await page.locator('.horizon-stage').focus();await page.keyboard.down('a');await page.waitForTimeout(700);await page.keyboard.up('a');const turned=await record('stationary-turn');assert.ok(Math.abs(turned.yaw-stopped.yaw)>.15);
 for(const skin of ['vespa','harley']){
  await page.getByLabel('Cruiser style').selectOption(skin);await page.locator('.horizon-stage').focus();const before=await state();
  for(const perspective of ['first-person','floating','activity']){await page.keyboard.press('c');await page.waitForTimeout(220);const shot=await page.evaluate(()=>{const r=window.__harbour,a=r.scene.children.find(o=>o.userData.skin);return {perspective:r.moverState().perspective,visible:a?.visible,state:r.cruiserState()};});assert.equal(shot.perspective,perspective);assert.equal(shot.visible,perspective!=='first-person');assert.equal(shot.state.yaw,before.yaw);assert.equal(shot.state.vx,before.vx);assert.equal(shot.state.vz,before.vz);if(perspective==='floating')await page.mouse.wheel(0,100);}
 }
 await record('both-skins-camera-cycle');
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.__harbour.cruiserState()?.grounded===false,null,{timeout:5000});await page.keyboard.press('v');assert.equal(await state(),null);assert.equal(await page.evaluate(()=>window.__harbour.moverState().mode),'parachute');assert.equal(await page.evaluate(()=>window.__harbour.scene.children.some(o=>o.userData.skin)),false);await page.waitForFunction(()=>window.__harbour.moverState().mode==='feet',null,{timeout:10000});
 await page.keyboard.down('w');await page.keyboard.press('Space');await page.waitForFunction(()=>window.__harbour.moverState().mode==='parachute',null,{timeout:5000});await page.waitForFunction(()=>window.__harbour.moverState().mode==='feet',null,{timeout:10000});const landed=await page.evaluate(()=>window.__harbour.body());await page.waitForTimeout(350);const walking=await page.evaluate(()=>window.__harbour.body());assert.ok(Math.hypot(walking.x-landed.x,walking.z-landed.z)>.1,'walking input survives ordinary jump landing');await page.keyboard.up('w');
 await page.keyboard.press('v');await page.waitForTimeout(350);assert.ok(await state());
 await page.keyboard.press('Space');await page.waitForFunction(()=>window.__harbour.cruiserState()?.grounded===false,null,{timeout:5000});await page.keyboard.down('Space');await page.waitForFunction(()=>window.__harbour.moverState().mode==='parachute',null,{timeout:5000});await page.waitForTimeout(150);assert.equal(await state(),null);await page.keyboard.up('Space');await page.waitForFunction(()=>window.__harbour.moverState().mode==='feet',null,{timeout:10000});await page.keyboard.press('v');await page.waitForTimeout(350);assert.ok(await state());await record('airborne-exits-and-remount');
 await page.getByRole('button',{name:'Look',exact:true}).click();const paused=await state();await page.waitForTimeout(650);assert.deepEqual(await state(),paused);await page.getByRole('button',{name:'Walk',exact:true}).click();await page.waitForTimeout(900);
 await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.press('v');await page.keyboard.up('w');assert.equal(await state(),null);const foot=await page.evaluate(()=>window.__harbour.body());await page.waitForTimeout(250);const after=await page.evaluate(()=>window.__harbour.body());assert.ok(Math.hypot(after.x-foot.x,after.z-foot.z)<.05);await record('dismounted');
 // Repeated ground handoffs start on the checked open road; the preceding walking jump changes the route.
 await page.evaluate(()=>window.__harbour.restore({world:'horizon:horizon-geo-1',geo:'horizon-geo-1',place:'court',x:1400,y:24,z:1060,yaw:1.8041}));await page.waitForTimeout(350);
 for(let i=0;i<3;i++){await page.keyboard.press('v');await page.waitForTimeout(250);assert.ok(await state());await page.keyboard.press('v');await page.waitForTimeout(250);assert.equal(await state(),null);}
 console.log('Repeated mount and dismount passed');
 await page.keyboard.press('v');await page.waitForTimeout(350);await page.keyboard.press('r');assert.ok(await state());await record('recovery');
 for(const theme of ['classic','taylor','newfoundland']){await page.evaluate(theme=>{window.__harbour.setCruiserTheme(theme);document.querySelector('.horizon-shell').className=`horizon-shell horizon-shell--review horizon-shell--${theme}`;},theme);for(const width of [320,390,720,1100]){await page.setViewportSize({width,height:width<700?844:900});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.ok(await page.evaluate(()=>document.querySelector('.horizon-toolbar').getBoundingClientRect().bottom<document.querySelector('.horizon-cruiser-controls').getBoundingClientRect().top),'toolbar and cruiser controls do not overlap');await page.screenshot({path:`${out}/${theme}-${width}.png`});}}
 await page.setViewportSize({width:390,height:844});const pad=page.getByRole('group',{name:'Ride pad: up accelerates, down brakes, left and right steer'});const beforePad=await state();const b=await pad.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+8);await page.mouse.down();await page.waitForTimeout(600);await page.mouse.up();const padRide=await record('touch-pad-ride');assert.ok(Math.hypot(padRide.x-beforePad.x,padRide.z-beforePad.z)>.05,'touch pad actually drives');await page.waitForTimeout(250);await page.getByRole('button',{name:'Hop',exact:true}).click();await page.waitForFunction(()=>window.__harbour.cruiserState()?.grounded===false,null,{timeout:5000});await record('touch-hop');
 assert.deepEqual(errors,[]);report.pass=true;
} catch(error){report.failure=String(error.stack??error);report.finalState=await page.evaluate(()=>({body:window.__harbour?.body(),mover:window.__harbour?.moverState(),status:document.querySelector('.horizon-status')?.textContent})).catch(()=>null);console.error(report.failure);await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});process.exitCode=1;}
finally{await writeFile(`${out}/review-report.json`,JSON.stringify(report,null,2));await browser.close();}
