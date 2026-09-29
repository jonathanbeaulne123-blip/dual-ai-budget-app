// Main-road evidence: driver-height views along Horizon Drive (roads.V01) plus the Mountain Road (V03) and the Green
// Road (VG), night views, real ride captures in the three cameras with both cruiser skins, and two aerials. Reusable for
// the BEFORE and AFTER picture of the main-road pass. Headless SwiftShader on the review harness; not device evidence
// (CONTRACT §2.21). Starts its own vite dev server (unless --url is given) and kills it at the end.
//   node scripts/horizon/capture-road.mjs --set before --out docs/horizon/evidence/road/before
// Options: --set <label> (file prefix, default 'before') · --out <dir> · --port <n> (default 5197) · --url <origin>
//          (use a running server) · --only <comma list of label substrings> · --no-compress
// Poses are computed from the baked centrelines the runtime itself reads (`__harbour.world.beds`): an eye on the bed
// centreline, +2 m into the right-hand lane, 1.9 m over the surface the runtime reports there (the cruiser rider's eye),
// looking 40 m ahead along the road. Stations are arc lengths along the bed points (V01 is a closed loop; it wraps).
import {chromium} from '@playwright/test';
import {mkdir,writeFile,readdir,stat,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';

const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:fallback;},flag=name=>args.includes(`--${name}`);
const set=opt('set','before'),output=resolve(opt('out',`docs/horizon/evidence/road/${set}`)),port=Number(opt('port','5197'));
const only=opt('only')?.split(',').filter(Boolean)??null,compress=!flag('no-compress');
const DATE='2026-06-21',DAY='13:00',NIGHT='22:30',VIEW={width:1280,height:800};
const EYE_HEIGHT=1.9,LANE=2,AHEAD=40,FOV_V=58;   // rider eye over the surface; right-lane offset; look-ahead; vertical FOV (CRUISER camera 58)
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim().length>0;
await mkdir(output,{recursive:true});
const started=Date.now(),log=(...m)=>console.log(`[${((Date.now()-started)/1000).toFixed(0).padStart(5)}s]`,...m);

// ---- The dev server ----
let server=null,origin=opt('url');
if(!origin){
  origin=`http://127.0.0.1:${port}`;
  server=spawn('pnpm',['exec','vite','--host','127.0.0.1','--port',String(port),'--strictPort'],{detached:true,stdio:['ignore','pipe','pipe']});
  let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
  const until=Date.now()+120000;let up=false;
  while(Date.now()<until&&!up){try{const r=await fetch(`${origin}/horizon-review.html`);up=r.ok;}catch{}if(!up)await new Promise(r=>setTimeout(r,1000));}
  if(!up){console.error(serverLog);killServer();throw new Error('vite did not start');}
  log('vite up at',origin);
}
function killServer(){if(server&&server.exitCode===null){try{process.kill(-server.pid,'SIGTERM');}catch{}}}
process.on('exit',killServer);process.on('SIGINT',()=>{killServer();process.exit(130);});

// ---- Geometry helpers (Horizon space: x east, y up, z south; right of heading (dx,dz) is (-dz,dx)) ----
function route(points,closed){
  const S=[0];for(let i=1;i<points.length;i++)S.push(S[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]));
  const L=S.at(-1);
  const at=(s)=>{if(closed)s=((s%L)+L)%L;else s=Math.max(0,Math.min(L,s));let lo=0,hi=S.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(S[m]<=s)lo=m;else hi=m;}
    const a=points[lo],b=points[hi],t=S[hi]>S[lo]?(s-S[lo])/(S[hi]-S[lo]):0;return{p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],index:lo,s};};
  const nearest=(x,z)=>{let bi=0,bd=Infinity;points.forEach((p,i)=>{const d=Math.hypot(p[0]-x,p[2]-z);if(d<bd){bd=d;bi=i;}});return{index:bi,s:S[bi],distance:bd};};
  return{L,S,at,nearest,closed};
}
/** A driver pose at arc length s, travelling dir (+1 along the bed's point order, -1 against it). */
function driverPose(r,s,dir){
  const c=r.at(s),back=r.at(s-dir*2),front=r.at(s+dir*2);let dx=front.p[0]-back.p[0],dz=front.p[2]-back.p[2];const n=Math.hypot(dx,dz)||1;dx/=n;dz/=n;
  const rx=-dz,rz=dx,t=r.at(s+dir*AHEAD);
  // Target lane offset uses the heading at the target so the gaze stays in the lane through a bend.
  const tb=r.at(s+dir*(AHEAD-2)),tf=r.at(s+dir*(AHEAD+2));let tx=tf.p[0]-tb.p[0],tz=tf.p[2]-tb.p[2];const tn=Math.hypot(tx,tz)||1;tx/=tn;tz/=tn;
  return{index:c.index,s:+s.toFixed(1),dir,bedEye:[c.p[0]+rx*LANE,c.p[1],c.p[2]+rz*LANE],bedTarget:[t.p[0]-tz*LANE,t.p[1],t.p[2]+tx*LANE],heading:Math.atan2(dx,dz)};
}

