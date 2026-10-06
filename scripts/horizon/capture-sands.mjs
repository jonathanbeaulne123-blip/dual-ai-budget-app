// Long Sands evidence (The Water's Way PR 4, `landing` · Long Sands, D-WW150…159): Sketchbook pages D and L, the porch,
// the place's signature poses at best hour and at night, the belfry → wheel and wheel-top → elevator sight lines, the
// Wreck and one aerial, in Classic / Taylor / Newfoundland × full / lite. Headless SwiftShader on the review harness; NOT
// device evidence (CONTRACT §2.21). Starts its own vite dev server (unless --url) and stops it at the end.
//   node scripts/horizon/capture-sands.mjs --out docs/horizon/evidence/waters-way-landing-sands --port 5206
// Options: --out <dir> · --port <n> · --url <origin> · --only <comma list of label substrings> · --themes classic,taylor,…
//          --tiers full,lite · --night-only · --day-only
// Each shot is a 1280 × 800 JPEG (quality 72); LOOK.md's set is downscaled to 960 × 600 so it stays under ~4 MB.
import {chromium} from '@playwright/test';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';

const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0?args[i+1]:f;},flag=n=>args.includes(`--${n}`);
const output=resolve(opt('out','docs/horizon/evidence/waters-way-landing-sands')),port=Number(opt('port','5206'));
const only=opt('only')?.split(',').filter(Boolean)??null,themes=(opt('themes','classic,taylor,newfoundland')).split(','),tiers=(opt('tiers','full,lite')).split(',');
const DATE='2026-06-21',VIEW={width:1280,height:800},FOV=50;
const sha=execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim();
await mkdir(output,{recursive:true});
const t0=Date.now(),log=(...m)=>console.log(`[${((Date.now()-t0)/1000).toFixed(0).padStart(5)}s]`,...m);

let server=null,origin=opt('url');
if(!origin){
  origin=`http://127.0.0.1:${port}`;
  server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:['ignore','pipe','pipe']});
  let slog='';server.stdout.on('data',d=>slog+=d);server.stderr.on('data',d=>slog+=d);
  const until=Date.now()+180000;let up=false;
  while(Date.now()<until&&!up){try{up=(await fetch(`${origin}/horizon-review.html`)).ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}
  if(!up){console.error(slog);kill();throw new Error('vite did not start');}
  log('vite up at',origin);
}
function kill(){if(server&&server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}}}
process.on('exit',kill);process.on('SIGINT',()=>{kill();process.exit(130);});

/** Poses: eye/target in Horizon space (x east, y up, z south). `lift`: the eye stands this high over the walkable surface
 *  under it (looked up in the page). `view`: use the baked Sketchbook page (world.views) as is. */
