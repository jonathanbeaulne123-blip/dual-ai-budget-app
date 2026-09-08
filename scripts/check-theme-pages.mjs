// Actual React routes, synthetic local demo only. No hosted account or financial Confirm.
// Opt-in fallback removes Web Locks in this isolated browser context only.
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.HEARTH_ARTIFACTS_DIR || '.artifacts/three-worlds/app-pages';
const origin=process.env.HEARTH_THEME_ORIGIN || 'http://127.0.0.1:5185';
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
try{
 await page.goto(origin);await page.getByRole('button',{name:'Open the demo kitchen table',exact:true}).click();await page.getByRole('button',{name:'I am Jonathan',exact:true}).click();await page.locator('nav.nav').waitFor({timeout:90000});await settle();
 const reminders = page.getByRole('button',{name:'Not now',exact:true}); if(await reminders.isVisible()) await reminders.click();
 const closeReminders=page.getByRole('button',{name:'Close reminders',exact:true}); if(await closeReminders.isVisible()) await closeReminders.click();
 for(const theme of ['classic','taylor','newfoundland']){
  await nav('More');await page.locator(`[data-preview-theme="${theme}"]`).click();await page.getByRole('button',{name:'Use theme',exact:true}).click();
  await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
  for(const scope of ['household','personal']){
   await page.locator('.view-switch button').nth(scope==='household'?0:1).click();await settle();
   for(const dest of ['home','calendar','plan','ledger','more',scope==='household'?'till':'shift']){
    await route(dest,scope);
    const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary,html:n.html}))}));
    const metrics=[];
    for(const width of [320,390,720,1100,1440]){await page.setViewportSize({width,height:1000});await settle();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${out}/${theme}-${scope}-${dest}-${width}.png`});metrics.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scene:document.documentElement.dataset.scene})));}
    await page.setViewportSize({width:390,height:1000});records.push({theme,scope,route:dest,bodySurface:await page.locator('[data-testid=onboarding-ready]').count()?'onboarding-ready':dest,metrics,violations});await writeFile(`${out}/report.json`,JSON.stringify({browser:'Installed Chrome, synthetic local demo',databaseMode:fallback?'existing fallback without Web Locks':'normal worker',records,errors},null,2));console.log(theme,scope,dest,violations.map(v=>v.id).join(','));
   }
  }
 }
}catch(e){console.log('FAILED',String(e));await page.screenshot({path:`${out}/failure.png`});console.log((await page.locator('body').innerText()).slice(-2500));process.exitCode=1;}
finally{if(records.length!==36 || errors.length || records.some(r=>r.violations.length || r.metrics.some(m=>m.scrollWidth>m.width))) process.exitCode=1;await writeFile(`${out}/report.json`,JSON.stringify({browser:'Installed Chrome, synthetic local demo',databaseMode:fallback?'existing fallback without Web Locks':'normal worker',records,errors},null,2));await browser.close();}
