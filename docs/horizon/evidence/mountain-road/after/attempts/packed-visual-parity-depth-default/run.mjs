/** Read-only frozen-bundle A/B. Run serially only after the parent releases GPU. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
const root=path.resolve(opt('root',process.cwd())),oldDir=path.resolve(opt('old','/tmp/mountain-real-draw-smoke-v2')),newDir=path.resolve(opt('new','/tmp/mountain-real-draw-packed-smoke'));
const out=path.resolve(opt('out',`/tmp/mountain-batching-visual-${Date.now()}`));
fs.mkdirSync(out,{recursive:true});if(fs.existsSync(path.join(out,'summary.json')))throw Error('Refusing to overwrite a parity attempt');
const require=createRequire(path.join(root,'package.json')),{chromium}=require('@playwright/test'),esbuild=require('esbuild');
const sha=b=>createHash('sha256').update(b).digest('hex');
const oldSummary=JSON.parse(fs.readFileSync(path.join(oldDir,'summary.json'))),newSummary=JSON.parse(fs.readFileSync(path.join(newDir,'summary.json')));
const worldBytes=fs.readFileSync(path.resolve(root,opt('world','public/horizon/world/horizon-geo-1.json'))),terrainBytes=fs.readFileSync(path.resolve(root,opt('terrain','public/horizon/terrain/horizon-geo-1.bin')));
const world=JSON.parse(worldBytes),district=opt('district','lakeside');
if(sha(worldBytes)!==oldSummary.worldSha256||sha(terrainBytes)!==oldSummary.terrainSha256)throw Error('Provided assets do not match old frozen smoke. Supply the exact old --world/--terrain; never silently compare different assets.');
// Both bundles will fetch these identical byte buffers, even if their source runs used different assets.
const runtimeText=fs.readFileSync(path.join(root,'src/harbour/horizon/runtime/index.ts'),'utf8');
const hookText=runtimeText.match(/^const fogHooks=new WeakMap[\s\S]*?^}/m)?.[0];if(!hookText)throw Error('Exact live fog wrapper extraction changed');
const hookJs=(await esbuild.transform(hookText,{loader:'ts',target:'es2022'})).code;
const fogBuild=await esbuild.build({absWorkingDir:root,stdin:{contents:"export {Fog,PCFSoftShadowMap} from 'three';export {horizonFog} from './src/harbour/horizon/sky/fog.ts';export {shadowFrame} from './src/harbour/horizon/sun/shadow.ts';",resolveDir:root,loader:'ts'},bundle:true,platform:'browser',format:'iife',globalName:'__parityEnvironment',write:false,metafile:true});
const fogJs=fogBuild.outputFiles[0].text;
const allowedPure=new Set(['src/harbour/horizon/sky/fog.ts','src/harbour/horizon/sky/gradient.ts','src/harbour/horizon/sun/shadow.ts','src/harbour/horizon/land/terrain/geometry.ts']);
for(const name of Object.keys(fogBuild.metafile.inputs))if(name.startsWith('src/')&&!allowedPure.has(name))throw Error('Unexpected live environment dependency '+name);
fs.writeFileSync(path.join(out,'exact-live-fog-hook.ts'),hookText);fs.writeFileSync(path.join(out,'exact-environment.js'),fogJs);
const environmentProof={runtimeSha256:sha(runtimeText),fogHookSourceSha256:sha(hookText),fogHookJsSha256:sha(hookJs),environmentJsSha256:sha(fogJs),inputs:Object.fromEntries(Object.keys(fogBuild.metafile.inputs).filter(n=>n!=='<stdin>').map(n=>[n,sha(fs.readFileSync(path.resolve(root,n)))]))};
const bundleInfo={};const served={};
for(const [id,dir] of [['old',oldDir],['new',newDir]]){
 const bytes=fs.readFileSync(path.join(dir,'harness.js')),text=bytes.toString();
 if(id==='new'&&text.includes('packedLamp')&&!text.includes('lampCompile'))throw Error('New frozen bundle predates captured lampCompile fog fix. Rebuild its smoke bundle first; do not patch old/new rendering logic inside parity.');
 const matches=[...text.matchAll(/renderer\.render\((scene\w*), camera\)/g)],scenes=new Set(matches.map(m=>m[1]));if(scenes.size!==1)throw Error(`${id}: cannot identify unchanged audit scene`);
 for(const token of ['var api =','var renderer =','var camera =','var art =','var lights =','var planting =','var CARD_CLOCK =','var sun ='])if(!text.includes(token))throw Error(`${id}: frozen lexical contract changed (${token})`);
 const scene=[...scenes][0];
 const addon=`\n// A/B diagnostic append: source rendering builders above remain byte-identical.\n${fogJs}\n${hookJs}\nfor(const m of Object.values(art.materials))fogHook(m);\napi.parity = (request) => {
 const p=request.pose; api.begin({district:request.district,season:request.season,time:request.time});
 camera.position.set(...p.eye);camera.fov=p.fov;camera.lookAt(...p.target);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 for(const m of planting.materials())fogHook(m);
 const heading=Math.atan2(p.target[0]-p.eye[0],p.target[2]-p.eye[2]),groundY=ground(p.eye[0],p.eye[2]);
 const f=__parityEnvironment.horizonFog({tier:config.tier,eyeAboveGround:Math.max(0,p.eye[1]-groundY),elevation:request.time==='night'?-12:30,sunAzimuth:0,heading:heading*180/Math.PI});
 ${scene}.fog=new __parityEnvironment.Fog(f.color,f.near,f.far);
 const resident=new Set([request.district]);art.update(camera,resident);if(art.building())throw Error('Incomplete art');planting.update(camera,resident);
 let simulationNow=0,settled=false;lights.refresh();for(let i=0;i<80;i++){lights.update(camera,request.time==='night'?-12:30,simulationNow+=100,{at:p.eye});if(!lights.busy(simulationNow)){settled=true;break;}}if(!settled)throw Error('Lights did not settle');
 CARD_CLOCK.value=request.wind;
 renderer.shadowMap.enabled=request.shadow;sun.castShadow=request.shadow;
 if(request.shadow){const frame=__parityEnvironment.shadowFrame({tier:config.tier,mode:'walk',eye:p.eye,heading,groundY});const c0=frame.centre,L=Math.hypot(200,500,100);sun.position.set(c0[0]+200/L*frame.sunDistance,c0[1]+500/L*frame.sunDistance,c0[2]+100/L*frame.sunDistance);sun.target.position.set(...c0);if(!sun.target.parent)${scene}.add(sun.target);sun.shadow.mapSize.set(frame.mapSize,frame.mapSize);const c=sun.shadow.camera;c.left=-frame.half;c.right=frame.half;c.top=frame.half;c.bottom=-frame.half;c.near=1;c.far=frame.far;c.updateProjectionMatrix();sun.shadow.normalBias=.05;sun.shadow.bias=-.00006;renderer.shadowMap.type=__parityEnvironment.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;sun.shadow.needsUpdate=true;}
 else {sun.position.set(200,500,100);sun.target.position.set(0,0,0);}
 frameDraws=[];renderer.info.reset();renderer.render(${scene},camera);
 const gl=renderer.getContext(),w=renderer.domElement.width,h=renderer.domElement.height,rgba=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,rgba);if(gl.getError()!==gl.NO_ERROR)throw Error('Parity WebGL error');
 const encode=(a)=>{let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);};
 const png=(a,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d'),im=ctx.createImageData(w,h);for(let y=0;y<h;y++)im.data.set(a.subarray(y*w*4,(y+1)*w*4),(h-1-y)*w*4);ctx.putImageData(im,0,0);return c.toDataURL('image/png').split(',')[1];};
 let depth=null;if(request.shadow){const rt=sun.shadow.map;if(!rt)throw Error('Missing directional shadow target');const a=new Uint8Array(rt.width*rt.height*4);renderer.readRenderTargetPixels(rt,0,0,rt.width,rt.height,a);if(gl.getError()!==gl.NO_ERROR)throw Error('Shadow readback error');let nonClearPixels=0;for(let k=0;k<a.length;k+=4)if(a[k]!==255||a[k+1]!==255||a[k+2]!==255||a[k+3]!==255)nonClearPixels++;if(config.tier==='full'&&!nonClearPixels)throw Error('Empty full-tier shadow color attachment does not prove silhouette parity');depth={width:rt.width,height:rt.height,nonClearPixels,rgba:encode(a),png:png(a,rt.width,rt.height)};}
 return {width:w,height:h,rgba:encode(rgba),png:png(rgba,w,h),depth,renderer:{...renderer.info.render},lights:lights.stats(),plants:planting.stats(),wind:CARD_CLOCK.value,performanceNow:performance.now(),dateNow:Date.now(),shadow:request.shadow,shadowReadback:request.shadow?{attachment:'color',requestedType:__parityEnvironment.PCFSoftShadowMap,effectiveType:renderer.shadowMap.type,depthTexturePresent:!!sun.shadow.map?.depthTexture,actualDepthTextureCompared:false}:null};
};\n`;
 served[id]=Buffer.from(text+addon);bundleInfo[id]={path:path.join(dir,'harness.js'),bundleSha256:sha(bytes),diagnosticAppendSha256:sha(addon),servedSha256:sha(served[id])};
 fs.writeFileSync(path.join(out,`${id}-served.js`),served[id]);
}
const findPlant=(id)=>{const g=world.corridors.flatMap(c=>c.planting).find(g=>g.id===id);if(!g)throw Error('Missing old authored group '+id);return g.items.find(p=>['round','birch','pine'].includes(p.species))??g.items[0];};
const grove=findPlant('VG.plant.framingTrees.1'),pine=findPlant('V03.plant.framingTrees.1');
const close=(id,p)=>({id,eye:[p.at[0]+7,p.at[1]+4,p.at[2]+7],target:[p.at[0],p.at[1]+2,p.at[2]],fov:58,source:'Fixed view derived from unchanged old baked plant root',at:p.at,species:p.species});
const oldPoses=JSON.parse(fs.readFileSync(path.join(oldDir,'poses-classic-full.json'))),lampPose=oldPoses.find(p=>p.id==='VBS.lamp.1:pool:1');if(!lampPose)throw Error('Missing historical lamp-pool witness');
const lampAt=[lampPose.eye[0],lampPose.eye[1]-1.65,lampPose.eye[2]];
let poses=[close('grove-close',grove),close('pine-close',pine),{id:'lamp-close',eye:[lampAt[0]+4,lampAt[1]+3,lampAt[2]+4],target:[lampAt[0],lampAt[1]+2,lampAt[2]],fov:58,source:'Fixed oblique view from old VBS.lamp.1 pool witness',at:lampAt}];
if(opt('poses'))poses=JSON.parse(fs.readFileSync(path.resolve(root,opt('poses'))));
const themes=opt('themes','classic,taylor,newfoundland').split(','),tiers=opt('tiers','full,lite').split(','),times=opt('times','day,night').split(','),modes=opt('modes','color,shadow').split(','),winds=opt('winds','7.25').split(',').map(Number);
const width=Number(opt('width','640')),height=Number(opt('height','420'));
const summary={status:'prepared',root,bundleInfo,environmentProof,worldSha256:sha(worldBytes),terrainSha256:sha(terrainBytes),oldSmokeAssetsMatch:true,newSmokeAssetsMatch:newSummary.worldSha256===sha(worldBytes)&&newSummary.terrainSha256===sha(terrainBytes),themes,tiers,times,modes,winds,poses,width,height,cases:[],errors:[],limits:['No acceptance tolerance: every differing pixel is recorded; exact equality is reported separately.','Same old frozen assets are deliberately used for both bundles; source runtime lamp refinements can still create real visual differences.','Isolated corridor art/plants and real shared lights, exact extracted live fog hook plus horizonFog and shadowFrame helpers. Sky/hemi/sun energy remains the same probe ambience, not a complete live world.','Color mode retains original audit sun/hemisphere settings. Shadow mode uses exact runtime walk shadowFrame, full2048/lite1024 resolution, requested PCFSoftShadowMap (effective renderer type recorded), near1, normalBias.05 and bias-.00006; point lights remain shadowless.','Shadow readback is the RGBA color attachment, with material-dependent Basic/RGBA depth encoding. The actual depthTexture consumed by the shadow shader is not read or compared; no depth precision or world-distance equality is claimed.','Shadow silhouette comparison has no extra receiver plane and does not replace final in-world theme/device captures.','One fresh planting per pose makes first-evaluation born=-1e9; browser performance/Date clocks and CARD_CLOCK are fixed.']};
const save=()=>fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');save();fs.writeFileSync(path.join(out,'poses.json'),JSON.stringify(poses,null,2));
let config={},bundleId='old';const html=Buffer.from('<!doctype html><meta charset="UTF-8"><title>Frozen corridor parity</title><link rel="icon" href="data:,"><style>body{margin:0}</style><script type="module" src="/harness.js"></script>');
const server=http.createServer((req,res)=>{const routes={'/':['text/html',html],'/harness.js':['text/javascript',served[bundleId]],'/world.json':['application/json',worldBytes],'/terrain.bin':['application/octet-stream',terrainBytes],'/config.json':['application/json',Buffer.from(JSON.stringify(config))]};const row=routes[req.url?.split('?')[0]];if(!row){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':row[0],'Cache-Control':'no-store'});res.end(row[1]);});
let browser;
function diff(a,b){if(a.length!==b.length)throw Error('Readback size mismatch');let pixels=0,channels=0,max=0,total=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let k=0;k<4;k++){const d=Math.abs(a[i+k]-b[i+k]);if(d){channels++;changed=true;}max=Math.max(max,d);total+=d;}if(changed)pixels++;}return{exactEqual:pixels===0,differingPixels:pixels,totalPixels:a.length/4,differingChannels:channels,maxChannelDifference:max,meanAbsoluteChannelDifference:total/a.length};}
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const executable=opt('chromium',process.env.HORIZON_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
 browser=await chromium.launch({headless:true,...(fs.existsSync(executable)?{executablePath:executable}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});summary.status='running';save();
 for(const theme of themes)for(const tier of tiers)for(const time of times)for(const mode of modes)for(const wind of winds)for(const pose of poses){
  const key=[theme,tier,time,mode,wind,pose.id].join('_').replace(/[^\w.-]/g,'-'),pair={};
  for(const id of ['old','new']){
   bundleId=id;config={theme,tier,districts:[district],corridorIds:'all',reviewViews:[],width,height};
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});const errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))errors.push(m.text());});
   await page.addInitScript(()=>{Object.defineProperty(performance,'now',{value:()=>100000});Date.now=()=>1800000000000;});
   try{await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mountainDrawAudit?.parity,null,{timeout:120000});
    const row=await page.evaluate(p=>window.__mountainDrawAudit.parity(p),{pose,district,season:'summer',time,wind,shadow:mode==='shadow'});if(errors.length)throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(out,`${key}.${id}.png`),Buffer.from(row.png,'base64'));const rgba=Buffer.from(row.rgba,'base64');fs.writeFileSync(path.join(out,`${key}.${id}.rgba`),rgba);pair[id]={...row,rgba};delete pair[id].png;
    if(row.depth){fs.writeFileSync(path.join(out,`${key}.${id}.shadow.png`),Buffer.from(row.depth.png,'base64'));const data=Buffer.from(row.depth.rgba,'base64');fs.writeFileSync(path.join(out,`${key}.${id}.shadow.rgba`),data);pair[id].depth={width:row.depth.width,height:row.depth.height,nonClearPixels:row.depth.nonClearPixels,rgba:data};}
    await page.evaluate(()=>window.__mountainDrawAudit.dispose());
   }finally{await page.close();}
  }
  const item={key,theme,tier,time,mode,wind,pose:pose.id,color:diff(pair.old.rgba,pair.new.rgba),shadow:mode==='shadow'?{...diff(pair.old.depth.rgba,pair.new.depth.rgba),oldNonClearPixels:pair.old.depth.nonClearPixels,newNonClearPixels:pair.new.depth.nonClearPixels}:null,old:{renderer:pair.old.renderer,lights:pair.old.lights,plants:pair.old.plants,clock:pair.old.performanceNow,shadowReadback:pair.old.shadowReadback},new:{renderer:pair.new.renderer,lights:pair.new.lights,plants:pair.new.plants,clock:pair.new.performanceNow,shadowReadback:pair.new.shadowReadback}};
  summary.cases.push(item);save();process.stdout.write(`${key}: ${item.color.differingPixels} color pixels${item.shadow?`, ${item.shadow.differingPixels} shadow pixels`:''}\n`);
 }
 summary.status='complete';summary.allExact=summary.cases.every(c=>c.color.exactEqual&&(!c.shadow||c.shadow.exactEqual));save();
}catch(e){summary.status='failed';summary.errors.push({message:e.message,stack:e.stack});save();throw e;}finally{await browser?.close();await new Promise(r=>server.close(r));}
