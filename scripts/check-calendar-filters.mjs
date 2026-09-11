// Synthetic browser proof: Google responses are injected and external traffic is blocked.
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const origin=process.env.HEARTH_TEST_ORIGIN||'http://127.0.0.1:5189';
const out=process.env.HEARTH_ARTIFACTS_DIR||'/tmp/hearth-calendar-filters';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await context.route('**/*',r=>new URL(r.request().url()).origin===origin&&!/^\/(hercules|ledger-sync|sync|documents|bank|work)\//.test(new URL(r.request().url()).pathname)?r.continue():r.abort());
await context.addInitScript(()=>{delete Object.getPrototypeOf(navigator).locks;});
const page=await context.newPage();page.setDefaultTimeout(60000);
const proof={geometry:[],accessibility:[],errors:[]};page.on('pageerror',e=>proof.errors.push(String(e)));
try {
 await page.goto(origin);
 await page.evaluate(async()=>{
  const {completedExistingBooksHousehold}=await import('/test/fixtures/existing-books-onboarding.ts');
  const {saveHousehold}=await import('/src/storage.ts');const {saveSession}=await import('/src/session.ts');
  const h=completedExistingBooksHousehold('2026-09-11T12:00:00.000Z');
  const {financialAuditHash}=await import('/src/core/index.ts');h.booksAcceptedHash=await financialAuditHash(h);
  await saveHousehold(h,{memberId:'MEM-002',activate:true});
  saveSession('development',{householdId:h.householdId,memberId:'MEM-002',view:'household'});
 });
 await page.goto(origin);
 try { await page.locator('.app[data-books-readiness=ready]').waitFor({timeout:30000}); } catch(error) { const retry=page.getByRole('button',{name:'Retry validation',exact:true}); if(!await retry.isVisible())throw error;await retry.click();await page.locator('.app[data-books-readiness=ready]').waitFor(); }
 await page.evaluate(async()=>{
  const {loadHousehold}=await import('/src/storage.ts');const h=await loadHousehold('development');
  const g=await import('/src/google/index.ts');g.setGoogleClientIdForTests('synthetic-client');
  g.saveGoogleSession('development',{householdId:h.householdId,memberId:'MEM-002',calendarId:'primary',accessToken:'synthetic-token',expiresAt:Date.now()+3600000,identity:{email:'test@example.com',subject:'synthetic',displayName:'Tester'},grantedScopes:g.scopesForServices(['identity','calendar'])});
  window.__googleReadProof={requests:0,writes:0};
  g.setGoogleHttpFetch(async(url,init)=>{
   window.__googleReadProof.requests++;
   if(init?.method&&init.method!=='GET'){window.__googleReadProof.writes++;throw Error('Unexpected Google write');}
   return new Response(JSON.stringify(url.includes('calendarList')?{items:[{id:'primary',primary:true,summary:'My Google calendar',accessRole:'owner'},{id:'shared',summary:'Shared household calendar',accessRole:'reader'}]}:{items:[{id:'same-id',summary:url.includes('/shared/')?'Shared calendar dinner':'Personal calendar appointment',start:{date:'2026-09-11'}}]}),{status:200});
  });
 });
 const due=page.locator('[aria-labelledby="due-preview-title"]');if(await due.isVisible())await due.getByRole('button',{name:'Not now',exact:true}).click();
 const close=page.getByRole('button',{name:'Close reminders',exact:true});if(await close.count())await close.click();
 for(const theme of ['classic','taylor','newfoundland']){
  await page.locator('nav.nav').getByRole('button',{name:'More',exact:true}).click();
  await page.locator(`[data-preview-theme="${theme}"]`).click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
  await page.locator('nav.nav').getByRole('button',{name:'Calendar',exact:true}).click();
  for(const scope of ['household','personal']){
   await page.locator('.view-switch button').nth(scope==='household'?0:1).click();
   const panel=page.getByRole('region',{name:'Google calendar integration'});
   await panel.getByText('2 events from 2 calendars:',{exact:false}).waitFor();
   const filters=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Show on calendar'})});
   await filters.locator('summary').click();
   const own=filters.getByRole('checkbox',{name:'My Google calendar',exact:true});
   await own.uncheck();
   const day=page.locator('[data-calendar-date="2026-09-11"]');
   if((await day.getAttribute('aria-label')).includes('Personal calendar appointment'))throw Error('Hidden Google event still on grid');
   if(!(await day.getAttribute('aria-label')).includes('Shared calendar dinner'))throw Error('Shared Google event hidden incorrectly');
   await own.check();
   for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:1000});await filters.scrollIntoViewIfNeeded();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    if(overflow)throw Error(`Overflow ${theme}/${scope}/${width}`);
    await page.screenshot({path:`${out}/${theme}-${scope}-${width}.png`});proof.geometry.push({theme,scope,width,overflow});
   }
   const violations=(await new AxeBuilder({page}).include('.calendar-card').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
   proof.accessibility.push({theme,scope,violations:violations.map(v=>v.id)});if(violations.length)throw Error('Calendar connection accessibility failure');
   await panel.getByRole('button',{name:'Refresh Google events',exact:true}).focus();await page.keyboard.press('Enter');
   await panel.getByText('2 events from 2 calendars:',{exact:false}).waitFor();
  }
 }
 proof.network=await page.evaluate(()=>window.__googleReadProof);
 if(proof.network.writes||proof.errors.length)throw Error(JSON.stringify(proof));
 console.log(JSON.stringify(proof));
} catch(error){await page.screenshot({path:`${out}/failure.png`});throw error;}
finally{await writeFile(`${out}/evidence.json`,JSON.stringify(proof,null,2));await browser.close();}
