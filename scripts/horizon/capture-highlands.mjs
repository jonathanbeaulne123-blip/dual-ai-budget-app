// The Highlands (The Water's Way PR 3, module `crown`) evidence: the place's Sketchbook pages (E, F), its porch (the hamlet
// lane at the north pass), its signature poses (Bench Hamlet, Westwatch Chapel, Fallswatch's binocular lines, High Shieling
// Ranch, the drag lift, the Rim Walk), the Bight lookout's telephoto line to the Westwatch cote, and an aerial — at the
// place's best hour (dawn) and at night, in Classic, Taylor's Scrapbook and Newfoundland, full and lite. Headless SwiftShader
// on the review harness; NOT device evidence. Starts its own vite dev server (unless --url) and kills it at the end.
//   node scripts/horizon/capture-highlands.mjs --out docs/horizon/evidence/waters-way-crown --port 5201
// Options: --out <dir> · --port <n> · --url <origin> · --only <comma list of label substrings> · --themes classic,taylor,newfoundland
//          · --tiers full,lite · --width 1024 --height 640 · --quality 78
import {chromium} from '@playwright/test';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';

const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0?args[i+1]:f;};
const out=resolve(opt('out','docs/horizon/evidence/waters-way-crown')),port=Number(opt('port','5201')),only=opt('only')?.split(',').filter(Boolean)??null;
const themes=opt('themes','classic,taylor,newfoundland').split(','),tiers=opt('tiers','full,lite').split(',');
const VIEW={width:Number(opt('width','1024')),height:Number(opt('height','640'))},QUALITY=Number(opt('quality','78'));
const DATE='2026-06-21',DAWN='06:30',DAY='10:30',NIGHT='22:40';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await mkdir(out,{recursive:true});
const t0=Date.now(),log=(...m)=>console.log(`[${((Date.now()-t0)/1000).toFixed(0).padStart(5)}s]`,...m);

let server=null,origin=opt('url');
if(!origin){
  origin=`http://127.0.0.1:${port}`;
  server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:['ignore','pipe','pipe']});
  let sl='';server.stdout.on('data',d=>sl+=d);server.stderr.on('data',d=>sl+=d);
  const until=Date.now()+180000;let up=false;
  while(Date.now()<until&&!up){try{up=(await fetch(`${origin}/horizon-review.html`)).ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}
  if(!up){console.error(sl);kill();throw new Error('vite did not start');}
}
function kill(){if(server&&server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}}}
process.on('exit',kill);

// Poses: [label, eye, target, vertical fov, eye mode]. `g` eyes stand `dy` over the surface the runtime reports at (x, z).
const POSES=[
  {label:'porch-north-pass',eye:{x:1060,z:342,dy:1.6},target:[1036,93,316],fov:55,note:'the porch: the hamlet lane at the north pass, Westwatch Chapel on its knoll and the sea beyond'},
  {label:'westwatch-chapel',eye:{x:1046,z:331,dy:1.6},target:[1036,91,315],fov:55,note:'Westwatch Chapel from its churchyard gate: the verdigris bell cote on the north gable'},
  {label:'bench-hamlet',eye:{abs:[1036,116,466]},target:[1082,103,412],fov:55,note:'Bench Hamlet from the shelf\'s south end: the crofts along the lane, yards, strips and dykes'},
  {label:'bench-hamlet-to-horn',eye:{x:1068,z:400,dy:1.6},target:[1400,150,398],fov:58,note:'standing in Bench Hamlet toward the horn (the prototype\'s hamlet camera)'},
  {label:'fallswatch-veil',eye:{x:1081,z:692.5,dy:1.7},target:[1112,74,706],fov:62,note:'from the Fallswatch eye along the Veil (the binocular line to the lip)'},
  {label:'fallswatch-oak',eye:{x:1086,z:694.3,dy:1.6},target:[1125,50,1165],fov:40,note:'from the Fallswatch eye: the Old Oak across Stillwater (story link 1 → 2)'},
  {label:'fallswatch-deck',eye:{x:1104,z:672,dy:1.6},target:[1082,95.5,693],fov:55,note:'the Fallswatch deck and its Lookout kit on the west buttress, from the lane behind the lip'},
  {label:'high-shieling-ranch',eye:{x:1430,z:706,dy:1.7},target:[1452,63.5,680],fov:58,note:'High Shieling Ranch: longhouse, barn, paddock, the mere below'},
  {label:'drag-lift',eye:{x:1124,z:420,dy:1.7},target:[1186,117,360],fov:55,note:'the drag lift from the Twin Tarns shelf: stations, towers, the rope and its T-bars'},
  {label:'rim-walk-cairns',eye:{abs:[1236,140,318]},target:[1360,128,372],fov:55,note:'on the Rim Walk: cairns, turf and scree toward the horn'},
  {label:'bight-to-westwatch',eye:{abs:[744,53.6,511]},target:[1038,95,313.2],fov:12,note:'telephoto along the Bight lookout\'s line to the Westwatch cote (story link 7 → 1)'},
  {label:'aerial',eye:{abs:[840,330,1010]},target:[1270,95,500],fov:46,note:'aerial from the south-west'},
];
const PAGES=['E','F'];

