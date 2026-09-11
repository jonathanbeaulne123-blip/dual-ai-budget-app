// Synthetic actual-App entry proof; external traffic is blocked and no money is posted.
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const origin=process.env.HEARTH_TEST_ORIGIN||'http://127.0.0.1:5189';
const out=process.env.HEARTH_ARTIFACTS_DIR||'/tmp/hearth-cashpad-ux';
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

 const due=page.locator('[aria-labelledby="due-preview-title"]');if(await due.isVisible())await due.getByRole('button',{name:'Not now',exact:true}).click();
 const close=page.getByRole('button',{name:'Close reminders',exact:true});if(await close.count())await close.click();
 for(const theme of ['classic','taylor','newfoundland']){
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('nav.nav').getByRole('button',{name:'More',exact:true}).click();
  await page.locator(`[data-preview-theme="${theme}"]`).click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
  for(const scope of ['household','personal']){
   await page.locator('.view-switch button').nth(scope==='household'?0:1).click();
   for(const width of (process.env.HEARTH_TEST_WIDTHS||"320,390,720,1100,1440,1920").split(",").map(Number)){
    await page.setViewportSize({width,height:Number(process.env.HEARTH_TEST_HEIGHT)||(width<720?844:1000)});
    await page.getByRole('button',{name:'Add money',exact:true}).click();
    await page.getByRole('menuitem',{name:'Add expense',exact:true}).click();
    const sheet=page.locator('.sheet.add-slideshow');await sheet.waitFor();
    if(await sheet.getAttribute('data-add-slide')==='full-form')await sheet.getByRole('button',{name:'Back',exact:true}).click();
    if(await sheet.getAttribute('data-add-slide')!=='amount')await sheet.getByRole('navigation',{name:'Draft sections'}).getByRole('button',{name:'Amount',exact:true}).click();
    await sheet.locator('.cad-pad').waitFor();
    if(width>=720){await sheet.locator('.cad-pad-input').fill('12.50');}
    else {await sheet.getByRole('button',{name:'Type amount',exact:true}).click();await sheet.locator('.cad-pad-input').fill('');await sheet.getByRole('button',{name:'Use keypad',exact:true}).click();for(const n of ['1','2','5','0'])await sheet.locator(`.cad-pad-keys button[aria-label="${n}"]`).click();}
    const geometry=await sheet.evaluate(el=>{const pad=el.querySelector('.cad-pad');return {overflow:document.documentElement.scrollWidth>innerWidth,padWidth:pad?.getBoundingClientRect().width,innerWidth:el.querySelector('.sheet-inner').getBoundingClientRect().width};});
    if(geometry.overflow)throw Error(`Overflow ${theme}/${scope}/${width}`);
    if(width>=720){await sheet.locator('.cad-pad-input').fill('12.345');await page.keyboard.press('Enter');if(await sheet.getAttribute('data-add-slide')!=='amount')throw Error('Invalid amount advanced');await sheet.locator('.cad-pad-input').fill('12.50');await page.keyboard.press('Enter');await sheet.locator('[data-entry-section="category"]').waitFor();await sheet.getByRole('navigation',{name:'Draft sections'}).getByRole('button',{name:'Amount',exact:true}).click();}
    if(width===390){const violations=(await new AxeBuilder({page}).include('.cad-pad').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;proof.accessibility.push({theme,scope,violations:violations.map(v=>v.id)});if(violations.length)throw Error('CashPad accessibility failed');}
    await page.screenshot({path:`${out}/${theme}-${scope}-${width}.png`});proof.geometry.push({theme,scope,width,...geometry});
    await sheet.getByRole('button',{name:'More',exact:true}).click();
    if(await sheet.locator('.entry-step-continue').count())throw Error('Full form has guided Continue buttons');
    await sheet.getByRole('navigation',{name:'Draft sections'}).getByRole('button',{name:'Review',exact:true}).click();
    await sheet.locator('[data-add-confirm]').scrollIntoViewIfNeeded();
    const clearance=await sheet.locator('[data-add-confirm]').evaluate(el=>{const r=el.getBoundingClientRect();const blockers=[...document.querySelectorAll('nav.nav,.fund-ledge-grip,.fund-return')].filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().top);return {bottom:r.bottom,ceiling:Math.min(innerHeight,...blockers)};});
    if(clearance.bottom>clearance.ceiling)throw Error(`Confirm obscured ${JSON.stringify(clearance)}`);
    await page.screenshot({path:`${out}/${theme}-${scope}-${width}-review.png`});
    await sheet.getByRole('button',{name:'Close',exact:true}).click();
   }
  }
 }
 console.log(JSON.stringify(proof));
} catch(error){await page.screenshot({path:`out-placeholder/failure.png`.replace('out-placeholder',out)});throw error;}
finally{await writeFile(`${out}/evidence.json`,JSON.stringify(proof,null,2));await browser.close();}
