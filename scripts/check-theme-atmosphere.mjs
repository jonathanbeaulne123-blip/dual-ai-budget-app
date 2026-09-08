// Synthetic local component proof; does not load an account or a ledger.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1100,height:1000},reducedMotion:'no-preference'});
const page=await context.newPage();const rows=[];
const running=()=>page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.closest?.('.scene-artwork, .friendship-bracelets') && a.playState==='running').length);
try {
for(const [theme,route] of [['classic','home'],['taylor','home'],['newfoundland','calendar']]) {
 await page.goto(`http://127.0.0.1:5184/?themeStudio=1&theme=${theme}&scope=personal&route=${route}`);
 await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
 await page.locator('.theme-scene-heading').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.documentElement.dataset.atmosphere==='playing');
 const before=await running();
 await page.locator('.theme-scene-heading').getByRole('button',{name:'Pause atmosphere'}).click();
 await page.waitForFunction(()=>document.documentElement.dataset.atmosphere==='paused'); const paused=await running();
 await page.locator('.theme-scene-heading').getByRole('button',{name:'Resume atmosphere'}).click();
 await page.locator('#studio-draft').focus(); await page.waitForFunction(()=>document.documentElement.dataset.atmosphere==='paused'); const editing=await running();
 await page.locator('#studio-draft').blur();
 await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
 await page.waitForFunction(()=>document.querySelector('.theme-scene-heading').dataset.sceneVisible==='false'); const offscreen=await running();
 await page.emulateMedia({reducedMotion:'reduce'}); await page.evaluate(()=>window.scrollTo(0,0)); const reduced=await running();
 rows.push({theme,before,paused,editing,offscreen,reduced});
 if(!before || paused || editing || offscreen || reduced) throw new Error(JSON.stringify(rows.at(-1)));
 await page.emulateMedia({reducedMotion:'no-preference'});
}
} finally {await writeFile('.artifacts/three-worlds/atmosphere-report.json',JSON.stringify(rows,null,2));await browser.close();}
console.log(rows);
