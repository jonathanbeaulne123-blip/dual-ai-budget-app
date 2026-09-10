/** Local browser acceptance of actual AddSlideshow + useDialog + production CSS.
 * Run from the checkout under review (no hosted server or financial writer):
 *   node test/five-boards-entry-layout.mjs
 * Optional: HEARTH_ARTIFACTS_DIR=/tmp/entry-proof ENTRY_CASE_FILTER='^flow/classic/expense/390'
 * Default: 60 mode/theme/width flows, 3 sign-out flows, 15 shift gates,
 * 24 desktop half-width reflow checks, and 3 normal-motion checks. Exit 1 on any failure.
 * 200% reflow means half-size CSS viewports, not native browser chrome zoom.
 */
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const out = resolve(process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/three-worlds/five-boards-entry-layout'); mkdirSync(out, {recursive:true});
const cacheDir = mkdtempSync(join(tmpdir(),'hearth-entry-review-'));
const cssPaths=[...readFileSync('src/main.tsx','utf8').matchAll(/import ["']\.\/(.*\.css)["'];/g)].map(([,path])=>'src/'+path);
assert.ok(cssPaths.length>=15,'Production CSS import discovery failed');
const files = ['src/AddSlideshow.tsx','src/addSlideshow.ts','src/MobileEntryChoices.tsx','src/mobile-entry-sheet.css','src/swipe.css','src/useDialog.ts',...cssPaths];
const fingerprint = () => ({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), files:Object.fromEntries(files.map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]))});
const start = fingerprint();
const css = cssPaths.map(path=>`import '/${path}';`).join('\n');
const entry = `
import {createElement as el,useState,useRef} from 'react';import {createRoot} from 'react-dom/client';
import {AddSlideshow} from '/src/AddSlideshow.tsx';
${css}
import {useDialog} from '/src/useDialog.ts';
import {catalogHousehold,JOINT,previewShiftAmounts} from '/src/core/index.ts';import {resolveThemeScene,sceneTokens} from '/src/theme/scenes.ts';
const q=new URLSearchParams(location.search);
window.applyEntryTheme=(theme)=>{const scene=resolveThemeScene(theme,'entry','household');
Object.assign(document.documentElement.dataset,{theme,scene:scene.id,material:scene.material,sceneLighting:scene.dark?'dark':'light',atmosphere:'paused'});
document.documentElement.style.colorScheme=scene.dark?'dark':'light';
for(const[k,v]of Object.entries(sceneTokens(scene)))document.documentElement.style.setProperty(k,v);};
window.applyEntryTheme(q.get('theme')||'classic');
const phone=matchMedia('(max-width:719px)');const touch=()=>document.documentElement.style.touchAction=phone.matches?'manipulation':'';touch();phone.addEventListener('change',touch);
const h=catalogHousehold('development');h.householdId='HH-entry-review';const today='2026-09-08',noop=()=>{};
const initial={date:today,amount:'32.45',accountId:'ACC-VISA',subcategoryId:q.get('mode')==='income'?'SUB-INCOME-WAGES':'SUB-FOOD-GROCERIES',note:'',place:'Local fixture place',who:JOINT,fromAccountId:'ACC-CHEQUING',toAccountId:'ACC-VISA',memberId:'MEM-002',sales:'842.50',cashTips:'65.25',ccTips:'110.75',hours:'7.25',customersServed:'40',staffingCount:'4',eventTag:'regular',visibility:'household',occurredAt:'',useHouseholdFund:false,fundedAmount:'',fundDestinationAccountId:'ACC-VISA'};
const placePrefs={displayTimeZone:'America/Toronto',locationAllowed:false,addPromptSeen:true,stampTime:true,stampCoords:true,shareCoordsWithModel:false,updatedAt:'2026-09-08T12:00:00Z'};
function App(){const[form,setForm]=useState(initial),[index,setIndex]=useState(0),[open,setOpen]=useState(false),[mounted,setMounted]=useState(false),[mode,setMode]=useState(q.get('mode')||'expense'),[gate,setGate]=useState(q.get('gate')||'finished'),[details,setDetails]=useState(false),[touched,setTouched]=useState(false);
const trigger=useRef(null),sheet=useDialog(open,()=>setOpen(false),()=>trigger.current),confirm=useRef(null);
window.entryProof={form,mode,index,open,gate};
const props={sheetRef:sheet,open,recommendationHousehold:h,mode,onSwitchMode:next=>{setMode(next);setIndex(0);},form,setForm,household:h,booksHousehold:h,pickerAccounts:h.accounts.filter(a=>a.active),categories:h.categories.filter(c=>c.recordType==='category'&&c.active&&c.transactionType===(mode==='income'?'income':'expense')),today,slideIndex:index,onSlideIndex:setIndex,shiftGate:gate,hasWorkJobs:false,shiftJobsPanel:el('p',null,'Fictional job panel'),shiftPreview:previewShiftAmounts({salesCents:Math.round(Number(form.sales)*100),cashTipsCents:Math.round(Number(form.cashTips)*100),ccTipsCents:Math.round(Number(form.ccTips)*100),hours:Number(form.hours)},h.shiftSettings),onHoursDirty:noop,hoursDirty:false,onClockIn:()=>setGate('clocked'),onAlreadyOff:()=>setGate('finished'),onSignOut:()=>setGate('signOut'),onNeverMind:()=>setGate('choose'),busy:false,error:'',onDismissError:noop,onGoMore:noop,confirm:null,confirmPanelRef:confirm,onConfirmAnyway:()=>window.entryPosts=(window.entryPosts||0)+1,postLabel:'Confirm '+mode,onPost:()=>window.entryPosts=(window.entryPosts||0)+1,onClose:()=>setOpen(false),persistCategory:noop,presetId:null,onPresetId:noop,onSavePreset:noop,onForgetPreset:noop,categoryTouched:touched,onCategoryTouched:setTouched,codingHint:'',onCodingHint:noop,splitPercents:{'MEM-001':50,'MEM-002':50},splitScopeValid:true,onMemberPercent:noop,addDetails:details,onAddDetails:setDetails,placePrefs,onPlacePrefs:noop,environment:'development',showLocationPrompt:false,onShowLocationPrompt:noop,locationBusy:false,applyConfiguredStamps:noop,clearLocationStamp:noop,displayZone:'America/Toronto',experienceLine:'Fictional local preview.'};
return el('main',{className:'app','data-ledger-tab':'home',style:{'--fund-ledge-height':'84px'}},el('section',null,el('h1',null,'Fictional local entry review'),el('button',{ref:trigger,onClick:()=>{setMounted(true);setOpen(true);}},'Open entry'),el('a',{href:'#background'},'Background link')),mounted?el(AddSlideshow,props):null,el('div',{className:'fund-ledge'},el('button',{className:'fund-ledge-grip'},'Household Fund')),el('nav',{className:'nav'},el('button',null,'Home')));}
createRoot(document.getElementById('root')).render(el(App));`;
const server = await createServer({root:process.cwd(),configFile:false,cacheDir,server:{host:'127.0.0.1',port:0,ws:false},plugins:[{name:'entry-review',resolveId(id){if(id==='/entry-review.js')return '\0entry-review';},load(id){if(id==='\0entry-review')return entry;},configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url?.split('?')[0]!=='/entry-review')return next();res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/entry-review','<!doctype html><html lang="en"><head><title>Local entry review</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/entry-review.js"></script></body></html>'));});}}]});
const records = [], failures = [], errors = [], blocked = [], cases = [];
let browser, context, page, url;
const themes = ['classic', 'taylor', 'newfoundland'];
const widths = [320, 390, 719, 1100, 1440];
const modes = ['expense', 'income', 'transfer', 'shift'];
const section = name => page.locator(`[data-entry-section="${name}"]`);
const button = name => page.getByRole('button', {name, exact:true});
const draft = () => page.evaluate(() => structuredClone(window.entryProof.form));
const posts = () => page.evaluate(() => window.entryPosts || 0);
const slide = async name => assert.equal(await page.locator('.add-slideshow').getAttribute('data-add-slide'), name);
const back = () => page.locator('.topbar').getByRole('button', {name:'Back', exact:true}).click();

// Geometry is measured after two browser frames, never by imposing test-only CSS.
async function inspect(label, meta) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const geometry = await page.evaluate(() => {
    const dialog = document.querySelector('.add-slideshow');
    const panel = dialog.querySelector('.sheet-inner');
    const rect = panel.getBoundingClientRect();
    const nav = document.querySelector('.nav')?.getBoundingClientRect();
    const fund = document.querySelector('.fund-ledge-grip')?.getBoundingClientRect();
    const visible = el => el.checkVisibility() && !el.closest('[hidden]');
    const targets = [...panel.querySelectorAll('button,input:not([type=hidden]),select,textarea,summary,a[href]')]
      .filter(visible).map(el => {
        const r = el.getBoundingClientRect();
        return {name:el.getAttribute('aria-label') || el.textContent?.trim().slice(0,60) || el.id,
          x:r.x, right:r.right, width:r.width, height:r.height, disabled:el.disabled || false};
      });
    const priorScrollTop = panel.scrollTop;
    panel.scrollTop = panel.scrollHeight;
    const reachableBottom = Math.max(...[...panel.querySelectorAll('button,input:not([type=hidden]),select,textarea,summary,a[href]')]
      .filter(visible).map(el => el.getBoundingClientRect().bottom));
    panel.scrollTop = priorScrollTop;
    const motion = panel.getAnimations({subtree:true}).filter(a => a.playState === 'running' &&
      (a.effect?.getComputedTiming().duration === Infinity || Number(a.effect?.getComputedTiming().duration) > 100));
    return {viewport:innerWidth,viewportHeight:innerHeight,documentWidth:document.documentElement.scrollWidth,
      panel:{x:rect.x,right:rect.right,width:rect.width,y:rect.y,height:rect.height,
        clientWidth:panel.clientWidth,scrollWidth:panel.scrollWidth,
        paddingBottom:parseFloat(getComputedStyle(panel).paddingBottom)},
      bottomChrome:(nav?.height||0)+(fund?.height||0),reachableBottom,
      slide:dialog.dataset.addSlide,mobile:dialog.classList.contains('mobile-entry-sheet'),
      reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,runningMotion:motion.length,motion:motion.map(a=>({kind:a.constructor.name,name:a.animationName||a.transitionProperty,duration:a.effect?.getComputedTiming().duration,target:a.effect?.target?.outerHTML?.slice(0,250)})),
      targets,declaredTransitions:[...panel.querySelectorAll('*')].filter(visible).map(el=>({target:el.tagName+'.'+el.className,property:getComputedStyle(el).transitionProperty,duration:getComputedStyle(el).transitionDuration})).filter(t=>t.duration.split(',').some(d=>parseFloat(d)>0.1)),focusInside:dialog.contains(document.activeElement)};
  });
  records.push({label,...meta,...geometry});
  assert.ok(geometry.documentWidth <= geometry.viewport + 1, `${label}: document overflow`);
  assert.ok(geometry.panel.x >= -1 && geometry.panel.right <= geometry.viewport + 1, `${label}: panel outside viewport`);
  assert.ok(geometry.panel.scrollWidth <= geometry.panel.clientWidth + 1, `${label}: panel horizontal overflow`);
  if (geometry.viewport <= 719) assert.ok(geometry.panel.paddingBottom >= geometry.bottomChrome + 15,
    `${label}: final controls do not reserve mobile nav and Household Fund pull-tab clearance`);
  if (geometry.viewport <= 719) assert.ok(geometry.reachableBottom <= geometry.viewportHeight - geometry.bottomChrome + 1,
    `${label}: final control cannot scroll above mobile nav and Household Fund pull tab`);
  const clipped = geometry.targets.filter(t => t.x < geometry.panel.x-1 || t.right > geometry.panel.right+1);
  assert.deepEqual(clipped, [], `${label}: controls extend outside panel`);
  if (meta.reducedMotion && geometry.runningMotion) failures.push({label:'reduced-motion',...meta,state:label,error:'Transition remains active under reduced motion',motion:geometry.motion});
}

async function open(meta) {
  await page.setViewportSize({width:meta.width,height:900});
  await page.emulateMedia({reducedMotion:meta.reducedMotion ? 'reduce' : 'no-preference'});
  await page.goto(`${url}?theme=${meta.theme}&mode=${meta.mode}&gate=${meta.gate || 'finished'}`);
  await button('Open entry').click();
  await page.locator('.add-slideshow:not([hidden])').waitFor();
}

async function choose(name) {
  const choices = section(name).locator('button.swipe-cat:not(.more):not([disabled]),button.wallet-tile:not([disabled]),button.chip:not([disabled])');
  const chosen = choices.first();
  await chosen.click();
}

async function keyboard(meta) {
  // Real Tab traversal, including both boundary directions. No synthetic focus
  // changes to make the trap pass. The heading may receive initial programmatic focus.
  const count = await page.locator('.add-slideshow button,.add-slideshow input,.add-slideshow select,.add-slideshow summary').count();
  for (const key of ['Tab','Shift+Tab']) {
    for (let i=0; i<count+3; i++) {
      await page.keyboard.press(key);
      assert.ok(await page.evaluate(() => document.querySelector('.add-slideshow').contains(document.activeElement)), `${key}: focus escaped`);
    }
  }
  const focus = await page.evaluate(() => {
    const el = document.activeElement, c = getComputedStyle(el), r = el.getBoundingClientRect();
    return {name:el.textContent?.trim().slice(0,60), outline:c.outline, boxShadow:c.boxShadow,
      visible:r.bottom>0 && r.top<innerHeight && r.left>=0 && r.right<=innerWidth,
      indicator:(c.outlineStyle!=='none' && parseFloat(c.outlineWidth)>0) || c.boxShadow!=='none'};
  });
  assert.ok(focus.visible, 'keyboard focus is outside visible viewport');
  assert.ok(focus.indicator, 'keyboard focus lacks a visible indicator');
  records.push({label:'keyboard-loop',...meta,focus});
}

async function retention(meta) {
  const before = await draft();
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('.add-slideshow').isHidden(), 'Escape did not close');
  const returned = await page.waitForFunction(() => document.activeElement?.textContent === 'Open entry', undefined, {timeout:500}).then(()=>true,()=>false);
  if (!returned) failures.push({label:'escape-return-focus',...meta,error:'Escape did not return focus',
    focus:await page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id,text:document.activeElement.textContent?.slice(0,80)}))});
  await button('Open entry').click();
  assert.deepEqual(await draft(), before, 'close/reopen lost draft');
  const nextTheme = themes[(themes.indexOf(meta.theme)+1)%themes.length];
  await page.evaluate(theme => window.applyEntryTheme(theme), nextTheme);
  assert.deepEqual(await draft(), before, 'theme switch lost draft');
  await page.evaluate(theme => window.applyEntryTheme(theme), meta.theme);
  for (const width of [meta.width<=719 ? 1100 : 390, meta.width]) {
    await page.setViewportSize({width,height:900});
    assert.deepEqual(await draft(), before, 'resize lost draft');
    await inspect('resize-retention', {...meta,resized:width});
  }
  assert.equal(await posts(), 0, 'navigation called posting callback');
}

