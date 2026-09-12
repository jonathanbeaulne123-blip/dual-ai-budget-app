import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const out=process.env.HEARTH_ARTIFACTS_DIR||'/tmp/hercules-audit-easy-read';await mkdir(out,{recursive:true});
const results=[];const view=process.env.PROOF_VIEW??'household';
let lastPage;
try {
 for(const theme of (process.env.PROOF_THEME ? [process.env.PROOF_THEME] : ['classic','taylor','newfoundland'])) {
  for(const width of (process.env.PROOF_WIDTH ? [Number(process.env.PROOF_WIDTH)] : [320,390,720,1100,1440,1920])) {
  const context=await browser.newContext({viewport:{width,height:width<720?500:1000},reducedMotion:'reduce'});
  const page=await context.newPage();lastPage=page;page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.stack);});page.on('response',r=>{if(r.status()>=400)console.log('badresponse',r.status(),r.url());});page.on('requestfailed',r=>console.log('requestfailed',r.url(),r.failure()?.errorText));
  await context.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5191')||route.request().url().startsWith('data:')?route.continue():route.abort());
  await context.route('**/pglite.data*',route=>route.fulfill({path:'node_modules/@electric-sql/pglite/dist/pglite.data',contentType:'application/octet-stream'}));
  await context.route('**/initdb.wasm*',route=>route.fulfill({path:'node_modules/@electric-sql/pglite/dist/initdb.wasm',contentType:'application/wasm'}));
  await context.route('**/pglite.wasm*',route=>route.fulfill({path:'node_modules/@electric-sql/pglite/dist/pglite.wasm',contentType:'application/wasm'}));
  await page.goto(`http://127.0.0.1:5191/test/browser/category-split-app.html?theme=${theme}&view=${view}`);
  await page.getByRole('button',{name:'Add money',exact:true}).waitFor({timeout:90000});
   console.log(theme,width);
   if(width<720)await page.locator('.hercules-pill').click();
   else await page.locator('[aria-label^="Open Hercules"]').press('Enter');
   const shell=page.locator(width<720?'.hercules-focus-shell':'.hercules-bubble.chat');
   const scroll=shell.locator('.hercules-conversation-content');
   const toggle=scroll.getByRole('button',{name:/Easy read/});
   await toggle.waitFor({state:'visible'});
   await toggle.click();if(await toggle.getAttribute('aria-pressed')!=='true')throw new Error('Toggle did not activate');
   // Deterministic long conversation geometry, with no provider or ledger writes.
   await scroll.evaluate(el=>{const p=document.createElement('p');p.textContent='Synthetic long conversation. '.repeat(800);el.append(p);el.scrollTop=0;});
   const before=await toggle.boundingBox();
   await scroll.evaluate(el=>el.scrollTop=80);
   const after=await toggle.boundingBox();
   if(Math.abs(before.y-after.y)>6)throw new Error('Easy read scrolled out of reach');
   await scroll.evaluate(el=>el.scrollTop=el.scrollHeight);
   const sticky=await toggle.boundingBox();if(sticky.y<0||sticky.y+sticky.height>(width<720?500:1000))throw new Error('Easy read clipped at end');
   await toggle.click();if(await toggle.getAttribute('aria-pressed')!=='false')throw new Error('Toggle unreachable after scrolling');
   const composer=shell.locator('textarea[aria-label="Ask Hercules"]');
   await composer.waitFor({state:'visible'});
   const box=await composer.boundingBox();if(box.y<0||box.y+box.height> (width<720?500:1000)+1)throw new Error('Composer clipped');
   await page.screenshot({path:`${out}/${theme}-${view}-${width}.png`});
   results.push({theme,view,width,scrollDelta:before.y-after.y,errors:[...errors]});
  await context.close();
  }
 }
 await writeFile(`${out}/hercules-easy-read-${view}.json`,JSON.stringify(results,null,2));
 const errors=[...new Set(results.flatMap(r=>r.errors))];console.log(JSON.stringify({cases:results.length,errors}));if(errors.length)throw new Error('Browser errors recorded');
} catch(error) { if(lastPage && !lastPage.isClosed()) { await lastPage.screenshot({path:`${out}/failure.png`});console.log((await lastPage.locator('body').innerText()).slice(-9000)); } throw error; } finally {await browser.close();}
