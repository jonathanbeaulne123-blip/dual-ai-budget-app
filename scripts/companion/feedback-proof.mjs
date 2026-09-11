import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='.artifacts/hercules-feedback';await mkdir(out,{recursive:true});
const themes=(process.env.HEARTH_PROOF_THEMES||'classic,taylor,newfoundland').split(','),scopes=(process.env.HEARTH_PROOF_SCOPES||'household,personal').split(','),widths=(process.env.HEARTH_PROOF_WIDTHS||'320,390,719,720,721,1100,1440,1920').split(',').map(Number);
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:390,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),records=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(30000);
await page.addInitScript(()=>{delete Object.getPrototypeOf(navigator).locks;});
await page.route('**/*',route=>{const url=new URL(route.request().url());return ['localhost','127.0.0.1'].includes(url.hostname)&&route.request().method()==='GET'&&!url.pathname.startsWith('/hercules/')?route.continue():route.abort();});
const say=async(text)=>{const input=page.locator('textarea[aria-label="Ask Hercules"]:visible');await input.fill(text);await input.press('Enter');await expect(page.locator('.hercules-actions:visible').getByRole('button',{name:'Cancel this task',exact:true})).toBeEnabled();};
try{
 await page.goto('http://127.0.0.1:5199');await page.getByRole('button',{name:'Open the demo kitchen table',exact:true}).click();await page.getByRole('button',{name:'I am Jonathan',exact:true}).click();await page.locator('nav.nav').waitFor({timeout:90000});const close=page.getByRole('button',{name:'Close reminders',exact:true});if(await close.isVisible())await close.click();
 for(const theme of themes){
  await page.setViewportSize({width:390,height:1000});await page.getByRole('button',{name:'Household Ledger',exact:true}).click();if(await close.isVisible())await close.click();await page.getByRole('button',{name:'Settings & more',exact:true}).click();await page.locator(`[data-preview-theme="${theme}"]`).click();await page.getByRole('button',{name:'Use theme',exact:true}).click();await page.locator('nav.nav').getByRole('button',{name:'Home',exact:true}).click();
  for(const scope of scopes){
   await page.getByRole('button',{name:scope==='household'?'Household Ledger':"Jonathan's Personal Ledger",exact:true}).click();
   if(await close.isVisible())await close.click();
  for(const width of widths){
   await page.setViewportSize({width,height:1000});
   const launcher=page.locator(width<720?'.hercules-pill':'.hercules-help-label');await launcher.waitFor();const caption=await launcher.innerText();await launcher.click();if(caption.includes('How can I help?')&&!await page.locator('.hercules-discovery').isVisible())await page.getByText('Suggestions and help',{exact:true}).click();await page.locator('.hercules-discovery:visible').waitFor();
   if(!caption.includes('How can I help?'))await expect(page.locator('.hercules-discovery-answer:visible')).toContainText(caption.trim());
   await say('Add a visa card');await say(`Synthetic ${theme} Visa`);await say('skip');
   const actions=page.locator('.hercules-actions:visible');await actions.getByRole('button',{name:'Review changes',exact:true}).click();await expect(actions).toContainText('Hearth default, unverified');
   const geometry=await actions.evaluate(e=>({overflow:e.scrollWidth>e.clientWidth+1,width:e.clientWidth}));expect(geometry.overflow).toBe(false);
   if(width<720){const hero=await page.locator('.hercules-focus-hero').boundingBox(),body=await page.locator('.hercules-focus-body').boundingBox();expect(hero.y+hero.height).toBeLessThanOrEqual(body.y);}
   else {const header=page.locator('.hercules-chat-header:visible');const h=await header.boundingBox(),body=await page.locator('.hercules-bubble.chat>.hercules-conversation-content').boundingBox();expect(h.y+h.height).toBeLessThanOrEqual(body.y);await header.getByRole('button',{name:'Expand',exact:true}).click();await header.getByRole('button',{name:'Compact',exact:true}).click();}
   await page.screenshot({path:`${out}/account-${theme}-${scope}-${width}.png`});await actions.getByRole('button',{name:'Cancel this task',exact:true}).click();
   await say('I want to save money for a date with Bianca');await expect(actions).toContainText('One goal');await expect(actions).toContainText('Create a new Kitty Bank');
   await page.screenshot({path:`${out}/goal-${theme}-${scope}-${width}.png`});await actions.getByRole('button',{name:'Cancel this task',exact:true}).click();
   records.push({theme,scope,width,caption,geometry});
   if(width<720)await page.getByRole('button',{name:'Close focus mode',exact:true}).click();else await page.locator('.hercules-live').press('Enter');
  }
  }
 }
}catch(error){records.push({failure:String(error),header:await page.locator('.hercules-chat-header').evaluateAll(es=>es.map(e=>[e,...e.children].map(n=>({tag:n.tagName,cls:n.className,rect:n.getBoundingClientRect().toJSON(),display:getComputedStyle(n).display,position:getComputedStyle(n).position,flex:getComputedStyle(n).flex,height:getComputedStyle(n).height})))),body:(await page.locator('body').innerText()).slice(-7000)});await page.screenshot({path:`${out}/failure.png`});process.exitCode=1;}
await writeFile(`${out}/report.json`,JSON.stringify({records,errors},null,2));await browser.close();if(errors.length||records.length!==themes.length*scopes.length*widths.length)process.exitCode=1;
