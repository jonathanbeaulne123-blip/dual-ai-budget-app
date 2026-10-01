/** Actual rendered baked-solid budget delta against the integrated main asset set.
 * Run after final bake. No terrain solving, GPU or browser; capacity, not device timing.
 */
import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const root=process.cwd(),out=resolve(process.argv[2]??'docs/horizon/evidence/mountain-road/after/baked-budget.json');
const baselineRef=process.env.MOUNTAIN_BASELINE_REF??'1cf76c551e6f49124b6257162bc4d36ca18d7bd1';
const worldPath='public/horizon/world/horizon-geo-1.json',currentBytes=readFileSync(worldPath),beforeBytes=execFileSync('git',['show',baselineRef+':'+worldPath],{maxBuffer:128*1024*1024});
const current=JSON.parse(currentBytes),before=JSON.parse(beforeBytes),sha=b=>createHash('sha256').update(b).digest('hex');
const bundled=await build({stdin:{contents:`export {buildDistrictCards} from './src/harbour/horizon/runtime/cards';export {decodeTerrainAsset} from './src/harbour/horizon/land/terrain/asset';export {useDefinitionDistricts} from './src/harbour/horizon/world/districts';`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'error'});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const bytes=readFileSync('public/horizon/terrain/horizon-geo-1.bin'),field=api.decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'full');
const wanted=process.env.DISTRICTS?.split(',')??['prow','lakeside','crown','hollow','green'];
const count=group=>{let triangles=0,drawCalls=0;group.traverse(o=>{if(!o.visible)return;if(o.isMesh||o.isLine||o.isLineSegments){drawCalls+=Array.isArray(o.material)?o.geometry.groups.length:1;if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3*(o.isInstancedMesh?o.count:1);}});return {triangles,drawCalls};};
const render=(w,d,tier)=>{api.useDefinitionDistricts(w.districts);const district=w.districts.find(x=>x.id===d);if(!district)return {triangles:0,drawCalls:0};
 // The exact runtime builder. childOf omits only the separate terrain mesh stage;
 // solids still use the actual district membership, tier indices, pavement paint and ink.
 const cards=api.buildDistrictCards(w,field,{...w.collision,solids:w.geometry.solids,diagnostics:[]},{...district,childOf:'audit-no-terrain'},tier);const n=count(cards.group);cards.dispose();return n;};
const rows=[];for(const district of wanted)for(const tier of['full','lite']){const a=render(before,district,tier),b=render(current,district,tier);rows.push({district,tier,before:a,after:b,addedTriangles:b.triangles-a.triangles,addedDrawCalls:b.drawCalls-a.drawCalls});}
const old=new Map(before.geometry.solids.map(s=>[s.id,JSON.stringify(s)]));
const changed=current.geometry.solids.filter(s=>old.get(s.id)!==JSON.stringify(s));
const result={baselineRef,baselineWorldSha256:sha(beforeBytes),worldSha256:sha(currentBytes),runtimeBundleSha256:sha(bundled.outputFiles[0].text),auditSha256:sha(readFileSync('scripts/horizon/mountain-baked-budget.mjs')),rows,changedSourceIds:[...new Set(changed.map(s=>s.sourceId??s.id))].sort(),method:'Before and after assets rendered with the same current buildDistrictCards implementation. Counts resident capacity of baked solid meshes and ink after the real tier/pavement handling.',limits:['No GPU timing, frustum/distance culling, shadow passes or physical-device claim.','Terrain, water, native Mountain scene, bridge-theme art and corridor-theme art/plants/halos are separate runtime layers and excluded here.','Bridge-owned collision solids are omitted by the real runtime builder and rendered by bridgeArt.','Counts are not a whole-scene performance pass. Combine with corridor and native/bridge layer evidence.']};
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({out,rows},null,2));