async function walk(meta) {
  const first = meta.mode==='shift' ? (meta.gate==='signOut'?'shift-hours':'shift-sales') : 'amount';
  await slide(first);
  await inspect('first-pad',meta);
  if (meta.width<=719) {
    const sizes=await page.locator('.cad-pad-keys button').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
    assert.ok(sizes.every(h=>h>=(meta.width<389?56:72)-1),'large pad key height regressed');
    await button('More').click();
    await slide('full-form');
    if(meta.mode==='shift')assert.deepEqual(await page.locator('[data-entry-section^="shift-"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.entrySection)),
      meta.gate==='signOut'?['shift-hours','shift-sales','shift-cashTips','shift-ccTips']:['shift-sales','shift-cashTips','shift-ccTips','shift-hours'], 'More changed original shift field order');
    assert.ok(await page.locator('[data-add-confirm]').isDisabled(), 'unscoped inherited account bypassed explicit choice');
    await section('note').locator('input#add-note').fill('Retain every entry detail');
    await section('confirm').locator('input[type=date]').fill('2026-09-07');
    // Real receipt input exercises local component state, outside AddFormFields.
    await section('note').locator('input[type=file]').setInputFiles({name:'receipt.png',mimeType:'image/png',
      buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64')});
    await page.locator('.add-picture-preview').waitFor();
    const before=await draft();
    await inspect('more-full-form',meta);
    if(meta.width===390) await page.screenshot({path:join(out,`${meta.theme}-${meta.mode}-more.png`)});
    await back(); await slide(first); assert.deepEqual(await draft(),before,'More/Back lost draft fields');
    await button('More').click();
    assert.equal(await page.locator('.add-picture-preview').getAttribute('alt'),'receipt.png','More/Back lost picture');
    await keyboard(meta);
    await retention(meta);
    assert.equal(await page.locator('.add-picture-preview').getAttribute('alt'),'receipt.png','close/theme/resize lost picture');
    await back(); await slide(first);
  }
  const fields=meta.mode==='shift' ? (meta.gate==='signOut'
    ? ['shift-hours','shift-sales','shift-cashTips','shift-ccTips']
    : ['shift-sales','shift-cashTips','shift-ccTips','shift-hours']) : ['amount'];
  for(const field of fields) {
    await slide(field);
    await inspect(field,meta);
    await section(field).getByRole('button',{name:'Enter',exact:true}).click();
  }
  for(const name of meta.mode==='transfer'?['from','to']:meta.mode==='shift'?['account']:['category','account']) {
    await slide(name); await inspect(name,meta); await choose(name);
  }
  if(meta.mode==='transfer') {
    const form=await draft(); assert.notEqual(form.fromAccountId,form.toAccountId,'transfer uses same account');
  }
  await slide('note'); await section('note').locator('#add-note').fill('Retain every entry detail');
  await section('note').getByRole('button',{name:'Continue',exact:true}).click();
  await slide('confirm');
  await inspect('confirm',meta);
  const before=await draft(); await back(); await slide('note');
  assert.equal(await page.locator('#add-note').inputValue(),before.note);
  await section('note').getByRole('button',{name:'Continue',exact:true}).click();
  if(meta.width>719){await keyboard(meta);await retention(meta);}
  const confirm=page.locator('[data-add-confirm]');
  assert.ok(await confirm.isEnabled(),'valid deliberate choices cannot reach Confirm');
  await confirm.scrollIntoViewIfNeeded();
  assert.ok(await confirm.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight+1;}),'Confirm unreachable by vertical scroll');
  assert.equal(await posts(),0,'a step before Confirm called posting callback');
  await confirm.click(); assert.equal(await posts(),1,'explicit Confirm must call existing callback once');
  records.push({label:'flow-passed',...meta,form:await draft(),postingCallbacks:await posts()});
}

async function runCase(meta, fn) {
  if(process.env.ENTRY_CASE_FILTER && !new RegExp(process.env.ENTRY_CASE_FILTER).test(`${meta.label||'flow'}/${meta.theme}/${meta.mode}/${meta.width}/${meta.gate||'finished'}`))return;
  const failureStart=failures.length;
  try {await open(meta);await fn(meta);console.log(`${failures.length===failureStart?'PASS':'FAIL'} ${meta.label||'flow'} ${meta.theme}/${meta.mode}/${meta.width}${meta.gate?'/'+meta.gate:''}`);}
  catch(error) {
    const failure={...meta,error:error.stack||String(error)}; failures.push(failure);
    console.error(`FAIL ${meta.label||'flow'} ${meta.theme}/${meta.mode}/${meta.width}: ${error.message}`);
    await page.screenshot({path:join(out,`FAIL-${meta.label||'flow'}-${meta.theme}-${meta.mode}-${meta.width}-${meta.gate||''}.png`)}).catch(()=>{});
  } finally {cases.push({...meta,passed:failures.length===failureStart});}
}
try {
  await server.listen();
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({serviceWorkers:'block'});page=await context.newPage();
  page.setDefaultTimeout(Number(process.env.ENTRY_ACTION_TIMEOUT_MS || 20000));
  await context.route('**/*',route=>{
    const request=new URL(route.request().url());
    if(request.hostname==='127.0.0.1')return route.continue();
    if(request.protocol==='data:'||request.protocol==='blob:')return route.continue();
    blocked.push(request.href);return route.abort();
  });
  page.on('pageerror',error=>errors.push(error.stack||error.message));
  url=server.resolvedUrls.local[0]+'entry-review';
  for(const width of widths)for(const theme of themes)for(const mode of modes)
    await runCase({width,theme,mode,reducedMotion:true},walk);
  // Sign-out has a different first field; exercise the actual sequence in every world.
  for(const theme of themes)await runCase({width:390,theme,mode:'shift',gate:'signOut',reducedMotion:true},walk);
  for(const width of widths)for(const theme of themes)await runCase({label:'shift-gates',width,theme,mode:'shift',gate:'choose',reducedMotion:true},async meta=>{
    await slide('shift-choose');await inspect('shift-choose',meta);
    assert.equal(await page.locator('[data-add-confirm]').count(),0);
    assert.equal(await button('More').count(),0,'specialized shift entry unexpectedly exposes More');
    await button('Clock in').click();await slide('shift-clocked');await inspect('shift-clocked',meta);
    await button('Sign out').click();await slide('shift-hours');await inspect('shift-sign-out',meta);
    assert.equal(await posts(),0,'shift navigation called financial posting callback');
  });
  // Desktop 200% browser zoom halves the CSS layout viewport. This is a reflow-equivalent
  // viewport test (1100→550, 1440→720), not native browser chrome zoom.
  // Mobile pinch changes the visual viewport; it does not halve the CSS layout.
  for(const originalWidth of [1100,1440])for(const theme of themes)for(const mode of modes) {
    const width=Math.floor(originalWidth/2);
    await runCase({label:'reflow-200',width,originalWidth,theme,mode,reducedMotion:true},async meta=>{
      await inspect('reflow-200-first',meta);
      if(width<=719){await button('More').click();await inspect('reflow-200-more',meta);}
      await keyboard(meta);
      if(await page.locator('[data-add-confirm]').count())await page.locator('[data-add-confirm]').scrollIntoViewIfNeeded();
      assert.equal(await posts(),0);
    });
  }
  // Contrast normal motion with the reduced-motion matrix; do not disable animations via CSS.
  for(const theme of themes)await runCase({label:'normal-motion',width:390,theme,mode:'expense',reducedMotion:false},async meta=>{
    await inspect('normal-motion',meta);await button('More').click();await inspect('normal-motion-more',meta);
  });
} finally {
  const end=fingerprint();
  if(JSON.stringify(start)!==JSON.stringify(end))failures.push({error:'Source changed during browser proof'});
  if(errors.length)failures.push({error:'Browser runtime errors',errors});
  const summary={cases:cases.length,passed:cases.filter(c=>c.passed).length,failedCases:cases.filter(c=>!c.passed).length,failures:failures.length,
    inspectedStates:records.filter(r=>r.panel).length,blockedRequests:blocked.length,report:join(out,'report.json')};
  writeFileSync(join(out,'report.json'),JSON.stringify({start,end,summary,run:{filter:process.env.ENTRY_CASE_FILTER||null,node:process.version,browser:browser?.version(),scriptSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex')},cases,records,failures,errors,blocked,
    limits:['Actual AddSlideshow and useDialog with synthetic household and production CSS; not full App or hosted proof.',
      'Posting callback is a spy; no financial writer is invoked.',
      '200% reflow uses half-size CSS viewports; native zoom, VoiceOver and physical-device checks are not claimed.']},null,2));
  console.log(JSON.stringify(summary,null,2));
  await browser?.close();await server.close();rmSync(cacheDir,{recursive:true,force:true});
  if(failures.length)process.exitCode=1;
}
