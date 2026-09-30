// Actual Horizon renderer, observed clock and physically seated review cameras.
// Headless Chromium/SwiftShader only; these images do not establish device acceptance.
import {chromium} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]??'docs/horizon/evidence/mountain-road/after/captures');mkdirSync(out,{recursive:true});
const worldBytes=readFileSync('public/horizon/world/horizon-geo-1.json'),world=JSON.parse(worldBytes);
const source=JSON.parse(readFileSync('src/harbour/horizon/land/mountainV2/v2-data.json'));
const inv=JSON.parse(readFileSync('docs/horizon/evidence/mountain-road/before/inventory.json'));
const chain=world.roadChains.find(c=>c.id==='mountain-road'),road=world.beds.find(b=>b.id==='mountainV2.road').points,link=world.beds.find(b=>b.id==='spur stillwater').points;
const nearest=(points,p)=>points.reduce((a,q,i)=>Math.hypot(q[0]-p[0],q[2]-p[2])<Math.hypot(points[a][0]-p[0],points[a][2]-p[2])?i:a,0);
const rider=(id,p,points=chain.points,reverse=false)=>{
 const i=nearest(points,p),eye=points[i],direction=reverse?-1:1;let target=points[Math.max(0,Math.min(points.length-1,i+direction*4))];
 // At a route end, continue its terminal tangent. Keep the eye on the authored surface;
 // clamping both indices to the end would otherwise give the camera no look direction.
 if(Math.hypot(target[0]-eye[0],target[2]-eye[2])<.01){
  let j=i-direction;while(j>=0&&j<points.length&&Math.hypot(points[j][0]-eye[0],points[j][2]-eye[2])<.01)j-=direction;
  if(j<0||j>=points.length)throw new Error(`View ${id} has no distinct route tangent`);
  const before=points[j],distance=Math.hypot(eye[0]-before[0],eye[2]-before[2]);target=eye.map((v,k)=>v+(v-before[k])*8/distance);
 }
 return{id,eye:[...eye],target:[...target],seat:true};
};
const joins=[];
for(const j of inv.joins)for(const reverse of[false,true])joins.push(rider(j.id+(reverse?'-down':'-up'),j.at,chain.points,reverse));
for(const h of inv.hairpins)for(const reverse of[false,true])joins.push(rider(h.id+(reverse?'-down':'-up'),h.at,road,reverse));
for(const b of source.road.bridges)for(const [end,p]of [['a',b.axis[0]],['b',b.axis.at(-1)]])for(const reverse of[false,true])joins.push(rider(`${b.id}-${end}-${reverse?'down':'up'}`,p,road,reverse));
for(const mouth of world.collision.mouths.filter(m=>/^(mountainRoadTunnel|stillwaterTunnel)\.portal/.test(m.id))){const x=mouth.outline.reduce((n,p)=>n+p[0],0)/mouth.outline.length,z=mouth.outline.reduce((n,p)=>n+p[1],0)/mouth.outline.length;for(const reverse of[false,true])joins.push(rider(`${mouth.id}-${reverse?'back':'out'}`,[x,mouth.floor,z],mouth.id.startsWith('stillwater')?link:chain.points,reverse));}
for(const [id,p]of [['stillwater-foot',link[0]],['stillwater-green',link.at(-1)]])for(const reverse of[false,true])joins.push(rider(`${id}-${reverse?'back':'out'}`,p,link,reverse));
const matrix=[rider('library-drive',[1340,94,584],road),{id:'mountain-air',eye:[1480,290,890],target:[1260,95,625]},rider('stillwater-drive',link[Math.floor(link.length*.46)],link)];
const records=[],errors=[],browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const save=()=>writeFileSync(out+'/captures.json',JSON.stringify({method:'Actual Horizon renderer; static physically seated camera poses; headless Chromium SwiftShader, not device evidence',worldSha256:createHash('sha256').update(worldBytes).digest('hex'),records,errors},null,2));
try{
 for(const tier of(process.env.TIERS??'full,lite').split(','))for(const theme of(process.env.THEMES??'classic,taylor,newfoundland').split(',')){
  const page=await browser.newPage({viewport:{width:1100,height:720},timezoneId:'America/Toronto',reducedMotion:'no-preference'});page.on('pageerror',e=>errors.push({tier,theme,error:e.message}));
  await page.goto(`${process.env.HORIZON_REVIEW_URL??'http://127.0.0.1:5209'}/horizon-review.html?world=horizon&tier=${tier}&theme=${theme}&date=2026-06-21&sun=13:00&diagnostics=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__harbour?.stats().firstInteractiveMs!==null&&!!window.__harbour,null,{timeout:180000});
  await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls{visibility:hidden!important}'});
  for(const time of(process.env.TIMES??'day,night').split(',')){
   const poses=process.argv.includes('--joins')?(tier==='full'&&theme==='classic'&&time==='day'?joins:[]):matrix;
   for(const pose of poses){
    try{
     const actual=await page.evaluate(({pose,time})=>{const h=window.__harbour,p={...pose,eye:[...pose.eye],target:[...pose.target]};if(p.seat){for(const a of[p.eye,p.target])a[1]=(h.geography.surface(a[0],a[2],a[1],.5)?.y??a[1])+1.65;}
      h.world.views.push({...p,label:p.id,fovDegrees:58,radius:500,portrait:null});h.shot(p.id);h.setDate(new Date(time==='day'?'2026-06-21T13:00:00-04:00':'2026-06-21T23:00:00-04:00'));return p;
     },{pose,time});
     const settled=await page.evaluate(()=>window.__harbour.settle(45000));await page.waitForTimeout(500);
     const stats=await page.evaluate(()=>{const h=window.__harbour,s=h.stats();return{region:s.region,draw:s.drawSamples?.at(-1),resident:s.chunks?.resident,inspector:h.inspect?.(),clock:h.inspect?.().clock,renderer:s.renderer,lights:h.roadLights?.(),camera:s.camera};});
     const expected=time==='day'?'2026-06-21T17:00:00.000Z':'2026-06-22T03:00:00.000Z';if(stats.clock!==expected)throw new Error(`World clock ${stats.clock} does not match ${expected}`);
     const file=`${theme}-${tier}-${time}-${pose.id.replace(/[^a-z0-9-]/gi,'-')}.jpg`;
     await page.locator('.horizon-stage canvas').screenshot({path:out+'/'+file,type:'jpeg',quality:86,timeout:60000});records.push({file,theme,tier,time,pose:actual,settled,stats});save();console.log(file);
    }catch(e){errors.push({pose:pose.id,tier,theme,time,error:e.message});save();}
   }
  }
  await page.close();
 }
}finally{save();await browser.close();}
