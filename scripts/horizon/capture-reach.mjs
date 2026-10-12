// The Water's Way, PR 3 — the Reach and the Greenway (STORY place 3): evidence captures on the review harness.
// Headless Chromium (SwiftShader) — NOT device evidence. Starts its own vite dev server (unless --url) and kills it at the end.
//   node scripts/horizon/capture-reach.mjs --out docs/horizon/evidence/waters-way-reach --port 5182
// Options: --out <dir> · --port <n> · --url <origin> · --only <comma list of label substrings> · --tier full|lite|both
// Poses are the prototype's (protos/reach SPEC §1–§4) on the baked world: page I on the boardwalk's north end, the lookouts'
// poses from their frames, the Greenway's places from its baked centreline (`structure.greenway`), two aerials. JPEG output.
import {chromium} from '@playwright/test';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import sharp from 'sharp';

const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:fallback;};
const output=resolve(opt('out','docs/horizon/evidence/waters-way-reach')),port=Number(opt('port','5182')),only=opt('only')?.split(',').filter(Boolean)??null,tiers=opt('tier','both');
const DATE='2026-06-21',VIEW={width:960,height:600},QUALITY=Number(opt('quality','62'));
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
  // One fresh page per tier × dressing (the theme from the URL, as the app mounts it; a live setTheme swap is not trusted).
  for(const tier of tiers==='both'?['full','lite']:[tiers])for(const theme0 of (opt('themes','classic,taylor,newfoundland')).split(',')){
    const page=await browser.newPage({viewport:VIEW,timezoneId:'America/Toronto',deviceScaleFactor:1});
    page.setDefaultTimeout(600000);
    page.on('pageerror',e=>errors.push({tier,message:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({tier,message:m.text().slice(0,300)});});
    await page.goto(`${origin}/horizon-review.html?world=horizon&tier=${tier}&theme=${theme0}&date=${DATE}&sun=${MORNING}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:400000});
    await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls,.horizon-inspector,.horizon-top-controls,.horizon-fleet,.horizon-sheet,.horizon-offer,.horizon-jump,.horizon-pad,.horizon-glider-hint,.horizon-airport,.horizon-bubble-lift{visibility:hidden!important}'});
    log(tier,theme0,'first interactive');
    // The Greenway's baked line (the runtime's beds) for its places' poses.
    const gw=await page.evaluate(()=>window.__harbour.world.beds.find(b=>b.id==='structure.greenway')?.points??null);
    const S=[0];for(let i=1;i<gw.length;i++)S.push(S[i-1]+Math.hypot(gw[i][0]-gw[i-1][0],gw[i][2]-gw[i-1][2]));
    const at=s=>{let i=1;while(i<gw.length-1&&S[i]<s)i++;const a=gw[i-1],b=gw[i],t=(s-S[i-1])/((S[i]-S[i-1])||1),dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1;
      return{p:[a[0]+dx*t,a[1]+(b[1]-a[1])*t,a[2]+dz*t],f:[dx/l,dz/l],r:[-dz/l,dx/l]};};
    const W=(s,off,dy)=>{const q=at(s);return[q.p[0]+q.r[0]*off,q.p[1]+dy,q.p[2]+q.r[1]*off];};
    const sNear=(x,z)=>{let b=0,d=Infinity;for(let s=0;s<S.at(-1);s+=1){const q=at(s).p,e=Math.hypot(q[0]-x,q[2]-z);if(e<d){d=e;b=s;}}return b;};
    // Poses: `times` (each shot at every listed hour), `themes` ('all' or classic only), `lite` (also shot on lite).
    const ALL='all',SB=frame([1246.4,1199.5],[1268.6,1204]),HS=frame([1268,1145],[1290,1250]);
    const poses=[
      // the Sketchbook pages: page I (the baked view, moved to the boardwalk's north end) and Notch Bluff
      {label:'pageI',view:'I',times:[MORNING,NIGHT],themes:ALL,lite:true,note:'page I: the boardwalk\'s north end, reeds at hand height, the spring\'s source rock (night: the High Span\'s lights)'},
      {label:'notchBluff',times:[GOLD,NIGHT],themes:ALL,lite:true,eye:N.W(2.7,2.2,25.2),target:N.ahead(120,5),fov:62,note:'Notch Bluff (new page): the marsh, the osprey pole, the river mouth'},
      // the porch: Spring Bay on the boardwalk (the viewers, the heron, the campanile beyond)
      {label:'porch-springBay',times:[MORNING],themes:ALL,lite:true,eye:SB.W(-1.6,-1.1,6.0),target:SB.ahead(40,5.4),fov:60,note:'the porch: Spring Bay, its viewers, the heron\'s pool'},
      // signature poses
      {label:'greenway-deck',times:['10:30',NIGHT],themes:ALL,lite:true,eye:W(150,-1.4,1.7),target:W(195,-1.0,1.2),fov:58,note:'the Greenway at s 150: reeds at hand height, the island lanterns'},
      {label:'greenway-bluffEnd',times:[GOLD],themes:ALL,lite:true,eye:[869.5,22.5,694.5],target:[540,8,1195],fov:62,note:'Bluff End: the pavilion, wind-bent pines, the Lamp across the Bight'},
      {label:'channelHide-dawn',times:[DAWN],themes:'classic',lite:true,eye:[1252.6,6.7,1237.5],target:[1244,3.6,1262],fov:62,note:'the Channel Hide at dawn from the boardwalk: the blind on its piles, the west channel beyond'},
      {label:'sunsetRail-golden',times:[GOLD],themes:'classic',eye:SR.W(2.7,2.2,12.8),target:SR.ahead(130,2.5),fov:62,note:'Sunset Rail: the marsh into the sunset, the High Span'},
      {label:'harbourBell-dusk',times:['20:50'],themes:'classic',eye:HB.W(0,-1.3,11.3),target:HB.ahead(200,4),fov:58,note:'Harbour Bell Landing at dusk'},
      {label:'greenway-reedMaze',times:[GOLD],themes:'classic',eye:[1101,30,1329],target:[1088,7.9,1353],fov:58,note:'the Reed Maze and the Dune Overlook from above'},
      {label:'greenway-marshHide',times:[MORNING],themes:'classic',eye:W(392,-1.6,1.7),target:W(418,-12,0.5),fov:60,note:'the Marsh Hide and its pool'},
      {label:'greenway-bight-rafts',times:[AFTERNOON],themes:'classic',eye:W(sNear(647.8,1093.7)+16,0,11),target:[652,0.2,1103],fov:64,note:'over the Bight: the floating reed rafts tethered to the bents'},
      {label:'night-boardwalk',times:[NIGHT],themes:'classic',eye:[1247.5,5.98,1218],target:[1258,6,1262],fov:58,note:'night: the boardwalk lanterns down the deck'},
      // the lookouts' binocular views (the zoom cut: the viewer's eye, fov 3–9)
      {label:'binoc-notchBluff-osprey',times:[GOLD],themes:'classic',eye:N.W(-0.7,2.25,24.8),target:[1292,14.5,1268],fov:8,note:'through the Notch Bluff viewer: the osprey on its pole'},
      {label:'binoc-highSpan-osprey',times:[MORNING],themes:'classic',eye:HS.W(-0.7,2.2,11.3),target:[1292,16.4,1268],fov:7,note:'through the High Span Overlook viewer: the osprey from above'},
      {label:'binoc-springBay-heron',times:[MORNING],themes:'classic',eye:[1248.42,6.3,1200.62],target:[1268.6,5.2,1204],fov:6.5,note:'through the Spring Bay viewer: the heron'},
      {label:'binoc-sunsetRail-span',times:[GOLD],themes:'classic',eye:SR.W(-0.7,2.25,12.39),target:[1240,27,1104],fov:7.5,note:'through the Sunset Rail viewer: the High Span against the sunset'},
      {label:'binoc-harbourBell-lamp',times:['21:05'],themes:'classic',eye:[1323.53,10.3,1380.94],target:[540,20,1195],fov:3.2,note:'through the Harbour Bell viewer: the Lamp at dusk'},
      {label:'binoc-channelHide-lodge',times:[DAWN],themes:'classic',eye:[1250.58,5.98,1254.3],target:[1236,2.6,1292],fov:14,note:'the Channel Hide\'s slot: the muskrat lodge'},
      // aerials
      {label:'aerial-reach',times:[MORNING],themes:ALL,lite:true,eye:[1440,175,1450],target:[1262,6,1235],fov:50,note:'aerial: the Reach from the south-east'},
      {label:'aerial-greenway',times:['11:00'],themes:'classic',lite:true,eye:[1230,330,1560],target:[985,0,1150],fov:52,note:'aerial: the Greenway from the Reach Gate to the bluff'},
    ];
    const wanted=p=>(!only||only.some(o=>p.label.includes(o)))&&(tier==='full'||p.lite);
    // settle, then wait out the dressing layer's lazy per-district build (as capture-sands.mjs), then settle again
    const settle=async()=>{await page.evaluate(()=>window.__harbour.settle(300000));
      for(let i=0;i<90;i++){const b=await page.evaluate(()=>window.__harbour.dressingRenderStatus?.().building??false);if(!b)break;await page.waitForTimeout(1000);}
      const r=await page.evaluate(()=>window.__harbour.settle(300000));await page.waitForTimeout(3000);return r;};
    const setTime=async hhmm=>page.evaluate(({hhmm,DATE})=>{const [H,M]=hhmm.split(':').map(Number);const d=new Date(`${DATE}T12:00:00-04:00`);d.setHours(H,M,0,0);window.__harbour.setDate(d);},{hhmm,DATE});
    for(const theme of [theme0]){
      for(const p of poses.filter(wanted)){
        if(theme!=='classic'&&p.themes!=='all')continue;
        for(const time of p.times){
          if(tier==='lite'&&p.times.length>1&&time===NIGHT&&theme!=='classic'&&p.label!=='pageI')continue;
          try{
            if(p.view)await page.evaluate(id=>window.__harbour.shot(id),p.view);
            else await page.evaluate(({p})=>{const w=window.__harbour,views=w.world.views,v={id:'REACH_'+p.label,label:p.note,eye:p.eye,target:p.target,fovDegrees:p.fov,aspect:1,radius:260,portrait:null},i=views.findIndex(x=>x.id===v.id);if(i>=0)views[i]=v;else views.push(v);w.shot(v.id);},{p});
            await setTime(time);const settled=await settle();
            const file=`${p.label}_${theme}_${tier}_${time.replace(':','-')}.jpg`,png=await page.locator('.horizon-stage canvas').screenshot({timeout:180000});
            await sharp(png).jpeg({quality:QUALITY,mozjpeg:true}).toFile(join(output,file));
            const stats=await page.evaluate(()=>{const s=window.__harbour.stats(),d=s.drawSamples.at(-1)??null;return{drawCalls:d?.calls??null,triangles:d?.triangles??null};});
            records.push({file,label:p.label,theme,tier,time,view:p.view??null,eye:p.eye??null,target:p.target??null,fov:p.fov??null,note:p.note,settle:settled?.pending??null,stats});log(file,'draw',stats.drawCalls,'tri',stats.triangles);
          }catch(e){errors.push({tier,theme,label:p.label,time,message:String(e).slice(0,300)});log('FAILED',p.label,theme,time,String(e).slice(0,200));}
        }
      }
    }
    await page.close();
  }
}finally{await browser.close();killServer();}
await writeFile(join(output,'captures.json'),JSON.stringify({sha,method:'headless Chromium (SwiftShader) on the review harness; look poses via __harbour.world.views + shot(); themes via setTheme. SwiftShader, not device evidence.',date:DATE,viewport:VIEW,records,errors,seconds:Math.round((Date.now()-started)/1000)},null,1)+'\n');
log('done',records.length,'captures','errors',errors.length);
process.exit(0);