const POSES=[
  {label:'D-page',view:'D',day:'16:30',night:'22:30',note:'Sketchbook page D (Long Sands, baked pose): surf, the zip landing, the Lamp'},
  {label:'L-page',view:'L',day:'06:00',night:'22:30',note:'Sketchbook page L (the quay at night): the Boathouse across the water, its gable lantern'},
  {label:'porch',eye:[1320,1.75,1321],lift:1.65,target:[1420,3.6,1335],day:'19:30',night:'22:30',note:'porch: from the Boathouse dock across the river mouth to the quay'},
  {label:'promenade',eye:[975,0,1431.6],lift:1.65,target:[850,7,1407.6],day:'19:30',night:'22:30',note:'the promenade west from the pier plaza: palms, storefronts, the Strand'},
  {label:'beach',eye:[986,0,1474],lift:1.65,target:[830,5,1429],day:'19:30',note:'the beach: towers, courts, umbrellas, the promenade behind'},
  {label:'wheel',eye:[1066,0,1466],lift:1.65,target:[1012,18,1509],day:'20:30',night:'22:30',note:'the Ferris wheel on the pier platform, the shack, the pier lamps'},
  {label:'pier',eye:[1020,0,1486],lift:1.65,target:[1110,8,1424],day:'19:30',night:'22:30',note:'from the pier back to the promenade: festoons, palms, the zip landing'},
  {label:'belfry-wheel',eye:[1423,34.4,1187],target:[1010.5,26,1509.5],day:'19:30',note:'the sight line belfry → wheel (STORY §4.2)'},
  {label:'wheeltop-elevator',eye:[1010.5,31,1509.5],target:[395,60,706],day:'20:00',note:'from the top of the wheel across the Bight to the grain elevator'},
  {label:'wreck',eye:[318,9,1214],target:[250,1,1150],day:'18:00',note:'the Wreck on its reef'},
  {label:'aerial',eye:[800,130,1730],target:[1060,4,1430],day:'19:30',note:'aerial over Long Sands from the south-west'},
];
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[],errors=[];
try{
  for(const tier of tiers)for(const theme of themes){
    // Lite: Classic all poses, the others page D only (the lite rule is the same in every dressing).
    const poses=POSES.filter(p=>(!only||only.some(o=>p.label.includes(o)))&&(tier==='full'||theme==='classic'||p.label==='D-page'));
    if(!poses.length)continue;
    const page=await browser.newPage({viewport:VIEW,timezoneId:'America/Toronto',deviceScaleFactor:1});page.setDefaultTimeout(600000);
    page.on('pageerror',e=>errors.push({theme,tier,message:e.message}));
    await page.goto(`${origin}/horizon-review.html?world=horizon&tier=${tier}&theme=${theme}&date=${DATE}&sun=19:30`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:400000});
    await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls,.horizon-inspector{visibility:hidden!important}'});
    log(theme,tier,'interactive');
    const setTime=hhmm=>page.evaluate(({hhmm,DATE})=>{const [H,M]=hhmm.split(':').map(Number);const d=new Date(`${DATE}T12:00:00-04:00`);d.setHours(H,M,0,0);window.__harbour.setDate(d);},{hhmm,DATE});
    const settle=async()=>{await page.evaluate(()=>window.__harbour.settle(300000));await page.waitForTimeout(3000);};
    for(const p of poses){
      for(const [when,hhmm] of [['day',p.day],['night',p.night]]){
        if(!hhmm||(flag('night-only')&&when==='day')||(flag('day-only')&&when==='night'))continue;
        const id=p.view??`SANDS_${p.label}`;
        if(!p.view)await page.evaluate(({p,FOV,id})=>{const w=window.__harbour,v=w.world.views,i=v.findIndex(q=>q.id===id),r={id,label:p.note,eye:p.eye,target:p.target,fovDegrees:FOV,aspect:1,radius:260,portrait:null};if(i>=0)v[i]=r;else v.push(r);w.shot(id);},{p,FOV,id});
        else await page.evaluate(id=>window.__harbour.shot(id),id);
        await setTime(hhmm);await settle();
        if(p.lift!==undefined){
          // Re-seat the eye on the walkable surface under it now that the district is resident.
          const y=await page.evaluate(({x,z})=>{const g=window.__harbour.geography,h=g.surface(x,z,40,2.5);return h?h.y:g.ground(x,z);},{x:p.eye[0],z:p.eye[2]});
          const eye=[p.eye[0],y+p.lift,p.eye[2]];
          await page.evaluate(({p,FOV,id,eye})=>{const w=window.__harbour,v=w.world.views,i=v.findIndex(q=>q.id===id);v[i]={...v[i],eye};w.shot(id);},{p,FOV,id,eye});
          await settle();
        }
        const file=`${theme}-${tier}-${p.label}-${when}.jpg`;
        await page.locator('.horizon-stage canvas').screenshot({path:join(output,file),type:'jpeg',quality:72,scale:'css',timeout:180000});
        const s=await page.evaluate(()=>{const s=window.__harbour.stats(),d=s.drawSamples.at(-1)??null;return{drawCalls:d?.calls??null,triangles:d?.triangles??null};});
        records.push({file,theme,tier,label:p.label,time:hhmm,note:p.note,...s});log(file,s.drawCalls,s.triangles);
      }
    }
    await page.close();
  }
}finally{await browser.close();kill();}
await writeFile(join(output,'captures.json'),JSON.stringify({sha,date:DATE,method:'headless Chromium (SwiftShader) on horizon-review.html; look poses via __harbour.world.views + shot(). SwiftShader, not device evidence.',records,errors},null,1));
log('done',records.length,'shots',errors.length,'errors');
