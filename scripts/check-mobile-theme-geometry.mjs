// Local production-component specimens: geometry, contrast, pause and text enlargement.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.HEARTH_THEME_ORIGIN||'http://127.0.0.1:5184';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname)) throw Error('Local fixtures only');
const out=process.env.HEARTH_ARTIFACTS_DIR||'.artifacts/three-worlds/mobile-geometry';await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:320,height:568},reducedMotion:'no-preference'});const records=[];p.on("pageerror",e=>console.error(String(e)));
try {
 await p.goto(`${origin}/?themeStudio=1`);await p.locator('.studio-toolbar select').nth(0).waitFor({timeout:90000});
 for(const theme of ['classic','taylor','newfoundland']) for(const scope of ['household','personal']) {
  await p.locator('.studio-toolbar select').nth(0).selectOption(theme);await p.locator('.studio-toolbar select').nth(1).selectOption(scope);
  for(const route of ['home','calendar','plan','ledger','more',scope==='personal'?'shift':'till']) {
   await p.locator('.studio-toolbar select').nth(2).selectOption(route);await p.locator('.theme-scene-heading').scrollIntoViewIfNeeded();
   const check=await p.locator('.theme-scene-heading').evaluate(e=>{const box=e.getBoundingClientRect(),key=e.querySelector('.theme-atmosphere-toggle'),r=key.getBoundingClientRect();return {scene:document.documentElement.dataset.scene,contained:r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom,width:r.width,height:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===key,overflow:document.documentElement.scrollWidth>innerWidth}});
   if(!check.contained||!check.hit||check.width<44||check.height<44||check.overflow)throw Error(JSON.stringify(check));records.push(check);
   if(['reputation','midnights','jag-lobby','george-street'].includes(check.scene)) {
    const contrast=await p.locator('.preview.warn').evaluate(e=>{const c=getComputedStyle(e),canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');const lum=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)};const a=lum(c.color),z=lum(c.backgroundColor);return {foreground:c.color,background:c.backgroundColor,ratio:(Math.max(a,z)+.05)/(Math.min(a,z)+.05)}});check.warning=contrast;if(contrast.ratio<4.5)throw Error(JSON.stringify(check));
   }
  }
 }
 await p.locator('.studio-toolbar select').nth(0).selectOption('taylor');await p.locator('.studio-toolbar select').nth(2).selectOption('home');await p.locator('.theme-scene-heading').scrollIntoViewIfNeeded();
 await p.locator('.theme-scene-heading').getByRole('button',{name:'Pause atmosphere'}).click();await p.waitForFunction(()=>document.documentElement.dataset.atmosphere==='paused');
 const running=()=>p.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.target?.closest?.('.scene-artwork,.friendship-bracelets')).length);
 if(await running())throw Error('Paused scenery still running');
 await p.locator('.theme-scene-heading').getByRole('button',{name:'Resume atmosphere'}).click();await p.locator('#studio-draft').focus();await p.waitForFunction(()=>document.documentElement.dataset.atmosphere==='paused');if(await running())throw Error('Focused scenery still running');
 await p.locator('#studio-draft').blur();await p.emulateMedia({reducedMotion:'reduce'});if(await running())throw Error('Reduced motion not respected');
 await p.goto(`${origin}/scripts/fixtures/mobile-worlds/mobile-a3/index.html?theme=newfoundland`);await p.locator('.fund-ledge-grip').click();await p.locator('.is-sheet-grip').click();const position=await p.locator('.is-sheet-grip').evaluate(e=>getComputedStyle(e).position);if(position!=='relative')throw Error(`Expanded grip ${position}`);await p.keyboard.press('Escape');
 await p.goto(`${origin}/scripts/fixtures/mobile-worlds/mobile-a1/index.html?theme=taylor`);await p.locator('.ph-fold').waitFor();await p.evaluate(()=>document.documentElement.style.zoom='2');await p.screenshot({path:`${out}/text-zoom-200.png`,fullPage:true});const zoom=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,tiles:[...document.querySelectorAll('.hearth-paper-tile')].map(e=>({scroll:e.scrollWidth,width:e.clientWidth}))}));if(zoom.scroll>zoom.width||zoom.tiles.some(t=>t.scroll>t.width+1))throw Error(JSON.stringify(zoom));records.push({pause:true,focusedEntry:true,reducedMotion:true,expandedGrip:position,cssZoom200:zoom,nativeBrowserZoom:'not certified'});
} catch(error) {console.error((await p.locator("body").innerText()).slice(0,2000));await p.screenshot({path:`${out}/failure.png`});throw error;} finally {await writeFile(`${out}/report.json`,JSON.stringify(records,null,2));await b.close();}
console.log(`${records.length-1} scene headers passed; warning contrast, atmosphere, expanded grip and CSS zoom passed.`);
