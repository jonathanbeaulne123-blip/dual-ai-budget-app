// Pass 5 evidence: Mountain v2 on the Horizon. Pages A, E, F and B at their best hour, a reference-like scenic view
// from v2's Foot terrace looking up the gorge to the glass dam (the old town-arrival composition), and the three seams
// (the V03 road foot, the Foot terrace at the lake shore, the Crown's north face). Headless SwiftShader on the review
// harness (`pnpm exec vite --host 127.0.0.1 --port 5197`); not device evidence (CONTRACT §2.21).
//   node scripts/horizon/capture-mountain-v2.mjs docs/horizon/evidence/pass5
import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const output=resolve(process.argv[2]??'/tmp/horizon-captures/pass5'),url=process.env.HORIZON_REVIEW_URL??'http://127.0.0.1:5197';
await mkdir(output,{recursive:true});
const world=JSON.parse(await readFile('public/horizon/world/horizon-geo-1.json','utf8'));
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
// Extra poses in Horizon space (x east, y up, z south); the runtime's `lookAt` reads eye/target/fovDegrees.
const O={x:1308,y:54,z:764};
const h=(p)=>[p[0]+O.x,p[1]+O.y,p[2]+O.z];
const extra=[
  {id:'V2FOOT',label:"v2's Foot, looking up the gorge to the dam (the old town-arrival composition)",eye:h([-6,3.2,10]),target:h([8,60,-236]),fovDegrees:52,sun:'19:12'},
  {id:'V2LIB',label:'Library terrace: the road, the timber bridge and the funicular over the gorge',eye:h([70,40,-150]),target:h([0,45,-215]),fovDegrees:55,sun:'13:02'},
  {id:'SEAMFOOT',label:'Seam: V03 arrives at the Foot terrace; the lake shore to the west',eye:[1330,null,800],target:[1270,54,735],fovDegrees:60,sun:'13:02'},
  {id:'SEAMLAKE',label:'Seam: the Foot terrace meets Stillwater; the old dam site is a natural sill',eye:[1180,null,900],target:[1250,54,780],fovDegrees:60,sun:'13:02'},
  {id:'SEAMNORTH',label:"Seam: the Crown's north face and the Throat from the coast drive",eye:[1330,40,120],target:[1305,125,400],fovDegrees:60,sun:'13:02'},
  {id:'OVERVIEW',label:'Island overview from the south-west (the Journey scale at LOD 0 sees the same silhouette)',eye:[700,420,1500],target:[1250,80,700],fovDegrees:55,sun:'16:02'},
];
const only=process.env.HORIZON_PAGES?.split(',');
const pages=[['A','19:47'],['E','13:02'],['F','09:32'],['B','20:47']].filter(([id])=>!only||only.includes(id));
// A null eye height means: stand 1.7 m over the ground the runtime reports there (seam views on the Horizon's own terrain).
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),records=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},timezoneId:'America/Toronto',deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${url}/horizon-review.html?world=horizon&tier=full&date=2026-06-21&sun=13:02&mountainV2`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:180000});
  await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls{visibility:hidden!important}'});
  const settle=async()=>{const r=await page.evaluate(()=>window.__harbour.settle(300000));if(r.pending.length)console.warn("still pending",r.pending);await page.waitForTimeout(2500);};
  const setSun=async hhmm=>{await page.evaluate(hhmm=>{const [H,M]=hhmm.split(':').map(Number);const d=new Date('2026-06-21T12:00:00-04:00');d.setHours(H,M,0,0);window.__harbour.setDate(d);},hhmm);};
  for(const [id,sun] of pages){
    await page.evaluate(id=>window.__harbour.shot(id),id);await setSun(sun);await settle();
    const file=`${id}_${sun.replace(':','-')}_classic_full.png`;await page.locator('.horizon-stage canvas').screenshot({path:resolve(output,file),timeout:120000});
    const stats=await page.evaluate(()=>window.__harbour.stats());records.push({file,id,sun,region:stats.region,draw:stats.draw??stats.render});console.log(file,JSON.stringify(stats.region??null).slice(0,160));
  }
  for(const pose of extra.filter(p=>!only||only.includes(p.id))){
    await page.evaluate(pose=>{const w=window.__harbour;if(pose.eye[1]===null)pose.eye=[pose.eye[0],w.geography.ground(pose.eye[0],pose.eye[2])+1.7,pose.eye[2]];const views=w.world.views;const i=views.findIndex(v=>v.id===pose.id);const v={id:pose.id,label:pose.label,eye:pose.eye,target:pose.target,fovDegrees:pose.fovDegrees,portrait:null};if(i>=0)views[i]=v;else views.push(v);w.shot(pose.id);},pose);
    await setSun(pose.sun);await settle();
    const file=`${pose.id}_${pose.sun.replace(':','-')}_classic_full.png`;await page.locator('.horizon-stage canvas').screenshot({path:resolve(output,file),timeout:120000});
    const stats=await page.evaluate(()=>window.__harbour.stats());records.push({file,id:pose.id,label:pose.label,eye:pose.eye,target:pose.target,sun:pose.sun,region:stats.region});console.log(file);
  }
  await page.close();
}finally{await browser.close();}
await writeFile(resolve(output,'captures.json'),JSON.stringify({sha,geographyRevision:world.geographyRevision,method:'headless Chromium (SwiftShader) on the review harness; not device evidence',records,errors},null,1)+'\n');
console.log('errors',errors.length);
