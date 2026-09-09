// Actual App, synthetic local fixture only. Blocks every non-local request.
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {checkCalendar} from './check-calendar-interactions.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const route=process.env.HEARTH_WORLD_PAGE||'home';
const state=process.env.HEARTH_WORLD_STATE||'normal';
const origin=process.env.HEARTH_THEME_ORIGIN||'http://127.0.0.1:5192';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Local proof only');
const out=process.env.HEARTH_ARTIFACTS_DIR||'.artifacts/page-worlds/'+route+(state==='normal'?'':'-'+state);
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
 for(const theme of (process.env.HEARTH_THEMES?.split(',')||['classic','taylor','newfoundland'])) {
  await nav('More');await page.locator('[data-preview-theme="'+theme+'"]').click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
  for(const scope of route==='till'?['household']:route==='shift'?['personal']:['household','personal']) {
   await page.locator('.view-switch button').nth(scope==='household'?0:1).click();await go(scope);
   const metrics=[];
   for(const width of (process.env.HEARTH_WIDTHS?.split(',').map(Number)||[320,390,719,720,1100,1440,1920])) {
    await page.setViewportSize({width,height:1000});await settle();await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:out+'/'+theme+'-'+scope+'-'+width+'.png'});
    if(width===390)await page.screenshot({path:out+'/'+theme+'-'+scope+'-mobile-full.png',fullPage:true});
    if(width===1440) {
     await page.screenshot({path:out+'/'+theme+'-'+scope+'-desktop-full.png',fullPage:true});
     const desktopAxe=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
     if(desktopAxe.length)errors.push(theme+' '+scope+' desktop axe '+JSON.stringify(desktopAxe.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
    }
    if(route==='home' && width<720 && await page.locator('.desktop-title-bracelets').isVisible())errors.push('Desktop bracelets leaked into phone');
    metrics.push(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,scene:document.documentElement.dataset.scene,dateWidth:document.querySelector('.cal-day')?.getBoundingClientRect().width,dateHeight:document.querySelector('.cal-day')?.getBoundingClientRect().height})));
   }
   await page.setViewportSize({width:1440,height:1000});await settle();
   if(route==='home') {
    if(await page.locator('.home-rehearsal-entry').isVisible())errors.push('Desktop rehearsal duplicate visible');
    if(!await page.locator('.desktop-title-bracelets').isVisible())errors.push('Desktop bracelets missing');
    const weather=page.locator('.office-glass');
    if(await weather.count()) {
     await weather.click();if(!await page.locator('.office-forecast').isVisible())errors.push('Forecast failed to open');
     await weather.click();if(!await page.locator('.office-window.is-minimized').count())errors.push('Weather failed to minimize');
     await weather.click();if(await page.locator('.office-window.is-minimized').count())errors.push('Weather failed to restore');
    }
   }
   await page.evaluate(()=>document.documentElement.style.zoom='2');
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))errors.push('Desktop enlarged overflow');
   await page.screenshot({path:out+'/'+theme+'-'+scope+'-desktop-enlarged.png'});
   await page.evaluate(()=>document.documentElement.style.zoom='');
   await page.setViewportSize({width:390,height:1000});await settle();
   const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
   const special={};
   if(route==='calendar'&&process.env.HEARTH_SKIP_NESTED!=='1')special.calendar=await checkCalendar({page,out,theme,scope,state});
   if(route==='home'&&theme==='taylor') {
    special.galleryCount=await page.locator('.home-scrapbook').count();
    special.galleryAfterOffice=await page.locator('.home-scrapbook').evaluate(e=>Boolean(document.querySelector('.office').compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING));
    await page.locator('.home-scrapbook').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+theme+'-'+scope+'-scrapbook.png'});
    await page.getByRole('button',{name:'Next scrapbook page',exact:true}).focus();await page.keyboard.press('Enter');
    special.gallerySecond=await page.locator('.scrapbook-navigation [aria-live]').innerText();
    await page.screenshot({path:out+'/'+theme+'-'+scope+'-sequins.png'});
    await page.getByRole('button',{name:'Previous scrapbook page',exact:true}).click();
   }
   if(route==='home') {
    const fund=page.locator('.fund-ledge > .fund-ledge-grip');
    special.fundPresent=await fund.count();
    if(await fund.count()) {await fund.click();await page.locator('.is-sheet-grip').click();await page.locator('.fund-ledge-sheet[data-detent="full"]').waitFor();special.fundExpanded=true;await page.screenshot({path:out+'/'+theme+'-'+scope+'-fund-expanded.png'});await page.keyboard.press('Escape');special.fundFocusRestored=await fund.evaluate(e=>document.activeElement===e);}
   }
   const charm=page.locator('.world-charm');
   if(await charm.count()) {
    await charm.scrollIntoViewIfNeeded();special.charm=await charm.evaluate(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e};});
    await charm.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');special.focus=await charm.evaluate(e=>getComputedStyle(e).outlineStyle);
   }
   await page.evaluate(()=>document.documentElement.style.zoom='2');
   special.zoom=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   await page.evaluate(()=>document.documentElement.style.zoom='');
   records.push({theme,scope,route,state,metrics,violations,special});console.log(theme,scope,route,JSON.stringify({violations:violations.map(v=>v.id),special}));
   await writeFile(out+'/report.json',JSON.stringify({records,errors},null,2));
  }
 }
 if(['home','calendar'].includes(route)&&state==='normal') {
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.world-charm').focus();
  await page.locator('.theme-scene-heading').getByRole('button',{name:'Pause atmosphere',exact:true}).click();
  await page.waitForFunction(()=>document.documentElement.dataset.atmosphere==='paused');
  const running=()=>page.evaluate(()=>document.getAnimations().filter(a=>a.constructor.name==='CSSAnimation'&&a.playState==='running'&&a.effect?.target?.closest?.('.page-world-art,.living-home-art,.world-charm-row,.calendar-heading-art,.calendar-binding')).length);
  if(await running())throw Error('Paused new atmosphere still running: '+JSON.stringify(await page.evaluate(()=>document.getAnimations().filter(a=>a.constructor.name==='CSSAnimation'&&a.playState==='running'&&a.effect?.target?.closest?.('.page-world-art,.living-home-art,.world-charm-row,.calendar-heading-art,.calendar-binding')).map(a=>({target:a.effect.target.outerHTML.slice(0,160),type:a.constructor.name,style:getComputedStyle(a.effect.target).animationPlayState})))));
  if(route==='calendar') {
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('nav.nav').waitFor({timeout:90000});await settle();await go('personal');
   if(await page.locator('html').getAttribute('data-atmosphere')!=='paused')throw Error('Atmosphere pause did not persist');
   records.at(-1).special.motion={persistentPause:true};
  }
  await page.locator('.theme-scene-heading').getByRole('button',{name:'Resume atmosphere',exact:true}).click();
  await page.locator('.world-charm').focus();await page.keyboard.press('Enter');
  if(route==='calendar') {
   await page.getByRole('tab',{name:'Month',exact:true}).click();await page.getByRole('slider',{name:'Day of the month',exact:true}).focus();
   await page.waitForFunction(()=>document.documentElement.dataset.atmosphere==='paused');
   if(await running())throw Error('Focused-entry atmosphere still running');
   records.at(-1).special.motion.focusQuiet=true;
   await page.getByRole('tab',{name:'Calendar',exact:true}).click();
   await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('.calendar-scenery-panel')).some(e=>e.dataset.atmosphereVisible==='false'));
   records.at(-1).special.motion.offscreen=await page.locator('.calendar-scenery-panel[data-atmosphere-visible=false]').count();
  }
  await page.emulateMedia({reducedMotion:'reduce'});if(await running())throw Error('Reduced motion still running');
 }
} catch(e) { console.error(String(e));console.error((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:out+'/failure.png'});process.exitCode=1; }
finally {
 await writeFile(out+'/report.json',JSON.stringify({browser:'Installed Chrome; synthetic completed-books fixture; no hosted requests',records,errors},null,2));
 if(errors.length||records.some(r=>r.violations.length||r.metrics.some(m=>m.scroll>m.width||(m.dateWidth!==undefined&&(m.dateWidth<43.9||m.dateHeight<(m.width<720?88:112))))||r.special.zoom.scroll>r.special.zoom.width||r.special.galleryCount>1||r.special.galleryAfterOffice===false||r.special.charm&&!r.special.charm.hit))process.exitCode=1;
 await browser.close();
}
