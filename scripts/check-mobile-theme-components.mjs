import {chromium} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';import {mkdir,writeFile} from 'node:fs/promises';
const names=['mobile-a1','mobile-a3','mobile-a4','mobile-a5','mobile-b1','mobile-b2','mobile-b3','mobile-b4','mobile-b5','mobile-b6','mobile-b7','mobile-b8','mobile-b9','mobile-c6','mobile-c7','mobile-c8','mobile-c9','mobile-proof','mobile-c11','mobile-return'];
const origin=process.env.HEARTH_THEME_ORIGIN||'http://127.0.0.1:5184';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Local synthetic verification only.');
const out=process.env.HEARTH_ARTIFACTS_DIR||'.artifacts/three-worlds/mobile-components-final';await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'});const records=[];
try{for(const theme of ['classic','taylor','newfoundland'])for(const name of names){
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const personal=['mobile-b2','mobile-b7','mobile-c11'].includes(name);let states=[];
 try{await page.goto(`${origin}/scripts/fixtures/mobile-worlds/${name}/index.html?theme=${theme}${personal?'&personal':''}`);await page.locator('[aria-label=Theme]').waitFor();await page.evaluate(()=>document.fonts.ready);
 if(name==='mobile-a3'){await page.locator('.fund-ledge-grip').click();await page.locator('.is-sheet-grip').click();}
 if(name==='mobile-a4'){const seal=page.locator('.ph-seals button').first();if(await seal.count())await seal.click();}
 for(const width of [320,390]){await page.setViewportSize({width,height:width===320?568:844});await page.screenshot({path:`${out}/${theme}-${name}-${width}.png`,fullPage:true});states.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scene:document.documentElement.dataset.scene,scroller:document.querySelector('.fund-ledge-content')?getComputedStyle(document.querySelector('.fund-ledge-content')).touchAction:null})));}
 const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary,html:n.html}))}));records.push({theme,name,states,errors,violations});console.log(theme,name,violations.map(v=>v.id).join(','),errors.length,states.some(s=>s.width<s.scrollWidth)?'OVERFLOW':'');
 }catch(e){records.push({theme,name,failed:String(e),errors,states});console.log('FAIL',theme,name,String(e).slice(0,250));}
 await ctx.close();await writeFile(`${out}/report.json`,JSON.stringify(records,null,2));
}}finally{await browser.close();if(records.length!==60||records.some(r=>r.failed||r.errors?.length||r.violations?.length||r.states?.some(s=>s.scrollWidth>s.width)))process.exitCode=1;}
