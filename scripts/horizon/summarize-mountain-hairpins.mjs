#!/usr/bin/env node
/** Read-only evidence reduction: parses reports/bake JSON; imports no world, renderer, or controller.
 * node scripts/horizon/summarize-mountain-hairpins.mjs --root <checkout> \
 *   --cruiser <paced/audit.json> --cruiser <natural/audit.json> \
 *   --native <paced/native-results.json> --native <natural/native-results.json> \
 *   --inventory <before/inventory.json> --out <new-directory>
 * --world and --native-source optionally override the checkout's baked gzip/exported station map.
 */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {nativeStationMap, nativeToChain, nativeSampleChainStation, wrapAngle} from './mountain-audit-telemetry.mjs';

const finite = Number.isFinite, sha = b => createHash('sha256').update(b).digest('hex');
const maxOrNull = xs => xs.length ? Math.max(...xs) : null;
const minOrNull = xs => xs.length ? Math.min(...xs) : null;

/** Direct observations and same-attempt entry brackets only. A jump/restart never fills a hairpin. */
export function hairpinObservation(samples, lo, hi, direction, cadence = .1, allowBrackets = true) {
  const sign = direction === 'reverse' || direction === 'rev' ? -1 : 1, entry = sign > 0 ? lo : hi;
  const inside = samples.filter(p => !p.discontinuity && finite(p.s) && p.s >= lo && p.s <= hi);
  let entrySpeedMps = null, entryEvidence = null;
  for (let i = 0; i < samples.length; i++) {
    const b = samples[i], a = samples[i - 1];
    if (b.discontinuity || !finite(b.s)) continue;
    if (Math.abs(b.s - entry) < 1e-6 && finite(b.speed)) { entrySpeedMps = b.speed; entryEvidence = {kind:'sample',timeSeconds:b.t}; break; }
    if (!allowBrackets || !a || a.discontinuity || a.segment !== b.segment || !finite(a.s) || !finite(a.t) || !finite(b.t)) continue;
    const dt = b.t - a.t, ds = Math.abs(b.s - a.s);
    // The small station allowance covers the legacy 0.5 m nearest-sample station quantization.
    if (dt <= 0 || dt > Math.max(cadence * 1.5, .15) || ds > Math.max(a.speed, b.speed) * dt + 1.1) continue;
    if (a.s * sign <= entry * sign && b.s * sign >= entry * sign && (b.s - a.s) * sign > 0) {
      if (finite(a.speed) && finite(b.speed)) entrySpeedMps = a.speed + (b.speed - a.speed) * ((entry - a.s) / (b.s - a.s));
      entryEvidence = {kind:'interpolated-between-observations',bracketSeconds:[a.t,b.t],bracketStations:[a.s,b.s],segment:a.segment}; break;
    }
  }
  const curves = [], turns = [], reserves = [];
  for (const p of inside) {
    if (finite(p.curvature) && (!p.curvatureIntervalStations || p.curvatureIntervalStations.every(s => s >= lo && s <= hi))) curves.push(Math.abs(p.curvature));
    if (finite(p.turnRate)) turns.push(Math.abs(p.turnRate));
    if (finite(p.steer)) reserves.push(1 - Math.abs(p.steer));
  }
  const reached = inside.length > 0 || entryEvidence !== null;
  return {reached, reachedEvidence:entryEvidence ? 'entry-observed' : inside.length ? 'interior-observed; entry not captured' : 'not-observed',
    entrySpeedMps, entryEvidence, interiorSamples:inside.length,
    maxObservedAbsCurvaturePerM:maxOrNull(curves), maxObservedAbsHeadingTurnRateRadPerS:maxOrNull(turns),
    minimumSteeringInputReserve:minOrNull(reserves), physicalGripMargin:null,
    contactSamples:inside.filter(p => p.contact).length, airborneSamples:inside.filter(p => p.airborne).length,
    offBedSamples:inside.some(p => typeof p.offBed === 'boolean') ? inside.filter(p => p.offBed === true).length : null,
    offBedObservedSamples:inside.filter(p => typeof p.offBed === 'boolean').length,
    offBedUnknownSamples:inside.filter(p => typeof p.offBed !== 'boolean').length,
    limits:[...(!inside.length && reached ? ['Entry was crossed between observations; no interior turn/steer measurement.'] : []),
      ...(!allowBrackets ? ['Legacy restarted trace has no segment IDs; reach/entry interpolation across samples is disabled.'] : []),
      'Reported maxima/minima are sampled observations, not bounds between samples. Steering reserve is command headroom, not physical grip.']};
}

