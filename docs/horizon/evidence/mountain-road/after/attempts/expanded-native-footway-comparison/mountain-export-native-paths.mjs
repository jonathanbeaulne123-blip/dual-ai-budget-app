import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';import{execFileSync}from'node:child_process';
const root=resolve(process.argv[2]),out=resolve(process.argv[3]);mkdirSync(out,{recursive:true});const {build}=createRequire(resolve(root,'package.json'))('esbuild');
const r=await build({stdin:{contents:"export {PATH_EDGES} from './src/harbour/mountain/pathGraph.ts';",resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'error'});
const code=r.outputFiles[0].text;writeFileSync(resolve(out,'source.mjs'),code);const m=await import(pathToFileURL(resolve(out,'source.mjs')));
const O=[1308,54,764],precise=p=>p.map((x,i)=>Math.round((x+O[i])*1e6)/1e6),nativePlanning={walks:m.PATH_EDGES.map(p=>({id:p.id,kind:p.kind,halfWidth:p.halfWidth,points:p.points.map(precise)}))};
writeFileSync(resolve(out,'snapshot.json'),JSON.stringify({root,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),bundleSha256:createHash('sha256').update(code).digest('hex'),method:'Exact original PATH_EDGES plus current dumper six-decimal Horizon offset transform; original source unchanged',nativePlanning},null,2));console.log('Exported',nativePlanning.walks.length,'native paths');
