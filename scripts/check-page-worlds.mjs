// Actual App, synthetic local fixture only. Blocks every non-local request.
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {checkBooks} from './check-books-interactions.mjs';
import {checkMore} from './check-more-interactions.mjs';
import {checkPlan} from './check-plan-interactions.mjs';
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
page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000);
page.on('pageerror',e=>errors.push(String(e)));
async function settle(){await page.locator('.deferred-surface[aria-busy=true]').waitFor({state:'hidden',timeout:90000});await page.evaluate(()=>document.fonts.ready);await page.locator('.books-heading-art img:visible,.books-scene-viewport>img:visible').evaluateAll(es=>Promise.all(es.map(e=>e.decode().then(()=>{if(!e.naturalWidth)throw Error("Books scene image is empty");}))));const close=page.getByRole('button',{name:'Close reminders',exact:true});if(await close.count())await close.click();}
async function nav(name){await page.locator('nav.nav').getByRole('button',{name,exact:true}).click();await settle();}
async function go(scope){
 if(route==='ledger'){await nav('More');await page.getByRole('button',{name:scope==='household'?'Open the household table':'Open my books',exact:true}).click();}
 else if(route==='till'){await nav('Home');await page.getByRole('link',{name:'Till',exact:true}).first().click();}
 else await nav({home:'Home',plan:'Plan',calendar:'Calendar',shift:'Shifts',more:'More'}[route]);await settle();
}
try {
 await page.goto(origin+'/?themeStudio=1',{waitUntil:'domcontentloaded',timeout:120000});
 await page.evaluate(async({state,route})=>{
  const {completedExistingBooksHousehold}=await import('/test/fixtures/existing-books-onboarding.ts');
  const {saveHousehold}=await import('/src/storage.ts');const {saveSession}=await import('/src/session.ts');
  let h=completedExistingBooksHousehold('2026-09-09T12:00:00.000Z');
  const {assertAcceptableBooks}=await import('/src/core/booksValidation.ts');const {financialAuditHash}=await import('/src/core/commandIdentity.ts');
  if(state==='empty') {h.transactions=[];h.shifts=[];h.goals=[];h.recurrences=[];if(route==='plan')h.budgetPlans=[];}
  if(state==='long') {
   if(route==='more')h.members=h.members.map(m=>({...m,name:m.name+' with a very long illustrative member name'}));
   h.name='Our household with a wonderfully long name for narrow-screen verification';
   if(route==='plan')h.budgetPlans=h.budgetPlans.map(b=>({...b,amountCents:123456789}));
   if(route==='plan')h.categories=h.categories.map(c=>({...c,name:c.name+' — a longer illustrative category label'}));
   h.accounts=h.accounts.map(a=>({...a,name:a.name+' — a longer account label with additional details'}));
   h.goals=h.goals.map(g=>({...g,name:g.name+' — something wonderful we are carefully saving toward together'}));
   h.recurrences=h.recurrences.map(r=>({...r,note:r.note+' — a long illustrative recurring payment with additional scheduling detail',amountCents:123456789}));
  }
  if(route==='ledger'&&state==='long'){const {postEntry}=await import('/src/core/index.ts');h=postEntry(h,{date:'2026-09-09',type:'income',amount:'1234567.89',accountId:'ACC-CHEQUING',subcategoryId:'SUB-INCOME-WAGES',note:'A deliberately long illustrative income description for checking large amounts and narrow reading surfaces',createdBy:'MEM-002',visibility:'household',confirmDuplicate:true}).household;h.transactions=h.transactions.map(t=>({...t,note:t.note+' — a longer illustrative record description for testing the Books page'}));}
  if(route==='plan'&&state!=='empty') { const {addGoal}=await import('/src/core/index.ts'); h=addGoal(h,{name:'A weekend by the water'+(state==='long'?' — something wonderful we are carefully saving toward together':''),target:'1500',shared:true}).household; if(state==='long'){ const {fundGoal}=await import('/src/core/index.ts'); h=addGoal(h,{name:'A little keepsake',target:'25',shared:true}).household; const goal=h.goals.find(g=>g.name==='A little keepsake'); h=fundGoal(h,{goalId:goal.id,amount:'25',fromAccountId:'ACC-CHEQUING',date:'2026-09-09',createdBy:'MEM-002'}).household; } h=addGoal(h,{name:'My next adventure',target:'800',shared:false,ownerMemberId:'MEM-002'}).household; }
  if(route==='more'&&state==='long'){const {appendRestorePoint}=await import('/src/core/restorePoints.ts');h=await appendRestorePoint(h,'MEM-002');h.restorePoints=h.restorePoints.map(p=>({...p,label:'A deliberately long illustrative restore point label for the household books — September review'}));const {saveUndoHistory}=await import('/src/undoHistory.ts');saveUndoHistory('development',h.householdId,'MEM-002',[{id:'UNDO-VISUAL',label:'A long illustrative recent change description for the household review — groceries and supplies',postedIds:[h.transactions[0].id],snapshot:h,actorMemberId:'MEM-002'}]);}
  assertAcceptableBooks(h);h.booksAcceptedHash=await financialAuditHash(h);
  await saveHousehold(h,{memberId:'MEM-002',activate:true});saveSession('development',{householdId:h.householdId,memberId:'MEM-002',view:'household'});
 },{state,route});
 await page.goto(origin);await page.locator('nav.nav').waitFor({timeout:90000});await settle();await page.locator('.app[data-books-readiness=ready]').waitFor({timeout:90000});
 const due=page.locator('[aria-labelledby="due-preview-title"]');if(await due.isVisible())await due.getByRole('button',{name:'Not now',exact:true}).click();
 const closeReminders=page.getByRole('button',{name:'Close reminders',exact:true});if(await closeReminders.count())await closeReminders.click();
 if(route==='ledger'&&process.env.HEARTH_BOOKS_LOADING==='1') {
  await nav('More');let release;const pending=new Promise(resolve=>release=resolve);
  await page.route('**/src/Books.tsx*',async request=>{await pending;await request.abort();});
  for(const phase of ['loading','error']) {
   if(phase==='error')release();
   for(const theme of ['classic','taylor','newfoundland']) {
    await nav('More');await page.locator('[data-preview-theme="'+theme+'"]').click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
    for(const scope of ['household','personal']) {
     await nav('More');await page.locator('.view-switch button').nth(scope==='household'?0:1).click();
     await page.getByRole('button',{name:scope==='household'?'Open the household table':'Open my books',exact:true}).click();
     const surface=phase==='loading'?page.locator('.deferred-surface[aria-busy=true]'):page.locator('.deferred-surface[role=alert]');await surface.waitFor();
     const metrics=[];
     for(const width of [320,390,720,1100,1440]){await page.setViewportSize({width,height:1000});await surface.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${theme}-${scope}-${phase}-${width}.png`});metrics.push(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth})));}
     const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
     records.push({theme,scope,route,state:phase,metrics,violations,special:{zoom:{width:1440,scroll:await page.evaluate(()=>document.documentElement.scrollWidth)}}});
    }
   }
  }
  const unexpected=errors.filter(e=>!e.includes('Failed to fetch dynamically imported module'));errors.splice(0,errors.length,...unexpected);
 }
 if(route==='more'&&process.env.HEARTH_MORE_LOADING==='1') {
  let release;const pending=new Promise(resolve=>release=resolve);
  await page.route('**/src/Pairing.tsx',async request=>{await pending;await request.abort();});
  await page.locator('nav.nav').getByRole('button',{name:'More',exact:true}).click();
  await page.locator('.deferred-surface[aria-busy=true]').waitFor();
  for(const phase of ['loading','error']) {
   if(phase==='error'){release();await page.locator('.deferred-surface[role=alert]').waitFor();}
   for(const theme of ['classic','taylor','newfoundland']) {
    await page.locator('[data-preview-theme="'+theme+'"]').click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
    for(const scope of ['household','personal']) {
     await page.locator('.view-switch button').nth(scope==='household'?0:1).click();
     for(const width of [390,1440]){await page.setViewportSize({width,height:1000});await page.locator('.deferred-surface').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${theme}-${scope}-${phase}-${width}.png`});}
     const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
     records.push({theme,scope,route,state:phase,metrics:[],violations,special:{zoom:{width:1440,scroll:await page.evaluate(()=>document.documentElement.scrollWidth)}}});
    }
   }
  }
  const unexpected=errors.filter(e=>!e.includes('Failed to fetch dynamically imported module'));errors.splice(0,errors.length,...unexpected);
 }
 if(process.env.HEARTH_MORE_LOADING!=='1'&&process.env.HEARTH_BOOKS_LOADING!=='1') for(const theme of (process.env.HEARTH_THEMES?.split(',')||['classic','taylor','newfoundland'])) {
  await nav('More');await page.locator('[data-preview-theme="'+theme+'"]').click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
  for(const scope of route==='till'?['household']:route==='shift'?['personal']:['household','personal']) {
   if(process.env.HEARTH_SCENE_PAIRS&&!process.env.HEARTH_SCENE_PAIRS.split(',').includes(theme+':'+scope))continue;
   await page.locator('.view-switch button').nth(scope==='household'?0:1).click();await go(scope);
   if(route==='more'&&theme==='newfoundland')await page.locator('.more-chair-sticker').evaluate(e=>{if(!e.complete||!e.naturalWidth)throw Error('Chair image not loaded');});
   const metrics=[];
   for(const width of (process.env.HEARTH_WIDTHS?.split(',').map(Number)||[320,390,719,720,1100,1440,1920])) {
    await page.setViewportSize({width,height:1000});await settle();await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:out+'/'+theme+'-'+scope+'-'+width+'.png'});
    if(width===390)await page.screenshot({path:out+'/'+theme+'-'+scope+'-mobile-full.png',fullPage:true});
    if(width===1440) {
     await page.screenshot({path:out+'/'+theme+'-'+scope+'-desktop-full.png',fullPage:true});
     if(route==='ledger') { await page.evaluate(()=>window.scrollTo(0,1000)); await page.screenshot({path:out+'/'+theme+'-'+scope+'-desktop-scrolled.png'}); const scene=await page.locator('.books-scene-viewport').evaluate(e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom})); if(scene.bottom<500)errors.push('Books background did not follow scroll '+theme+' '+scope); await page.evaluate(()=>window.scrollTo(0,0)); }
     const desktopAxe=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
     if(desktopAxe.length)errors.push(theme+' '+scope+' desktop axe '+JSON.stringify(desktopAxe.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
    }
    if(['home','calendar','plan','ledger','more'].includes(route)) {
     const bracelet=await page.evaluate(()=>{const group=document.querySelector('.background-keepsake'),wrap=group?.querySelector('.friendship-bracelets--wrapped'),copy=document.querySelector('.theme-scene-copy'),era=group?.querySelectorAll('.era-light').length??0;if(!group||!wrap||!copy)return {visible:false,overlapsCopy:false,overlapsExistingArt:false,era};const g=group.getBoundingClientRect(),c=copy.getBoundingClientRect(),intersects=(r,o)=>r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top;const existing=[...document.querySelectorAll('.more-chair-sticker,.calendar-couple,.plan-cannon-sticker')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect());return {visible:getComputedStyle(group).display!=='none'&&g.width>0&&g.height>0,overlapsCopy:intersects(g,c),overlapsExistingArt:existing.some(r=>intersects(g,r)),era};});
     if(!bracelet.visible)errors.push('Wrapped friendship bracelets missing '+route+' '+theme+' '+scope+' '+width);
     if(bracelet.overlapsCopy)errors.push('Wrapped friendship bracelets overlap title copy '+route+' '+theme+' '+scope+' '+width);
     if(bracelet.overlapsExistingArt)errors.push('Wrapped friendship bracelets overlap existing title art '+route+' '+theme+' '+scope+' '+width);
     if(bracelet.era!==(theme==='taylor'?1:0))errors.push('Concert bracelet theme leak '+route+' '+theme+' '+scope+' '+width);
    }
    if(route==='more'&&theme==='newfoundland') {
     const chair=page.locator('.more-chair-sticker');
     if(await chair.isVisible()) { const contained=await chair.evaluate(e=>{const r=e.getBoundingClientRect(),p=e.closest('.theme-scene-heading').getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom&&r.left>=p.left&&r.right<=p.right;}); if(!contained)errors.push('JAG chair clipped '+width); }
    }
    if(route==='plan') {
     const geometry=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width};};return {categories:rect('.plan-categories'),banks:rect('.kitty-banks'),sit:rect('.sit-guide')};});
     if(width>=1100&&!(geometry.categories.x<geometry.banks.x&&geometry.banks.y<geometry.sit.y))errors.push('Plan desktop columns incorrect '+width);
     if(width<1100&&!(geometry.categories.y<geometry.sit.y&&geometry.sit.y<geometry.banks.y))errors.push('Plan single-column order changed '+width);
    }
    metrics.push(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,scene:document.documentElement.dataset.scene,dateWidth:document.querySelector('.cal-day')?.getBoundingClientRect().width,dateHeight:document.querySelector('.cal-day')?.getBoundingClientRect().height})));
   }
   await page.setViewportSize({width:1440,height:1000});await settle();
   if(route==='home') {
    if(await page.locator('.home-rehearsal-entry').isVisible())errors.push('Desktop rehearsal duplicate visible');
    if(!await page.locator('.background-keepsake').isVisible())errors.push('Desktop bracelets missing');
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
   if(route==='ledger'&&process.env.HEARTH_SKIP_NESTED!=='1')special.books=await checkBooks({page,out,theme,scope,state});
   if(route==='more'&&process.env.HEARTH_SKIP_NESTED!=='1')special.more=await checkMore({page,out,theme,scope,state});
   if(route==='plan'&&process.env.HEARTH_SKIP_NESTED!=='1')special.plan=await checkPlan({page,out,theme,scope,state});
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
 if(process.env.HEARTH_MORE_LOADING!=='1'&&process.env.HEARTH_BOOKS_LOADING!=='1'&&['home','calendar','plan','more','ledger'].includes(route)&&state==='normal') {
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('.world-charm').focus();
  await page.locator('.theme-scene-heading').getByRole('button',{name:'Pause atmosphere',exact:true}).click();
  await page.waitForFunction(()=>document.documentElement.dataset.atmosphere==='paused');
  const running=()=>page.evaluate(()=>document.getAnimations().filter(a=>a.constructor.name==='CSSAnimation'&&a.playState==='running'&&a.effect?.target?.closest?.('.page-world-art,.living-home-art,.world-charm-row,.calendar-heading-art,.calendar-binding,.plan-heading-art,.more-heading-art,.books-heading-art,.books-phone-art,.books-divider')).length);
  if(await running())throw Error('Paused new atmosphere still running: '+JSON.stringify(await page.evaluate(()=>document.getAnimations().filter(a=>a.constructor.name==='CSSAnimation'&&a.playState==='running'&&a.effect?.target?.closest?.('.page-world-art,.living-home-art,.world-charm-row,.calendar-heading-art,.calendar-binding,.plan-heading-art,.more-heading-art,.books-heading-art,.books-phone-art,.books-divider')).map(a=>({target:a.effect.target.outerHTML.slice(0,160),type:a.constructor.name,style:getComputedStyle(a.effect.target).animationPlayState})))));
  if(route==='calendar'||route==='plan'||route==='more'||route==='ledger') {
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('nav.nav').waitFor({timeout:90000});await settle();await page.locator('.view-switch button').nth(1).click();await go('personal');
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
  if(route==='ledger') {
   const reminders=page.getByRole('button',{name:'Close reminders',exact:true});if(await reminders.count())await reminders.click();
   const audit=page.locator('.books-audit-office');if(await audit.getAttribute('open')===null)await audit.locator('summary').click();
   await page.waitForFunction(()=>document.querySelector('.books-audit-office')?.open);
   await page.locator('[data-books-tabs="audit"]').getByRole('button',{name:'Reconcile',exact:true}).click();
   await page.getByRole('textbox',{name:'Statement balance (CAD)',exact:true}).focus();
   await page.waitForFunction(()=>document.documentElement.dataset.atmosphere==='paused');
   if(await running())throw Error('Books focus quiet failed');
   await page.locator('.world-charm').focus();await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('.books-scenery-panel')).some(e=>e.dataset.atmosphereVisible==='false'));
   records.at(-1).special.motion={persistentPause:true,focusQuiet:true,offscreen:await page.locator('.books-scenery-panel[data-atmosphere-visible=false]').count()};
  }
  if(route==='more') {
   await page.getByRole('textbox',{name:'Category name',exact:true}).focus();
   await page.waitForFunction(()=>document.documentElement.dataset.atmosphere==='paused');
   if(await running())throw Error('More focus quiet failed');
   await page.locator('.world-charm').focus();
   await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('.more-scenery-panel')).some(e=>e.dataset.atmosphereVisible==='false'));
   records.at(-1).special.motion={persistentPause:true,focusQuiet:true,offscreen:await page.locator('.more-scenery-panel[data-atmosphere-visible=false]').count()};
  }
  if(route==='plan') {
   await page.locator('.budget-edit-trigger').first().click();
   await page.waitForFunction(()=>document.documentElement.dataset.atmosphere==='paused');
   if(await running())throw Error('Plan focused-entry atmosphere still running');
   await page.keyboard.press('Escape');
   await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('.plan-scenery-panel')).some(e=>e.dataset.atmosphereVisible==='false'));
   records.at(-1).special.motion={persistentPause:true,focusQuiet:true,offscreen:await page.locator('.plan-scenery-panel[data-atmosphere-visible=false]').count()};
  }
  await page.emulateMedia({reducedMotion:'reduce'});if(await running())throw Error('Reduced motion still running');
 }
} catch(e) { errors.push(String(e));console.error(String(e));console.error((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:out+'/failure.png'});process.exitCode=1; }
finally {
 await writeFile(out+'/report.json',JSON.stringify({browser:'Installed Chrome; synthetic completed-books fixture; no hosted requests',records,errors},null,2));
 if(errors.length||records.some(r=>r.violations.length||r.metrics.some(m=>m.scroll>m.width||(m.dateWidth!==undefined&&(m.dateWidth<43.9||m.dateHeight<(m.width<720?88:112))))||r.special.zoom.scroll>r.special.zoom.width||r.special.galleryCount>1||r.special.galleryAfterOffice===false||r.special.charm&&!r.special.charm.hit))process.exitCode=1;
 await browser.close();
}
