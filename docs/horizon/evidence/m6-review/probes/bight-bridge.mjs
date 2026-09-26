// Probe B1 (reviewer): the Bight Bridge's underside across gate 5 (centre [560,1080] h 6, aperture 24 × 16, yaw −0.577).
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:300,height:200}});
await page.goto(`http://127.0.0.1:5199/horizon-review.html?world=horizon&tier=lite`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__harbour?.stats&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:240000});
const r=await page.evaluate(()=>{const g=window.__harbour.geography,yaw=-0.576860895,nx=Math.sin(yaw),nz=Math.cos(yaw),tx=Math.cos(yaw),tz=-Math.sin(yaw),rows=[];
 for(const along of [-12,-8,-4,0,4,8,12])for(const across of [-10,0,10]){const x=560+nx*along+tx*across,z=1080+nz*along+tz*across;rows.push({along,across,x:+x.toFixed(1),z:+z.toFixed(1),ceiling:+g.ceiling(x,z,0).toFixed(2),ground:+g.ground(x,z).toFixed(2),blockedAt:[4,6,8,10,11,12,13].filter(y=>g.blocked(x,z,y,.5))});}
 return rows;});
console.log(JSON.stringify({gate:'bightBridge',note:'along = metres along the gate normal (the flight direction), across = along the aperture width; ceiling = lowest underside above y 0; blockedAt = rider heights (feet) where geography.blocked(…, 0.5) is true',rows:r},null,0));
await browser.close();
