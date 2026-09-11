import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const results=[];const view=process.env.PROOF_VIEW??'household';
let lastPage;
try {
 for(const theme of (process.env.PROOF_THEME ? [process.env.PROOF_THEME] : ['classic','taylor','newfoundland'])) {
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage();lastPage=page;page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.stack);});page.on('response',r=>{if(r.status()>=400)console.log('badresponse',r.status(),r.url());});page.on('requestfailed',r=>console.log('requestfailed',r.url(),r.failure()?.errorText));
  await context.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5191')||route.request().url().startsWith('data:')?route.continue():route.abort());
  await context.route('**/pglite.data*',route=>route.fulfill({path:'node_modules/@electric-sql/pglite/dist/pglite.data',contentType:'application/octet-stream'}));
  await context.route('**/initdb.wasm*',route=>route.fulfill({path:'node_modules/@electric-sql/pglite/dist/initdb.wasm',contentType:'application/wasm'}));
  await context.route('**/pglite.wasm*',route=>route.fulfill({path:'node_modules/@electric-sql/pglite/dist/pglite.wasm',contentType:'application/wasm'}));
  await page.goto(`http://127.0.0.1:5191/test/browser/category-split-app.html?theme=${theme}&view=${view}`);
  await page.getByRole('button',{name:'Add money',exact:true}).waitFor({timeout:90000});
  for(const width of (process.env.PROOF_WIDTH ? [Number(process.env.PROOF_WIDTH)] : [390,1440])) {
   console.log(theme,width);
   await page.setViewportSize({width,height:width<720?844:1000});
   const nav=page.locator('[data-ledger-nav]'),fab=page.getByRole('button',{name:'Add money',exact:true});
   const nb=await nav.boundingBox(),fb=await fab.boundingBox();
   const offset=Math.abs(fb.x+fb.width/2-(nb.x+nb.width/2));
   if(offset>1)throw new Error(`Add off-centre ${theme}/${width}: ${offset}`);

   await fab.click();await page.getByRole('menuitem',{name:'Add expense',exact:true}).click();
   const sheet=page.locator('[data-add-slideshow="expense"]');
   while(await sheet.getAttribute('data-add-slide') !== 'amount')await sheet.getByRole('button',{name:'Back',exact:true}).click();
   await sheet.getByRole('button',{name:'Type amount',exact:true}).click();

   await sheet.locator('.cad-pad-input').fill('130.01');
   console.log('amount entered');await sheet.locator('.cad-pad-enter').click();console.log('category opened');
   const toggle=sheet.getByRole('button',{name:'Split between two categories',exact:true});
   if(await toggle.count())await toggle.click();
   await sheet.getByLabel('First category',{exact:true}).selectOption('SUB-FOOD-GROCERIES');
   await sheet.getByLabel('Second category',{exact:true}).selectOption('SUB-FOOD-COFFEE');
   const slider=sheet.locator('.category-split-editor [role="slider"]');
   await slider.press('Home');await slider.press('PageUp');await slider.press('PageUp');await slider.press('PageUp');
   const proceed=sheet.getByRole('button',{name:'Continue to account',exact:true});
   await proceed.waitFor({state:'visible'});
   if(!await proceed.isEnabled())throw new Error('Continue disabled');
   console.log('continue visible');await proceed.click();
   await sheet.locator('[data-entry-section="account"]').waitFor();
   await sheet.locator('[data-entry-section="account"] button').filter({hasText:'Visa'}).first().click();
   await sheet.getByRole('button',{name:'Skip',exact:true}).click();
   await sheet.locator('[data-add-confirm]').waitFor({state:'visible'});
   const review=sheet.getByLabel('Category amounts',{exact:true});
   if(!(await review.textContent()).includes('$39.00')||!(await review.textContent()).includes('$91.01'))throw new Error('Wrong final review');
   const overflow=await sheet.evaluate(el=>el.scrollWidth>el.clientWidth+1);
   if(overflow)throw new Error('Overflow');
   await sheet.getByRole('button',{name:'Close',exact:true}).click();
   await page.reload();await page.getByRole('button',{name:'Add money',exact:true}).waitFor();
   // Reset only this synthetic browser context before the next viewport.
   await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByRole('button',{name:'Add money',exact:true}).waitFor();
   results.push({view,theme,width,offset,overflow,errors:[...errors]});
  }
  await context.close();
 }
 await writeFile(`artifacts/category-split/continue-results-${view}.json`,JSON.stringify(results,null,2));
 const errors=[...new Set(results.flatMap(r=>r.errors))];console.log(JSON.stringify({cases:results.length,errors}));if(errors.length)throw new Error('Browser errors recorded');
} catch(error) { if(lastPage && !lastPage.isClosed()) { await lastPage.screenshot({path:'artifacts/category-split/failure.png'});console.log((await lastPage.locator('body').innerText()).slice(-9000)); } throw error; } finally {await browser.close();}
