// The Water's Way, PR 3 — the Reach and the Greenway (STORY place 3): evidence captures on the review harness.
// Headless Chromium (SwiftShader) — NOT device evidence. Starts its own vite dev server (unless --url) and kills it at the end.
//   node scripts/horizon/capture-reach.mjs --out docs/horizon/evidence/waters-way-landing-reach --port 5203
// Options: --out <dir> · --port <n> · --url <origin> · --only <comma list of label substrings> · --tier full|lite|both
// Poses are the prototype's (protos/reach SPEC §1–§4) on the baked world: page I on the boardwalk's north end, the lookouts'
// poses from their frames, the Greenway's places from its baked centreline (`structure.greenway`), two aerials. JPEG output.
import {chromium} from '@playwright/test';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import sharp from 'sharp';

const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:fallback;};
const output=resolve(opt('out','docs/horizon/evidence/waters-way-landing-reach')),port=Number(opt('port','5203')),only=opt('only')?.split(',').filter(Boolean)??null,tiers=opt('tier','both');
const DATE='2026-06-21',VIEW={width:1024,height:640},QUALITY=Number(opt('quality','68'));
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await mkdir(output,{recursive:true});
const started=Date.now(),log=(...m)=>console.log(`[${((Date.now()-started)/1000).toFixed(0).padStart(5)}s]`,...m);

let server=null,origin=opt('url');
if(!origin){
  origin=`http://127.0.0.1:${port}`;
  server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:['ignore','pipe','pipe']});
  let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
  const until=Date.now()+180000;let up=false;
  while(Date.now()<until&&!up){try{const r=await fetch(`${origin}/horizon-review.html`);up=r.ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}
  if(!up){console.error(serverLog);killServer();throw new Error('vite did not start');}
  log('vite up at',origin);
}
function killServer(){if(server&&server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}}}
process.on('exit',killServer);process.on('SIGINT',()=>{killServer();process.exit(130);});

// ---- frames (the prototype's: f = (sin yaw, cos yaw), u across = (cos yaw, −sin yaw)) ----
const frame=(at,face)=>{const yaw=Math.atan2(face[0]-at[0],face[1]-at[1]),f=[Math.sin(yaw),Math.cos(yaw)],r=[Math.cos(yaw),-Math.sin(yaw)];return{yaw,f,W:(u,v,y)=>[at[0]+r[0]*u+f[0]*v,y,at[1]+r[1]*u+f[1]*v],ahead:(d,y)=>[at[0]+f[0]*d,y,at[1]+f[1]*d]};};
const N=frame([1188,1112],[1290,1290]),SR=frame([1356,1236],[1250,1210]),HB=frame([1325.8,1382.2],[1150,1340]);
const MORNING='09:30',GOLD='19:50',DAWN='05:40',NIGHT='22:20',AFTERNOON='15:30';

