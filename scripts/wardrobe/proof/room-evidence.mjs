/**
 * Dressing-room evidence: builds the fictional harness, serves it locally and captures every theme x lighting x width.
 * Local only. Blocks non-local requests. Writes PNGs + a JSON report to docs/evidence/hercules-room/ (or HEARTH_ARTIFACTS_DIR).
 *   node scripts/wardrobe/proof/room-evidence.mjs
 */
import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
const out=process.env.HEARTH_ARTIFACTS_DIR||'docs/evidence/hercules-room';await mkdir(out,{recursive:true});
const dist='dist/wardrobe-room-proof';
await build({entryPoints:['scripts/wardrobe/proof/room-harness.tsx'],outdir:dist,bundle:true,splitting:true,format:'esm',jsx:'automatic',minify:true,define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},loader:{'.woff2':'file','.woff':'file','.png':'file','.svg':'file','.jpg':'file'},external:['node:*'],target:'es2022',logLevel:'error'});
await writeFile(`${dist}/index.html`,'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="./room-harness.css"></head><body><div id="root"></div><script type="module" src="./room-harness.js"></script></body></html>');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.gz':'application/gzip','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.png':'image/png','.json':'application/json'};
const server=createServer(async(req,res)=>{const path=normalize(decodeURIComponent(new URL(req.url,'http://x').pathname));const candidates=[join(dist,path==='/'?'index.html':path),join('public',path)];for(const file of candidates){try{const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream'});res.end(body);return;}catch{}}res.writeHead(404);res.end();});
await new Promise(resolve=>server.listen(5197,'127.0.0.1',resolve));const origin='http://127.0.0.1:5197';
const browser=await chromium.launch({headless:true,...(process.env.HEARTH_CHROMIUM?{executablePath:process.env.HEARTH_CHROMIUM}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const records=[],errors=[];
const cases=[
 {theme:'classic',route:'home',view:'household',lighting:'light'},{theme:'classic',route:'more',view:'personal',lighting:'light'},
 {theme:'taylor',route:'home',view:'household',lighting:'light'},{theme:'taylor',route:'ledger',view:'household',lighting:'dark'},
 {theme:'newfoundland',route:'home',view:'household',lighting:'light'},{theme:'newfoundland',route:'shift',view:'personal',lighting:'dark'},
];
try{
 for(const c of cases){
  const context=await browser.newContext({viewport:{width:1100,height:900},reducedMotion:'reduce'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(`${c.theme}/${c.route}: ${e}`));
  await page.goto(`${origin}/?theme=${c.theme}&route=${c.route}&view=${c.view}`);
  await page.locator('.hercules-fitting-backdrop').waitFor();
  const state=await page.locator('.fitting-webgl').getAttribute('data-state').catch(()=>'missing');
  let mode='2d';try{await page.locator('.fitting-webgl[data-state=ready]').waitFor({timeout:60000});await page.waitForFunction(()=>document.querySelector('.fitting-stage-label')?.textContent==='Fitting platform',null,{timeout:60000});mode='3d';}catch{mode='2d';}
  const lighting=await page.evaluate(()=>document.documentElement.dataset.sceneLighting);
  const roomName=await page.locator('#fitting-title').textContent();
  for(const width of [320,390,720,1100]){
   await page.setViewportSize({width,height:width<720?820:900});await page.waitForTimeout(250);
   const geometry=await page.locator('.hercules-fitting-room').evaluate(n=>{n.scrollTop=0;return{overflow:n.scrollWidth>n.clientWidth+1,roomWidth:n.clientWidth,stage:n.querySelector('.fitting-stage')?.clientHeight,sheet:Boolean(n.querySelector('.fitting-sheet'))};});
   const axe=await new AxeBuilder({page}).include('.hercules-fitting-backdrop').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   await page.screenshot({path:`${out}/${c.theme}-${c.lighting}-${c.view}-${width}.png`});
   records.push({...c,width,mode,initialState:state,roomLighting:lighting,roomName,...geometry,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
   console.log(c.theme,c.lighting,width,mode,geometry.overflow?'OVERFLOW':'ok',axe.violations.length,'axe');
  }
  if(c.theme==='classic'&&c.view==='household'){
   // Phone: open the bottom sheet, then the 2D compare state; desktop: colour-first and a search.
   await page.setViewportSize({width:390,height:820});await page.getByRole('tab',{name:'The outfit'}).click();await page.waitForTimeout(350);await page.screenshot({path:`${out}/classic-light-phone-sheet-open.png`});
   const sheetOpen=await page.locator('.fitting-sheet').getAttribute('data-open');await page.keyboard.press('Escape');await page.waitForTimeout(350);
   records.push({check:'phone-sheet',sheetOpenAfterTab:sheetOpen,sheetOpenAfterEscape:await page.locator('.fitting-sheet').getAttribute('data-open'),roomStillOpen:await page.locator('.hercules-fitting-backdrop').count()});
   await page.getByRole('button',{name:'Compare 2D look'}).click();await page.waitForTimeout(250);await page.screenshot({path:`${out}/classic-light-phone-2d.png`});await page.getByRole('button',{name:'Return to 3D'}).click();
   await page.setViewportSize({width:1100,height:900});await page.locator('.fitting-colour-first summary').click();await page.getByRole('button',{name:'Pieces in brass'}).click();await page.waitForTimeout(250);await page.screenshot({path:`${out}/classic-light-desktop-colour-first.png`});await page.getByRole('button',{name:'Any colour'}).click();
   await page.locator('.fitting-shelves').getByRole('button',{name:'Snow day'}).click();await page.getByRole('button',{name:'Try the collection look'}).click();try{await page.waitForFunction(()=>document.querySelector('.fitting-stage-label')?.textContent==='Fitting platform',null,{timeout:60000});}catch{}await page.waitForTimeout(300);await page.screenshot({path:`${out}/classic-light-desktop-snow-day.png`});
   await page.locator('.fitting-shelves').getByRole('button',{name:'Hearth after dark'}).click();await page.getByRole('button',{name:'Try the collection look'}).click();try{await page.waitForFunction(()=>document.querySelector('.fitting-stage-label')?.textContent==='Fitting platform',null,{timeout:60000});}catch{}await page.waitForTimeout(300);await page.getByRole('button',{name:'See the back'}).click();await page.waitForTimeout(300);await page.screenshot({path:`${out}/classic-light-desktop-night-back.png`});
   await page.locator('.fitting-shelves').getByRole('button',{name:'Garden Sunday'}).click();await page.getByRole('button',{name:'Try the collection look'}).click();try{await page.waitForFunction(()=>document.querySelector('.fitting-stage-label')?.textContent==='Fitting platform',null,{timeout:60000});}catch{}await page.waitForTimeout(300);await page.getByRole('button',{name:'Reset view'}).click();await page.waitForTimeout(300);await page.screenshot({path:`${out}/classic-light-desktop-garden.png`});
   // Keyboard order: Tab from the close button through the room and back.
   await page.getByRole('button',{name:'Close dressing room'}).focus();const order=[];for(let i=0;i<14;i++){await page.keyboard.press('Tab');order.push(await page.evaluate(()=>{const a=document.activeElement;return a?.getAttribute('aria-label')||a?.textContent?.slice(0,30)||a?.tagName;}));}
   records.push({check:'keyboard-order',order,focusVisible:await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle)});
   await page.keyboard.press(']');await page.waitForTimeout(200);records.push({check:'shortcut-]-from-focused-button',wearing:await page.locator('.fitting-wearing').textContent()});
  }
  await context.close();
 }
}catch(e){console.log(String(e));records.push({failure:String(e)});process.exitCode=1;}
await writeFile(`${out}/report.json`,JSON.stringify({generated:new Date().toISOString(),fixture:'catalogHousehold() synthetic fixture; no real household data',records,errors},null,2)+'\n');
await browser.close();server.close();
if(errors.length||records.some(r=>r.overflow||r.violations?.length))process.exitCode=1;
