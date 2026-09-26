// Probe B2 (reviewer): what stands in the Lamp Hop's line south of gate 5's plane (solid ids by height).
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:300,height:200}});
await page.goto(`http://127.0.0.1:5199/horizon-review.html?world=horizon&tier=lite`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__harbour?.stats&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:240000});
const r=await page.evaluate(()=>{const g=window.__harbour.geography,yaw=-0.576860895,nx=Math.sin(yaw),nz=Math.cos(yaw),tx=Math.cos(yaw),tz=-Math.sin(yaw),rows=[];
 for(const along of [6,8,10,12,14,16,18,20,24,28])for(const across of [-12,-6,0,6,12]){const x=560+nx*along+tx*across,z=1080+nz*along+tz*across,hits={};
  for(let y=0;y<=14;y+=1){const id=g.blocker(x,z,y,.5);if(id)(hits[id]??=[]).push(y);}
  rows.push({along,across,x:+x.toFixed(1),z:+z.toFixed(1),ceiling:Number.isFinite(g.ceiling(x,z,0))?+g.ceiling(x,z,0).toFixed(2):null,hits});}
 const bridge=window.__harbour.world.structures.find(s=>/bight/i.test(s.id));
 return{rows,bridge:bridge&&{id:bridge.id,kind:bridge.kind,bounds:bridge.bounds}};});
console.log(JSON.stringify(r));
await browser.close();
