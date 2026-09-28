// Combined cruiser/fleet ownership, persistence and phone layout after main integration.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.CRUISER_PROOF_URL??'http://127.0.0.1:5206',out=process.env.CRUISER_PROOF_DIR??'/tmp/island-cruiser-fleet';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-gpu','--disable-background-networking']});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
try{
 await page.goto(`${origin}/horizon-review.html?world=horizon&tier=lite&sun=13:02`);
 await page.waitForFunction(()=>window.__harbour?.stats().chunksLoaded?.length===14,null,{timeout:180000});
 await page.evaluate(()=>window.__harbour.restore({x:1400,y:24,z:1060,yaw:1.8041,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'}));await page.waitForTimeout(400);
 for(const width of [320,390,720,1100]){await page.setViewportSize({width,height:844});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.querySelector('.horizon-fleet').getBoundingClientRect().top>document.querySelector('.horizon-top-controls').getBoundingClientRect().bottom),'fleet clears both control rows');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/combined-phone.png`});
 await page.getByRole('button',{name:'Ride',exact:true}).click();await page.waitForFunction(()=>window.__harbour.cruiserState());await page.waitForTimeout(900);
 await page.locator('.horizon-stage').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>window.__harbour.cruiserState()?.grounded===false);
 const saved=await page.evaluate(()=>{const r=window.__harbour,state=r.cruiserState();window.dispatchEvent(new Event('pagehide'));return{safe:state.safe,raw:r.body(),saved:JSON.parse(localStorage.getItem('hearth:horizon-fleet:review:v1')).body};});
 assert.deepEqual(saved.saved,saved.safe);assert.ok(saved.raw.y>saved.saved.y,'hop persists checked ground, not raw air position');
 await page.reload();await page.waitForFunction(()=>window.__harbour?.stats().chunksLoaded?.length===14,null,{timeout:180000});
 const restored=await page.evaluate(()=>({body:window.__harbour.body(),mode:window.__harbour.moverState().mode}));assert.equal(restored.mode,'feet');assert.ok(Math.abs(restored.body.y-saved.safe.y)<.1);
 const deck=await page.evaluate(async()=>{const r=window.__harbour,M=await import('/src/harbour/horizon/movers/fleet/model.ts'),L=await import('/src/harbour/horizon/movers/fleet/layout.ts'),y=r.fleetState().vessels.find(v=>v.id==='yacht'),seat=L.SEATS[0];r.restore({...M.toWorld(y,seat.stand),yaw:0,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'});const deckMount=r.toggleCruiser(),sat=r.fleetAction(seat.id),seatMount=r.toggleCruiser();return{deckMount,sat,seatMount,sitting:r.fleetState().sitting,mode:r.moverState().mode};});
 assert.equal(deck.deckMount,false);assert.equal(deck.sat,true);assert.equal(deck.seatMount,false);assert.ok(deck.sitting);assert.equal(deck.mode,'feet');
 await page.evaluate(async()=>{const r=window.__harbour,M=await import('/src/harbour/horizon/movers/fleet/model.ts'),L=await import('/src/harbour/horizon/movers/fleet/layout.ts');r.restore({...M.toWorld(r.fleetState().vessels.find(v=>v.id==='yacht'),L.HELM),yaw:0,place:'court',world:'horizon:horizon-geo-1',geo:'horizon-geo-1'});if(!r.fleetAction('helm'))throw Error('helm unavailable');});
 await page.locator('.horizon-stage').focus();const anchor=await page.evaluate(()=>window.__harbour.fleetState().vessels.find(v=>v.id==='yacht').anchor);await page.keyboard.press('q');assert.equal(await page.evaluate(()=>window.__harbour.fleetState().vessels.find(v=>v.id==='yacht').anchor),!anchor);
 await page.getByRole('button',{name:'Look',exact:true}).click();await page.waitForTimeout(400);assert.ok((await page.locator('.horizon-status').textContent()).includes('waits where you left it'));await page.getByRole('button',{name:'Walk',exact:true}).click();
 assert.deepEqual(errors,[]);await writeFile(`${out}/combined-proof.json`,JSON.stringify({pass:true,saved,restored,deck,errors},null,2));console.log('Combined cruiser/fleet proof passed');
}finally{await browser.close();}
