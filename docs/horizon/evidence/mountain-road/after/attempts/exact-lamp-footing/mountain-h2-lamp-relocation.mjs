/** Root-executable diagnostic only. No checkout writes. A temporary candidate plan is not a production acceptance pass.
 * At the first failed actual safety target, inspect the existing +/-12m interval
 * at 0.25m instead of 1.5m. Every production reject/make/foot-support rule stays intact.
 * This reads the served world/terrain with the exact horizonNativeFurniture test loader.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]??'/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book');
const out=resolve(process.argv[3]??'/tmp/mountain-h2-lamp-relocation');
const expected=[1324.7544049798214,671.2465400241723];
process.chdir(root);await mkdir(out,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const lampsPath=resolve(root,'src/harbour/horizon/land/corridor/plan/lamps.ts');
const source=await readFile(lampsPath,'utf8');
const marker="    if(!best)throw new Error(`${A.id}: no supported lamp site covers safety target ${pending[0]}`);";
if(source.split(marker).length!==2)throw new Error('Diagnostic source fence changed: expected one safety-site failure');
const relocationSearch=`    if(!best){
      // Diagnostic candidate only. Keep the existing search interval and physical
      // reject/make rules, but sample it at .25m for each still-pending H2 target.
      if(pending.some(p=>Math.hypot(p[0]-${expected[0]},p[1]-${expected[1]})>20))throw new Error('Relocation diagnostic escaped the H2 target cluster');
      (globalThis as any).__mountainLampRequired=required;
      const previouslyCovered=required.filter(p=>out.some(o=>covers(o.l,p)));
      let choice:any=null;
      const audit:any={pass,pending:pending.length,previouslyCovered:previouslyCovered.length,attempted:0,physicalRejected:0,spacingRejected:0,coverageLost:0,eligible:[]};
      const seen=new Set<string>();
      for(const target of pending){
        let near={s:0,d:Infinity};for(let i=0;i<n;i+=10){const q=F.project(target[0],target[1],i,10);if(q.d<near.d)near=q;}
        for(let k=-48;k<=48;k++){const s=F.wrapS(near.s+k*.25);if(!F.closed&&(s<=.2||s>=F.length-.2))continue;
          const st=S[F.nearestIndex(s)]!,kind:LampKind=st.structureId?(env.structureKind(st.structureId)==='tunnel'?'tunnelLamp':'bridgeLantern'):'roadLantern';
          for(const side of ['left','right'] as const){
            const key=s.toFixed(6)+':'+side;if(seen.has(key))continue;seen.add(key);audit.attempted++;
            if(kind!=='roadLantern'){audit.physicalRejected++;continue;}
            if(env.lampSetback&&measuredSetback(s,side)===undefined&&!env.lampMountAllowed){audit.physicalRejected++;continue;}
            if(reject(s,side,kind)){audit.physicalRejected++;continue;}
            const l=make({s,side,kind});if(!l||!covers(l,target))continue;
            const conflicts=out.flatMap((o,index)=>o.l.kind===kind&&o.l.side===side&&Math.abs(F.delta(o.s,s))<4?[index]:[]);
            // Move at most one existing fixture; never waive same-side spacing.
            if(conflicts.length>1){audit.spacingRejected++;continue;}
            const replaced=conflicts[0]??-1;
            const lost=previouslyCovered.filter(p=>!covers(l,p)&&!out.some((o,index)=>index!==replaced&&covers(o.l,p)));
            if(lost.length){audit.coverageLost++;continue;}
            const gained=pending.filter(p=>covers(l,p));if(!gained.length)continue;
            const margin=Math.min(...gained.map(p=>l.poolRadius-Math.hypot(p[0]-l.pool[0],p[1]-l.pool[2])));
            const move=replaced<0?0:Math.abs(F.delta(out[replaced]!.s,s));
            const c={l,s,score:gained.length,margin,replaced,move,gained};
            audit.eligible.push({s,side,at:l.at,pool:l.pool,score:c.score,margin,replaced:replaced<0?null:{s:out[replaced]!.s,at:out[replaced]!.l.at,pool:out[replaced]!.l.pool},move});
            if(!choice||c.score>choice.score||c.score===choice.score&&(c.margin>choice.margin||c.margin===choice.margin&&c.move<choice.move))choice=c;
          }
        }
      }
      const log=((globalThis as any).__mountainLampRelocation??=[]);log.push(audit);
      if(choice){
        audit.selected={s:choice.s,side:choice.l.side,at:choice.l.at,head:choice.l.head,pool:choice.l.pool,score:choice.score,margin:choice.margin,gained:choice.gained,previouslyCovered,unchangedCoverage:true,old:choice.replaced<0?null:{...out[choice.replaced]!.l,s:out[choice.replaced]!.s},move:choice.move};
        if(choice.replaced>=0)out.splice(choice.replaced,1);
        best={l:choice.l,s:choice.s,score:choice.score,margin:choice.margin};
      }
    }
`;
const instrument=`    if(!best){
      const target=pending[0]!;
      if(Math.hypot(target[0]-${expected[0]},target[1]-${expected[1]})>20)throw new Error('Diagnostic target changed: '+target);
      let near={s:0,d:Infinity};for(let i=0;i<n;i+=10){const q=F.project(target[0],target[1],i,10);if(q.d<near.d)near=q;}
      const sampleFoot=(l:LampSpot)=>roadLampFootprint(l).map(([x,z])=>({x,z,ground:env.ground(x,z),delta:env.ground(x,z)-l.at[1],wet:env.wet(x,z),occupied:env.occupied(x,z,0,6)}));
      const rows=[];
      for(let k=-48;k<=48;k++){const d=k*.25,s=F.wrapS(near.s+d);if(!F.closed&&(s<=.2||s>=F.length-.2))continue;
        const st=S[F.nearestIndex(s)]!,kind:LampKind=st.structureId?(env.structureKind(st.structureId)==='tunnel'?'tunnelLamp':'bridgeLantern'):'roadLantern';
        for(const side of ['left','right'] as const){
          const reason=reject(s,side,kind),l=make({s,side,kind});if(!l)continue;
          const overlap=out.filter(o=>o.l.kind===kind&&o.l.side===side&&Math.abs(F.delta(o.s,s))<4).map(o=>({s:o.s,at:o.l.at,pool:o.l.pool}));
          const special=kind==='bridgeLantern'&&(seaSide(st)===side||!['bridgeRail','postRail','stoneParapet'].includes(st[side].guard));
          const measured=kind==='roadLantern'?measuredSetback(s,side):undefined;
          const guard=kind==='roadLantern'?mountedCandidate(s,side):null;
          const distance=Math.hypot(target[0]-l.pool[0],target[1]-l.pool[2]);
          const groundSites=[];
          if(kind==='roadLantern')for(let j=0;j<17;j++){const back=.9+j*.25,c=roadCandidate(s,side,back),foot=sampleFoot(c);groundSites.push({back,at:c.at,head:c.head,yaw:c.yaw,maxGroundDelta:Math.max(...foot.map(p=>Math.abs(p.delta))),roadStep:Math.abs(c.at[1]-st.at[1]),wet:foot.some(p=>p.wet),occupied:foot.some(p=>p.occupied),supported:roadLampFootSupported(c,{ground:env.ground,occupied:env.occupied,water:env.wet})});}
          rows.push({d,s,side,kind,onOriginalStationGrid:k%6===0,station:{at:st.at,half:st.half,side:st[side],structureId:st.structureId},measured:measured??null,reason,special,overlap,at:l.at,head:l.head,pool:l.pool,yaw:l.yaw,poolRadius:l.poolRadius,distance,covers:distance<=l.poolRadius,legalByPlanner:!reason&&!special&&!overlap.length,foot:sampleFoot(l),guard:guard?{at:guard.at,head:guard.head,pool:guard.pool,yaw:guard.yaw,allowed:env.lampMountAllowed?.(guard,side)??false}:null,groundSites});
        }
      }
      (globalThis as any).__mountainLampDiagnostic={target,near,required,pending,present:out.map(o=>({s:o.s,...o.l})),rows};
    }
`+marker;
const adapted=source.replace("import {roadLampFootSupported}","import {roadLampFootprint,roadLampFootSupported}").replace(marker,relocationSearch+instrument);
await writeFile(resolve(out,'lamps.instrumented.ts'),adapted);
const {build}=await import(pathToFileURL(resolve(root,'node_modules/esbuild/lib/main.js')).href);
const exports=`export {buildMountainCorridor,mountainPlanEnvironment} from './src/harbour/horizon/land/corridor/mountain.ts';
export {createCorridorEnv} from './src/harbour/horizon/land/corridor/stations.ts';
export {createMountainV2Region,terraceBedExclusion} from './src/harbour/horizon/regions/mountainV2/index.ts';
export {decodeTerrainAsset} from './src/harbour/horizon/land/terrain/asset.ts';
export {sampleTerrain} from './src/harbour/horizon/land/terrain/index.ts';
export {corridorDestinations} from './src/harbour/horizon/world/build.ts';
export {nativeOccupied} from './src/harbour/horizon/land/mountainV2/planning.ts';
export {nearestOnPath} from './src/harbour/horizon/land/structures/mesh.ts';
export {pointInPolygon} from './src/harbour/horizon/world/geometry.ts';
export {Frame} from './src/harbour/horizon/land/corridor/plan/frame.ts';
export {roadLampFootprint} from './src/harbour/horizon/land/corridor/plan/lampFootprint.ts';`;
const bundled=await build({stdin:{contents:exports,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'error',plugins:[{name:'diagnostic-only',setup(b){b.onLoad({filter:/land\/corridor\/plan\/lamps\.ts$/},args=>({contents:adapted,loader:'ts',resolveDir:dirname(args.path)}));}}]});
const bundle=bundled.outputFiles[0].text;await writeFile(resolve(out,'api.mjs'),bundle);
const m=await import(pathToFileURL(resolve(out,'api.mjs')).href);
const worldBytes=await readFile(resolve(root,'public/horizon/world/horizon-geo-1.json')),terrainBytes=await readFile(resolve(root,'public/horizon/terrain/horizon-geo-1.bin')),v2Bytes=await readFile(resolve(root,'src/harbour/horizon/land/mountainV2/v2-data.json'));
const world=JSON.parse(worldBytes),V2=JSON.parse(v2Bytes),field=m.decodeTerrainAsset(terrainBytes.buffer.slice(terrainBytes.byteOffset,terrainBytes.byteOffset+terrainBytes.byteLength)),terrain=(x,z)=>m.sampleTerrain(field,x,z);
const region=m.createMountainV2Region({horizonGround:terrain,yield:m.terraceBedExclusion(world.collision.beds),terrainStep:field.step});
const ground=(x,z)=>region.provider.owns(x,z)?region.provider.ground(x,z):terrain(x,z);
const cuts={...world.collision,solids:world.geometry.solids,diagnostics:[]},env=m.createCorridorEnv(cuts,ground),offRoad=m.createCorridorEnv({...cuts,beds:cuts.beds.filter(b=>b.id!=='mountainV2.road')},ground);
let failure=null,candidate=null;try{candidate=m.buildMountainCorridor(env,m.corridorDestinations(cuts));}catch(e){failure=String(e?.stack??e);}
const diagnostic=globalThis.__mountainLampDiagnostic??(candidate?{target:expected,near:null,required:globalThis.__mountainLampRequired??[],pending:[],present:candidate.lamps,rows:[]}:null);
if(!diagnostic){await writeFile(resolve(out,'failure.txt'),failure??'Plan did not reach the expected failed H2 target');throw new Error('Expected H2 diagnostic was not reached; see failure.txt');}
function parapetCells(guard,step){
 const side=guard.side==='left'?1:-1,samples=V2.road.samples.filter(s=>s.s>=guard.s0&&s.s<=guard.s1);
 const rows=samples.filter((_,i)=>i%step===0||i===samples.length-1).map(s=>({inside:[s.at[0]+s.normal[0]*s.hw*side,s.at[2]+s.normal[2]*s.hw*side],outside:[s.at[0]+s.normal[0]*(s.hw+.5)*side,s.at[2]+s.normal[2]*(s.hw+.5)*side],y:s.at[1]}));
 return rows.slice(1).map((b,i)=>({outline:[rows[i].inside,b.inside,b.outside,rows[i].outside],bottom:Math.max(rows[i].y,b.y)-.05,top:Math.min(rows[i].y,b.y)+.95}));
}
function enrich(l,side){
 const feet=m.roadLampFootprint(l).map(([x,z])=>({x,z,offRoadOccupied:offRoad.occupied(x,z),nativeOccupied:m.nativeOccupied(x,z,()=>l.at[1],0,6,'mountain-road')}));
 const guard=V2.road.guards.find(g=>g.kind==='parapet'&&g.side===side&&m.nearestOnPath([l.at[0],l.at[2]],g.points).distance<.2);
 if(!guard)return {feet,guardId:null,anchored:false};
 const dx=l.head[0]-l.at[0],dz=l.head[2]-l.at[2],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
 const support=[1,2].map(step=>{const cells=parapetCells(guard,step);return {step,points:[-.2,-.15,-.1].flatMap(u=>[-.2,0,.2].map(v=>{const x=l.at[0]+ux*u-uz*v,z=l.at[2]+uz*u+ux*v;return {x,z,anchored:cells.some(c=>m.pointInPolygon(x,z,c.outline)&&l.at[1]+.1>=c.bottom&&l.at[1]+.3<=c.top)};}))};});
 return {feet,guardId:guard.id,anchored:support.every(t=>t.points.every(p=>p.anchored)),support};
}
for(const row of diagnostic.rows){if(row.guard)row.guard.actualSupport=enrich(row.guard,row.side);if(row.legalByPlanner&&row.covers)row.actualSupport=enrich(row,row.side);}
const validation=[];
if(candidate){
 const E=m.mountainPlanEnvironment(env,m.corridorDestinations(cuts)),F=new m.Frame(candidate.stations,false);
 for(const l of candidate.lamps.filter(l=>l.kind==='roadLantern')){
  const support=enrich(l,l.side),foot=m.roadLampFootprint(l).map(([x,z])=>({x,z,dy:ground(x,z)-l.at[1],wet:E.water(x,z),occupied:E.occupied(x,z)}));
  const q=m.nearestOnPath([l.at[0],l.at[2]],candidate.stations.map(s=>s.at)),st=F.st(F.nearestIndex(q.along));
  const supported=support.guardId!==null?support.anchored&&support.feet.every(p=>!p.offRoadOccupied&&!p.nativeOccupied):foot.every(p=>!p.occupied&&Math.abs(p.dy)<=.141);
  validation.push({id:l.id,at:l.at,pool:l.pool,mount:support.guardId,anchored:support.anchored,maxGroundDelta:Math.max(...foot.map(p=>Math.abs(p.dy))),outsideLane:q.distance>st.half/2+.6,wet:foot.some(p=>p.wet),supported,foot,...(support.guardId?{support}:{})});
 }
 await writeFile(resolve(out,'candidate-corridor.json'),JSON.stringify(candidate,null,2));
}
const relocation=globalThis.__mountainLampRelocation??[];
const coverage=candidate?['full','lite'].map(tier=>{const lamps=tier==='full'?candidate.lamps:candidate.lamps.filter(l=>candidate.liteLampIds.includes(l.id));return {tier,targets:diagnostic.required.length,uncovered:diagnostic.required.filter(p=>!lamps.some(l=>Math.hypot(p[0]-l.pool[0],p[1]-l.pool[2])<=l.poolRadius))};}):null;
const legal=diagnostic.rows.filter(r=>r.legalByPlanner&&r.covers).map(r=>({s:r.s,d:r.d,side:r.side,kind:r.kind,onOriginalStationGrid:r.onOriginalStationGrid,at:r.at,head:r.head,pool:r.pool,distance:r.distance,measured:r.measured,groundSupported:r.measured!==null,actualSupport:r.actualSupport}));
const reasons={};for(const r of diagnostic.rows){const key=r.reason??(r.special?'bridge-side':r.overlap.length?'spacing':r.covers?'legal-covered':'legal-out-of-pool');reasons[key]=(reasons[key]??0)+1;}
const metadata={root,worldSha256:sha(worldBytes),terrainSha256:sha(terrainBytes),v2Sha256:sha(v2Bytes),sourceLampSha256:sha(source),adaptedLampSha256:sha(adapted),bundleSha256:sha(bundle),method:'Actual production planner failure instrumented in a temporary source overlay. Temporary candidate plan only, no scene, controller, bake or source mutation. On failed H2 coverage only, sample the same +/-12m interval at .25m; add a legal fixture or relocate exactly one spacing conflict only when every previously covered required target remains covered. Test loader retained exactly.',limits:['Sites are diagnostic candidates. A changed real plan must still pass every unchanged actual fixture and coverage assertion. Candidate validates all emitted road lanterns with the unchanged independent support test.','No search interval, reserved route width, lamp shape, pool radius, support tolerance, native source, material or controller change.','Masonry proof reproduces the exact conservative nine-anchor full/lite test, not a nearby guard label.','The rescue search is confined to the failed H2 cluster. Previously covered targets are retained and the final full/lite required target sets are checked, but real runtime anchors, night appearance and final bake remain separate gates.']};
const result={metadata,failure,candidateCompleted:!!candidate,coverage,relocation,validation,...diagnostic};await writeFile(resolve(out,'report.json'),JSON.stringify(result,null,2));
await writeFile(resolve(out,'summary.json'),JSON.stringify({metadata,candidateCompleted:!!candidate,coverage,lamps:candidate?.lamps.length,validationFailures:validation.filter(r=>!r.supported||r.wet||!r.outsideLane),relocation:relocation.map(r=>({...r,eligible:r.eligible.length,selected:r.selected?{...r.selected,previouslyCovered:r.selected.previouslyCovered.length}:null})),target:diagnostic.target,near:diagnostic.near,pending:diagnostic.pending.length,reasons,legal},null,2));
console.log(JSON.stringify({out,candidateCompleted:!!candidate,coverage,lamps:candidate?.lamps.length,validationFailures:validation.filter(r=>!r.supported||r.wet||!r.outsideLane),relocations:relocation.map(r=>r.selected?{s:r.selected.s,at:r.selected.at,old:r.selected.old?.at,move:r.selected.move,gained:r.selected.score}:null),target:diagnostic.target,pending:diagnostic.pending.length,reasons,legal:legal.map(r=>({s:r.s,side:r.side,distance:r.distance,at:r.at,groundSupported:r.groundSupported,anchored:r.actualSupport?.anchored}))},null,2));
