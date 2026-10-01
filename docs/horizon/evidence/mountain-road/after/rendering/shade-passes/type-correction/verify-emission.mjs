import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const root='/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book',dir='/tmp/mountain-shade-group-types';
const require=createRequire(path.join(root,'package.json')),esbuild=require('esbuild');
const sha=b=>createHash('sha256').update(b).digest('hex'),base=JSON.parse(fs.readFileSync(path.join(dir,'BASE.json'),'utf8')),rows=[];
for(const file of base.files){
 const name=path.basename(file.path),before=fs.readFileSync(path.join(dir,name+'.before'),'utf8'),after=fs.readFileSync(path.join(dir,name),'utf8');
 if(sha(before)!==file.baseSha256||sha(after)!==file.candidateSha256)throw Error('Scratch input hash changed');
 const options={loader:'ts',format:'esm',target:'es2022',sourcemap:false,legalComments:'none'};
 const a=await esbuild.transform(before,options),b=await esbuild.transform(after,options);
 const equal=a.code===b.code;rows.push({path:file.path,beforeSourceSha256:sha(before),afterSourceSha256:sha(after),beforeJsSha256:sha(a.code),afterJsSha256:sha(b.code),emittedBytes:Buffer.byteLength(a.code),byteIdentical:equal,warningsBefore:a.warnings,warningsAfter:b.warnings});
 fs.writeFileSync(path.join(dir,name+'.emitted-before.js'),a.code);fs.writeFileSync(path.join(dir,name+'.emitted-after.js'),b.code);
 if(!equal)throw Error('Emitted code changed: '+file.path);
}
const report={tool:'esbuild.transform (no bundling, no source/test/world imports)',esbuildVersion:esbuild.version,options:{loader:'ts',format:'esm',target:'es2022',sourcemap:false,legalComments:'none'},status:'pass',rows,limits:['This checks exact emitted JavaScript equality; it is not the configured full TypeScript verdict or a test execution.','No checkout or frozen bundle was modified.']};
fs.writeFileSync(path.join(dir,'emission-proof.json'),JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify(report,null,2)+'\n');
