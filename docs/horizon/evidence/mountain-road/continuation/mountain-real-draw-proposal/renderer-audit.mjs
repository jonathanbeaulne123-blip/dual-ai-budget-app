/** Unexecuted temporary real-WebGL diagnostic. Run only after root releases the heavy-process slot. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2),opt=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:args[i+1];};
const root=path.resolve(opt('root',process.cwd())),out=path.resolve(opt('out',`/tmp/mountain-real-draw-${Date.now()}`));
const require=createRequire(path.join(root,'package.json')),esbuild=require('esbuild'),{chromium}=require('@playwright/test');
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.resolve(root,p));
const worldPath=opt('world','public/horizon/world/horizon-geo-1.json'),terrainPath=opt('terrain','public/horizon/terrain/horizon-geo-1.bin');
const worldBytes=read(worldPath),terrainBytes=read(terrainPath),world=JSON.parse(worldBytes);
const districts=opt('districts','lakeside').split(','),themes=opt('themes','classic,taylor,newfoundland').split(','),tiers=opt('tiers','full,lite').split(','),seasons=opt('seasons','spring,summer,autumn,winter').split(','),times=opt('times','day,night').split(',');
for(const [name,values,allowed] of [['themes',themes,['classic','taylor','newfoundland']],['tiers',tiers,['full','lite']],['seasons',seasons,['spring','summer','autumn','winter']],['times',times,['day','night']]]){if(!values.length||values.some(v=>!allowed.includes(v))||new Set(values).size!==values.length)throw Error('Invalid or duplicate '+name);}
if(!districts.length||new Set(districts).size!==districts.length)throw Error('Invalid/duplicate districts');
for(const d of districts)if(!world.districts.some(x=>x.id===d))throw Error('Unknown district '+d);
const corridorIds=opt('corridors','all')==='all'?'all':opt('corridors').split(',');
const width=Number(opt('width','550')),height=Number(opt('height','360'));
if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('Invalid viewport');
const viewsFile=opt('views'),reviewViews=[];let reviewViewSource=null;
if(viewsFile){const raw=read(viewsFile),parsed=JSON.parse(raw);reviewViewSource={path:path.resolve(root,viewsFile),sha256:sha(raw),worldSha256:parsed.worldSha256??null};
 const rows=Array.isArray(parsed)?parsed:parsed.records??[];
 for(const [i,r] of rows.entries()){const p=r.pose??r;if(Array.isArray(p.eye)&&Array.isArray(p.target))reviewViews.push({id:`captured:${p.id??r.file??i}`,kind:'review-captured',eye:p.eye,target:p.target,fov:p.fov??p.fovDegrees??58,source:reviewViewSource.path});}
 if(!reviewViews.length)throw Error('No eye/target poses in --views file');
}
fs.mkdirSync(out,{recursive:true});
const recordsFile=path.join(out,'frames.ndjson'),fd=fs.openSync(recordsFile,'wx');
const entryPath=path.join(path.dirname(fileURLToPath(import.meta.url)),'renderer-audit.page.ts'),entryBytes=fs.readFileSync(entryPath);
const summary={status:'preparing',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),root,worldPath:path.resolve(root,worldPath),worldSha256:sha(worldBytes),terrainPath:path.resolve(root,terrainPath),terrainSha256:sha(terrainBytes),scriptSha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),entrySha256:sha(entryBytes),districts,themes,tiers,seasons,times,corridorIds,reviewViewSource,reviewViewsMatchWorld:!reviewViewSource?.worldSha256?null:reviewViewSource.worldSha256===sha(worldBytes),cases:[],renderers:[],errors:[],limits:[
 'Finite camera/season samples. A sampled peak below12 is not an exhaustive ROAD district bound or a device acceptance.',
 'Real WebGL base-pass renderer.info calls, including actual transparent double-sided passes. Shadow maps and other render passes are disabled, matching the existing base-pass corridor budget scope.',
 'Furniture and plants are isolated to one resident district; the actual globally shared road glow/pool draws are charged in full. Door/threshold geometry is excluded from corridor attribution but still competes under the unchanged shared lighting cap.',
 'Existing physical objects, authored full/lite geometry, all themes, material hooks, wind and plant residency/fade are retained. Hidden/faded primitives count whenever submitted.',
 'No terrain, native world, buildings, sky or non-corridor structure geometry is rendered. Ground conformation uses the same baked-terrain approximation as mountain-budgets; no visual/support or occlusion acceptance is claimed.',
 'Budget route/pool eyes are nominal anchor+1.65m, not newly surface-seated views. Plant-root diagnostics have four explicit headings. Captured review poses, if supplied, are copied exactly and their source/hash is recorded.',
 'Camera traversal order and existing plant hysteresis are retained within each case; all four seasons and day/night are separate cases. Submitted work, not GPU elapsed time, is measured.',
 'Any retained capacity report is a separate unmodified reference. Asset hash mismatches are explicit and never silently treated as current evidence. Its per-mesh draw counts are not a guaranteed upper bound on WebGL calls: transparent DoubleSide materials may submit twice.',
 'The actual builder materials and hooks are used; the live global fog hook/environment is not mounted. This count-only harness is not visual or material-appearance acceptance.',
 'Plant scale-in time follows the browser clock and is retained, not forced complete. It does not exempt any submitted zero-scale or zero-alpha work from the measured call count.'
]};
const capacityPath=opt('capacity');if(capacityPath){const raw=read(capacityPath),data=JSON.parse(raw);summary.capacityReference={path:path.resolve(root,capacityPath),sha256:sha(raw),worldSha256:data.worldSha256??null,terrainSha256:data.terrainSha256??null,matchesAssets:data.worldSha256===summary.worldSha256&&data.terrainSha256===summary.terrainSha256};fs.writeFileSync(path.join(out,'capacity-reference.json'),raw,{flag:'wx'});}
const save=()=>fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');save();
let browser,server;
try{
 const built=await esbuild.build({absWorkingDir:root,stdin:{contents:entryBytes.toString(),resolveDir:root,loader:'ts'},bundle:true,platform:'browser',format:'esm',target:'es2022',metafile:true,write:false,plugins:[
  {name:'repo-path',setup(b){b.onResolve({filter:/^@repo\//},a=>({path:path.resolve(root,a.path.slice(6))}));}},
  {name:'exact-pure-crown-adapter',setup(b){b.onLoad({filter:/[/\\]mountain[/\\]planting\.ts$/},({path:file})=>{const source=fs.readFileSync(file,'utf8'),crown=source.match(/export function crownOf[\s\S]*?^}/m)?.[0];if(!crown)throw Error('crownOf source contract changed');return{contents:crown+"\nexport function mountainPlanting(){throw new Error('Audit must not generate native planting');}",loader:'ts',resolveDir:path.dirname(file)};});}}
 ]});
 const bundle=built.outputFiles[0].contents;fs.writeFileSync(path.join(out,'harness.js'),bundle);summary.bundleSha256=sha(bundle);
 summary.sourceHashes={};for(const p of Object.keys(built.metafile.inputs)){if(p==='<stdin>')continue;const abs=path.resolve(root,p);if(!fs.existsSync(abs))throw Error('Unresolved bundle source for hashing: '+p);summary.sourceHashes[path.relative(root,abs)]=sha(fs.readFileSync(abs));}
 summary.adapter='Only mountain/planting.ts is substituted, with its exact crownOf function and a throwing mountainPlanting stub, as in mountain-budgets.mjs. No source world/terrain solve is imported.';
 fs.writeFileSync(path.join(out,'metafile.json'),JSON.stringify(built.metafile,null,2)+'\n');
 summary.buildSourceSnapshotAt=new Date().toISOString();
 let config={};
 const html=Buffer.from('<!doctype html><meta charset="UTF-8"><title>Temporary corridor draw audit</title><link rel="icon" href="data:,"><style>body{margin:0}</style><script type="module" src="/harness.js"></script>');
 server=http.createServer((req,res)=>{const routes={'/': ['text/html',html],'/harness.js':['text/javascript',bundle],'/world.json':['application/json',worldBytes],'/terrain.bin':['application/octet-stream',terrainBytes],'/config.json':['application/json',Buffer.from(JSON.stringify(config))]};const row=routes[req.url?.split('?')[0]];if(!row){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':row[0],'Cache-Control':'no-store'});res.end(row[1]);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 const executable=opt('chromium',process.env.HORIZON_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
 browser=await chromium.launch({headless:true,...(fs.existsSync(executable)?{executablePath:executable}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});summary.status='running';save();
 for(const theme of themes)for(const tier of tiers){
  config={theme,tier,districts,corridorIds,reviewViews,width,height};
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.on('pageerror',e=>summary.errors.push({theme,tier,error:e.message}));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon.ico'))summary.errors.push({theme,tier,console:m.text()});});
  await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mountainDrawAudit?.ready,null,{timeout:120000});
  const renderer=await page.evaluate(()=>window.__mountainDrawAudit.renderer);summary.renderers.push({theme,tier,...renderer});
  const inventory=await page.evaluate(()=>window.__mountainDrawAudit.inventory);fs.writeFileSync(path.join(out,`poses-${theme}-${tier}.json`),JSON.stringify(inventory,null,2)+'\n');
  for(const district of districts)for(const season of seasons)for(const time of times){
   const setup=await page.evaluate(p=>window.__mountainDrawAudit.begin(p),{district,season,time});
   const item={theme,tier,district,season,time,requestedSamples:setup.count,completedSamples:0,poseKinds:setup.poseKinds,furnitureCapacity:setup.furnitureCapacity,furnitureWebglCallUpperBoundIgnoringFrustumAndDetail:setup.furnitureWebglCallUpperBoundIgnoringFrustumAndDetail,peak:null,reviewPeak:null,peakPlantCalls:0,peakUnculledActivePlantCalls:0,status:'running'};summary.cases.push(item);save();
   let done=false;while(!done){
    const chunk=await page.evaluate(()=>window.__mountainDrawAudit.next(8));
    for(const row of chunk.records){const record={theme,tier,...row};fs.writeSync(fd,JSON.stringify(record)+'\n');item.completedSamples++;
     const witness={calls:row.renderer.calls,triangles:row.renderer.triangles,byCategory:row.byCategory,pose:row.pose,frame:row.frame,renderedPlantLayers:row.draws.filter(x=>x.category==='plants').map(x=>({name:x.name,calls:x.calls,instances:x.instances}))};
     if(!item.peak||witness.calls>item.peak.calls)item.peak=witness;
     if(row.pose.kind.startsWith('review-')&&(!item.reviewPeak||witness.calls>item.reviewPeak.calls))item.reviewPeak=witness;
     item.peakPlantCalls=Math.max(item.peakPlantCalls,row.byCategory.plants);
     item.peakUnculledActivePlantCalls=Math.max(item.peakUnculledActivePlantCalls,row.unculledActivePlantCalls.calls);
    }
    done=chunk.done;if(summary.errors.length)throw Error('Browser/shader error; see summary errors');
   }
   item.status=item.completedSamples===item.requestedSamples?'complete':'incomplete';item.sampledAtMost12=item.status==='complete'&&item.peak?.calls<=12;save();
   console.log(`${theme}/${tier} ${district} ${season}/${time}: ${item.completedSamples} samples, peak ${item.peak?.calls} actual base-pass calls`);
  }
  await page.evaluate(()=>window.__mountainDrawAudit.dispose());await page.close();
 }
 summary.sourceDrift=[];for(const [p,hash]of Object.entries(summary.sourceHashes)){const abs=path.resolve(root,p);if(!fs.existsSync(abs)||sha(fs.readFileSync(abs))!==hash)summary.sourceDrift.push(p);}if(summary.sourceDrift.length)throw Error('Source changed during diagnostic; no complete acceptance claim');
 summary.status='complete';summary.sampledAllAtMost12=summary.cases.every(c=>c.status==='complete'&&c.sampledAtMost12);summary.exhaustiveBudgetAcceptance=false;
}catch(e){summary.status='failed';summary.errors.push({error:e.stack??String(e)});process.exitCode=1;}
finally{save();fs.closeSync(fd);await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());console.log(out);}