export function nearestLamp(lamps, at) {
  let best = null;
  for (const l of lamps) {
    const pool = l.pool ?? l.at, d = Math.hypot(pool[0] - at[0], pool[2] - at[2]);
    if (!best || d < best.poolPlanDistanceM) best = {id:l.id, corridorId:l.corridorId, kind:l.kind,
      poolPlanDistanceM:d, poolHeightDifferenceM:pool[1] - at[1], poolRadiusM:l.poolRadius ?? null,
      basePlanDistanceM:Math.hypot(l.at[0] - at[0], l.at[2] - at[2]),
      headSpatialDistanceM:l.head ? Math.hypot(...l.head.map((v,i) => v - at[i])) : null};
  }
  return best;
}

function run(argv) {
  const many = name => argv.flatMap((s,i) => s === name ? [argv[i + 1]] : []);
  const one = (name, fallback) => many(name)[0] ?? fallback;
  const root = resolve(one('--root',process.cwd())), path = p => resolve(root,p), load = p => JSON.parse(readFileSync(p,'utf8'));
  const inventoryPath = path(one('--inventory','docs/horizon/evidence/mountain-road/before/inventory.json'));
  const worldPath = path(one('--world','public/horizon/world/horizon-geo-1.json.gz'));
  const sourcePath = path(one('--native-source','src/harbour/horizon/land/mountainV2/v2-data.json'));
  const out = path(one('--out','/tmp/mountain-hairpin-summary'));
  const reports = [...many('--cruiser').map(p => ({kind:'cruiser',path:path(p)})), ...many('--native').map(p => ({kind:'native',path:path(p)}))];
  if (!reports.length) throw new Error('Supply at least one --cruiser audit.json or --native native-results.json');
  const worldBytes = readFileSync(worldPath), worldHash = sha(worldBytes), world = JSON.parse((worldPath.endsWith('.gz') ? gunzipSync(worldBytes) : worldBytes).toString());
  const chain = world.roadChains?.find(c => c.id === 'mountain-road'), road = (world.collision?.beds ?? world.beds).find(b => b.id === 'mountainV2.road');
  if (!chain || !road) throw new Error('This baked definition has no canonical mountain-road chain/native road');
  const sourceBytes = readFileSync(sourcePath), mapping = nativeStationMap(JSON.parse(sourceBytes).road.samples,road.points,chain);
  if (!mapping.valid) throw new Error(mapping.reason);
  const inventoryBytes = readFileSync(inventoryPath), inventory = JSON.parse(inventoryBytes), hairpins = Array.isArray(inventory) ? inventory : inventory.hairpins;
  if (!Array.isArray(hairpins) || !hairpins.length) throw new Error('Inventory/hairpin input has no hairpin groups');
  const part = id => chain.parts.find(p => p.id === id);
  const rangeFor = r => r.chainRange ?? (r.routeKind === 'chain' || r.route === chain.id ? {from:0,to:chain.widths.at(-1).s} : part(r.route));
  const halfAt = s => {
    const rows = chain.widths; let i = 1; while (i < rows.length - 1 && rows[i].s < s) i++;
    const a = rows[i-1], b = rows[i], t = Math.max(0,Math.min(1,(s-a.s)/(b.s-a.s||1))); return a.half+(b.half-a.half)*t;
  };
  const fullLamps = (world.corridors ?? []).flatMap(c => c.lamps.map(l => ({...l,corridorId:c.id})));
  const liteLamps = (world.corridors ?? []).flatMap(c => c.lamps.filter(l => !c.liteLampIds || c.liteLampIds.includes(l.id)).map(l => ({...l,corridorId:c.id})));
  const attempts = [], ignoredRoutes = [], staticReports = [], provenance = [];
  let terrainHash = null;
  for (const input of reports) {
    const bytes = readFileSync(input.path), report = JSON.parse(bytes), bake = report.meta?.bake ?? report.bake;
    if (bake?.worldSha256 !== worldHash) throw new Error(`${input.path}: world hash differs from the supplied bake; do not mix generations`);
    if (!bake.terrainSha256 || terrainHash && terrainHash !== bake.terrainSha256) throw new Error(`${input.path}: reports do not identify the same terrain bake`);
    terrainHash = bake.terrainSha256;
    const scenario = input.kind === 'cruiser' ? report.meta?.scenario?.id ?? 'paced' : report.scenario ?? 'paced';
    provenance.push({...input,sha256:sha(bytes),scenario,bake,sourceProof:report.meta?.sourceProof ?? report.sourceProof ?? null});
    if (input.kind === 'cruiser') {
      if (report.stations?.['mountain-chain']?.length) staticReports.push({input,report});
      for (const d of report.drives ?? []) {
        if (d.bed !== 'mountain-chain') { ignoredRoutes.push({input:input.path,route:d.bed,reason:'not the canonical mountain chain'}); continue; }
        const raw = (report.telemetry ?? []).filter(t => t.bed === d.bed && t.dir === d.dir && t.lane === d.lane);
        const cadence = report.meta?.telemetry?.sampleIntervalSeconds ?? 12 * (report.meta?.cruiser?.dt ?? 1/120);
        const samples = raw.map((t,i) => ({s:finite(t.chainS)?t.chainS:t.s, t:finite(t.timeSeconds)?t.timeSeconds:(i+1)*cadence,
          speed:t.velocity?Math.hypot(t.velocity[0],t.velocity[2]):t.speed, segment:t.segment??null,
          curvature:t.observedCurvature??null,turnRate:t.headingTurnRate??null,steer:t.steer??null,
          contact:t.contact,airborne:t.grounded===false,offBed:typeof t.offBed === 'boolean' ? t.offBed : null,discontinuity:!!t.discontinuity}));
        attempts.push({kind:input.kind,scenario,input:input.path,route:d.bed,direction:d.dir,lane:d.lane,attempted:d.steps>0,
          range:{from:0,to:chain.widths.at(-1).s},completed:d.completed,reason:d.reason??null,restarts:d.restarts?.length??0,
          kernelRecoveries:d.kernelRecoveries??null,contactFrames:d.contacts,airborneFrames:d.airborneSteps,offBedFrames:d.offBedSteps??null,
          brakeFrames:d.brakeSteps??null, samples,cadence,allowBrackets:!(d.restarts?.length && raw.some(t => !finite(t.segment))),
          limits:report.meta?.scenario?.limits ?? ['Legacy paced cruiser telemetry has no measured velocity/heading/steer; those table fields remain unavailable.']});
      }
    } else {
      for (const r of report.results ?? []) {
        const range = rangeFor(r);
        if (!range) { ignoredRoutes.push({input:input.path,route:r.route,reason:'no canonical chain station range; not projected onto a different route'}); continue; }
        const cadence = report.telemetry?.sampleIntervalSeconds ?? 1;
        const samples = (r.samples??[]).map(t => {
          const s = nativeSampleChainStation(t,r,range);
          return {s,t:finite(t.timeSeconds)?t.timeSeconds:t.t, speed:t.velocity?Math.hypot(t.velocity[0],t.velocity[2]):t.speed,
            segment:t.segment??0,velocity:t.velocity,heading:t.heading,legacyVelocityTrace:!Object.hasOwn(t,'observedCurvature'),curvature:t.observedCurvature??null,
            turnRate:t.headingTurnRate??t.turnRate??null,steer:t.steer??null,contact:t.contact,airborne:t.phase==='air',
            offBed:finite(s) && finite(t.observedOff??t.off) ? (t.observedOff??t.off)>halfAt(s) : null,discontinuity:!!t.discontinuity};
        });
        // Legacy native reports carry measured velocities at 1 Hz. Use only consecutive
        // samples for an explicitly interval-averaged curvature; never use bendRadius as observation.
        for (let i=1;i<samples.length;i++) {
          const a=samples[i-1], b=samples[i], dt=b.t-a.t;
          if (b.legacyVelocityTrace && b.curvature===null && a.velocity && b.velocity && a.speed>=.25 && b.speed>=.25 && dt>0 && dt<=cadence*1.5 && !a.discontinuity && !b.discontinuity) {
            b.curvature=wrapAngle(Math.atan2(b.velocity[0],b.velocity[2])-Math.atan2(a.velocity[0],a.velocity[2]))/dt/((a.speed+b.speed)/2);
            b.curvatureAveragedOverSeconds=dt;b.curvatureIntervalStations=[a.s,b.s];
          }
        }
        attempts.push({kind:input.kind,scenario,input:input.path,route:r.route,direction:r.direction,lane:0,attempted:r.attempted,
          range,completed:r.completed,reason:r.reason,restarts:r.restarts??0,kernelRecoveries:(r.events??[]).filter(e=>e.kind==='recovered').length,
          contactProbes:r.contacts,airborneFrames:r.airborneFrames, samples,cadence,allowBrackets:!(r.restarts>0),
          limits:[...(report.limits??[]),'Legacy native d+0.5 is direction-relative plan progress; reverse maps from the route end, and each reach has its own chain offset.',
            ...(samples.some(p=>p.curvatureAveragedOverSeconds) ? ['Legacy velocity curvature is an interval average at the recorded cadence, not an instantaneous peak.'] : [])]});
      }
    }
  }
  const rows = [];
  for (const attempt of attempts) for (const h of hairpins) {
    const lo=nativeToChain(h.s0,mapping),hi=nativeToChain(h.s1,mapping);
    if (hi < attempt.range.from || lo > attempt.range.to) continue;
    const sourceSamples=mapping.samples.filter(p=>p.nativeS>=h.s0 && p.nativeS<=h.s1);
    const apex=sourceSamples.reduce((a,b)=>Math.hypot(b.at[0]-h.at[0],b.at[2]-h.at[2])<Math.hypot(a.at[0]-h.at[0],a.at[2]-h.at[2])?b:a);
    const probes=staticReports.flatMap(({input,report})=>{
      const nearest=report.stations['mountain-chain'].reduce((a,b)=>Math.abs(b.s-apex.chainS)<Math.abs(a.s-apex.chainS)?b:a);
      const findings=(report.issues?.['mountain-chain']??[]).filter(e=>e.type==='missing-guard' && Array.isArray(e.station) && e.station[0]<=hi && e.station[1]>=lo);
      return [{input:input.path,stationPlanM:nearest.s,apexStationDifferenceM:nearest.s-apex.chainS,
        left:nearest.leftEdge??{kind:nearest.L,d:nearest.Ld},right:nearest.rightEdge??{kind:nearest.R,d:nearest.Rd},missingGuardFindings:findings}];
    });
    rows.push({kind:attempt.kind,scenario:attempt.scenario,input:attempt.input,route:attempt.route,direction:attempt.direction,lane:attempt.lane,
      hairpin:h.id,nativeSpatialRangeM:[h.s0,h.s1],chainPlanRangeM:[lo,hi],at:h.at,
      ...hairpinObservation(attempt.samples,lo,hi,attempt.direction,attempt.cadence,attempt.allowBrackets),
      attempt:{attempted:attempt.attempted,completed:attempt.completed,reason:attempt.reason,restarts:attempt.restarts,kernelRecoveries:attempt.kernelRecoveries},
      guards:{beforeNativeSource:{left:h.guardLeft,right:h.guardRight},finalStaticProbes:probes,
        limitation:'Before guard tags describe the inventory source. Final probes are collision edges/nearby missing-guard diagnostics, not visual or guard-height acceptance. Sides use canonical source direction.'},
      nearestBakedLamp:{full:nearestLamp(fullLamps,h.at),lite:nearestLamp(liteLamps,h.at)}});
  }
  const result={generatedAt:new Date().toISOString(),provenance:{world:{path:worldPath,sha256:worldHash},terrainSha256:terrainHash,
    inventory:{path:inventoryPath,sha256:sha(inventoryBytes),sourceHead:inventory.sha??null,worldSha256:inventory.worldHash??null,terrainSha256:inventory.terrainHash??null},nativeSource:{path:sourcePath,sha256:sha(sourceBytes)},reports:provenance},
    mapping:{...mapping,samples:undefined},method:{steeringReserve:'minimum sampled 1-abs(applied steer); input headroom, not tyre force',physicalGripMargin:null,
      nearestLamps:'nearest baked corridor lamp pool in plan at inventory apex; full uses all lamps, lite uses baked liteLampIds exactly; base/head/height differences retained',
      activeLights:'shared runtime pool full 6 / lite 2; nearest fixture is not proof of active light, scene visibility, illuminance, pool occlusion, dusk scheduling, or theme/device acceptance'},
    attempts:attempts.map(({samples,...a})=>({...a,sampleCount:samples.length})),ignoredRoutes,rows};
  const fmt=(x,d=2)=>finite(x)?x.toFixed(d):'unavailable', esc=x=>String(x??'—').replaceAll('|','\\|');
  let md='# Mountain hairpin observations\n\nSeparate ordinary-input scenarios; sampled kinematics only. Physical grip margin is unavailable. Native spatial s is mapped through matching full source/baked points into canonical chain plan metres.\n\n';
  md+='| Mode / scenario / route / direction / lane | Hairpin | Reached | Entry m/s | Max observed curvature 1/m | Max body turn rad/s | Min steering input reserve | Nearest full / lite pool m |\n|---|---|---|---:|---:|---:|---:|---|\n';
  for(const r of rows)md+=`| ${esc(`${r.kind} / ${r.scenario} / ${r.route} / ${r.direction} / ${r.lane}`)} | ${r.hairpin} | ${r.reached?'yes':'not observed'} | ${fmt(r.entrySpeedMps)} | ${fmt(r.maxObservedAbsCurvaturePerM,4)} | ${fmt(r.maxObservedAbsHeadingTurnRateRadPerS,3)} | ${fmt(r.minimumSteeringInputReserve,3)} | ${fmt(r.nearestBakedLamp.full?.poolPlanDistanceM)} / ${fmt(r.nearestBakedLamp.lite?.poolPlanDistanceM)} |\n`;
  md+='\nEntry speeds interpolated across a valid same-attempt observation bracket are marked in JSON; no sample between a failed attempt and its restart implies reach. Unreached or undersampled turns retain unavailable metrics. Native legacy curvature is a velocity-trace interval average where marked, and legacy cruiser turn/steer metrics stay unavailable. A reached hairpin is not a clean passage; inspect contact, air, off-bed and attempt-stop fields.\n\n';
  md+='| Hairpin | Before native guards L / R | Final nearest static edges L / R | Full / lite lamp IDs |\n|---|---|---|---|\n';
  for(const h of hairpins){const r=rows.find(r=>r.hairpin===h.id);if(!r)continue;const p=r.guards.finalStaticProbes[0];md+=`| ${h.id} | ${esc(`${h.guardLeft} / ${h.guardRight}`)} | ${p?esc(`${p.left.kind} / ${p.right.kind} at chain ${p.stationPlanM} m`):'unavailable: no static report supplied'} | ${esc(r.nearestBakedLamp.full?.id)} / ${esc(r.nearestBakedLamp.lite?.id)} |\n`;}
  md+='\nBefore guard labels and final static edge probes are separate evidence. Lamp distances are baked pool locations, not guaranteed illumination: the runtime shares only 6/full or 2/lite point lights. Height offsets, fixture IDs, all probe findings, source hashes, failures and run-specific limits are in HAIRPINS.json.\n\n';
  for(const a of result.attempts)md+=`- ${esc(`${a.kind}/${a.scenario}/${a.route}/${a.direction}/${a.lane}`)}: ${a.completed?'endpoint reached':'incomplete'}, reason ${esc(a.reason)}, ${a.restarts} restarts. ${a.limits.join(' ')}\n`;
  mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'HAIRPINS.json'),JSON.stringify(result,null,2));writeFileSync(resolve(out,'HAIRPINS.md'),md);
  console.log(JSON.stringify({out,reports:reports.length,attempts:attempts.length,rows:rows.length,worldSha256:worldHash}));
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)run(process.argv.slice(2));
