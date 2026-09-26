import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page=await browser.newPage({viewport:{width:400,height:260},timezoneId:'America/Toronto'});
await page.goto(`http://127.0.0.1:5199/horizon-review.html?world=horizon&tier=lite`,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__harbour?.stats&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:240000});
const r=await page.evaluate(()=>{const h=window.__harbour,sky=h.world.sky,g=h.geography;
 const line=(a,b,n=40)=>Array.from({length:n+1},(_,i)=>{const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n;return [Math.round(x),Math.round(z),Math.round(g.ground(x,z)*10)/10];});
 return{landings:sky.landings,gates:sky.gates.map(x=>({id:x.id,xy:x.xy,h:x.height})),gateVols:sky.volumes.filter(v=>v.kind==='gate').map(v=>({id:v.id,c:v.centre,ap:v.aperture,yaw:v.yaw})),launches:sky.launches,thermals:sky.volumes.filter(v=>v.kind!=='gate'&&v.kind!=='landing'),
 crownRing:[0,45,90,135,180,225,270,315].map(d=>{const a=d*Math.PI/180;return [d,[20,50,100,200].map(r=>Math.round(g.ground(1310+Math.sin(a)*r,440-Math.cos(a)*r)))];}),
 northFace:line([1300,200],[1300,300],20), crownToLamp:line([1310,440],[540,1195],20)};});
console.log(JSON.stringify(r));
await browser.close();
