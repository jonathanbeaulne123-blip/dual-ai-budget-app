import { startHomeFeedbackProof } from '../scripts/serve-home-feedback-proof.mjs';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = '.artifacts/feedback-home/actual-app'; mkdirSync(output,{recursive:true});
const proof = await startHomeFeedbackProof(), browser = await chromium.launch({headless:true,...(process.env.HEARTH_CHROMIUM ? {executablePath:process.env.HEARTH_CHROMIUM} : {})});
const records=[],errors=[]; let lastPage;
try {
 for(const theme of (process.env.HEARTH_PROOF_THEMES || 'classic,taylor,newfoundland').split(',')) {
  const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:950}}),page=await context.newPage();
  lastPage=page; page.setDefaultTimeout(60000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'&&route.request().method()==='GET'&&!u.pathname.startsWith('/hercules/')?route.continue():route.abort();});
  await page.goto(proof.url+'?theme='+theme);await page.locator('.chapter-setup').waitFor({timeout:90000});
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  for(const width of (process.env.HEARTH_PROOF_WIDTHS || '320,390,719,720,1100,1440,1920').split(',').map(Number)) {
   await page.setViewportSize({width,height:950});
   const home=page.locator('.household-home');
   await home.locator('.chapter-setup').scrollIntoViewIfNeeded();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   expect(overflow).toBeLessThanOrEqual(1);
   const buttons=home.locator('.chapter-setup button,.nest-bank,.home-door');
   for(const box of await buttons.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()))) expect(box.height).toBeGreaterThanOrEqual(44);
   const result=await new AxeBuilder({page}).include('.household-home').withTags(['wcag2a','wcag2aa']).analyze();
   const serious=result.violations.filter(v=>['serious','critical'].includes(v.impact));
   await page.screenshot({path:`${output}/${theme}-${width}-home.png`,fullPage:true});
   await home.locator('.kitty-nest').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/${theme}-${width}-shelf.png`});
   const selected=home.getByRole('button',{name:'Open Our kitchen garden in the 3D gallery',exact:true});await selected.click();
   await expect(page.locator('.kitty-bank-tabs [aria-pressed="true"]')).toContainText('Our kitchen garden');
   await expect(page.getByRole('button',{name:'← Back to Home',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Use money',exact:true}).click();
   await expect(page.getByRole('button',{name:'Review Fund assignment',exact:true})).toBeVisible();
   expect(await page.locator('.kitty-room').evaluate(n=>n.scrollWidth-n.clientWidth)).toBeLessThanOrEqual(1);
   await page.screenshot({path:`${output}/${theme}-${width}-gallery.png`});
   await page.getByRole('button',{name:'← Back to Home',exact:true}).click();await expect(selected).toBeFocused();
   console.log('Verified',theme,width);
   records.push({theme,width,overflow,serious:serious.map(v=>v.id),selectedBank:true,returnFocus:true});
  }
  // Actual App callbacks: Charter takeover and exact Books Fund pane.
  await page.setViewportSize({width:390,height:950});
  await page.locator('.chapter-setup button').first().click();
  await page.locator('.charter-page').waitFor();
  await page.screenshot({path:`${output}/${theme}-charter.png`});
  console.log(theme,'charter buttons',await page.locator('.charter-page button').allTextContents());
  await page.keyboard.press('Escape');
  if(await page.locator('.charter-page').count()) {
   const close=page.locator('.charter-page').getByRole('button',{name:/close|back/i}).first();await close.click();
  }
  await page.locator('.chapter-setup button').nth(1).click();
  await page.locator('.household-fund-panel').waitFor();
  await page.screenshot({path:`${output}/${theme}-fund.png`});
  console.log('Verified setup routes',theme);
  records.push({theme,setupRoutes:true});
  await context.close();
 }
} catch(error) { records.push({failure:String(error), body: lastPage ? (await lastPage.locator('body').innerText().catch(()=>'' )).slice(-6000) : ''}); if(lastPage) await lastPage.screenshot({path:output+'/failure.png'}).catch(()=>{}); process.exitCode=1; }
finally { writeFileSync(`${output}/report${process.env.HEARTH_PROOF_PART ? '-'+process.env.HEARTH_PROOF_PART : ''}.json`,JSON.stringify({records,errors},null,2)); await browser.close();await proof.close(); }
console.log(JSON.stringify({cases:records.length,errors,failures:records.filter(r=>r.failure),axe:records.flatMap(r=>r.serious||[])}));
if(errors.length||records.some(r=>r.serious?.length))process.exitCode=1;