const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[],errors=[];
try{
  for(const tier of tiers==='both'?['full','lite']:[tiers]){
    const page=await browser.newPage({viewport:VIEW,timezoneId:'America/Toronto',deviceScaleFactor:1});
    page.setDefaultTimeout(600000);
    page.on('pageerror',e=>errors.push({tier,message:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({tier,message:m.text().slice(0,300)});});
    await page.goto(`${origin}/horizon-review.html?world=horizon&tier=${tier}&date=${DATE}&sun=${MORNING}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:400000});
    await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls,.horizon-inspector{visibility:hidden!important}'});
    log(tier,'first interactive');
    // The Greenway's baked line (the runtime's beds) for its places' poses.
    const gw=await page.evaluate(()=>window.__harbour.world.beds.find(b=>b.id==='structure.greenway')?.points??null);
    const S=[0];for(let i=1;i<gw.length;i++)S.push(S[i-1]+Math.hypot(gw[i][0]-gw[i-1][0],gw[i][2]-gw[i-1][2]));
    const at=s=>{let i=1;while(i<gw.length-1&&S[i]<s)i++;const a=gw[i-1],b=gw[i],t=(s-S[i-1])/((S[i]-S[i-1])||1),dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
      return{p:[a[0]+dx*t,a[1]+(b[1]-a[1])*t,a[2]+dz*t],f:[dx/l,dz/l],r:[-dz/l,dx/l]};};
    const W=(s,off,dy)=>{const q=at(s);return[q.p[0]+q.r[0]*off,q.p[1]+dy,q.p[2]+q.r[1]*off];};
    const poses=[
      {label:'pageI-boardwalk',time:MORNING,eye:[1247.5,5.98,1218],target:[1250,5.7,1184],fov:55,themes:'all',lite:true,note:'page I: the boardwalk\'s north end, reeds at hand height, the spring\'s source rock'},
      {label:'springBay-heron',time:MORNING,eye:[1244.42,6.0,1200.73],target:[1268.6,5.6,1204],fov:56,note:'Spring Bay: the viewers, the heron'},
      {label:'notchBluff-panorama',time:GOLD,eye:N.W(-1.6,-1.4,24.48),target:N.ahead(140,9.5),fov:60,themes:'all',note:'Notch Bluff: the marsh, the osprey pole, the river mouth'},
      {label:'notchBluff-binoculars-osprey',time:GOLD,eye:N.W(-0.7,2.25,24.8),target:[1292,14.5,1268],fov:8,note:'through the Notch Bluff viewer: the osprey pole'},
      {label:'sunsetRail-golden',time:GOLD,eye:SR.W(1.4,-1.4,12.07),target:SR.ahead(140,3.1),fov:62,note:'Sunset Rail: the marsh into the sunset, the High Span'},
      {label:'channelHide-dawn',time:DAWN,eye:[1250.36,5.98,1253.02],target:[1236,3.4,1294],fov:66,note:'the Channel Hide at dawn through the south slot'},
      {label:'harbourBell-dusk',time:'21:05',eye:HB.W(1.6,-1.6,10.0),target:HB.ahead(160,3),fov:62,note:'Harbour Bell Landing at dusk'},
      {label:'greenway-deck',time:'10:30',eye:W(150,-1.4,1.7),target:W(195,-1.0,1.2),fov:58,themes:'all',lite:true,note:'the Greenway at s 150: reeds at hand height, the lanterns'},
      {label:'greenway-reedMaze',time:GOLD,eye:[1121,24,1326],target:[1080,7.6,1354],fov:56,note:'the Reed Maze and the Dune Overlook from above'},
      {label:'greenway-marshHide',time:MORNING,eye:W(392,-1.6,1.7),target:W(418,-12,0.5),fov:60,note:'the Marsh Hide and its pool'},
      {label:'greenway-bight-rafts',time:AFTERNOON,eye:W(880,1.5,1.7),target:W(820,-4,0),fov:58,note:'over the Bight: the floating reed rafts tethered to the bents'},
      {label:'greenway-bluffEnd-lamp',time:GOLD,eye:[858.7,20.5,712.5],target:[540,12,1195],fov:62,note:'Bluff End: the pavilion, wind-bent pines, the Lamp across the Bight'},
      {label:'night-boardwalk',time:NIGHT,eye:[1247.5,5.98,1218],target:[1258,6,1262],fov:58,themes:'all',note:'night: the boardwalk lanterns, the High Span\'s lights behind'},
      {label:'night-greenway',time:NIGHT,eye:W(40,1.2,1.7),target:W(110,0,1.2),fov:58,note:'night: the Greenway\'s lanterns from the Gate'},
      {label:'aerial-reach',time:MORNING,eye:[1440,175,1450],target:[1262,6,1235],fov:50,themes:'all',lite:true,note:'aerial: the Reach from the south-east'},
      {label:'aerial-greenway',time:'11:00',eye:[1230,330,1560],target:[985,0,1150],fov:52,note:'aerial: the Greenway from the Reach Gate to the bluff'},
    ];
    const wanted=p=>(!only||only.some(o=>p.label.includes(o)))&&(tier==='full'||p.lite);
    const settle=async()=>{const r=await page.evaluate(()=>window.__harbour.settle(300000));await page.waitForTimeout(3500);return r;};
    const setTime=async hhmm=>page.evaluate(({hhmm,DATE})=>{const [H,M]=hhmm.split(':').map(Number);const d=new Date(`${DATE}T12:00:00-04:00`);d.setHours(H,M,0,0);window.__harbour.setDate(d);},{hhmm,DATE});
    for(const theme of ['classic','taylor','newfoundland']){
      await page.evaluate(t=>window.__harbour.setTheme(t),theme);
      for(const p of poses.filter(wanted)){
        if(theme!=='classic'&&p.themes!=='all')continue;
        try{
          await page.evaluate(({p})=>{const w=window.__harbour,views=w.world.views,v={id:'REACH_'+p.label,label:p.note,eye:p.eye,target:p.target,fovDegrees:p.fov,aspect:1,radius:260,portrait:null},i=views.findIndex(x=>x.id===v.id);if(i>=0)views[i]=v;else views.push(v);w.shot(v.id);},{p});
          await setTime(p.time);const settled=await settle();
          const file=`${p.label}_${theme}_${tier}_${p.time.replace(':','-')}.jpg`,png=await page.locator('.horizon-stage canvas').screenshot({timeout:180000});
          await sharp(png).jpeg({quality:QUALITY,mozjpeg:true}).toFile(join(output,file));
          const stats=await page.evaluate(()=>{const s=window.__harbour.stats(),d=s.drawSamples.at(-1)??null;return{drawCalls:d?.calls??null,triangles:d?.triangles??null,dressing:window.__harbour.dressingRenderStatus?.()?.districts??null};});
          records.push({file,label:p.label,theme,tier,time:p.time,eye:p.eye,target:p.target,fov:p.fov,note:p.note,settle:settled?.pending??null,stats});log(file,'draw',stats.drawCalls,'tri',stats.triangles);
        }catch(e){errors.push({tier,theme,label:p.label,message:String(e).slice(0,300)});log('FAILED',p.label,theme,String(e).slice(0,200));}
      }
    }
    await page.close();
  }
}finally{await browser.close();killServer();}
await writeFile(join(output,'captures.json'),JSON.stringify({sha,method:'headless Chromium (SwiftShader) on the review harness; look poses via __harbour.world.views + shot(); themes via setTheme. SwiftShader, not device evidence.',date:DATE,viewport:VIEW,records,errors,seconds:Math.round((Date.now()-started)/1000)},null,1)+'\n');
log('done',records.length,'captures','errors',errors.length);
process.exit(0);
