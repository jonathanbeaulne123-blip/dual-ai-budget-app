import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
const out = '.artifacts/hercules-slice-6';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({viewport:{width:390,height:1000},reducedMotion:'reduce'});
await context.addInitScript(()=>{delete Object.getPrototypeOf(navigator).locks;});
const page = await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(url.hostname))return route.abort();if(url.pathname.startsWith('/hercules/'))return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});return route.continue();});
const records=[];
try {
 await page.goto('http://127.0.0.1:5193');
 await page.getByRole('button',{name:'Open the demo kitchen table',exact:true}).click();await page.getByRole('button',{name:'I am Jonathan',exact:true}).click();await page.locator('nav.nav').waitFor({timeout:90000});
 const close=page.getByRole('button',{name:'Close reminders',exact:true});if(await close.isVisible())await close.click();
 for(const view of ['household','personal']) for(const theme of ['classic','taylor','newfoundland']) {
  await page.locator('.view-switch button').nth(view==='household'?0:1).click();
  await page.locator('nav.nav').getByRole('button',{name:'More',exact:true}).click();
  await page.locator(`[data-preview-theme="${theme}"]`).click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
  await page.locator('nav.nav').getByRole('button',{name:'Home',exact:true}).click();
  await page.getByRole('button',{name:/Talk to Hercules/}).click();
  await page.getByRole('dialog',{name:'Hercules focus'}).waitFor();
  const dialog=page.getByRole('dialog',{name:'Hercules focus'});
  await dialog.locator('.companion-memory summary').click();
  for (const width of [320]) {
   await page.setViewportSize({width,height:1000});
   if (await page.locator('.companion-memory:visible').count() === 0) {
     await page.getByRole('button',{name:/Open Hercules/}).press('Enter');
     await page.locator('.companion-memory:visible summary').first().click();
   }
   const card=page.locator('.companion-memory:visible').first();await card.scrollIntoViewIfNeeded();
   if (await card.getAttribute('open') === null) await card.locator('summary').click();
   await page.locator('.hercules-focus-shell').evaluate(room=>{const nodes=[...room.querySelectorAll('h1,h2,h3,p,small,strong,button,label,span,select,summary')].map(n=>[n,parseFloat(getComputedStyle(n).fontSize)]);for(const [n,size] of nodes)n.style.fontSize=`${size*2}px`;});
   const overflow=await page.locator('.hercules-focus-shell').evaluate(e=>e.scrollWidth>e.clientWidth+1);
   const axe=await new AxeBuilder({page}).include('.companion-memory').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   let trapped=true;for(let i=0;i<30;i++){await page.keyboard.press('Tab');trapped=trapped&&await page.evaluate(()=>Boolean(document.activeElement.closest('[role=dialog]')));}
   await page.screenshot({path:`${out}/text200-${view}-${theme}-${width}.png`});records.push({view,theme,width,trapped,overflow,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
  }
  await page.setViewportSize({width:390,height:1000});await page.getByRole('button',{name:'Close focus mode',exact:true}).click();
 }
} catch(error){console.log(String(error));console.log((await page.locator('body').innerText()).slice(-4000));await page.screenshot({path:`${out}/failure.png`});process.exitCode=1;}
await writeFile(`${out}/text200-report.json`,JSON.stringify({records,errors},null,2));await browser.close();if(errors.length||records.length!==6||records.some(r=>r.overflow||!r.trapped||r.violations.length))process.exitCode=1;
