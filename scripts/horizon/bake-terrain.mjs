import {build} from 'esbuild';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=process.cwd(),output=resolve(tmpdir(),`horizon-bake-${process.pid}.mjs`),start=performance.now();
try{
 await build({entryPoints:[resolve(root,'scripts/horizon/bake-entry.ts')],outfile:output,bundle:true,platform:'node',format:'esm',logLevel:'warning'});
 const {bake}=await import(pathToFileURL(output).href),{buffer,world,horizonCards,foundations,groundBeds}=await bake();
 const paths={terrain:resolve(root,'public/horizon/terrain/horizon-geo-1.bin'),world:resolve(root,'public/horizon/world/horizon-geo-1.json'),compressed:resolve(root,'public/horizon/world/horizon-geo-1.json.gz'),cards:resolve(root,'public/horizon/world/horizon-cards.json')};
 const definition=Buffer.from(JSON.stringify(world));
 const artifacts={terrain:Buffer.from(buffer),world:definition,compressed:gzipSync(definition,{level:9}),cards:Buffer.from(JSON.stringify(horizonCards))};
 for(const key of Object.keys(paths)){if(process.argv.includes('--check')){if(!(await readFile(paths[key])).equals(artifacts[key]))throw new Error(`Stale Horizon ${key} asset`);}else{await mkdir(resolve(paths[key],'..'),{recursive:true});await writeFile(paths[key],artifacts[key]);}}
 const evidenceIndex=process.argv.indexOf('--evidence-dir');
 if(evidenceIndex>=0){const dir=resolve(process.argv[evidenceIndex+1]);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,'horizon-support-settlement.json'),JSON.stringify({revision:world.geographyRevision,terrainSha256:createHash('sha256').update(artifacts.terrain).digest('hex'),foundations,groundBeds},null,2));}
 console.log(JSON.stringify({revision:world.geographyRevision,terrainBytes:buffer.byteLength,definitionBytes:artifacts.world.byteLength,definitionCompressedBytes:artifacts.compressed.byteLength,sha256:createHash('sha256').update(artifacts.terrain).digest('hex'),solids:world.geometry.solids.length,diagnostics:world.diagnostics.length,conflicts:world.diagnostics.filter(d=>d.severity==='conflict').length,seconds:(performance.now()-start)/1000},null,2));
}finally{await unlink(output).catch(()=>{});}
