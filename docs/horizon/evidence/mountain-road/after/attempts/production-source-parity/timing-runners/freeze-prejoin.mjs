/** Root-only observational snapshot. Never imports/runs fit or builds final world. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const ROOT=resolve(process.argv[2]??''),OUT=process.argv[3]&&resolve(process.argv[3]);
if(!process.argv[2]||!OUT)throw new Error('Usage: node freeze-prejoin.mjs ROOT FRESH_OUTPUT_DIRECTORY');
if(existsSync(OUT))throw new Error('Output must be fresh: '+OUT);mkdirSync(OUT,{recursive:true});process.chdir(ROOT);
const sha=b=>createHash('sha256').update(b).digest('hex'),start=performance.now(),cpu0=process.cpuUsage();let prior=start,priorCpu=cpu0;
const mark=(stage,details)=>{const t=performance.now(),cpu=process.cpuUsage();const row={stage,utc:new Date().toISOString(),wallMs:t-start,intervalWallMs:t-prior,cpuUserMs:(cpu.user-cpu0.user)/1000,cpuSystemMs:(cpu.system-cpu0.system)/1000,intervalCpuMs:(cpu.user-priorCpu.user+cpu.system-priorCpu.system)/1000,rssBytes:process.memoryUsage().rss,resourceUsage:process.resourceUsage(),details};writeFileSync(resolve(OUT,'timings.jsonl'),JSON.stringify(row)+'\n',{flag:'a'});prior=t;priorCpu=cpu;};
globalThis.__horizonBakeTiming=mark;
const entry='scripts/horizon/bake-entry.ts',original=readFileSync(resolve(ROOT,entry),'utf8');
const env='  const {ground}=mountainSourceEnvironment(cuts,field);',stop='  fitFootLaneJoin(cuts,ground);';
if(original.split(env).length!==2||original.split(stop).length!==2)throw new Error('Bake source changed: review precise pre-join insertion points');
let overlay=original.replace(env,"  const groundInputs=structuredClone({beds:cuts.beds,mouths:cuts.mouths});\n"+env).replace(stop,"  return {buffer,cuts,groundInputs,corridors,foundations,groundBeds};");
const typedMark="const snapshotTiming=(stage:string)=>(globalThis as typeof globalThis&{__horizonBakeTiming?:(stage:string)=>void}).__horizonBakeTiming?.(stage);\n";
overlay=typedMark+overlay;
for(const [needle,label]of[['  const cuts=buildLandCuts(baseHeight);','buildLandCuts'],['  const built=buildTerrain(cuts,{step:5});','buildTerrain'],['  const foundations=settleFoundations(cuts,(x,z)=>sampleTerrain(field,x,z));','settleFoundations'],[env,'sourceEnvironment'],['  const {corridors}=settleCorridors(cuts,ground,{destinations:corridorDestinations(cuts)});','settleCorridors']]){
 if(!overlay.includes(needle))throw new Error('Missing timing boundary '+label);
 overlay=overlay.replace(needle,`  snapshotTiming('${label}:begin');\n${needle}\n  snapshotTiming('${label}:end');`);
}
writeFileSync(resolve(OUT,'bake-entry.overlay.ts'),overlay);
const {build}=createRequire(resolve(ROOT,'package.json'))('esbuild'),inputs=new Map();
mark('bundle:begin');
const built=await build({entryPoints:[resolve(ROOT,entry)],bundle:true,platform:'node',format:'esm',write:false,metafile:true,logLevel:'warning',plugins:[{name:'freeze-prejoin-no-fit',setup(b){b.onLoad({filter:/bake-entry\.ts$/},args=>args.path===resolve(ROOT,entry)?{contents:overlay,loader:'ts',resolveDir:resolve(ROOT,'scripts/horizon')}:undefined);b.onEnd(result=>{for(const name of Object.keys(result.metafile?.inputs??{})){const path=isAbsolute(name)?name:resolve(ROOT,name);if(existsSync(path))inputs.set(path,sha(readFileSync(path)));}});}}]});
const bundle=built.outputFiles[0].text;mark('bundle:end',{inputs:inputs.size});writeFileSync(resolve(OUT,'bundle.sha256'),sha(bundle)+'\n');
mark('import:begin');const {bake}=await import('data:text/javascript;base64,'+Buffer.from(bundle).toString('base64'));mark('import:end');
mark('prejoin:begin');const snapshot=await bake();mark('prejoin:end',{solids:snapshot.cuts.solids.length,beds:snapshot.cuts.beds.length});
if('world' in snapshot||snapshot.cuts.solids.some(s=>(s.sourceId??s.id.split('@')[0])==='mountainV2.funicularFoot.apron'))throw new Error('Snapshot passed the intended pre-join stop');
const terrain=Buffer.from(snapshot.buffer),cuts=Buffer.from(JSON.stringify(snapshot.cuts)),ground=Buffer.from(JSON.stringify(snapshot.groundInputs)),corridors=Buffer.from(JSON.stringify(snapshot.corridors));
writeFileSync(resolve(OUT,'terrain.bin'),terrain);writeFileSync(resolve(OUT,'cuts.json.gz'),gzipSync(cuts));writeFileSync(resolve(OUT,'ground-inputs.json.gz'),gzipSync(ground));writeFileSync(resolve(OUT,'corridors.json.gz'),gzipSync(corridors));
const drift=[...inputs].filter(([p,h])=>sha(readFileSync(p))!==h).map(([path,before])=>({path,before,after:sha(readFileSync(path))}));
const manifest={status:drift.length?'REJECTED_SOURCE_DRIFT':'PREJOIN_SNAPSHOT_ONLY',createdAt:new Date().toISOString(),root:realpathSync(ROOT),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),entryOriginalSha256:sha(original),entryOverlaySha256:sha(overlay),bundleSha256:sha(bundle),sourceInputs:Object.fromEntries(inputs),drift,assets:{terrain:{path:'terrain.bin',sha256:sha(terrain)},cuts:{path:'cuts.json.gz',decodedSha256:sha(cuts)},groundInputs:{path:'ground-inputs.json.gz',decodedSha256:sha(ground)},corridors:{path:'corridors.json.gz',decodedSha256:sha(corridors)}},semantics:'Exact JS number round-trip via JSON.stringify, no Horizon decimal rounding. Decode terrain.bin at full tier; construct mountainSourceEnvironment from ground-inputs, then fit cloned cuts. No fit/world/lite/serialization acceptance claimed.'};
writeFileSync(resolve(OUT,'manifest.json'),JSON.stringify(manifest,null,2));mark('snapshot:written');delete globalThis.__horizonBakeTiming;
if(drift.length)throw new Error('Source changed during snapshot; reject output');console.log(JSON.stringify({out:OUT,status:manifest.status,solids:snapshot.cuts.solids.length,beds:snapshot.cuts.beds.length,wallMs:performance.now()-start,cpu:process.cpuUsage(cpu0)},null,2));
