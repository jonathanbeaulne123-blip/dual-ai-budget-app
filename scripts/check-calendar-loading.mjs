// Actual App, synthetic local fixture only. Blocks every non-local request.
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {checkCalendar} from './check-calendar-interactions.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const route='calendar';
const state=process.env.HEARTH_WORLD_STATE||'normal';
const origin=process.env.HEARTH_THEME_ORIGIN||'http://127.0.0.1:5192';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local proof only');
const out='.artifacts/page-worlds/calendar-loading';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:390,height:1000},reducedMotion:'reduce'});
await context.route('**/*',r=>new URL(r.request().url()).origin===origin&&!/^\/(hercules|ledger-sync|sync|documents|bank|work)\//.test(new URL(r.request().url()).pathname)?r.continue():r.abort());
await context.addInitScript(()=>{delete Object.getPrototypeOf(navigator).locks;});
const page=await context.newPage(),records=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
async function settle(){await page.locator('.deferred-surface[aria-busy=true]').waitFor({state:'hidden',timeout:90000});await page.evaluate(()=>document.fonts.ready);const close=page.getByRole('button',{name:'Close reminders',exact:true});if(await close.count())await close.click();}
async function nav(name){await page.locator('nav.nav').getByRole('button',{name,exact:true}).click();await settle();}
async function go(scope){
 if(route==='ledger'){await nav('More');await page.getByRole('button',{name:scope==='household'?'Open the household table':'Open my books',exact:true}).click();}
 else if(route==='till'){await nav('Home');await page.getByRole('link',{name:'Till',exact:true}).first().click();}
 else await nav({home:'Home',plan:'Plan',calendar:'Calendar',shift:'Shifts',more:'More'}[route]);await settle();
}
try {
 await page.goto(origin+'/?themeStudio=1');
 await page.evaluate(async(state)=>{
  const {completedExistingBooksHousehold}=await import('/test/fixtures/existing-books-onboarding.ts');
  const {saveHousehold}=await import('/src/storage.ts');const {saveSession}=await import('/src/session.ts');
  let h=completedExistingBooksHousehold('2026-09-09T12:00:00.000Z');
  const {assertAcceptableBooks}=await import('/src/core/booksValidation.ts');const {financialAuditHash}=await import('/src/core/commandIdentity.ts');
  if(state==='empty') {h.transactions=[];h.shifts=[];h.goals=[];h.recurrences=[];}
  if(state==='long') {
   h.name='Our household with a wonderfully long name for narrow-screen verification';
   h.accounts=h.accounts.map(a=>({...a,name:a.name+' — a longer account label with additional details'}));
   h.goals=h.goals.map(g=>({...g,name:g.name+' — something wonderful we are carefully saving toward together'}));
   h.recurrences=h.recurrences.map(r=>({...r,note:r.note+' — a long illustrative recurring payment with additional scheduling detail',amountCents:123456789}));
  }
  assertAcceptableBooks(h);h.booksAcceptedHash=await financialAuditHash(h);
  await saveHousehold(h,{memberId:'MEM-002',activate:true});saveSession('development',{householdId:h.householdId,memberId:'MEM-002',view:'household'});
 },state);
 await page.goto(origin);await page.locator('nav.nav').waitFor({timeout:90000});await settle();await page.locator('.app[data-books-readiness=ready]').waitFor({timeout:90000});
 const due=page.locator('[aria-labelledby="due-preview-title"]');if(await due.isVisible())await due.getByRole('button',{name:'Not now',exact:true}).click();
 const closeReminders=page.getByRole('button',{name:'Close reminders',exact:true});if(await closeReminders.count())await closeReminders.click();
 for(const theme of ['classic','taylor','newfoundland']) {
  await nav('More');await page.locator('[data-preview-theme="'+theme+'"]').click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
  for(const scope of ['household','personal']) {
   await page.locator('.view-switch button').nth(scope==='household'?0:1).click();await nav('Home');
   let release;const pending=new Promise(resolve=>release=resolve);
   const pattern='**/src/Calendar.tsx*';
   await context.route(pattern,async request=>{await pending;await request.abort();});
   await page.reload({waitUntil:'domcontentloaded',timeout:90000});await page.locator('nav.nav').waitFor({timeout:90000});
   await page.locator('nav.nav').getByRole('button',{name:'Calendar',exact:true}).click();
   await page.locator('.deferred-surface[aria-busy=true]').waitFor();
   for(const width of [390,1440]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`${out}/${theme}-${scope}-loading-${width}.png`});}
   release();await page.locator('.deferred-surface[role=alert]').waitFor();
   for(const width of [390,1440]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`${out}/${theme}-${scope}-error-${width}.png`});}
   await context.unroute(pattern);await page.getByRole('button',{name:'Reload Hearth',exact:true}).click();await page.locator('nav.nav').waitFor({timeout:90000});await settle();await go(scope);
   if(!await page.locator('.calendar-card').isVisible())throw Error('Reload did not recover Calendar');
   records.push({theme,scope,loading:true,error:true,recovered:true});
  }
 }
} finally {await writeFile(out+'/report.json',JSON.stringify({records,expectedErrors:errors},null,2));await browser.close();}
