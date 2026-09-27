// M6 acceptance rides, headless (FLIGHT.md §11). Usage: node docs/horizon/evidence/m6/scripts/rides.mjs <ride> [...]
// Needs `pnpm exec vite --host 127.0.0.1 --port 5199 --strictPort` running. Writes docs/horizon/evidence/m6/rides/<ride>/.
//
// Method (stated in RIDES.md): the page is the dev review harness (`/horizon-review.html?world=horizon`, no household).
// The threshold offer is taken by clicking its screen-space button; the run-off is real keyboard input (W held) through
// the runtime until the lip. The flight is then flown by `pilot.js` through the live controller's own `update(1/60, input)`
// with the runtime paused (SwiftShader renders ~1 frame/s, and the runtime caps a frame at 0.05 s of sim, so real time
// would be ~20× slower than the sim); every ~5 sim-seconds the runtime is un-paused with the same input for three
// rendered frames and a PNG is taken. Touchdown, the exit and the detach to feet are the runtime's own (un-paused).
import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..'),out=resolve(here,'../rides');
const BASE=process.env.HORIZON_URL??'http://127.0.0.1:5199';
const pilot=await readFile(resolve(here,'pilot.js'),'utf8');
const sha=execFileSync('git',['rev-parse','--short','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME??'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const VIEW={width:640,height:400};

async function open(query,{viewport=VIEW,reducedMotion,colorScheme}={}){
  const context=await browser.newContext({viewport,timezoneId:'America/Toronto',...(reducedMotion?{reducedMotion}:{}),...(colorScheme?{colorScheme}:{})});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`${BASE}/horizon-review.html?world=horizon${query}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__harbour?.stats&&window.__harbour.stats().firstInteractiveMs!==null,null,{timeout:240000});
  await page.addScriptTag({content:pilot});
  return{page,context,errors};
}
const frames=(page,n=3)=>page.evaluate(n=>new Promise(r=>{let k=0;const f=()=>{if(++k>=n)r();else requestAnimationFrame(f);};requestAnimationFrame(f);}),n);
async function standAt(page,thresholdId,yaw){
  await page.evaluate(([id,yaw])=>{const h=window.__harbour,t=h.world.thresholds.find(t=>t.id===id);h.setMode('walk');h.restore({world:'horizon:horizon-geo-1',geo:'horizon-geo-1',place:'court',x:t.at[0],y:t.height??h.geography.ground(t.at[0],t.at[1]),z:t.at[1],yaw});},[thresholdId,yaw]);
  await page.waitForTimeout(1500);await frames(page,4);
}
async function takeOffer(page,label){
  const button=page.locator('.horizon-offer',{hasText:label}).first();await button.waitFor({timeout:120000});
  const offers=await page.locator('.horizon-offer').allTextContents();await button.click({timeout:180000});return offers;
}
async function runOff(page){
  // W held through the runtime's keyboard handler until the lip (phase 'flight'); stage has focus after the accept.
  await page.locator('.horizon-stage').focus();await page.keyboard.down('w');
  const t0=Date.now();
  await page.waitForFunction(()=>window.__horizonFlight?.phase()==='flight'||window.__horizonFlight?.phase()==='flare',null,{timeout:300000,polling:100});
  await page.keyboard.up('w');await page.evaluate(()=>window.__harbour.pause(true));
  return{realMs:Date.now()-t0,at:await page.evaluate(()=>window.__horizonFlight.probe())};
}
async function capture(page,dir,name){
  await page.evaluate(()=>{const i=window.__m6.input();window.__harbour.pause(false);window.__harbour.input({bar:i.bar,bank:i.bank,forward:0,strafe:0});});
  await frames(page,3);
  await page.screenshot({path:resolve(dir,name)});
  await page.evaluate(()=>window.__harbour.pause(true));
}
async function fly(page,dir,kind,legs,{maxSeconds=600,every=5,onChunk}={}){
  await page.evaluate(([k,l])=>window.__m6.start(k,l),[kind,legs]);
  const pngs=[];let t=0,last=null;
  for(;;){
    const r=await page.evaluate(s=>window.__m6.run(s),every);last=r.last;t=r.last.t;
    if(r.paused&&onChunk){await onChunk(r);if(await page.evaluate(()=>!window.__harbour.moverState().attached))break;continue;}
    if(r.done)break;
    const name=`t${String(Math.round(t)).padStart(3,'0')}.png`;await capture(page,dir,name);pngs.push(name);
    if(t>maxSeconds)break;
  }
  // Let the runtime itself end the mode (exit → detach on foot), then read what it did.
  await page.evaluate(()=>window.__harbour.pause(false));
  await page.waitForFunction(()=>!window.__harbour.moverState().attached,null,{timeout:120000,polling:100}).catch(()=>{});
  await frames(page,2);
  const after=await page.evaluate(()=>({moverState:window.__harbour.moverState(),body:window.__harbour.body(),mode:window.__harbour.mode(),outcome:window.__horizonFlight?.outcome()}));
  await page.screenshot({path:resolve(dir,'after.png')});pngs.push('after.png');
  const log=await page.evaluate(()=>window.__m6.log()),events=await page.evaluate(()=>window.__m6.events());
  return{log,events,last,after,pngs};
}
async function save(name,data){const dir=resolve(out,name);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'steplog.json'),JSON.stringify({ride:name,sha,generated:new Date().toISOString(),...data},null,1));console.log(name,JSON.stringify({summary:data.summary},null,0));}
const dirFor=async name=>{const d=resolve(out,name);await mkdir(d,{recursive:true});return d;};

const G={green:[1040,1065],meadow:[1230,1190],sands:[1050,1440],strip:[435,690],lamp:[540,1195],throat:[1300,300],bightBridge:[560,1080]};
const summary=(r,extra={})=>({seconds:r.last.t,final:r.last,outcome:r.after.outcome?.kind??null,label:r.after.outcome?.label??r.after.moverState?.fade??null,bodyAfter:r.after.body,modeAfter:r.after.moverState?.mode,...extra});

async function gliderRide(name,query,threshold,yaw,offer,legs,opts={}){
  const dir=await dirFor(name),{page,context,errors}=await open(query,opts.open);
  await standAt(page,threshold,yaw);
  const offers=await takeOffer(page,offer);
  await page.screenshot({path:resolve(dir,'offer-taken.png')});
  const launch=await runOff(page);
  await capture(page,dir,'lip.png');
  const r=await fly(page,dir,'glider',legs,opts);
  const peak=r.log.reduce((m,x)=>x.y>m.y?x:m,r.log[0]??{y:0});
  await save(name,{query,threshold,yaw,offers,launch,legs,summary:summary(r,{peak:{t:peak.t,y:peak.y,x:peak.x,z:peak.z},...(opts.extra?opts.extra(r):{})}),events:r.events,log:r.log,pngs:['offer-taken.png','lip.png',...r.pngs],errors});
  await context.close();return r;
}

async function chuteRide(name,leg){
  const dir=await dirFor(name),{page,context,errors}=await open('&sun=11:00&bail=1040,1000,200');
  await page.evaluate(()=>window.__harbour.pause(true));
  const start=await page.evaluate(()=>({probe:window.__horizonFlight?.probe(),mover:window.__harbour.moverState()}));
  await capture(page,dir,'jump.png');
  const r=await fly(page,dir,'parachute',[leg],{every:5});
  const td=r.events.find(e=>/→ (touchdown|pose|done)/.test(e.event));
  await save(name,{query:'&sun=11:00&bail=1040,1000,200',leg,start,summary:summary(r,{touchdownEvent:td??null,distanceToTarget:+Math.hypot(r.last.x-G.green[0],r.last.z-G.green[1]).toFixed(2)}),events:r.events,log:r.log,pngs:['jump.png',...r.pngs],errors});
  await context.close();
}
const rides={
  // (1) Crown → the Lamp at trim. The Crown always runs off north (FLIGHT §2.1): turn west round the summit, then the Lamp.
  async crown_lamp_trim(){await gliderRide('crown_lamp_trim','&sun=11:00','crownLaunch',Math.PI,'Run off',[
    {kind:'heading',name:'clear the lip north',heading:Math.PI,seconds:3},
    {kind:'to',name:'round the summit (west)',to:[1180,380],within:25},
    {kind:'to',name:'the Lamp at trim',to:G.lamp,within:15,bar:0},
    {kind:'land',name:'land'}]);},
  // (1b) the same, crossing the Bight fast (bar half) — feel the sink.
  async crown_lamp_fast(){await gliderRide('crown_lamp_fast','&sun=11:00','crownLaunch',Math.PI,'Run off',[
    {kind:'heading',name:'clear the lip north',heading:Math.PI,seconds:3},
    {kind:'to',name:'round the summit (west)',to:[1180,380],within:25},
    {kind:'to',name:'toward the Bight',to:[760,880],within:30,bar:0},
    {kind:'to',name:'cross the Bight fast',to:G.lamp,within:15,bar:.5},
    {kind:'land',name:'land'}]);},
  // (2) Crown → ridge → the Throat. The ridge first (beat along the south face in the south wind), then north.
  async crown_ridge_throat(){await gliderRide('crown_ridge_throat','&sun=11:00','crownLaunch',Math.PI,'Run off',[
    {kind:'heading',name:'clear the lip north',heading:Math.PI,seconds:3},
    {kind:'to',name:'round the summit (west)',to:[1150,420],within:25},
    {kind:'to',name:'down the west side to the ridge',to:[1150,660],within:25},
    {kind:'beat',name:'work the ridge to 190 m',x:[1150,1470],z:660,untilY:190,maxSeconds:300},
    {kind:'to',name:'north past the Crown (west)',to:[1120,300],within:30},
    {kind:'to',name:'out over the north sea',to:[1300,150],within:25},
    {kind:'heading',name:'turn south onto the axis',heading:0,seconds:6,maxBank:45},
    {kind:'to',name:'straight in at the mouth',to:[1300,420],within:5,bar:0},
    {kind:'land',name:'land'}]);},
  // (3a) the Prow → the Prow thermal → Long Sands at 15:00.
  async prow_thermal_sands(){await gliderRide('prow_thermal_sands','&sun=15:00','prowPlatform',0,'Run off',[
    {kind:'to',name:'to the Prow thermal',to:[1610,850],within:25},
    {kind:'orbit',name:'circle the thermal',core:[1610,850],r:25,untilY:200,maxSeconds:200},
    {kind:'to',name:'glide to Long Sands',to:G.sands,within:30},
    {kind:'landOn',name:'spiral down onto the Sands',xy:G.sands,r:60}]);},
  // (3b) the Prow at 07:00 → the Reach meadow (thermal off; bend west of the knoll at [1450,872], HANDOFF-notes L1).
  async prow_meadow_direct(){await gliderRide('prow_meadow_direct','&sun=07:00','prowPlatform',0,'Run off',[
    {kind:'to',name:'the Reach meadow, straight (FLIGHT §0 row 2)',to:G.meadow,within:10},
    {kind:'landOn',name:'spiral down onto the meadow',xy:G.meadow,r:40}]);},
  async prow_meadow_0700(){await gliderRide('prow_meadow_0700','&sun=07:00','prowPlatform',0,'Run off',[
    {kind:'to',name:'south-west, west of the knoll',to:[1380,860],within:25},
    {kind:'to',name:'the Reach meadow',to:G.meadow,within:10},
    {kind:'land',name:'land'}]);},
  // (4) the Lamp Hop: gallery → under the Bight Bridge (gate 5, h 6) → the sandbar.
  async lamp_hop(){await gliderRide('lamp_hop','&sun=11:00','lampGallery',0,'Run off',[
    {kind:'heading',name:'off the gallery, south into the wind',heading:0,seconds:3},
    {kind:'heading',name:'turn back north',heading:Math.PI*.95,seconds:6,maxBank:45},
    {kind:'gate',name:'under the Bight Bridge (gate 5, centre h 6)',gate:G.bightBridge,h:6,within:4,aim:[582,1046],maxBank:30},
    {kind:'to',name:'through, toward the sandbar',to:[600,1030],within:10,bar:0},
    {kind:'land',name:'land'}]);},
  // (6) night: Crown → the strip's lamp rows at 02:00.
  async night_crown_strip(){await gliderRide('night_crown_strip','&sun=02:00','crownLaunch',Math.PI,'Run off',[
    {kind:'heading',name:'clear the lip north',heading:Math.PI,seconds:3},
    {kind:'to',name:'the strip',to:G.strip,within:40},
    {kind:'landOn',name:'spiral down onto the strip',xy:G.strip,r:30}]);},
  // (8) the Fold bubble from over the Flats: climb in the Flats thermal at 15:00 to 250 m, then press the Fold bubble (DOM click).
  async fold_flats(){
    const name='fold_flats',dir=await dirFor(name),{page,context,errors}=await open('&sun=15:00');
    await standAt(page,'crownLaunch',Math.PI);const offers=await takeOffer(page,'Run off');const launch=await runOff(page);
    let fold=null;
    const r=await fly(page,dir,'glider',[
      {kind:'heading',name:'clear the lip north',heading:Math.PI,seconds:3},
      {kind:'to',name:'west to the Flats thermal',to:[380,600],within:25},
      {kind:'orbit',name:'climb in the Flats thermal',core:[380,600],r:30,untilY:250,maxSeconds:400},
      {kind:'pause',name:'the Fold bubble'}],{every:10,onChunk:async()=>{
        await page.evaluate(()=>{window.__harbour.pause(false);window.__harbour.input({bar:0,bank:0,forward:0,strafe:0});});
        await frames(page,3);await page.waitForTimeout(400);await frames(page,2);
        const bubble=page.locator('button.horizon-bubble-place');
        const before={text:await bubble.textContent().catch(()=>null),aria:await bubble.getAttribute('aria-label').catch(()=>null),height:await page.locator('.horizon-bubble-height').textContent().catch(()=>null),probe:await page.evaluate(()=>window.__horizonFlight.probe())};
        await page.screenshot({path:resolve(dir,'fold-bubble.png')});
        await bubble.click({timeout:180000});
        await page.waitForFunction(()=>!window.__harbour.moverState().attached,null,{timeout:120000,polling:50});
        const fade=await page.evaluate(()=>window.__harbour.moverState());
        await page.screenshot({path:resolve(dir,'fold-fade-label.png')});
        fold={before,fade,body:await page.evaluate(()=>window.__harbour.body())};
      }});
    await save(name,{offers,launch,fold,summary:summary(r,{fold}),events:r.events,log:r.log,pngs:[...r.pngs,'fold-bubble.png','fold-fade-label.png'],errors});
    await context.close();
  },
  // (5) the parachute from the dev jump `&bail=1040,1000,200` over the Green in the south wind: a stand-up (half brakes into
  // the wind through the last 5 m) and a tumble (full brakes, the 4 m/s wind's ground speed).
  async chute_standup(){await chuteRide('chute_standup',{target:G.green,pullAtAgl:150,flareBrake:.5,flareHeading:0});},
  async chute_tumble(){await chuteRide('chute_tumble',{target:G.green,pullAtAgl:150,flareBrake:1,flareHeading:0});},
  async chute_autopull(){await chuteRide('chute_autopull',{target:G.green,flareBrake:1,flareHeading:0});},
  // (7) reduced motion: the Crown's launch offer becomes the sheet; choose the Green (a cut); and the bail sheet.
  async reduced_motion(){
    const name='reduced_motion',dir=await dirFor(name),{page,context,errors}=await open('',{reducedMotion:'reduce'});
    await standAt(page,'crownLaunch',Math.PI);
    const settings=await page.evaluate(()=>window.__harbour.settings());
    const offers=await takeOffer(page,'Run off');
    await page.locator('.horizon-sheet').waitFor({timeout:30000});await frames(page,2);
    const sheet=await page.locator('.horizon-sheet').innerText();
    await page.screenshot({path:resolve(dir,'crown-sheet.png')});
    const during=await page.evaluate(()=>({moverState:window.__harbour.moverState(),camera:window.__harbour.stats().camera,flying:window.__horizonFlight?.artState?.().flying??null}));
    const t0=await page.evaluate(()=>performance.now());
    await page.locator('.horizon-sheet button',{hasText:'the Green'}).first().click({timeout:180000});
    await frames(page,2);
    const after=await page.evaluate(t0=>({ms:performance.now()-t0,moverState:window.__harbour.moverState(),body:window.__harbour.body(),mode:window.__harbour.mode(),camera:window.__harbour.stats().camera}),t0);
    await page.screenshot({path:resolve(dir,'after-cut-green.png')});
    // The bail sheet: a jump needs the plane (M7). The dev jump refuses under reduced motion; record what it does.
    const bail=await page.evaluate(async()=>{const m=await import('/src/harbour/horizon/movers/glider/index.ts');const c=m.startDevParachute(window.__harbour,{x:1040,z:1000,h:200});return{started:c!==null,attached:window.__harbour.moverState().attached};});
    await save(name,{settings,offers,sheet,during,after,bail,summary:{settings,sheetLines:sheet.split('\n').length,afterBody:after.body,afterMode:after.moverState.mode,bail},errors,pngs:['crown-sheet.png','after-cut-green.png']});
    await context.close();
  },
};
const names=process.argv.slice(2);
try{for(const n of names){if(!rides[n])throw new Error(`no ride ${n}`);const t=Date.now();await rides[n]();console.log(n,'wall s',((Date.now()-t)/1000).toFixed(0));}}
finally{await browser.close();}