const browser=await chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[],errors=[];let bedInfo=null,seq=0,worldExtent=null;
try{
  const page=await browser.newPage({viewport:VIEW,timezoneId:'America/Toronto',deviceScaleFactor:1});
  page.setDefaultTimeout(600000);
  let errorMark=0;
  page.on('pageerror',e=>errors.push({at:seq,message:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({at:seq,message:m.text().slice(0,400)});});
  page.on('response',r=>{if(r.status()>=400)errors.push({at:seq,message:`HTTP ${r.status()} ${r.url().replace(origin,'')}`});});
  const pageUrl=`${origin}/horizon-review.html?world=horizon&tier=full&date=${DATE}&sun=${DAY}`;
  await page.goto(pageUrl,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__harbour&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:300000});
  log('first interactive');
  await page.addStyleTag({content:'.horizon-toolbar,.horizon-status,.horizon-touch-controls,.horizon-cruiser-controls{visibility:hidden!important}'});
  // Every district's solids fetched before any pose (settle() is synchronous and cannot wait for a fetch).
  await page.waitForFunction(()=>{const c=window.__harbour.stats().chunks;return !c||c.resident.length>=0&&window.__harbour.stats().chunksLoaded?.length===c.total;},null,{timeout:600000}).catch(e=>errors.push({at:'chunks',message:String(e).slice(0,200)}));
  log('chunks loaded',await page.evaluate(()=>window.__harbour.stats().chunksLoaded?.length));

  // ---- The beds, as the runtime reads them ----
  bedInfo=await page.evaluate(()=>{const w=window.__harbour.world;return{extent:w.extent,beds:Object.fromEntries(['V01','V03','VG'].map(id=>{const b=w.beds.find(b=>b.id===id);return[id,b?{id:b.id,kind:b.kind,profile:b.profile,surface:b.surface,width:b.width,structureIds:[...new Set(b.structureIds)],districtIds:b.districtIds,points:b.points}:null];}))};});
  worldExtent=bedInfo.extent;
  const R={};for(const [id,b] of Object.entries(bedInfo.beds)){if(!b)throw new Error(`bed ${id} missing`);const p=b.points,closed=Math.hypot(p[0][0]-p.at(-1)[0],p[0][2]-p.at(-1)[2])<.5;R[id]=route(p,closed);log(id,b.kind,'width',b.width,'points',p.length,'length',R[id].L.toFixed(0),closed?'closed':'open');}
  const V=R.V01,sOf=(x,z)=>V.nearest(x,z).s;
  const quay=sOf(1350,1345),bightW=sOf(460,1030),bightE=sOf(660,1170),prow=sOf(1592,890),v03=sOf(1599.5,790.8),ne=sOf(1433,335);
  const town=sOf(1365,1141),coast=sOf(1053,1395);
  // ---- The pose list ----
  const drive=[
    {label:'green-road-junction-approach',route:'V01',s:V.L-55,dir:1,night:true,note:'V01 closing its loop into the Green Road junction [1400,1060]'},
    {label:'harbour-east',route:'V01',s:130,dir:1,note:'even station: the harbour side heading east then north'},
    {label:'prow-gallery-approach',route:'V01',s:prow-75,dir:1,night:true,note:'approaching the Prow gallery (prowTunnel, 90 m) from the south'},
    {label:'prow-gallery-inside',route:'V01',s:prow-5,dir:1,note:'inside the Prow gallery: the colonnade open to the sea'},
    {label:'v03-junction',route:'V01',s:v03-45,dir:1,note:'V01 approaching the Mountain Road (V03) junction [1599.5,790.8]'},
    {label:'prow-north-climb',route:'V01',s:650,dir:1,note:'even station: the climb north along the Prow'},
    {label:'ne-cliff-corner',route:'V01',s:ne-35,dir:1,note:'the NE cliff corner [1433,335]'},
    {label:'north-ridge',route:'V01',s:1130,dir:1,note:'even station: the high north ridge (crown / scholars)'},
    {label:'north-west',route:'V01',s:1640,dir:1,note:'even station: the long north-west run'},
    {label:'west-coast',route:'V01',s:2150,dir:1,note:'coastal stretch: the west coast heading south'},
    {label:'west-descent',route:'V01',s:2420,dir:1,note:'even station: descending to the Bight'},
    {label:'bight-bridge-west-approach',route:'V01',s:bightW-40,dir:1,night:true,note:'approaching the Bight Bridge west end [460,1030]'},
    {label:'bight-bridge-deck',route:'V01',s:(bightW+bightE)/2,dir:1,note:'on the Bight Bridge deck'},
    {label:'bight-bridge-east-approach',route:'V01',s:bightE+40,dir:-1,note:'approaching the Bight Bridge east end [660,1170] against point order'},
    {label:'south-coast',route:'V01',s:coast,dir:1,note:'coastal stretch: the south shore near sea level'},
    {label:'quay-bridge-approach',route:'V01',s:quay-75,dir:1,night:true,note:'approaching the Quay Bridge [1350,1345] (90 m, h 9)'},
    {label:'town-stretch',route:'V01',s:town,dir:1,night:true,note:'town stretch past the bank and home (harbour)'},
    {label:'v03-mountain-road-start',route:'V03',s:30,dir:1,note:'V03 Mountain Road leaving V01 westward'},
    {label:'v03-tunnel-approach',route:'V03',s:R.V03.nearest(1478,790).s-45,dir:1,note:'V03 approaching its 73 m tunnel'},
    {label:'v03-canal-bridge',route:'V03',s:R.V03.nearest(1300,748).s-40,dir:1,note:'V03 into the canal bridge and the Mountain v2 town lane'},
    {label:'vg-green-road-start',route:'VG',s:25,dir:1,note:'VG Green Road leaving the junction westward'},
    {label:'vg-high-span-approach',route:'VG',s:R.VG.nearest(1295,1101).s-45,dir:1,note:'VG approaching the High Span'},
    {label:'vg-north',route:'VG',s:780,dir:1,note:'VG crossing the island northward'},
  ];
  const wanted=p=>!only||only.some(o=>p.label.includes(o));
  const settle=async()=>{const r=await page.evaluate(()=>window.__harbour.settle(300000));await page.waitForTimeout(4000);return r;};
  const setTime=async hhmm=>page.evaluate(({hhmm,DATE})=>{const [H,M]=hhmm.split(':').map(Number);const d=new Date(`${DATE}T12:00:00-04:00`);d.setHours(H,M,0,0);window.__harbour.setDate(d);},{hhmm,DATE});
  const statsNow=async()=>page.evaluate(()=>{const s=window.__harbour.stats(),d=s.drawSamples.at(-1)??null,f=s.frames.slice(-8).sort((a,b)=>a-b);return{drawCalls:d?.calls??null,triangles:d?.triangles??null,resident:d?.resident??null,frameMsMedian:f.length?+f[f.length>>1].toFixed(1):null,lightCards:s.lightCards,residentDistricts:s.chunks?.resident??null,streamPending:s.stream.at(-1)?.pending??[],camera:s.camera,mode:s.mode,shot:s.shot};});
  const shoot=async(label,hhmm)=>{const file=`${set}_${String(++seq).padStart(2,'0')}_${label}_${hhmm.replace(':','-')}.png`;
    try{await page.locator('.horizon-stage canvas').screenshot({path:join(output,file),timeout:180000});}catch(e){errors.push({at:file,message:'screenshot: '+String(e).slice(0,300)});return{file,failed:true};}
    return{file};};
  const newErrors=()=>{const e=errors.slice(errorMark);errorMark=errors.length;return e;};
  /** Place a look pose (the runtime's own `lookAt` via world.views), vertical FOV = FOV_V. */
  const pose=async(p)=>page.evaluate(({p,FOV_V})=>{const w=window.__harbour,views=w.world.views,i=views.findIndex(v=>v.id===p.id);
    const v={id:p.id,label:p.label,eye:p.eye,target:p.target,fovDegrees:FOV_V,aspect:1,radius:p.radius??220,portrait:null};if(i>=0)views[i]=v;else views.push(v);return w.shot(p.id);},{p,FOV_V});
  const surfaceAt=async(x,z,y)=>page.evaluate(({x,z,y})=>{const g=window.__harbour.geography,h=g.surface(x,z,y+1,2.5);return h?{y:h.y,id:h.id??null}:{y:null,ground:g.ground(x,z)};},{x,z,y});
  async function capturePose(d,hhmm,{reuse}={}){
    const r=R[d.route],dp=driverPose(r,d.s,d.dir);
    let eye=[dp.bedEye[0],dp.bedEye[1]+EYE_HEIGHT,dp.bedEye[2]],target=[dp.bedTarget[0],dp.bedTarget[1]+EYE_HEIGHT,dp.bedTarget[2]],source='bed';
    const id=`ROAD_${d.label}`;
    await pose({id,label:d.note,eye,target});await setTime(hhmm);const settled=await settle();
    // Re-seat on the surface the runtime reports (deck, bridge or terrain) now that the district's solids are live.
    const se=await surfaceAt(dp.bedEye[0],dp.bedEye[2],dp.bedEye[1]),st=await surfaceAt(dp.bedTarget[0],dp.bedTarget[2],dp.bedTarget[1]);
    if(se.y!==null){eye=[eye[0],se.y+EYE_HEIGHT,eye[2]];source='surface';}
    if(st.y!==null)target=[target[0],st.y+EYE_HEIGHT,target[2]];
    await pose({id,label:d.note,eye,target});await setTime(hhmm);const settled2=await settle();
    const shot=await shoot(d.label,hhmm);const stats=await statsNow();
    const rec={...shot,kind:'driver',route:d.route,label:d.label,note:d.note,time:hhmm,date:DATE,perspective:'look pose (driver eye)',station:{s:dp.s,index:dp.index,dir:dp.dir,length:+r.L.toFixed(1)},
      eye:eye.map(v=>+v.toFixed(2)),target:target.map(v=>+v.toFixed(2)),verticalFovDegrees:FOV_V,eyeSource:source,surfaceUnderEye:se,surfaceUnderTarget:st,bedY:+dp.bedEye[1].toFixed(2),
      settle:{pendingFirst:settled.pending,pendingFinal:settled2.pending,region:settled2.region},stats,errors:newErrors()};
    records.push(rec);log(rec.file,'eye',rec.eye.join(','),'draw',stats.drawCalls,'tri',stats.triangles,'ms',stats.frameMsMedian,rec.errors.length?`errors ${rec.errors.length}`:'');
    return rec;
  }
  // 1. Day, driver height.
  for(const d of drive.filter(wanted)){try{await capturePose(d,DAY);}catch(e){errors.push({at:d.label,message:String(e).slice(0,400)});log('FAILED',d.label,String(e).slice(0,200));}}
  // 2. Night, the most important poses.
  for(const d of drive.filter(d=>d.night&&wanted(d))){try{await capturePose({...d,label:`${d.label}-night`},NIGHT);}catch(e){errors.push({at:d.label+'-night',message:String(e).slice(0,400)});log('FAILED',d.label,String(e).slice(0,200));}}
  // 3. Riding: mount at the Green Road junction on V01, drive along the loop with the real controller, then capture the
  //    activity, first-person and floating cameras (Vespa, then Harley).
  if(!only||only.some(o=>'ride'.includes(o)||o==='ride')){
    try{
      await setTime(DAY);
      const start=V.at(0).p,next=V.at(8).p,yaw=Math.atan2(next[0]-start[0],next[2]-start[2]);
      await page.evaluate(({start,yaw})=>{const h=window.__harbour;h.setCruiserSkin('vespa');h.restore({world:'horizon:horizon-geo-1',geo:h.world.geographyRevision,place:'court',x:start[0],y:start[1],z:start[2],yaw});},{start,yaw});
      await settle();
      let mounted=false;for(let i=0;i<30&&!mounted;i++){mounted=await page.evaluate(()=>!!(window.__harbour.cruiserState()||window.__harbour.toggleCruiser()));if(!mounted)await page.waitForTimeout(1000);}
      if(!mounted)throw new Error('cruiser did not mount at '+start.join(','));
      await page.waitForTimeout(1500);
      const drove=await page.evaluate(({points})=>{const h=window.__harbour;let index=1,travel=0,maxSpeed=0,contacts=0,last=h.cruiserState();const t0=last;
        for(let i=0;i<60;i++){const s=h.cruiserState();if(!s)return{error:'lost cruiser'};while(index<points.length-1&&Math.hypot(points[index][0]-s.x,points[index][2]-s.z)<8)index++;
          const to=points[index],err=Math.atan2(Math.sin(Math.atan2(to[0]-s.x,to[2]-s.z)-s.yaw),Math.cos(Math.atan2(to[0]-s.x,to[2]-s.z)-s.yaw));
          h.input({forward:.8,strafe:Math.max(-1,Math.min(1,-err*1.8))});h.simulateMotion(.1);const n=h.cruiserState();travel+=Math.hypot(n.x-last.x,n.z-last.z);maxSpeed=Math.max(maxSpeed,Math.hypot(n.vx,n.vz));if(n.contact)contacts++;last=n;}
        for(let i=0;i<60&&Math.hypot(last.vx,last.vz)>.05;i++){h.input({forward:-1,strafe:0});h.simulateMotion(.1);last=h.cruiserState();}
        h.input({forward:0,strafe:0});return{start:{x:t0.x,y:t0.y,z:t0.z,yaw:t0.yaw},end:last,travel,maxSpeed,contacts,drivenSeconds:6,pointIndex:index};},{points:bedInfo.beds.V01.points.slice(0,200)});
      log('drove',JSON.stringify({travel:drove.travel,maxSpeed:drove.maxSpeed,contacts:drove.contacts,end:drove.end&&[drove.end.x,drove.end.y,drove.end.z]}));
      const rideShot=async(label,skin)=>{await page.evaluate(skin=>window.__harbour.setCruiserSkin(skin),skin);await settle();await page.waitForTimeout(3000);
        const shot=await shoot(label,DAY);const stats=await statsNow();const st=await page.evaluate(()=>({cruiser:window.__harbour.cruiserState(),mover:window.__harbour.moverState()}));
        const rec={...shot,kind:'ride',route:'V01',label,time:DAY,date:DATE,skin,perspective:st.mover.perspective,eye:stats.camera.eye.map(v=>+v.toFixed(2)),target:stats.camera.target.map(v=>+v.toFixed(2)),verticalFovDegrees:stats.camera.fov,cruiser:st.cruiser,drive:drove,stats,errors:newErrors()};
        records.push(rec);log(rec.file,rec.perspective,'draw',stats.drawCalls,'tri',stats.triangles);};
      await rideShot('ride-activity-vespa','vespa');
      await page.evaluate(()=>window.__harbour.cyclePerspective());await rideShot('ride-first-person-vespa','vespa');
      await page.evaluate(()=>window.__harbour.cyclePerspective());await rideShot('ride-floating-harley','harley');
      await page.evaluate(()=>window.__harbour.cyclePerspective());await rideShot('ride-activity-harley','harley');
      await page.evaluate(()=>{const h=window.__harbour;if(h.cruiserState())h.toggleCruiser();});
    }catch(e){errors.push({at:'ride',message:String(e).slice(0,400)});log('FAILED ride',String(e).slice(0,300));}
  }
  // 4. Aerials: the whole loop, and an oblique of the NE Prow cliff drive.
  const W=worldExtent;
  const aerials=[
    {label:'overview-whole-loop',eye:[W.w/2,1400,1900],target:[W.w/2,0,820],fov:36,radius:900,note:'the whole island from high over the south sea (V01 loop, V03, VG)'},
    {label:'aerial-ne-prow-cliff-drive',eye:[1860,230,760],target:[1500,55,520],fov:50,radius:420,note:'oblique aerial of the NE Prow cliff drive from offshore east'},
  ];
  for(const a of aerials.filter(wanted)){
    try{
      await page.evaluate(({a})=>{const w=window.__harbour,views=w.world.views,v={id:'ROAD_'+a.label,label:a.note,eye:a.eye,target:a.target,fovDegrees:a.fov,aspect:1,radius:a.radius,portrait:null},i=views.findIndex(x=>x.id===v.id);if(i>=0)views[i]=v;else views.push(v);w.shot(v.id);},{a});
      await setTime(DAY);const settled=await settle();const shot=await shoot(a.label,DAY);const stats=await statsNow();
      records.push({...shot,kind:'aerial',label:a.label,note:a.note,time:DAY,date:DATE,perspective:'look pose (aerial)',eye:a.eye,target:a.target,verticalFovDegrees:a.fov,settle:settled,stats,errors:newErrors()});log(shot.file,'draw',stats.drawCalls);
    }catch(e){errors.push({at:a.label,message:String(e).slice(0,400)});}
  }
  await page.close();
}finally{await browser.close();killServer();}

