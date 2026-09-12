import {startWorkspaceProof} from './serve-workspace-proof.mjs';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.HEARTH_ARTIFACTS_DIR||'/tmp/hearth-feedback-browser';await mkdir(out,{recursive:true});
const server=await startWorkspaceProof({port:5199}),browser=await chromium.launch({channel:'chrome',headless:true}),records=[],errors=[];
try{
 for(const theme of ['classic','taylor','newfoundland'])for(const view of ['personal','household']){
  const context=await browser.newContext({reducedMotion:'reduce'});await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${server.url}?theme=${theme}&view=${view}&feedback=1`);await page.locator('#hw-message').waitFor();
  await page.locator('.hw-feedback-review summary').click();
  for(const width of [320,390,720,1100,1440,1920]){
   await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'Submit this report',exact:true}).scrollIntoViewIfNeeded();
   const metrics=await page.locator('.hw-feedback').evaluate(e=>({overflow:e.scrollWidth>e.clientWidth+1,bodyOverflow:document.documentElement.scrollWidth>innerWidth+1,inputs:[...e.querySelectorAll('input,select,textarea')].every(i=>i.getBoundingClientRect().width>=20)}));
   const axe=await new AxeBuilder({page}).include('.hw-feedback').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   records.push({theme,view,width,...metrics,violations:axe.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});
   if(width===390||width===1440)await page.screenshot({path:`${out}/${theme}-${view}-${width}.png`,fullPage:true});
  }
  await page.getByRole('textbox',{name:'What happened?',exact:true}).fill('The chart disappears only in landscape.');await page.getByRole('button',{name:'Save report edits for Hercules'}).click();
  await page.getByRole('button',{name:'Submit this report',exact:true}).click();await page.getByRole('button',{name:'Check original report receipt'}).click();
  await page.getByRole('heading',{name:'Report received'}).waitFor();
  await page.locator('#hw-message').fill('Unrelated conversation is still here.');if(!await page.locator('#hw-message').isEditable())errors.push('composer blocked '+theme+view);
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:700},reducedMotion:'reduce'}),page=await context.newPage();await page.goto(server.url+'?feedback=1&mode=compact');await page.locator('.hw-feedback-review summary').click();await page.getByRole('textbox',{name:'What happened?',exact:true}).fill('Compact draft stays.');await page.getByRole('button',{name:'Open room ↗'}).click();if(await page.getByRole('textbox',{name:'What happened?',exact:true}).inputValue()!=='Compact draft stays.')errors.push('expand lost draft');
 await page.locator('#hw-message').press('Tab');if(!await page.evaluate(()=>document.activeElement?.tagName!=='BODY'))errors.push('keyboard focus');await context.close();
}catch(e){errors.push(String(e));}finally{await browser.close();await server.close();}
await writeFile(`${out}/report.json`,JSON.stringify({records,errors},null,2));
const failed=records.filter(r=>r.overflow||r.bodyOverflow||!r.inputs||r.violations.length);console.log(JSON.stringify({cases:records.length,errors,failed},null,2));if(errors.length||records.length!==36||failed.length)process.exitCode=1;
