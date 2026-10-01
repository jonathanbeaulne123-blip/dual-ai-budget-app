import {captureEvidence,captureSelection,nativeTerrainInput} from './capture-evidence.mjs';
/** Actual native Mountain v2 renderer; headless SwiftShader evidence, never device or ride acceptance.
 * Start the normal Vite dev server separately; node scripts/horizon/capture-native-mountain.mjs /tmp/native-captures
 */
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out=resolve(process.argv[2]??'/tmp/native-mountain-captures');mkdirSync(out,{recursive:false});
const records=[],errors=[],sourceFiles=['scripts/horizon/native-mountain-review.mjs','src/harbour/mountain/course.ts','src/harbour/mountain/generated/library-landing.json','src/harbour/mountain/generated/awning-landing.json','src/harbour/mountain/branchLandings.ts','src/harbour/mountain/damEntry.ts','src/harbour/mountain/roads.ts','src/harbour/mountain/surfaces.ts','src/harbour/mountain/roadFrameFairing.ts','src/harbour/mountain/orchardJunction.ts','src/harbour/mountain/orchardJunction.generated.json','src/harbour/mountain/art/routeArt.ts','src/harbour/scene/groundPaint.ts'];
const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
const tiers=captureSelection('TIERS','full,lite',['full','lite']),themes=captureSelection('THEMES','classic,taylor,newfoundland',['classic','taylor','newfoundland']);
const nativeTerrain=nativeTerrainInput();
const evidence=captureEvidence({out,assets:[nativeTerrain],origin:process.env.NATIVE_MOUNTAIN_REVIEW_URL??'http://127.0.0.1:5209',liveSources:[...sourceFiles,'src/worldGeography.ts']});
let expected=0;
const metadata={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes,method:'Native mountHarbourWorld + villageCourt renderer; headless Chromium SwiftShader; static camera review, not input-driven or device evidence',lighting:'Native lightRig is fixed authored daylight and has no clock API. No fabricated night captures.',scope:{tiers,themes},provenance:'provenance.json',records,errors};
const save=()=>writeFileSync(out+'/captures.json',JSON.stringify(metadata,null,2));
let browser;const launch=()=>chromium.launch({headless:true,executablePath:process.env.HORIZON_CHROMIUM??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{await evidence.start();for(const tier of tiers)for(const theme of themes){
 browser=await launch();
 const page=await browser.newPage({viewport:{width:1100,height:720},reducedMotion:'reduce'});await evidence.watch(page,{label:`${tier}/${theme}`,required:[nativeTerrain]});page.on('pageerror',e=>errors.push({tier,theme,error:e.message}));
 try{
  await page.setExtraHTTPHeaders({'Cache-Control':'no-cache'});await page.goto(`${process.env.NATIVE_MOUNTAIN_REVIEW_URL??'http://127.0.0.1:5209'}/native-mountain-review.html?theme=${theme}&tier=${tier}&diagnostics=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__nativeMountain?.snapshot().ready||window.__nativeMountain?.snapshot().failed,null,{timeout:180000});
  if(await page.evaluate(()=>window.__nativeMountain.snapshot().failed))throw Error('Native renderer failed');
  await page.addStyleTag({content:'#native-mountain-status{visibility:hidden}'});
  const poses=await page.evaluate(()=>window.__nativeMountain.poses.map(p=>p.id));if(!poses.length||new Set(poses).size!==poses.length)throw Error('Empty or duplicate native pose inventory');expected+=poses.length;
  for(const id of poses){try{
   await page.evaluate(id=>window.__nativeMountain.show(id),id);const observed=await page.evaluate(()=>window.__nativeMountain.settle(45000));
   const file=`${theme}-${tier}-authored-daylight-${id}.jpg`;
   await page.locator('#native-mountain-stage canvas').screenshot({path:out+'/'+file,type:'jpeg',quality:86,timeout:60000});
   records.push({file,id,theme,tier,...observed});if(!observed.settled)errors.push({id,theme,tier,error:'Native view did not settle within 45 seconds'});
   if(observed.cameraDisplacement>.35)errors.push({id,theme,tier,error:'Runtime adjusted requested rider camera by more than 0.35 m; inspect before accepting rider-height label',metres:observed.cameraDisplacement});
   save();console.log(file);
  }catch(e){errors.push({id,theme,tier,error:e.message});save();}}
 }catch(e){errors.push({theme,tier,error:e.message});save();}finally{await evidence.preparePageClose(page);await page.close();await browser.close();browser=undefined;}
}}catch(e){errors.push({fatal:true,error:e.message});}finally{if(!expected||records.length!==expected)errors.push({error:'Incomplete selected capture inventory',expected,actual:records.length});await evidence.finish(errors);save();await browser?.close();if(errors.length)process.exitCode=1;}
