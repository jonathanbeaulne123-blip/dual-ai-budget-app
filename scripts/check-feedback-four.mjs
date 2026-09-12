import {chromium} from '@playwright/test';
import {checkCalendar} from './check-calendar-interactions.mjs';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const nested=process.env.HEARTH_PROOF_NESTED==='1';
const scope=process.env.HEARTH_PROOF_SCOPE==='personal'?'personal':'household';
const origin='http://127.0.0.1:5198';
const out=process.env.HEARTH_ARTIFACTS_DIR||'docs/evidence/feedback-four';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
await context.addInitScript(()=>{delete Object.getPrototypeOf(navigator).locks;});
const page=await context.newPage();page.setDefaultTimeout(90000);
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto(origin+'/?themeStudio=1');
 await page.evaluate(async(scope)=>{
 const {completedExistingBooksHousehold}=await import('/test/fixtures/existing-books-onboarding.ts');
 const {saveHousehold}=await import('/src/storage.ts');const {saveSession}=await import('/src/session.ts');
 const {financialAuditHash}=await import('/src/core/commandIdentity.ts');
 const h=completedExistingBooksHousehold('2026-09-12T12:00:00.000Z');h.booksAcceptedHash=await financialAuditHash(h);
 await saveHousehold(h,{memberId:'MEM-002',activate:true});saveSession('development',{householdId:h.householdId,memberId:'MEM-002',view:scope});
 },scope);
 await page.goto(origin);await page.locator('nav.nav').waitFor();await page.locator('.app[data-books-readiness=ready]').waitFor();
 await page.screenshot({path:out+'/initial.png'});
 await writeFile(out+'/initial.txt',await page.locator('body').innerText());
 const metrics=[], accessibility=[];
 const settle=async()=>{await page.locator('.deferred-surface[aria-busy=true]').waitFor({state:'hidden'});await page.evaluate(()=>document.fonts.ready);const reminders=page.getByRole('button',{name:'Close reminders',exact:true});if(await reminders.count())await reminders.click();};
 const nav=async(name)=>{await page.locator('nav.nav').getByRole('button',{name,exact:true}).click();await settle();};
 for(const theme of (nested?['classic']:['classic','taylor','newfoundland'])) {
  await page.getByRole('button',{name:/Status Centre/}).first().click();await settle();
  const comfort=page.locator('#status-comfort');if(await comfort.count() && !await comfort.evaluate(e=>e.open))await comfort.locator('summary').click();
  await page.locator(`[data-preview-theme="${theme}"]`).click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
  for(const route of (nested?['calendar']:scope==='personal'?['home','calendar','ledger','plan','more']:['home','calendar','ledger','plan','together','more'])) {
   if(route==='more')await page.getByRole('button',{name:/Status Centre/}).first().click();
   else if(route==='calendar'){if(scope==='personal')await nav('Calendar');else {await nav('Home');await page.locator('.home-doors').getByRole('button',{name:/Calendar/}).click();}}
   else await nav({home:'Home',ledger:scope==='personal'?'Books':'The Fund',plan:scope==='personal'?'Plan':'Our Path',together:'Together'}[route]);
   await settle();
   for(const width of [320,390,720,1100,1440,1920]) {
    await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
    const record=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,titleBracelets:document.querySelectorAll('.desktop-title-bracelets').length,nav:[...document.querySelectorAll('nav.nav > button')].map(e=>({text:e.textContent,y:e.getBoundingClientRect().y})),clippedTabs:[...document.querySelectorAll('.calendar-tabs button')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent),hiddenAdd:[...document.querySelectorAll('.cal-add:not(.is-revealed)')].filter(e=>e.tabIndex>=0).length}));
    if(record.scroll>width+1)errors.push(`${theme}/${route}/${width}: overflow ${record.scroll}`);
    if(record.titleBracelets||record.hiddenAdd||record.clippedTabs.length)errors.push(`${theme}/${route}/${width}: decoration/tab stop regression`);
    metrics.push({theme,route,...record});
    if([390,1440].includes(width))await page.screenshot({path:`${out}/${theme}-${route}-${width}.png`,fullPage:true});
   }
   await page.setViewportSize({width:390,height:900});
   const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
   accessibility.push({theme,route,violations});
   if(violations.length)errors.push(`${theme}/${route}: accessibility ${violations.map(v=>v.id).join(', ')}`);
   if(route==='ledger'){await page.getByRole('button',{name:'See any month',exact:true}).click();await settle();await page.getByRole('button',{name:'Back to Books',exact:true}).click();await settle();if(!await page.getByRole('button',{name:'See any month',exact:true}).isVisible()||await page.evaluate(()=>document.activeElement===document.body))errors.push(`${theme}: month history return/focus failed`);}
   if(route==='calendar') {
    await page.getByRole('button',{name:'Cash flow',exact:true}).click();await page.locator('.weight').waitFor();
    await page.getByRole('button',{name:'Dates',exact:true}).click();await page.locator('.cal-grid').waitFor();
    if(nested)metrics.push({theme,scope,nested:await checkCalendar({page,out,theme,scope,state:'normal'})});
   }
  }
 }
 await writeFile(out+'/metrics.json',JSON.stringify({scope,metrics,accessibility,errors},null,2));
 console.log(JSON.stringify({out,errors,cases:metrics.length,accessibility:accessibility.map(x=>({theme:x.theme,route:x.route,violations:x.violations.map(v=>v.id)}))}));
 if(errors.length)process.exitCode=1;
}finally{await browser.close();}
