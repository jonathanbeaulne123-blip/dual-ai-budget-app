// Capture provenance only. This does not turn a screenshot into geometry/device acceptance.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import ts from 'typescript';
const hash=b=>createHash('sha256').update(b).digest('hex');
const decode=b=>b[0]===31&&b[1]===139?gunzipSync(b):b;
export function nativeTerrainInput(){const match=readFileSync('src/worldGeography.ts','utf8').match(/export const CURRENT_WORLD_GEOGRAPHY\s*=\s*'([^']+)'/);if(!match)throw Error('Cannot resolve native terrain revision from source');return `public/mountain/terrain/${match[1]}.bin`;}
export function captureSelection(name,fallback,allowed){
 const values=(process.env[name]??fallback).split(',');
 if(!values.length||new Set(values).size!==values.length||values.some(x=>!allowed.includes(x)))throw Error(`Invalid ${name}: ${values}`);
 return values;
}
export function captureEvidence({out,origin,assets=[],liveSources=[]}){
 const snapshot=()=>{
  const paths=execFileSync('git',['ls-files','-co','--exclude-standard','-z','src','test/fixtures','scripts/horizon','public/horizon','public/mountain','docs/horizon/evidence/mountain-road/after/journey/harness','package.json','pnpm-lock.yaml','vite.config.ts','native-mountain-review.html','horizon-review.html'],{encoding:'utf8'}).split('\0').filter(Boolean);
  const files=Object.fromEntries([...new Set(paths)].sort().map(p=>[p,hash(readFileSync(p))]));
  return {head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha256:hash(JSON.stringify(files)),files};
 };
 const evidence={startedAt:new Date().toISOString(),origin,sourceStart:snapshot(),assets,liveSources,liveChecks:[],loadedAssets:[],loadedPages:[],runtimeErrors:[],status:'running'};
 const save=()=>writeFileSync(out+'/provenance.json',JSON.stringify(evidence,null,2)+'\n');save();
 const live=async phase=>{
  const failures=[];
  for(const path of [...assets,...liveSources]){
   const source=liveSources.includes(path),url=new URL(source?'/'+path:'/'+path.replace(/^public\//,''),origin);url.searchParams.set('captureProof',Date.now().toString());
   // Vite's raw flag is bare. URLSearchParams would rewrite ?raw to ?raw=,
   // which no longer selects the raw-source loader used by this byte check.
   if(source)url.search+='&raw';
   const item={phase,path,url:String(url)};evidence.liveChecks.push(item);
   try{
    const response=await fetch(url,{cache:'no-store',headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());item.servedSha256=hash(bytes);item.contentEncoding=response.headers.get('content-encoding');
    let served=bytes,local=readFileSync(path);item.localSha256=hash(local);
    if(source&&!bytes.equals(local)){
     // Vite may emit either a quoted string or a template literal. Parse only
     // one literal export; never evaluate code from a source-proof response.
     // Static JSON handlers may instead return the exact raw bytes above.
     const parsed=ts.createSourceFile('capture-raw.js',bytes.toString(),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),statement=parsed.statements[0];
     if(parsed.statements.length!==1||!statement||!ts.isExportAssignment(statement)||statement.isExportEquals||!(ts.isStringLiteral(statement.expression)||ts.isNoSubstitutionTemplateLiteral(statement.expression)))throw Error('Expected one literal Vite raw source export');
     served=Buffer.from(statement.expression.text);
    }
    else if(path.endsWith('.gz')){item.comparisonMode=bytes.equals(local)?'exact-compressed-bytes':'exact-decompressed-bytes';served=decode(bytes);local=decode(local);}else item.comparisonMode='exact-bytes';
    item.servedDecodedSha256=hash(served);item.localDecodedSha256=hash(local);item.matches=served.equals(local);
    if(!item.matches)throw Error('Served input differs from local input');
   }catch(error){item.error=String(error);failures.push({phase,path,error:String(error)});}
   save();
  }
  return failures;
 };
 const pending=new Set();
 const loadedPath=url=>{const u=new URL(url);return /^\/(horizon\/(world|terrain)|mountain\/terrain)\//.test(u.pathname)&&/\.(json|gz|bin)$/.test(u.pathname)?u:null;};
 const watch=async(page,{label,required=[]})=>{
  const run={label,required,observed:[]};evidence.loadedPages.push(run);
  page.on('console',message=>{if(message.type()==='error'){evidence.runtimeErrors.push({page:label,error:message.text(),location:message.location()});save();}});
  await page.addInitScript(()=>{window.__captureContextAuditActive=true;document.addEventListener('webglcontextlost',()=>{if(window.__captureContextAuditActive)console.error('Capture observed WebGL context loss');},true);});
  page.on('response',response=>{const u=loadedPath(response.url());if(!u)return;
   const task=(async()=>{
    const item={page:label,url:String(u),path:'public'+decodeURIComponent(u.pathname),status:response.status(),contentEncoding:response.headers()['content-encoding']??null};evidence.loadedAssets.push(item);run.observed.push(item.path);
    try{
     if(u.origin!==new URL(origin).origin)throw Error('Loaded asset came from another origin');
     if(!response.ok())throw Error('Loaded asset HTTP '+response.status());
     const bytes=await response.body(),local=readFileSync(item.path);item.servedSha256=hash(bytes);item.localSha256=hash(local);
     if(bytes.equals(local)){item.comparisonMode='exact-bytes';item.matches=true;}
     else if(item.path.endsWith('.gz')){item.comparisonMode='exact-decompressed-bytes';item.servedDecodedSha256=hash(decode(bytes));item.localDecodedSha256=hash(decode(local));item.matches=decode(bytes).equals(decode(local));}
     else {item.comparisonMode='exact-bytes';item.matches=false;}
     if(!item.matches)throw Error('Actually loaded asset differs from local input');
    }catch(error){item.error=String(error);}save();
   })();pending.add(task);task.then(()=>pending.delete(task),()=>pending.delete(task));
  });
  page.on('requestfailed',request=>{if(loadedPath(request.url()))evidence.loadedAssets.push({page:label,url:request.url(),error:'Asset request failed: '+request.failure()?.errorText});});
 };
 const drain=async()=>{while(pending.size)await Promise.all([...pending]);};
 // Native pagehide deliberately disposes the renderer and force-loses its
 // context. End the context audit only after all captures, before that cleanup.
 const preparePageClose=async page=>{await drain();await page.evaluate(()=>{window.__captureContextAuditActive=false;});};
 return {evidence,watch,drain,preparePageClose,async start(){const readable='public/horizon/world/horizon-geo-1.json',compressed=readable+'.gz';if(assets.includes(readable)&&assets.includes(compressed)&&JSON.stringify(JSON.parse(readFileSync(readable)))!==JSON.stringify(JSON.parse(decode(readFileSync(compressed)))))throw Error('Local readable and gzip world definitions differ');const errors=await live('before');if(errors.length){evidence.status='failed';save();throw Error(JSON.stringify(errors));}},async finish(errors){
  try{await drain();errors.push(...evidence.runtimeErrors);for(const item of evidence.loadedAssets)if(item.error)errors.push({loadedAsset:item.url,error:item.error});for(const page of evidence.loadedPages)for(const prefix of page.required)if(!page.observed.some(p=>p.startsWith(prefix)))errors.push({page:page.label,error:'Required loaded asset family missing: '+prefix});errors.push(...await live('after'));evidence.sourceEnd=snapshot();evidence.sourceStable=evidence.sourceStart.sha256===evidence.sourceEnd.sha256&&evidence.sourceStart.head===evidence.sourceEnd.head;if(!evidence.sourceStable)errors.push({error:'Capture source/assets changed during run'});}
  catch(error){errors.push({error:'Final provenance check failed: '+String(error)});}
  evidence.endedAt=new Date().toISOString();evidence.status=errors.length?'failed':'complete';save();
 }};
}
