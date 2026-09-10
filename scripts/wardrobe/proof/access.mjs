import {chromium,expect} from '@playwright/test';import {writeFile,mkdir} from 'node:fs/promises';
await mkdir('.artifacts/hercules-slice-5',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1100,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),records=[];
const url='http://127.0.0.1:5193/';
page.setDefaultTimeout(60000);
const ready=async()=>{await page.locator('.fitting-webgl[data-state=ready]').waitFor({timeout:120000});await expect(page.getByRole('button',{name:'See the back',exact:true})).toBeEnabled({timeout:120000});};
async function enter(){await page.goto(url,{timeout:120000});await page.waitForFunction(()=>document.querySelector('nav.nav')||[...document.querySelectorAll('button')].some(b=>b.textContent==='Open the demo kitchen table'));const demo=page.getByRole('button',{name:'Open the demo kitchen table',exact:true});if(await demo.isVisible()){await demo.click();await page.getByRole('button',{name:'I am Jonathan',exact:true}).click();}await page.locator('nav.nav').waitFor({timeout:120000});const close=page.getByRole('button',{name:'Close reminders',exact:true});if(await close.isVisible())await close.click();await page.locator('nav.nav').getByRole('button',{name:'Home',exact:true}).click();const drawer=page.locator('.office-wide-drawer');if(!await drawer.getByRole('button',{name:/Hercules outfits/}).isVisible())await drawer.locator('summary').click();await drawer.getByRole('button',{name:/Hercules outfits/}).click();}
await page.addInitScript(()=>{delete Object.getPrototypeOf(navigator).locks;});await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
try{
 await enter();await page.getByRole('button',{name:'Open dressing room',exact:true}).click();await ready();await page.setViewportSize({width:320,height:1000});
 await page.locator('.hercules-fitting-room').evaluate(room=>{const rows=[...room.querySelectorAll('h1,h2,h3,p,small,strong,button,label,span')].map(n=>[n,parseFloat(getComputedStyle(n).fontSize)]);for(const [n,size] of rows)n.style.fontSize=`${size*2}px`;});
 records.push({text200Overflow:await page.locator('.hercules-fitting-room').evaluate(n=>n.scrollWidth>n.clientWidth+1)});
 records.push({overflowingElements:await page.locator('.hercules-fitting-room').evaluate(room=>[...room.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().right>room.getBoundingClientRect().right+1).map(n=>({tag:n.tagName,cls:n.className,text:n.textContent?.slice(0,50)})).slice(0,15))});
 await page.getByRole('button',{name:'Cable-knit sweater: slate',exact:true}).click();records.push({enlargedControls:await page.getByRole('button',{name:'Cable-knit sweater: slate',exact:true}).getAttribute('aria-pressed')});
 let trapped=true;for(let i=0;i<40;i++){await page.keyboard.press('Tab');trapped=trapped&&await page.evaluate(()=>Boolean(document.activeElement.closest('[role=dialog]')));}records.push({keyboardTrapped:trapped});await page.screenshot({path:'.artifacts/hercules-slice-5/text-200.png'});
 await page.keyboard.press('Escape');records.push({closed:await page.locator('.hercules-fitting-backdrop').count(),focus:await page.evaluate(()=>document.activeElement.outerHTML.slice(0,250))});
}catch(e){records.push({failure:String(e)});process.exitCode=1;}
if(records.some(r=>r.text200Overflow||r.keyboardTrapped===false||r.enlargedControls==='false'||r.closed>0))process.exitCode=1;
console.log(records);await writeFile('.artifacts/hercules-slice-5/access-report.json',JSON.stringify(records,null,2));await browser.close();
