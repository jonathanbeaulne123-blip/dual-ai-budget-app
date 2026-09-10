const baseURL=process.env.HEARTH_COMPANION_BASE_URL||"http://127.0.0.1:5193";
const smokeHost=new URL(baseURL).hostname;
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='.artifacts/hercules-slice-6';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),records=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(60000);
await page.addInitScript(()=>{delete Object.getPrototypeOf(navigator).locks;});
await page.route('**/*',r=>['localhost','127.0.0.1',smokeHost].includes(new URL(r.request().url()).hostname)&&r.request().method()==='GET'&&!new URL(r.request().url()).pathname.startsWith('/hercules/')?r.continue():r.abort());
try{
 await page.goto(baseURL);await page.getByRole('button',{name:'Open the demo kitchen table',exact:true}).click();await page.getByRole('button',{name:'I am Jonathan',exact:true}).click();await page.locator('nav.nav').waitFor({timeout:90000});const close=page.getByRole('button',{name:'Close reminders',exact:true});if(await close.isVisible())await close.click();
 for(const theme of ['classic','taylor','newfoundland']){
  await page.locator('nav.nav').getByRole('button',{name:'More',exact:true}).click();await page.locator(`[data-preview-theme="${theme}"]`).click();await page.getByRole('button',{name:'Use theme',exact:true}).click();await page.locator('nav.nav').getByRole('button',{name:'Home',exact:true}).click();
  for(const width of [1100,1440,1920]){
   await page.setViewportSize({width,height:1000});const label=page.locator('.hercules-help-label');await label.waitFor();
   await expect.poll(()=>label.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})).toBe(true);
   const geometry=await label.evaluate(e=>{const r=e.getBoundingClientRect(),stage=e.parentElement.querySelector('.hercules-stage');return {left:r.left,right:r.right,labelWidth:r.width,height:r.height,foreground:Number(getComputedStyle(e).zIndex)>Number(getComputedStyle(stage).zIndex),hit:e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)),hitElement:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.outerHTML.slice(0,300),stageZ:getComputedStyle(stage).zIndex,labelZ:getComputedStyle(e).zIndex};});
   records.push({theme,width,...geometry});await page.screenshot({path:`${out}/invitation-${theme}-${width}.png`});
   expect(geometry.foreground).toBe(true);expect(geometry.hit).toBe(true);expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(width);
   await label.click({position:{x:4,y:geometry.height/2}});await page.locator('.hercules-discovery:visible').waitFor();await page.getByRole('button',{name:/Open Hercules/}).press('Enter');
  }
 }
}catch(error){records.push({failure:String(error)});process.exitCode=1;}
await writeFile(`${out}/invitation-report.json`,JSON.stringify({records,errors},null,2));await browser.close();if(errors.length||records.length!==9)process.exitCode=1;
