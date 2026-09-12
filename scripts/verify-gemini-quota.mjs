import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from 'miniflare';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const dir = await mkdtemp('/tmp/hearth-gemini-quota-');
const sha = text => createHash('sha256').update(text).digest('hex');
const model = 'gemini-3.8-flash';
const config = {version:1,tier:'free',exclusive:true,projectId:'hearth-quota-test',keySha256:sha('synthetic'),verifiedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),models:{
  'gemini-3.1-flash-lite':{rpm:15,tpm:250000,rpd:500,usedOnVerificationDay:0},[model]:{rpm:5,tpm:250000,rpd:20,usedOnVerificationDay:0}}};
await build({stdin:{contents:`export {HerculesGeminiQuota} from './workers/geminiQuota.ts';
export default {async fetch(request,env){const q=env.QUOTA.get(env.QUOTA.idFromName('hearth-quota-test'));const body=await request.json();return Response.json((await q[body.method](...body.args))??null);}};`,resolveDir:process.cwd(),loader:'ts'},outfile:dir+'/worker.mjs',bundle:true,format:'esm',platform:'neutral',external:['cloudflare:*'],logLevel:'warning'});
const options = () => convertV4MiniflareOptions({name:'quota-proof',rootPath:dir,modules:true,scriptPath:dir+'/worker.mjs',compatibilityDate:'2026-08-21',log:new Log(LogLevel.ERROR),telemetry:{enabled:false},resourcePersistencePath:dir+'/state',durableObjects:{QUOTA:{className:'HerculesGeminiQuota',useSQLite:true}},bindings:{HERCULES_GEMINI_FREE_QUOTAS:JSON.stringify(config)},outboundService:async()=>new Response('No external access',{status:403})});
let mf = new Miniflare(options());
const api = async(method,...args) => (await mf.dispatchFetch('http://local.test',{method:'POST',body:JSON.stringify({method,args})})).json();
const reservation = (attempt,phase,tokens=0) => ({id:sha(attempt)+':'+phase,model,tokens,digest:sha('synthetic prompt')});
const results=[];
try {
  await mf.ready;
  const identity=sha('shared-turn');
  const starts=await Promise.all(Array.from({length:8},()=>api('begin',identity)));
  assert.equal(starts.filter(r=>r.ok).length,1);results.push('concurrent duplicate turn has one active attempt');
  await api('release',identity,starts.find(r=>r.ok).attempt);
  const retry=await api('begin',identity);assert(retry.ok);results.push('failed turn can obtain a new accounted attempt');
  const counts=await Promise.all(Array.from({length:8},(_,i)=>api('reserve',reservation('attempt-'+i,'count'))));
  const admitted=counts.flatMap((r,i)=>r.ok?[i]:[]);assert.equal(admitted.length,2);
  for(const i of admitted) assert((await api('reserve',reservation('attempt-'+i,'generate',1000))).ok);
  assert.equal((await api('reserve',reservation('attempt-'+admitted[0],'generate',1000))).code,'GEMINI_FREE_DUPLICATE_ATTEMPT');
  results.push('two concurrent Flash calls reserve paired slots and both generate; duplicate dispatch refused');
  await mf.dispose();mf=new Miniflare(options());await mf.ready;
  assert.equal((await api('reserve',reservation('after-restart','count'))).code,'GEMINI_FREE_MINUTE_LIMIT');
  results.push('SQLite restart preserves minute usage and refused reservations');
  await api('pauseUntilReset');
  assert.equal((await api('reserve',{...reservation('after-429','count'),model:'gemini-3.1-flash-lite'})).code,'GEMINI_FREE_PROVIDER_LIMIT');
  results.push('unexpected upstream quota stop covers both models');
  console.log(JSON.stringify({passed:results.length,results,artifact:dir+'/results.json'},null,2));
  await writeFile(dir+'/results.json',JSON.stringify({at:new Date().toISOString(),results},null,2));
} finally {await mf.dispose();}
