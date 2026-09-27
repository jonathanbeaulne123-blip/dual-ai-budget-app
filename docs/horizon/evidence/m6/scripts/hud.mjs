// M6 HUD captures: the offer row at the Crown pad, the two bubbles in flight, the Fold → fade label, at 320, 390, 720
// and 1100 px, light and dark; the reduced-motion sheet at 390 and 1100. Needs the vite server on 5199.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),out=resolve(here,'../hud');await mkdir(out,{recursive:true});
const BASE=process.env.HORIZON_URL??'http://127.0.0.1:5199';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const frames=(page,n=3)=>page.evaluate(n=>new Promise(r=>{let k=0;const f=()=>{if(++k>=n)r();else requestAnimationFrame(f);};requestAnimationFrame(f);}),n);
const rows=[];
async function measure(page){
  return page.evaluate(()=>{
    const box=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return{text:e.textContent,x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),bg:cs.backgroundColor,color:cs.color};};
    const overflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    const hits=[...document.querySelectorAll('.horizon-offer,.horizon-bubble,.horizon-sheet button,.horizon-toolbar button')].map(e=>{const r=e.getBoundingClientRect();return{t:e.textContent,w:Math.round(r.width),h:Math.round(r.height),inView:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};});
    return{viewport:[innerWidth,innerHeight],overflowX:overflow,offers:box('.horizon-offers'),height:box('.horizon-bubble-height'),place:box('.horizon-bubble-place'),fade:box('.horizon-bubble-fade'),sheet:box('.horizon-sheet'),toolbar:box('.horizon-toolbar'),touch:box('.horizon-touch-controls'),targets:hits,tier:window.__harbour?.settings().tier};
  });
}
async function flow(width,height,scheme){
  const context=await browser.newContext({viewport:{width,height},timezoneId:'America/Toronto',colorScheme:scheme,hasTouch:width<720,isMobile:width<720});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/horizon-review.html?world=horizon&sun=11:00`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__harbour?.stats&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:240000});
  await page.evaluate(()=>{const h=window.__harbour,t=h.world.thresholds.find(t=>t.id==='crownLaunch');h.setMode('walk');h.restore({world:'horizon:horizon-geo-1',geo:'horizon-geo-1',place:'court',x:t.at[0],y:t.height,z:t.at[1],yaw:Math.PI});});
  await page.waitForTimeout(1200);await frames(page,4);
  const tag=`${width}_${scheme}`;
  await page.locator('.horizon-offer').first().waitFor({timeout:120000});await frames(page,2);
  const a=await measure(page);await page.screenshot({path:resolve(out,`${tag}_1-offer-row.png`)});
  await page.locator('.horizon-offer',{hasText:'Run off'}).first().click({timeout:180000});
  await page.locator('.horizon-stage').focus();await page.keyboard.down('w');
  await page.waitForFunction(()=>window.__horizonFlight?.phase()==='flight'||window.__horizonFlight?.phase()==='flare',null,{timeout:300000,polling:100});
  await page.keyboard.up('w');
  // Fly on a few seconds at trim (accelerated through the live controller, the runtime paused), then let it render.
  await page.evaluate(()=>{window.__harbour.pause(true);const c=window.__horizonFlight;for(let i=0;i<360;i++)c.update(1/60,{forward:0,strafe:0,run:false,bar:0,bank:i<120?0:.4,pull:false,look:[0,0]});window.__harbour.pause(false);window.__harbour.input({bar:0,bank:.4});});
  await frames(page,3);await page.waitForTimeout(450);await frames(page,2);
  const b=await measure(page);await page.screenshot({path:resolve(out,`${tag}_2-bubbles.png`)});
  await page.locator('button.horizon-bubble-place').click({timeout:180000});
  await page.waitForFunction(()=>!window.__harbour.moverState().attached,null,{timeout:120000,polling:50});
  await page.waitForTimeout(250);await frames(page,1);
  const c=await measure(page);await page.screenshot({path:resolve(out,`${tag}_3-fade-label.png`)});
  rows.push({width,height,scheme,offerRow:a,flight:b,afterFold:c,moverState:await page.evaluate(()=>window.__harbour.moverState()),errors});
  console.log(tag,'done');await context.close();
}
async function sheet(width,height,scheme){
  const context=await browser.newContext({viewport:{width,height},timezoneId:'America/Toronto',colorScheme:scheme,reducedMotion:'reduce',hasTouch:width<720,isMobile:width<720});
  const page=await context.newPage();
  await page.goto(`${BASE}/horizon-review.html?world=horizon`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__harbour?.stats&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:240000});
  await page.evaluate(()=>{const h=window.__harbour,t=h.world.thresholds.find(t=>t.id==='crownLaunch');h.setMode('walk');h.restore({world:'horizon:horizon-geo-1',geo:'horizon-geo-1',place:'court',x:t.at[0],y:t.height,z:t.at[1],yaw:Math.PI});});
  await page.waitForTimeout(1200);await frames(page,3);
  await page.locator('.horizon-offer',{hasText:'Run off'}).first().click({timeout:180000});await page.locator('.horizon-sheet').waitFor();await frames(page,2);
  const focus=await page.evaluate(()=>({active:document.activeElement?.tagName+'.'+(document.activeElement?.className||''),inSheet:!!document.activeElement?.closest?.('.horizon-sheet')}));
  const m=await measure(page);await page.screenshot({path:resolve(out,`${width}_${scheme}_reduced-motion-sheet.png`)});
  rows.push({width,height,scheme,reducedMotion:true,sheet:m,focus});console.log(width,scheme,'sheet done');await context.close();
}
try{
  for(const [w,h] of [[320,640],[390,844],[720,900],[1100,800]])for(const s of ['light','dark'])await flow(w,h,s);
  for(const [w,h] of [[390,844],[1100,800]])for(const s of ['light','dark'])await sheet(w,h,s);
}finally{await writeFile(resolve(out,'hud.json'),JSON.stringify(rows,null,1));await browser.close();}