// ---- Size: palette-quantise PNGs when the set exceeds 25 MB ----
let files=(await readdir(output)).filter(f=>f.endsWith('.png')&&f.startsWith(`${set}_`)),bytes=0;
for(const f of files)bytes+=(await stat(join(output,f))).size;
let compressed=false;
if(compress&&bytes>25*1024*1024){
  const sharp=(await import('sharp')).default;bytes=0;
  for(const f of files){const p=join(output,f),buf=await readFile(p),out=await sharp(buf).png({palette:true,quality:90,effort:8,compressionLevel:9}).toBuffer();await writeFile(p,out);bytes+=out.length;}
  compressed=true;
}
const seconds=Math.round((Date.now()-started)/1000);
await writeFile(join(output,'captures.json'),JSON.stringify({set,sha,dirtyTree:dirty,url:`${origin}/horizon-review.html?world=horizon&tier=full&date=${DATE}&sun=${DAY}`,
  method:'headless Chromium (SwiftShader) on the review harness; look poses via __harbour.world.views + shot(); rides via restore + toggleCruiser + input/simulateMotion (the live controller and collision). Not device evidence.',
  command:`node scripts/horizon/capture-road.mjs ${process.argv.slice(2).join(' ')}`,viewport:VIEW,date:DATE,times:{day:DAY,night:NIGHT},
  driverEye:{heightOverSurface:EYE_HEIGHT,rightLaneOffset:LANE,lookAhead:AHEAD,verticalFovDegrees:FOV_V},
  beds:bedInfo&&Object.fromEntries(Object.entries(bedInfo.beds).map(([k,b])=>[k,b&&{id:b.id,kind:b.kind,profile:b.profile,surface:b.surface,width:b.width,structureIds:b.structureIds,districtIds:b.districtIds,pointCount:b.points.length}])),
  runSeconds:seconds,totalPngBytes:bytes,compressed,records,errors},null,1)+'\n');
log('done',records.length,'captures',(bytes/1048576).toFixed(1),'MB','errors',errors.length);
process.exit(0);