const browser=await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[],errors=[];
const wanted=l=>!only||only.some(o=>l.includes(o));
try{
  for(const tier of tiers)for(const theme of themes){
    // Classic full: everything at dawn + night; other dressings / lite: the signature set.
    const set=tier==='full'&&theme==='classic'?POSES:POSES.filter(p=>['porch-north-pass','westwatch-chapel','bench-hamlet','fallswatch-veil','fallswatch-deck','high-shieling-ranch'].includes(p.label));
    const times=tier==='full'&&theme==='classic'?[DAWN,NIGHT]:theme==='newfoundland'&&tier==='full'?[DAWN,NIGHT]:[DAWN];
    const todo=set.filter(p=>wanted(p.label));if(!todo.length&&!(tier==='full'&&theme==='classic'))continue;
    const page=await browser.newPage({viewport:VIEW,timezoneId:'America/Toronto',deviceScaleFactor:1});page.setDefaultTimeout(600000);
    page.on('pageerror',e=>errors.push({tier,theme,message:e.message}));
    await page.goto(`${origin}/horizon-review.html?world=horizon&tier=${tier}&theme=${theme}&date=${DATE}&sun=${DAWN}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:400000});
    await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls,.horizon-inspector{visibility:hidden!important}'});
    await page.waitForFunction(()=>{const s=window.__harbour.stats();return !s.chunks||s.chunksLoaded?.length===s.chunks.total;},null,{timeout:600000}).catch(e=>errors.push({tier,theme,message:'chunks '+String(e).slice(0,160)}));
    log(tier,theme,'ready');
    // settle() does not drive the deferred dressing / corridor builders: wait until both report built (the frame loop runs them).
    const settle=async()=>{await page.evaluate(()=>window.__harbour.settle(300000));
      await page.waitForFunction(()=>{const h=window.__harbour;return !h.dressingRenderStatus?.().building&&!h.corridorRenderStatus?.().building;},null,{timeout:180000,polling:500}).catch(e=>errors.push({tier,theme,message:'dressing build '+String(e).slice(0,120)}));
      await page.evaluate(()=>window.__harbour.settle(60000));await page.waitForTimeout(3000);};
    const setTime=hh=>page.evaluate(({hh,DATE})=>{const [H,M]=hh.split(':').map(Number),d=new Date(`${DATE}T12:00:00-04:00`);d.setHours(H,M,0,0);window.__harbour.setDate(d);},{hh,DATE});
    const surface=(x,z)=>page.evaluate(({x,z})=>{const g=window.__harbour.geography,h=g.surface(x,z,400,400);return h?h.y:g.ground(x,z);},{x,z});
    const shoot=async(label,hh,meta)=>{
      const file=`${tier}_${theme}_${label}_${hh.replace(':','')}.jpg`;
      const png=join(out,`.tmp-${process.pid}.png`);await page.screenshot({path:png,timeout:180000});
      execFileSync('convert',[png,'-quality',String(QUALITY),join(out,file)]);await rm(png);
      const st=await page.evaluate(()=>{const s=window.__harbour.stats(),d=s.drawSamples.at(-1);return{drawCalls:d?.calls??null,triangles:d?.triangles??null};});
      records.push({file,tier,theme,time:hh,...meta,stats:st});log(file,JSON.stringify(st));
    };
    for(const p of todo)try{
      let eye;if(p.eye.abs)eye=p.eye.abs;else{const y=await surface(p.eye.x,p.eye.z);eye=[p.eye.x,y+p.eye.dy,p.eye.z];}
      await page.evaluate(({p,eye})=>{const w=window.__harbour,views=w.world.views,v={id:'HL_'+p.label,label:p.note,eye,target:p.target,fovDegrees:p.fov,aspect:1,radius:300,portrait:null},i=views.findIndex(x=>x.id===v.id);if(i>=0)views[i]=v;else views.push(v);w.shot(v.id);},{p,eye});
      for(const hh of times){await setTime(hh);await settle();await shoot(p.label,hh,{note:p.note,eye,target:p.target,fov:p.fov});}
    }catch(e){errors.push({tier,theme,pose:p.label,message:String(e).slice(0,300)});log('FAILED',p.label,String(e).slice(0,160));}
    if(tier==='full'&&theme==='classic')for(const id of PAGES.filter(wanted)){
      await page.evaluate(id=>window.__harbour.shot(id),id);await setTime(DAY);await settle();await shoot(`page-${id}`,DAY,{note:`Sketchbook page ${id}`});
    }
    await page.close();
  }
}catch(e){errors.push({message:String(e).slice(0,500)});log('FAILED',String(e).slice(0,300));}
finally{await browser.close();kill();}
await writeFile(join(out,'captures.json'),JSON.stringify({sha,date:DATE,times:{dawn:DAWN,day:DAY,night:NIGHT},viewport:VIEW,method:'headless Chromium (SwiftShader) on the review harness; look poses via __harbour.world.views + shot(). SwiftShader, not device evidence.',records,errors},null,1)+'\n');
log('done',records.length,'errors',errors.length);
process.exit(0);
