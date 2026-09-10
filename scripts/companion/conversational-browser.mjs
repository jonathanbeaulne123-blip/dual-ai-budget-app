import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const origin='http://127.0.0.1:5197',out='.artifacts/hercules-conversational';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-gpu']}),context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
await context.addInitScript(()=>{delete Object.getPrototypeOf(navigator).locks;});
const page=await context.newPage(),errors=[],records=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();if(url.pathname.startsWith('/hercules/'))return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});return route.continue();});
try{
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Open the demo kitchen table',exact:true}).click();await page.getByRole('button',{name:'I am Jonathan',exact:true}).click();await page.locator('nav.nav').waitFor({timeout:120000});
 const reminder=page.getByRole('button',{name:'Close reminders',exact:true});if(await reminder.isVisible())await reminder.click();
 for(const theme of ['classic','taylor','newfoundland']){
  await page.setViewportSize({width:390,height:900});await page.locator('nav.nav').getByRole('button',{name:'More',exact:true}).click();await page.locator(`[data-preview-theme="${theme}"]`).click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
  await page.getByRole('button',{name:/Talk to Hercules/}).click();
  for(const size of [{width:390,height:700},{width:320,height:568},{width:1440,height:900},{width:1100,height:600}]){
   await page.setViewportSize(size);if(!await page.locator('input[aria-label="Ask Hercules"]:visible').count())await page.getByRole('button',{name:/Open Hercules/}).press('Enter');
   const input=page.locator('input[aria-label="Ask Hercules"]:visible').first();await input.waitFor();await input.fill('I just bought something');await input.press('Enter');
   const card=page.locator('.hercules-actions:visible').first();await card.waitFor();
   const metrics=await input.evaluate(e=>{const r=e.getBoundingClientRect(),shell=e.closest('.hercules-bubble,.hercules-focus-shell');return{visible:r.y>=0&&r.bottom<=innerHeight+1,inputWidth:r.width,enabled:!e.disabled,focused:document.activeElement===e,shellWidth:shell?.getBoundingClientRect().width,overflow:shell? shell.scrollWidth>shell.clientWidth+1:false};});
   const axe=await new AxeBuilder({page}).include('.hercules-actions').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   await page.screenshot({path:`${out}/${theme}-${size.width}-${size.height}.png`});records.push({theme,...size,...metrics,violations:axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});
   const cancel=card.getByRole('button',{name:'Cancel this task',exact:true});if(await cancel.isVisible())await cancel.click();
  }
  await page.setViewportSize({width:390,height:900});const close=page.getByRole('button',{name:'Close focus mode',exact:true});if(await close.isVisible())await close.click();
 }
}catch(e){errors.push(String(e));console.log(String(e));try{await page.screenshot({path:`${out}/failure.png`});console.log((await page.locator('body').innerText()).slice(-4000));}catch{}}
await writeFile(`${out}/report.json`,JSON.stringify({records,errors},null,2));await browser.close();console.log(JSON.stringify({records,errors}));if(errors.length||records.length!==12||records.some(r=>!r.visible||!r.enabled||!r.focused||r.overflow||r.violations.length))process.exitCode=1;
