import {build} from 'esbuild';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {serializeHorizonJson,assertHorizonArtifact,splitHorizonDefinition} from './artifacts.mjs';
import {readdir} from 'node:fs/promises';
const root=process.cwd(),outIndex=process.argv.indexOf('--out'),outRoot=outIndex>=0?resolve(process.argv[outIndex+1]):resolve(root,'public/horizon'),output=resolve(tmpdir(),`horizon-bake-${process.pid}.mjs`),start=performance.now();
try{
 await build({entryPoints:[resolve(root,'scripts/horizon/bake-entry.ts')],outfile:output,bundle:true,platform:'node',format:'esm',logLevel:'warning'});
 const {bake}=await import(pathToFileURL(output).href),{buffer,world,horizonCards,foundations,groundBeds}=await bake();
 const paths={terrain:resolve(outRoot,'terrain/horizon-geo-1.bin'),world:resolve(outRoot,'world/horizon-geo-1.json'),compressed:resolve(outRoot,'world/horizon-geo-1.json.gz'),cards:resolve(outRoot,'world/horizon-cards.json')};
 const definition=serializeHorizonJson(world);
 const artifacts={terrain:Buffer.from(buffer),world:definition,compressed:gzipSync(definition,{level:9}),cards:serializeHorizonJson(horizonCards)};
 // R1-72: the served definition is an index + one chunk per district (world/<revision>.index.json.gz, world/<revision>/<district>.json.gz);
 // the raw monolith stays a bake artefact for tests and probes. --check compares every file by its decoded payload.
 const sha=b=>createHash('sha256').update(b).digest('hex'),split=splitHorizonDefinition(world,sha);
 paths.index=resolve(outRoot,`world/${world.geographyRevision}.index.json.gz`);artifacts.index=gzipSync(split.index,{level:9});
 for(const chunk of split.chunks){const key=`chunk:${chunk.districtId}`;paths[key]=resolve(outRoot,'world',chunk.path);artifacts[key]=gzipSync(chunk.json,{level:9});}
 if(process.argv.includes('--check')){const dir=resolve(outRoot,'world',world.geographyRevision),stored=(await readdir(dir).catch(()=>[])).filter(f=>f.endsWith('.json.gz')).sort(),expected=split.chunks.map(c=>c.path.split('/').pop()).sort();if(stored.join()!==expected.join())throw new Error(`Stale Horizon chunk set: ${stored.join(',')} ≠ ${expected.join(',')}; regenerate with pnpm horizon:bake`);}
 for(const key of Object.keys(paths)){if(process.argv.includes('--check')){assertHorizonArtifact(key==='index'||key.startsWith('chunk:')?'compressed':key,await readFile(paths[key]),artifacts[key]);}else{await mkdir(resolve(paths[key],'..'),{recursive:true});await writeFile(paths[key],artifacts[key]);}}
 const evidenceIndex=process.argv.indexOf('--evidence-dir');
 if(evidenceIndex>=0){const dir=resolve(process.argv[evidenceIndex+1]);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'horizon-support-settlement.json'),JSON.stringify({revision:world.geographyRevision,terrainSha256:createHash('sha256').update(artifacts.terrain).digest('hex'),foundations,groundBeds},null,2));}
 console.log(JSON.stringify({revision:world.geographyRevision,terrainBytes:buffer.byteLength,definitionBytes:artifacts.world.byteLength,definitionCompressedBytes:artifacts.compressed.byteLength,indexCompressedBytes:artifacts.index.byteLength,chunkCompressedBytes:Object.fromEntries(split.chunks.map(c=>[c.districtId,artifacts[`chunk:${c.districtId}`].byteLength])),sha256:createHash('sha256').update(artifacts.terrain).digest('hex'),solids:world.geometry.solids.length,diagnostics:world.diagnostics.length,conflicts:world.diagnostics.filter(d=>d.severity==='conflict').length,seconds:(performance.now()-start)/1000},null,2));
}finally{await unlink(output).catch(()=>{});}
