import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { HeightQuery, LandCuts, XY } from '../interfaces';
import { addFlatPad, bed, heightOnBeds } from '../beds/profiles';
import { gradeRoute } from '../beds/solver';
import { box, distance, nearestOnPath, plan, slab, solid } from '../structures/mesh';
import { buildStair } from '../structures/build';

/** Lantern Row's water edge (R1-87: 18 m of quay with a 2 eu drop and nothing on it): a stone
 * lip 0.35 high along every metre of the town quay whose water side drops more than body
 * height, with a bollard every 4 m. A quay keeps its edge open for boats: lip and bollards,
 * not a railing. */
function quayLip(cuts:LandCuts,base:HeightQuery):void {
  const q=M.structures.townQuay,h=3,a:XY=q.from as unknown as XY,b:XY=q.to as unknown as XY,len=Math.hypot(b[0]-a[0],b[1]-a[1]),d:XY=[(b[0]-a[0])/len,(b[1]-a[1])/len],n:XY=[-d[1],d[0]],half=1.25;
  const lip=solid('town quay.lip','kerb','stone','wall',['town quay'],'harbour'),bollards=solid('town quay.bollards','bollard','stone','wall',['town quay'],'harbour');
  for(const side of [-1,1]){
    let run:XY|null=null,prev:XY|null=null,count=0;
    const flush=()=>{if(run&&prev&&distance(run,prev)>.5)slab(lip,[run[0],h,run[1]],[prev[0],h,prev[1]],.4,.35,0,.35);run=null;};
    for(let s=0;s<=len;s+=1){
      const on:XY=[a[0]+d[0]*s+n[0]*side*(half+.2),a[1]+d[1]*s+n[1]*side*(half+.2)],beyond:XY=[on[0]+n[0]*side*1.5,on[1]+n[1]*side*1.5];
      if(h-base(...beyond)>1.25){run??=on;prev=on;if(count++%4===0)box(bollards,on,h+.9,[.45,.45],h);}else{flush();count=0;}
    }
    flush();
  }
  for(const s of [lip,bollards])if(s.indices.length)cuts.solids.push(s);
}
export function buildTown(cuts:LandCuts,base:HeightQuery):void {
  const tiers=[['upperStreet',[1480,1080],18,[34,70]],['square',[1455,1175],12,[56,56]],['storefrontLane',[1490,1218],8,[40,12]],['quay',[1460,1295],3,[55,12]]] as const;
  for(const [id,xy,h,size]of tiers)addFlatPad(cuts,`town.${id}`,'place',xy,h,size);
  quayLip(cuts,base);
  // Three flights with level landings, alongside an independently traversable 8% lane.
  for(let f=0;f<3;f++){
    const z=1150+f*7;buildStair(`marketStair.flight.${f}`,[1480,18-f*2,z],[1480,16-f*2,z+5],3,cuts);addFlatPad(cuts,`marketStair.landing.${f}`,'landing',[1480,z+6],16-f*2,[4,2]);
  }
  const ramp=gradeRoute('marketRamp',[[1480,1150],[1499,1158],[1500,1182],[1474,1180],[1480,1171]],()=>12,.08,[{xy:[1480,1150],height:18,reason:'upper landing'},{xy:[1480,1171],height:12,reason:'square'}],cuts.diagnostics);
  const b=bed('marketRamp','walk',ramp);b.surface='cobble';b.maxGrade=.08;cuts.beds.push(b);
  cuts.beds.push(bed('town.storefront','walk',[[1475,12,1190],[1500,8,1218],[1497,3,1265]]));
  cuts.beds.push(bed('town.bankLink','walk',gradeRoute('town.bankLink',[[1455,1175],[1414,1162],[1420,1138],[1430,1138],[1440,1134]],()=>12,.08,[{xy:[1455,1175],height:12,reason:'square'},{xy:[1430,1138],height:16,reason:'level Kitty Plaza entry'},{xy:[1440,1134],height:16,reason:'bank door'}],cuts.diagnostics)));
  // Join the town to the existing drive once, then use its graded ascent.
  // The former shortcut cut obliquely through the drive's steep shoulders twice.
  const bankWalk=cuts.beds.find(b=>b.id==='town.bankLink')!,northStart=nearestOnPath([1420,1138],bankWalk.points).at;
  const northJoin=nearestOnPath([1380,1130],cuts.beds.find(b=>b.id==='V01')!.points).at;
  cuts.beds.push(bed('town.northLink','walk',gradeRoute('town.northLink',[plan(northStart),[1400,1137],plan(northJoin)],base,.12,[{xy:plan(northStart),height:northStart[1],reason:'bank walk'},{xy:plan(northJoin),height:northJoin[1],reason:'drive junction'}],cuts.diagnostics)));
  cuts.beds.push(bed('town.quayLink','walk',gradeRoute('town.quayLink',[[1455,1175],[1423,1207],[1410,1220],[1400,1290],[1404,1316],[1420,1335]],()=>12,.08,[{xy:[1455,1175],height:12,reason:'square'},{xy:[1423,1207],height:12,reason:'level square edge'},{xy:[1400,1290],height:7,reason:'Reach walk'},{xy:[1420,1335],height:3,reason:'quay'}],cuts.diagnostics)));
  const road=cuts.beds.find(b=>b.id==='V01')!,junction=nearestOnPath([1370,1260],road.points);
  cuts.beds.push(bed('town.riverLink','walk',gradeRoute('town.riverLink',[[1400,1290],plan(junction.at)],()=>7,.12,[{xy:[1400,1290],height:7,reason:'Reach walk'},{xy:plan(junction.at),height:junction.at[1],reason:'drive'}],cuts.diagnostics)));
  cuts.beds.push(bed('gondolaBase.walk','walk',[[1480,18,1060],[1480,18,1090]]));
  // West of the summit knoll, reaching 158 at the L02 pad's edge (a 0.7 eu lip blocked it): the
  // east detour [1320,485] crossed the last leg of walk crownFromGondola
  // 0.5-1.5 eu apart (the old generated deck there blocked the summit walk, R1-08); capped at the
  // summit height (158) so no bed raises the ground above the summit.
  cuts.beds.push(bed('walk summit','walk',gradeRoute('walk summit',[[1310,500],[1294,494],[1292,480],[1304,475],[1310,470],[1310,440]],base,.12,[{xy:[1310,500],height:154,reason:'walk crown / crownFromGondola end'},{xy:[1304,475],height:158,reason:'L02 lookout edge (level onto the pad)'},{xy:[1310,470],height:158,reason:'L02'},{xy:[1310,440],height:158,reason:'summit'}],cuts.diagnostics)));
  const lane=gradeRoute('homestead.lane',[[1514,1190],[1555,1205],[1540,1240],[1500,1250],[1520,1260],[1497,1265]],base,.08,[{xy:[1514,1190],height:12,reason:'yard'},{xy:[1500,1250],height:5,reason:'crossing'},{xy:[1497,1265],height:3,reason:'quay'}],cuts.diagnostics);cuts.beds.push(bed('homestead.lane','walk',lane));
  addFlatPad(cuts,'homestead.yard','homestead',[1520,1190],12,[26,20]);
  for(const site of M.journey.homestead.sites){
    const xy='xy'in site?site.xy as unknown as XY:site.id==='home'?M.hosts[0]!.xy as unknown as XY:[1172,912] as unknown as XY;
    const sizes:Record<string,XY>={home:[22,16],kitchenGarden:[15,10],landing:[12,8],workbench:[7,5],pavilion:[12,12],reserveBasin:[5,5],timberCrossing:[20,3]};
    const h=site.id==='home'?14:site.id==='reserveBasin'?52:site.id==='landing'?3:site.id==='timberCrossing'?5:heightOnBeds(cuts,xy,base,40);
    addFlatPad(cuts,`homestead.${site.id}`,'homestead',xy,h,sizes[site.id]!);
  }
  addFlatPad(cuts,'kittyPlaza','homestead',M.journey.kittyPlaza.xy as unknown as XY,16,[18,12]);
  addFlatPad(cuts,'tidelinePark','place',M.skate.park.xy as unknown as XY,3,M.skate.park.size as unknown as XY);
  for(const p of M.places)if(p.id!=='court')addFlatPad(cuts,`place.${p.id}`,'place',p.xy as unknown as XY,p.h,p.id==='L02'?[12,10]:[8,8]);
}
