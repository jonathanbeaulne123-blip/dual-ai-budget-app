// Actual React routes, synthetic local demo only. No hosted account or financial Confirm.
// Opt-in fallback removes Web Locks in this isolated browser context only.
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/three-worlds/book-surfaces';
const origin=process.env.HEARTH_THEME_ORIGIN || 'http://127.0.0.1:5184';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname)) throw new Error('Synthetic theme verification requires a local server.');
const fallback=process.env.HEARTH_THEME_USE_DATABASE_FALLBACK==='1';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:390,height:1000},reducedMotion:'reduce'});
if(fallback) await context.addInitScript(()=>{delete Object.getPrototypeOf(navigator).locks;});
const page=await context.newPage();const records=[];const errors=[];
page.on('pageerror',e=>{if(errors.length<10)errors.push(String(e));});
async function settle(){await page.locator('.deferred-surface[aria-busy=true]').waitFor({state:'hidden',timeout:60000});await page.evaluate(()=>document.fonts.ready);}
async function nav(name){await page.locator('nav.nav').getByRole('button',{name,exact:true}).click();await settle();}
async function route(name,scope){if(name==='ledger'){await nav('More');await page.getByRole('button',{name:scope==='household'?'Open the household table':'Open my books',exact:true}).click();}
else if(name==='till'){await nav('Home');await page.getByRole('link',{name:'Till',exact:true}).first().click();}
else await nav({home:'Home',calendar:'Calendar',plan:'Plan',more:'More',shift:'Shifts'}[name]);await settle();await page.evaluate(()=>window.scrollTo(0,0));}
try {
 // A complete, deterministic existing-books fixture opens nested audit pages.
 // Fixture imports are served only by the local Vite dev server; never a hosted app.
 await page.goto(`${origin}/?themeStudio=1`);
 await page.evaluate(async () => {
  const {completedExistingBooksHousehold}=await import('/test/fixtures/existing-books-onboarding.ts');
  const {saveHousehold}=await import('/src/storage.ts');
  const {saveSession}=await import('/src/session.ts');
  const household=completedExistingBooksHousehold('2026-09-09T12:00:00.000Z');
  const {assertAcceptableBooks}=await import('/src/core/booksValidation.ts');
  const {financialAuditHash}=await import('/src/core/commandIdentity.ts');
  assertAcceptableBooks(household);
  household.booksAcceptedHash=await financialAuditHash(household);
  await saveHousehold(household,{memberId:'MEM-002',activate:true});
  saveSession('development',{householdId:household.householdId,memberId:'MEM-002',view:'personal'});
 });
 await page.goto(origin); await page.locator('nav.nav').waitFor({timeout:90000}); await settle();
 const due=page.locator('[aria-labelledby="due-preview-title"]');
 if(await due.isVisible()) await due.getByRole('button',{name:'Not now',exact:true}).click();
 for(const theme of ['classic','taylor','newfoundland']) {
  await nav('More'); await page.locator(`[data-preview-theme="${theme}"]`).click(); await page.getByRole('button',{name:'Use theme',exact:true}).click();
  for(const scope of ['household','personal']) {
   await page.locator('.view-switch button').nth(scope==='household'?0:1).click(); await route('ledger',scope);
   const ready=page.locator('.onboarding-ready.is-unlocked');
   if(await ready.isVisible()) { await ready.getByRole('button').click(); await settle(); }
   if(!await page.locator('.books-audit-office').evaluate(el=>el.open)) await page.locator('.books-audit-office > summary').click();
   if(scope==='household') await page.getByText(/Postgres .* is holding/).waitFor({timeout:90000});
   for(const name of ['Journal','Trial balance','Statements','Reconcile','Close pack','Chart','Ask']) {
    await page.locator('[data-books-tabs="audit"]').getByRole('button',{name,exact:true}).click(); await settle();
    const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary,html:n.html}))}));
    const file=`${theme}-${scope}-${name.toLowerCase().replaceAll(' ','-')}`;
    await page.screenshot({path:`${out}/${file}-390.png`});
    const metric=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
    let print=null;
    if(name==='Statements') {
     await page.emulateMedia({media:'print'});
     print=await page.evaluate(()=>({ink:getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),paper:getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),sceneHidden:getComputedStyle(document.querySelector('.theme-scene-heading')).display==='none'}));
     await page.pdf({path:`${out}/${file}.pdf`,format:'A4',printBackground:true}); await page.emulateMedia({media:'screen'});
    }
    records.push({theme,scope,surface:name,metric,violations,print}); await writeFile(`${out}/report.json`,JSON.stringify({records,errors},null,2)); console.log(theme,scope,name,violations.map(v=>v.id).join(','));
   }
  }
 }
} catch(e) { console.log('FAILED',String(e)); errors.push(String(e)); process.exitCode=1; await page.screenshot({path:`out/failure.png`.replace('out/',`${out}/`)}); }
finally {
 if(records.length!==42 || errors.length || records.some(r=>r.violations.length || r.metric.scrollWidth>r.metric.width || (r.print && (r.print.ink!=='#111111' || r.print.paper!=='#ffffff' || !r.print.sceneHidden)))) process.exitCode=1;
 await writeFile(`${out}/report.json`,JSON.stringify({browser:'Installed Chrome',databaseMode:fallback?'existing local fallback':'normal worker',records,errors},null,2)); await browser.close();
}
