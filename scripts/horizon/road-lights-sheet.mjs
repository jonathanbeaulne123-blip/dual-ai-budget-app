// Road-lights sheet (track N): the committed bake has no corridor lamps yet, so this puts a SYNTHETIC lamp line on the real
// V01 centreline in the running review page (the same runtime/roadLights.ts module, imported through vite) and captures a
// driver-height view at night, mid-sequence at dusk and by day. Headless SwiftShader; not device evidence (CONTRACT §2.21).
//   node scripts/horizon/road-lights-sheet.mjs --out <dir> [--port 5241] [--url <origin>] [--at town|quay|coast]
// The synthetic line: lamps every 24 eu on the right, base 5.9 eu off the centreline, head 5.2 eu up with a 1.4 eu arm,
// pool 2.5 eu right of the centreline (radius 9), all on the surface `geography.surface` reports.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf(`--${n}`);return i>=0?args[i+1]:f;};
const out=resolve(opt('out','docs/horizon/evidence/road/lights-sheet')),port=Number(opt('port','5241')),where=opt('at','town');
await mkdir(out,{recursive:true});
let server=null,origin=opt('url');
if(!origin){origin=`http://127.0.0.1:${port}`;server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:'ignore'});
  const until=Date.now()+120000;let up=false;while(Date.now()<until&&!up){try{up=(await fetch(`${origin}/horizon-review.html`)).ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}if(!up)throw new Error('vite did not start');}
