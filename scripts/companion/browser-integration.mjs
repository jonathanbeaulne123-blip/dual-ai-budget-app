const baseURL=process.env.HEARTH_COMPANION_BASE_URL||"http://127.0.0.1:5193";
const smokeHost=new URL(baseURL).hostname;
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
const out = '.artifacts/hercules-slice-6';
await import('node:fs/promises').then(fs=>fs.mkdir(out,{recursive:true}));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({viewport:{width:390,height:1000},reducedMotion:'reduce'});
await context.addInitScript(()=>{delete Object.getPrototypeOf(navigator).locks;});
const page = await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(!['127.0.0.1','localhost',smokeHost].includes(url.hostname)||route.request().method()!=='GET')return route.abort();if(url.pathname.startsWith('/hercules/'))return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});return route.continue();});
const records=[];
try {
 await page.goto(baseURL);
 await page.getByRole('button',{name:'Open the demo kitchen table',exact:true}).click();await page.getByRole('button',{name:'I am Jonathan',exact:true}).click();await page.locator('nav.nav').waitFor({timeout:90000});
 const close=page.getByRole('button',{name:'Close reminders',exact:true});if(await close.isVisible())await close.click();
 await page.setViewportSize({width:1440,height:1000});
 const invitation=page.locator('.hercules-help-label');await invitation.waitFor();await page.screenshot({path:`${out}/help-invitation.png`});
 await invitation.click({position:{x:4,y:4}});await page.locator('.hercules-discovery:visible').waitFor();
 await page.getByRole('button',{name:/Open Hercules/}).press('Enter');await page.setViewportSize({width:390,height:1000});
 for (const view of ['household','personal']) {
 await page.locator('.view-switch button').nth(view==='household'?0:1).click();
 for(const theme of ['classic','taylor','newfoundland']) {
  await page.locator('nav.nav').getByRole('button',{name:'More',exact:true}).click();
  await page.locator(`[data-preview-theme="${theme}"]`).click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
  await page.locator('nav.nav').getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('button',{name:/Talk to Hercules/}).click();
  await page.getByRole('dialog',{name:'Hercules focus'}).waitFor();
  for (const width of [320,390,720,1100,1440,1920]) {
   await page.setViewportSize({width,height:1000});
   if (await page.locator('.hercules-discovery:visible').count()===0) await page.getByRole('button',{name:/Open Hercules/}).press('Enter');
   const card=page.locator('.hercules-discovery:visible').first(); await card.waitFor();
   await card.getByRole('heading',{name:'How can I help?',exact:true}).scrollIntoViewIfNeeded();
   const memory=page.locator('.companion-memory:visible').first(); if(await memory.count() && await memory.getAttribute('open')===null) await memory.locator('summary').click();
   const overflow=await card.evaluate(e=>e.scrollWidth>e.clientWidth+1);
   const axe=await new AxeBuilder({page}).include('.hercules-discovery').include('.companion-memory').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   await page.screenshot({path:`${out}/${view}-${theme}-${width}.png`});
   records.push({view,theme,width,overflow,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
  }
  await page.setViewportSize({width:390,height:1000});
  const card=page.locator('.hercules-discovery:visible').first();
  await card.locator('.hercules-capability-catalogue summary').click();
  await card.getByRole('button',{name:'Choose an entry',exact:true}).last().click();
  await card.getByRole('button',{name:'Start transfer',exact:true}).click();
  await page.locator('[data-add-slideshow="transfer"]:visible').waitFor();
  await page.locator('[data-add-slideshow]:visible').getByRole('button',{name:'Close',exact:true}).click();
  await page.locator('nav.nav').getByRole('button',{name:'More',exact:true}).click();
  await page.getByRole('button',{name:/Talk to Hercules/}).click();
  const wardrobeHelp=page.locator('.hercules-discovery:visible');await wardrobeHelp.locator('.hercules-capability-catalogue summary').click();
  await wardrobeHelp.getByRole('button',{name:'Open Hercules outfits',exact:true}).last().click();
  await wardrobeHelp.locator('.hercules-discovery-answer').getByRole('button',{name:'Open Hercules outfits',exact:true}).click();
  for(const width of [320,390,720,1100,1440,1920]) {
   await page.setViewportSize({width,height:1000});
   if(!await page.locator('.wardrobe-desk:visible').count()) {
    const drawer=page.locator('.office-wide-drawer');await drawer.locator('summary').click();await drawer.getByRole('button',{name:/Hercules outfits/}).click();
   }
   const wardrobe=page.locator('.wardrobe-desk:visible');await wardrobe.waitFor();await wardrobe.scrollIntoViewIfNeeded();
   const overflow=await wardrobe.evaluate(e=>e.scrollWidth>e.clientWidth+1);
   const axe=await new AxeBuilder({page}).include('.wardrobe-desk').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   await page.screenshot({path:`${out}/wardrobe-${view}-${theme}-${width}.png`});
   records.push({view,theme,width,surface:'wardrobe',overflow,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
  }
  await page.setViewportSize({width:390,height:1000});

 }
 }
} catch(error){console.log(String(error));console.log((await page.locator('body').innerText()).slice(-4000));await page.screenshot({path:`${out}/failure.png`});process.exitCode=1;}
await writeFile(`${out}/final-report.json`,JSON.stringify({records,errors},null,2));await browser.close();if(errors.length||records.length!==72||records.some(r=>r.overflow||r.violations.length))process.exitCode=1;
