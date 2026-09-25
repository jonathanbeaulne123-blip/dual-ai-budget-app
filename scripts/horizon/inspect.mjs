import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
 page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE_ERROR',m.text().slice(0,500));});
 await page.goto('http://127.0.0.1:5197/horizon-review.html?world=horizon&shot=A&sun=15:00&date=2026-06-21',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__harbour?.stats,{timeout:120000});
 await page.waitForTimeout(8000);
 await page.screenshot({path:'/tmp/horizon-first.png'});
 console.log(JSON.stringify(await page.evaluate(()=>{const s=window.__harbour.stats();return{...s,frames:s.frames.slice(-10),drawSamples:s.drawSamples.slice(-3),stream:s.stream.slice(-2),diagnostics:s.diagnostics.length};}),null,2));
}finally{await browser.close();}