const kill=()=>{if(server&&server.exitCode===null)try{process.kill(-server.pid,'SIGTERM');}catch{}};process.on('exit',kill);
const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],records=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},timezoneId:'America/Toronto'});page.setDefaultTimeout(600000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));});
  await page.goto(`${origin}/horizon-review.html?world=horizon&tier=full&date=2026-06-21&sun=22:30&sha=${execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:300000});
  await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls,.horizon-fleet{visibility:hidden!important}'});
  const S={town:[1365,1141],quay:[1330,1370],coast:[1053,1395]}[where]??[1365,1141];
  // Build the line and the pose on V01 near S, then mount a second roadLights with only the synthetic line.
  const info=await page.evaluate(async({S})=>{
    const w=window.__harbour,bed=w.world.beds.find(b=>b.id==='V01'),P=bed.points,g=w.geography;
    const cum=[0];for(let i=1;i<P.length;i++)cum.push(cum[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][2]-P[i-1][2]));
    let bi=0,bd=Infinity;P.forEach((p,i)=>{const d=Math.hypot(p[0]-S[0],p[2]-S[1]);if(d<bd){bd=d;bi=i;}});
    const at=s=>{let i=0;while(i<cum.length-2&&cum[i+1]<s)i++;const a=P[i],b=P[i+1],t=(s-cum[i])/(cum[i+1]-cum[i]||1),dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz)||1;return{p:[a[0]+dx*t,a[1]+(b[1]-a[1])*t,a[2]+dz*t],t:[dx/n,dz/n]};};
    const surf=(x,z,y)=>g.surface(x,z,y+2,3)?.y??g.ground(x,z);
    const s0=cum[bi]-60,lamps=[];
    for(let k=0,s=s0-24;s<s0+260;s+=24,k++){const c=at(s),r=[-c.t[1],c.t[0]];const base=[c.p[0]+r[0]*5.9,0,c.p[2]+r[1]*5.9];base[1]=surf(base[0],base[2],c.p[1]);const pool=[c.p[0]+r[0]*2.5,0,c.p[2]+r[1]*2.5];pool[1]=surf(pool[0],pool[2],c.p[1]);
      lamps.push({id:`sheet.lamp.${k}`,kind:'roadLantern',at:base,head:[c.p[0]+r[0]*4.5,base[1]+5.2,c.p[2]+r[1]*4.5],pool,poolRadius:9,corridorId:'V01',line:'V01:sheet',order:k});}
    const e=at(s0),r=[-e.t[1],e.t[0]],eye=[e.p[0]+r[0]*2,0,e.p[2]+r[1]*2];eye[1]=surf(eye[0],eye[2],e.p[1])+1.9;
    const tg=at(s0+40),target=[tg.p[0]+r[0]*2,surf(tg.p[0],tg.p[2],tg.p[1])+1.9,tg.p[2]+r[1]*2];
    const views=w.world.views;views.push({id:'SHEET',label:'road lights sheet',eye,target,fovDegrees:58,aspect:1,radius:220,portrait:null});w.shot('SHEET');
    const mod=await import('/src/harbour/horizon/runtime/roadLights.ts');
    const rl=mod.createRoadLights(w.scene,{lights:lamps,beds:[]},{tier:'full',ground:(x,z,near)=>g.surface(x,z,near+1,0)?.y??null});
    // No posts: the lantern-post kit is another track's; the heads float here by design of this sheet.
    window.__sheet={rl,lamps,eye,target};
    return{eye,target,lamps:lamps.length,s0};
  },{S});
  console.log('sheet',JSON.stringify(info));
  await page.evaluate(()=>window.__harbour.settle(300000));
  const shoot=async(label,elev,{sequenceMs=null,steps=40}={})=>{
    const r=await page.evaluate(({elev,sequenceMs,steps})=>{const {rl}=window.__sheet,c=window.__harbour.camera;let now=performance.now();
      if(sequenceMs!==null){for(let t=0;t<3000;t+=16)rl.update(c,10,now+=16);let t=0;while(rl.stats().linesOn===0&&t<5000){rl.update(c,elev,now+=16);t+=16;}for(t=0;t<=sequenceMs;t+=16)rl.update(c,elev,now+=16);}else for(let i=0;i<steps;i++)rl.update(c,elev,now+=50);
      window.__harbour.input({});   // schedule a paint: the look pose is otherwise idle
      return rl.stats();},{elev,sequenceMs,steps});
    await page.waitForTimeout(1500);
    const file=`sheet_${where}_${label}.png`;await page.locator('.horizon-stage canvas').screenshot({path:join(out,file)});
    records.push({file,label,elevation:elev,stats:r,harbour:await page.evaluate(()=>{const s=window.__harbour.stats();return{lightCards:s.lightCards,roadLights:s.roadLights,draw:s.drawSamples.at(-1)};})});
    console.log(file,JSON.stringify(r));
  };
  await shoot('night-22-30',-15);
  await shoot('dusk-sequence-1-2s',-7,{sequenceMs:1200});
  await page.evaluate(()=>{const d=new Date('2026-06-21T13:00:00-04:00');window.__harbour.setDate(d);});await page.waitForTimeout(2500);
  await shoot('day-13-00',60);
  records.push({inspector:await page.evaluate(()=>window.__harbour.inspect())});
  // The `=` inspector on the real page at 320 px: focus the stage, `=` opens, `+` copies into inspectorLog, Escape closes.
  await page.setViewportSize({width:320,height:640});await page.waitForTimeout(1000);
  await page.locator('.horizon-stage').focus();await page.keyboard.press('Equal');await page.waitForTimeout(600);
  await page.screenshot({path:join(out,`sheet_${where}_inspector-320.png`)});
  await page.keyboard.press('Shift+Equal');await page.waitForTimeout(300);
  const panel=await page.evaluate(()=>{const p=document.querySelector('.horizon-inspector');const r=p?.getBoundingClientRect();return{open:!!p&&!p.hidden,rect:r?{x:r.x,y:r.y,w:r.width,h:r.height}:null,text:p?.textContent?.slice(0,400)??null,log:window.__harbour.inspectorLog.length};});
  await page.locator('.horizon-inspector').press('Escape');await page.waitForTimeout(300);
  panel.closedByEscape=await page.evaluate(()=>document.querySelector('.horizon-inspector')?.hidden===true);
  records.push({overlay:panel});console.log('overlay',JSON.stringify(panel));
}finally{await writeFile(join(out,'sheet.json'),JSON.stringify({records,errors},null,1));await browser.close();kill();}
console.log('errors',errors.length,errors.slice(0,5));
