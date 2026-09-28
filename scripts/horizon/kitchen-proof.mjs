// Real runtime, rendered UI and chef movement; review-only initial arrival is the sole placement fixture.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.KITCHEN_PROOF_URL??'http://127.0.0.1:5198',out=process.env.HEARTH_ARTIFACTS_DIR??'/tmp/hearth-yacht-kitchen';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--disable-background-networking']});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.__kitchenPads=[];Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.__kitchenPads});});
try{
 await page.goto(`${origin}/horizon-review.html?world=horizon&tier=lite&sun=13:02`);
 await page.waitForFunction(()=>window.__harbour?.stats().chunksLoaded?.length===14,null,{timeout:180000});
 assert.equal(await page.evaluate(()=>__harbour.kitchenCommand({type:'open'})),false,'no remote launch');
 await page.evaluate(async()=>{
  const h=__harbour,M=await import('/src/harbour/horizon/movers/fleet/model.ts'),G=await import('/src/harbour/horizon/kitchen/geometry.ts');
  const L=await import('/src/harbour/horizon/movers/fleet/layout.ts');let yacht=h.fleetState().vessels.find(v=>v.id==='yacht');h.restore({...M.toWorld(yacht,L.HELM),yaw:yacht.yaw,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'});h.fleetAction('helm');h.fleetAction('anchor');h.input({forward:1});h.simulateMotion(3);h.input({forward:0});h.fleetAction('leave-helm');yacht=h.fleetState().vessels.find(v=>v.id==='yacht');window.__kitchenYachtStart={...yacht};h.restore({...M.toWorld(yacht,G.KITCHEN_BOARD),yaw:0,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'});
  window.__kitchenProof={M,G};
 });
 await page.locator('.horizon-stage').focus();await page.keyboard.press('e');await page.getByRole('heading',{name:'Yacht Kitchen',exact:true}).waitFor();
 await page.getByRole('button',{name:'Set the table'}).click();await page.getByRole('button',{name:/Ready, Chef 1/}).click();await page.waitForFunction(()=>__harbour.kitchenView().state.phase==='playing');
 await page.locator('.horizon-stage').focus();for(const perspective of ['first-person','floating','activity']){await page.keyboard.press('c');assert.equal(await page.evaluate(()=>__harbour.fleetState().perspective),perspective);}
 const first=await page.evaluate(async()=>{
  const h=__harbour,{M,G}=window.__kitchenProof,C=await import('/src/harbour/horizon/kitchen/config.ts');
  const fleet=M.createFleet({water:()=>0,ground:()=>-12,blocked:()=>false,width:2200,depth:1800});for(const vessel of h.fleetState().vessels)Object.assign(fleet.get(vessel.id),vessel);fleet.doors.add('galley-aft-door');
  const state=()=>h.kitchenView().state,view=()=>h.kitchenView(),advance=s=>h.simulateMotion(s),action=(type,extra={})=>{h.kitchenCommand({type:'action',chef:0,action:{type,...extra}});advance(.05);};
  const go=(short)=>{
   const id=short.startsWith('yacht.')?short:'yacht.galley.'+short,st=view().stations.find(s=>s.id===id),stations=view().stations,start=state().chefs[0].pose,scale=4;
   if(!st)throw Error('Station missing '+id);const key=(x,z)=>x+','+z,begin=[Math.round(start.x*scale),Math.round(start.z*scale)],goal=[Math.round(st.approach.x*scale),Math.round(st.approach.z*scale)],queue=[begin],parents=new Map([[key(...begin),null]]);let found=null;
   for(let i=0;i<queue.length;i++){const [x,z]=queue[i];if(Math.hypot(x-goal[0],z-goal[1])<=1){found=key(x,z);break;}for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=key(nx,nz);if(parents.has(k)||!G.kitchenWalkable(fleet,{x:nx/scale,y:3.85,z:nz/scale},state().service==='sunset',stations))continue;parents.set(k,key(x,z));queue.push([nx,nz]);}}
   if(!found)throw Error('Unreachable '+id);const path=[];for(let k=found;k;k=parents.get(k))path.unshift(k.split(',').map(Number));
   for(const [px,pz]of path.slice(1))for(let i=0;i<12;i++){const p=state().chefs[0].pose,dx=px/scale-p.x,dz=pz/scale-p.z,n=Math.hypot(dx,dz);if(n<.045)break;h.kitchenInput(0,{x:-dx/Math.max(.16,n),z:dz/Math.max(.16,n)});advance(.05);}
   const p=state().chefs[0].pose,dx=st.at.x-p.x,dz=st.at.z-p.z,n=Math.hypot(dx,dz);h.kitchenInput(0,{x:-dx/n,z:dz/n});advance(1/60);h.kitchenInput(0,{x:0,z:0});advance(.05);if(state().chefs[0].target!==id)throw Error('Wrong target '+id+' got '+state().chefs[0].target);
  };
  const held=()=>state().items[state().chefs[0].held];
  const dish=(recipe)=>{for(const part of C.RECIPES[recipe].components){const st=view().stations.find(s=>s.ingredients?.includes(part.ingredient));go(st.id);action('interact',{ingredient:part.ingredient});const rule=C.INGREDIENTS[part.ingredient];if(part.phase==='prepared'||part.phase==='ready'&&rule.cook.from==='prepared'){go('prep-port');action('interact');action('prepare');advance(rule.prepSeconds);action('interact');}if(part.phase==='ready'){go(state().service==='sunset'&&rule.cook.appliance==='grill'?'yacht.kitchen.deck-grill':'hob');action('interact');advance(rule.cook.seconds);action('interact');}if(held()?.phase!==part.phase)throw Error('Incorrect component '+part.ingredient+' '+JSON.stringify(held()));go('plate');action('interact');}go('plate');action('interact');};
  const deliver=()=>{if(state().service==='banquet'){go('yacht.kitchen.trolley');if(state().trolley.dock===1){action('prepare');advance(10);go('yacht.kitchen.trolley');action('prepare');}action('interact');action('prepare');advance(10);go('yacht.kitchen.trolley');action('prepare');}else{go(state().service==='sunset'?'yacht.kitchen.deck-pass':'serve');action('interact');}};
  const wash=()=>{advance(6);go('return');action('interact');if(!held()?.dirty)throw Error('No dirty return');go('wash');action('interact');action('prepare');advance(3);};
  window.__kitchenProof={...window.__kitchenProof,go,dish,deliver,wash,action,advance,state};
  dish('bruschetta');deliver();if(state().served!==1)throw Error('First dish not served');wash();return view();
 });
 assert.equal(first.state.phase,'results');assert.equal(first.state.served,1);assert.ok(first.progress.unlocks.includes('chef-apron'));
 await page.waitForFunction(()=>document.querySelector('.kitchen-results'));await page.screenshot({path:`${out}/first-service-results.png`});
 await page.getByRole('button',{name:'Choose a service',exact:true}).click();await page.getByRole('heading',{name:'Yacht Kitchen',exact:true}).waitFor();
 const services=await page.evaluate(()=>{
  const h=__harbour,p=window.__kitchenProof,results=[];
  for(const players of[1,2])for(const service of(players===2?['first','lunch','sunset','banquet','practice']:['lunch','sunset','banquet','practice'])){
   if(players===2)window.__kitchenPads=[{index:0,connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))}];
   if(!h.kitchenCommand({type:'start',service,players,assists:{forgiveness:2,patience:2,hazards:true}}))throw Error('Cannot start '+service);
   for(let chef=0;chef<players;chef++)h.kitchenCommand({type:'action',chef,action:{type:'ready'}});
   let attempts=0;const cooked=new Set();
   while(p.state().phase==='playing'&&attempts<(service==='practice'?40:3)&&(service!=='practice'||cooked.size<5)){const order=p.state().orders.find(o=>o.status==='waiting');if(!order)break;const before=p.state().served;p.dish(order.recipe);p.deliver();if(p.state().served!==before+1)throw Error('Not served '+service+' '+JSON.stringify(p.state().events.slice(-3)));p.wash();cooked.add(order.recipe);attempts++;if(service!=='practice'&&p.state().remaining<90)break;}
   if(service==='practice'){if(cooked.size!==5)throw Error('Did not complete every recipe');p.action('ready');}else {while(p.state().phase==='playing')p.advance(Math.min(120,p.state().remaining+.1));}
   if(p.state().phase!=='results')throw Error('No results '+service);results.push(p.state().result);h.kitchenCommand({type:'open'});
  }
  return results;
 });
 const inputs=await page.evaluate(()=>{const h=__harbour;window.__kitchenPads=[0,1].map(index=>({index,connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))}));h.kitchenCommand({type:'start',service:'practice',players:2,assists:{}});h.kitchenCommand({type:'action',chef:0,action:{type:'ready'}});h.kitchenCommand({type:'action',chef:1,action:{type:'ready'}});h.simulateMotion(.05);const before=h.kitchenView().state.chefs.map(c=>c.pose);for(const c of h.kitchenView().connections){const index=Number(c.label.match(/Controller (\d+)/)[1])-1;window.__kitchenPads[index].axes=[c.chef===0?-1:1,0];}h.simulateMotion(.2);window.__kitchenPads.forEach(p=>{p.axes=[0,0];p.buttons[9]={pressed:true,value:1};});h.simulateMotion(.05);const paused=h.kitchenView().state;window.__kitchenPads.forEach(p=>p.buttons[9]={pressed:false,value:0});h.simulateMotion(2);return{before,after:paused.chefs.map(c=>c.pose),phase:paused.phase,elapsed:paused.elapsed,elapsedAfter:h.kitchenView().state.elapsed};});
 assert.equal(inputs.phase,'paused');assert.equal(inputs.elapsed,inputs.elapsedAfter);assert.ok(inputs.after[0].x>inputs.before[0].x);assert.ok(inputs.after[1].x<inputs.before[1].x);
 const moving=await page.evaluate(()=>({before:window.__kitchenYachtStart,after:__harbour.fleetState().vessels.find(v=>v.id==='yacht')}));assert.ok(moving.before.speed>0);assert.ok(moving.after.z>moving.before.z);assert.equal(moving.after.anchor,true);
 const interrupted=await page.evaluate(()=>{__harbour.kitchenCommand({type:'resume'});__harbour.pause(true);const before=__harbour.kitchenView().state.elapsed;__harbour.simulateMotion(30);__harbour.pause(false);window.dispatchEvent(new Event('pagehide'));return{before,after:__harbour.kitchenView().state.elapsed};});assert.equal(interrupted.before,interrupted.after);
 await page.reload();await page.waitForFunction(()=>window.__harbour?.stats().chunksLoaded?.length===14,null,{timeout:180000});
 const reload=await page.evaluate(()=>{const h=__harbour;return{phase:h.kitchenView().state.phase,resumable:h.kitchenView().resumable,progress:Object.keys(h.kitchenView().progress.completed).length};});assert.equal(reload.phase,'idle');assert.equal(reload.resumable,true);
 await page.evaluate(async()=>{const h=__harbour,M=await import('/src/harbour/horizon/movers/fleet/model.ts'),G=await import('/src/harbour/horizon/kitchen/geometry.ts'),y=h.fleetState().vessels.find(v=>v.id==='yacht');h.restore({...M.toWorld(y,G.KITCHEN_BOARD),yaw:0,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'});h.kitchenCommand({type:'open'});});
 await page.getByRole('button',{name:'Close kitchen menu',exact:true}).click();
 const menuClose=await page.evaluate(()=>({phase:__harbour.kitchenView().state.phase,resumable:__harbour.kitchenView().resumable}));assert.equal(menuClose.phase,'idle');assert.equal(menuClose.resumable,true);
 await page.locator('.horizon-stage').focus();await page.keyboard.press('e');await page.getByRole('button',{name:'Resume service',exact:true}).waitFor();
 const recovery=await page.evaluate(async()=>{const h=__harbour,M=await import('/src/harbour/horizon/movers/fleet/model.ts'),G=await import('/src/harbour/horizon/kitchen/geometry.ts'),y=h.fleetState().vessels.find(v=>v.id==='yacht');h.restore({...M.toWorld(y,G.KITCHEN_BOARD),yaw:0,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'});h.kitchenCommand({type:'open'});h.kitchenCommand({type:'resume-saved'});const restored=h.kitchenView().state.phase;h.kitchenCommand({type:'leave-partner'});h.kitchenCommand({type:'resume'});window.dispatchEvent(new Event('blur'));const blurred=h.kitchenView().state.phase;h.kitchenCommand({type:'exit'});h.restore({x:1400,y:24,z:1060,yaw:0,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'});return{restored,blurred,phase:h.kitchenView().state.phase,cruiser:h.toggleCruiser(),mode:h.moverState().mode};});assert.equal(recovery.restored,'paused');assert.equal(recovery.blurred,'paused');assert.equal(recovery.phase,'idle');assert.equal(recovery.cruiser,true);assert.equal(recovery.mode,'cruiser');
 assert.deepEqual(errors,[]);await writeFile(`${out}/runtime-proof.json`,JSON.stringify({first:first.state.result,services,inputs,moving,interrupted,reload,menuClose,recovery,errors},null,2));console.log(JSON.stringify({pass:true,first:first.state.result,services,inputs,moving,interrupted,reload,menuClose,recovery,errors}));
}finally{await browser.close();}
