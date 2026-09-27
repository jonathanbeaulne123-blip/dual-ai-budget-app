import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:300,height:200}});
const res=[];page.on('response',r=>{if(r.status()>=400)res.push(r.status()+' '+r.url());});
await page.goto(`http://127.0.0.1:5199/horizon-review.html?world=horizon&tier=lite`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__harbour?.stats&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:240000});
const r=await page.evaluate(()=>{const g=window.__harbour.geography;const rows=[];
 for(let z=640;z<=1200;z+=40){const row=[];for(let x=1200;x<=1720;x+=40)row.push(Math.round(g.ground(x,z)));rows.push(z+': '+row.join(' '));}
 const strip=window.__harbour.world.sky.volumes.find(v=>v.id==='strip');
 const bb=[];for(const y of [4,6,8,10,12,13,14,15,16])bb.push([y,g.blocker(556,1087.7,y,.5),g.surface(556,1087.7,y+.5)?.y,g.ceiling(556,1087.7,y)]);
 return{rows,strip,bb};});
console.log('x: '+Array.from({length:14},(_,i)=>1200+i*40).join(' '));console.log(r.rows.join('\n'));console.log(JSON.stringify(r.strip));console.log(JSON.stringify(r.bb));console.log(res);
await browser.close();
