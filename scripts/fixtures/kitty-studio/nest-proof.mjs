/** Single-page, fictional Development proof. Never connects to a hosted household. */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const out=process.env.OUT || '/tmp/hearth-nest-proof',origin=process.env.ORIGIN || 'http://127.0.0.1:5181';
const widths=(process.env.WIDTHS||'320,390,720,1100,1440,1920').split(',').map(Number);
const themes=(process.env.THEMES||'classic,taylor,newfoundland').split(',');
const views=(process.env.VIEWS||'household,personal').split(',');
const routes=(process.env.ROUTES||'home,plan,king,category,setup').split(',');
mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const context=await browser.newContext({reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));const hash=createHash('sha256');for(const file of [...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n'))].filter(file=>/^(src|scripts\/fixtures\/kitty-studio|test\/fixtures)\//.test(file)).sort()){hash.update(file);hash.update(readFileSync(file));}const fingerprint=hash.digest('hex');const prior=existsSync(`${out}/source.json`)?JSON.parse(readFileSync(`${out}/source.json`,'utf8')):null;const results=prior?.fingerprint===fingerprint&&existsSync(`${out}/results.json`)?JSON.parse(readFileSync(`${out}/results.json`,'utf8')):[];writeFileSync(`${out}/source.json`,JSON.stringify({fingerprint,at:new Date().toISOString()},null,2));
try{for(const theme of themes)for(const view of views)for(const width of widths)for(const route of routes){
 const label=`${theme}-${view}-${width}-${route}`; if(results.some(r=>r.label===label))continue;
 if(page.url().startsWith(origin))await page.evaluate(()=>sessionStorage.clear());
 await page.setViewportSize({width,height:width<720?900:1000});const modal=route.startsWith('king')||route==='category';const queryRoute=modal?'gallery':route,bank=route.startsWith('king')?'king':route==='category'?'plan:protect':'';
 await page.goto(`${origin}/scripts/fixtures/kitty-studio/index.html?theme=${theme}&view=${view}&route=${queryRoute}&bank=${bank}`,{waitUntil:'domcontentloaded'}).catch(async error=>{if(!String(error).includes('ERR_ABORTED'))throw error;await page.goto(`${origin}/scripts/fixtures/kitty-studio/index.html?theme=${theme}&view=${view}&route=${queryRoute}&bank=${bank}`,{waitUntil:'domcontentloaded'});});
 await page.locator(modal?'.nest-detail':route==='plan'?'.plan-studio':route==='setup'?'.onboarding-journey':'.kitty-nest').waitFor();await page.waitForTimeout(modal?450:150);
 if(route.startsWith('king-')){await page.getByRole('button',{name:'Throw a piece',exact:true}).click();const bench=route.split('-')[1];if(bench!=='shape')await page.getByRole('button',{name:bench==='paint'?'Paint':'Kiln',exact:true}).click();await page.locator('.nest-detail__controls').scrollIntoViewIfNeeded();}
 await page.screenshot({path:`${out}/${label}.png`});
 if(modal){await page.locator('.nest-detail__object').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${label}-pot.png`});}
 const geometry=await page.evaluate(()=>({viewport:innerWidth,root:document.documentElement.scrollWidth,room:document.querySelector('.kitty-room')?.scrollWidth,nest:document.querySelector('.kitty-nest')?.getBoundingClientRect().width,controls:document.querySelector('.nest-detail__controls')?.clientWidth,controlsScroll:document.querySelector('.nest-detail__controls')?.scrollWidth}));
 let violations=[];if([390,1100].includes(width))violations=(await new AxeBuilder({page}).withRules(['color-contrast','button-name','label','aria-valid-attr-value','aria-hidden-focus']).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
 await page.screenshot({path:`${out}/${label}-full.png`,fullPage:!modal});
 if(modal){await page.evaluate(()=>{const room=document.querySelector('.kitty-room');room.scrollTop=room.scrollHeight;});await page.screenshot({path:`${out}/${label}-bottom.png`});}
 const item={label,geometry,violations,errors:errors.splice(0)};results.push(item);writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(item));
}}finally{await browser.close();}
