/** Replays current tap-to-walk through the real Horizon runtime closure. No copied walker physics. */
import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const w=JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.json.gz'))),inventory=JSON.parse(readFileSync('docs/horizon/evidence/bridges/before/static-probes/audit.json'));
const args=process.argv.slice(2),opt=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const out=opt('--out','docs/horizon/evidence/bridges/before/walk');mkdirSync(out,{recursive:true});
const at=(p,s)=>{for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],l=Math.hypot(b[0]-a[0],b[2]-a[2]);if(s<=l||i===p.length-1){const t=Math.max(0,Math.min(1,s/(l||1)));return a.map((v,k)=>v+(b[k]-v)*t);}s-=l;}return p[0];};
const runs=[],errors=[];const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5197/horizon-review.html?world=horizon&tier=full&date=2026-06-21&sun=13:00',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:240000});
await page.waitForFunction(()=>{const s=window.__harbour.stats();return !s.chunks||s.chunksLoaded.length===s.chunks.total;},null,{timeout:240000});
for(const row of inventory.rows){if(opt('--only','')&&!opt('--only','').split(',').includes(row.id))continue;const bed=w.collision.beds.find(b=>b.id===row.route);if(!bed)continue;
for(const direction of [1,-1]){
const start=at(bed.points,direction===1?row.from:row.to),goal=at(bed.points,direction===1?row.to:row.from);
await page.evaluate(({start})=>{const h=window.__harbour;h.restore({world:'horizon:horizon-geo-1',geo:h.world.geographyRevision,place:'court',x:start[0],y:start[1],z:start[2],yaw:0});h.settle(30000);},{start});
await page.waitForTimeout(1500);
const result=await page.evaluate(({start,goal})=>{
 const h=window.__harbour,actual=h.stats().body,startError=Math.hypot(actual.x-start[0],actual.y-start[1],actual.z-start[2]);
 if(startError>1)return {status:'restore-relocated',startError,actual,start,goal};
 const plan=h.walkTo(goal);if(!plan)return {status:'no-route',startError,actual,start,goal};
 const trace=[],limit=1200;let result,stalled=0,prior=actual;
 for(let i=0;i<limit;i++){
  result=h.simulateWalk(.25);const b=result.body;trace.push([b.x,b.y,b.z]);
  if(result.remaining===0)break;
  if(Math.hypot(b.x-prior.x,b.y-prior.y,b.z-prior.z)<.001)stalled++;else stalled=0;
  prior=b;if(stalled>20)break;
 }
 const final=result.body,error=Math.hypot(final.x-goal[0],final.y-goal[1],final.z-goal[2]);
 return {status:error<1?'destination-reached-review-path':'incomplete-runtime-replay',startError,start,goal,final,error,remaining:result.remaining,blocker:result.blocker,plan:plan.points,trace};
},{start,goal});
runs.push({bridge:row.id,direction,...result});console.log(row.id,direction,result.status);
writeFileSync(out+'/audit.json',JSON.stringify({sha:inventory.sha,worldSha256:createHash('sha256').update(readFileSync('public/horizon/world/horizon-geo-1.json.gz')).digest('hex'),method:'Real runtime restore/walkTo/simulateWalk. A reached destination may take another route: trace requires bridge/deck review. No controller changes. Headless, not device evidence.',runs,errors},null,2));
}}
}finally{await browser.close();}
