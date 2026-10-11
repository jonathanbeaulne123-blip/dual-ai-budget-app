import { HORIZON_MANIFEST as M } from '../../world/manifest';
import { mountainV2Rule } from '../mountainV2/ground';
import { regionCarryLand } from '../mountainV2/beds';
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
/** Lantern Row's level tiers. W5-A: the upper street is x 1463-1480 (it was 34 wide, to x 1497): the square walk and S3
 * climb from the square to the upper street east of it, beside its wall, instead of 2-4 eu under its slab (the square walk
 * was walled at both pads, P17b 6), which makes the square walk the step-free way up (≈ 6 %). */
export const TOWN_TIERS=[['upperStreet',[1471.5,1080],18,[17,70]],['square',[1455,1175],12,[56,56]],['storefrontLane',[1490,1218],8,[40,12]],['quay',[1460,1295],3,[55,12]]] as const;
const insideTier=(id:string,p:XY,grow=0)=>{const t=TOWN_TIERS.find(t=>t[0]===id)!;return Math.abs(p[0]-t[1][0])<=t[3][0]/2+grow&&Math.abs(p[1]-t[1][1])<=t[3][1]/2+grow;};
/** Square-walk height pins: level with the square across its pad, level with the upper street at its end. */
export function squareWalkPins(samples:readonly XY[]):{xy:XY;height:number;reason:string;index:number}[] {
  return samples.flatMap((p,index)=>insideTier('square',p,.5)?[{xy:p,height:12,reason:'level across the square',index}]:insideTier('upperStreet',p,.5)?[{xy:p,height:18,reason:'level on the upper street',index}]:[]);
}
export function buildTown(cuts:LandCuts,base:HeightQuery):void {
  for(const [id,xy,h,size]of TOWN_TIERS)addFlatPad(cuts,`town.${id}`,'place',xy as unknown as XY,h,size as unknown as XY);
  quayLip(cuts,base);
  // Three flights with level landings. v2.0 D-C11 (Jonathan 2026-09-27, stairs only): the 8 % ramp twin (marketRamp) is
  // retired - it ran into Our home's walls and no step-free 75 m run fits; the step-free way between the square and the
  // upper street is the recorded detour structures.marketStair.stepFree (walk square → bank link → north link → V01 →
  // upper-street spur, 295 eu), proved in the bake's path graph (test/horizonHostRouting).
  // W7-A (v2.3, the reconciliation's regression 2): the stair's head stood 6 m over the square at [1480,18,1150], 35 m past the
  // upper street's end (z 1115, W5-A narrowed the terrace). The stair now leaves the upper street's south edge at its own height
  // (MANIFEST structures.marketStair.head) and comes down south to the square (foot + a level foot landing onto the square).
  const ms=M.structures.marketStair as unknown as {head:number[];foot:number[]},[sx,sh,sz]=ms.head as [number,number,number],rise=(sh-ms.foot[1]!)/3;
  for(let f=0;f<3;f++){
    const z=sz+f*7,top=sh-f*rise;buildStair(`marketStair.flight.${f}`,[sx,top,z],[sx,top-rise,z+5],3,cuts);
    if(f<2){addFlatPad(cuts,`marketStair.landing.${f}`,'landing',[sx,z+6],top-rise,[4,2]);cuts.beds.push(bed(`marketStair.landingWalk.${f}`,'walk',[[sx,top-rise,z+5],[sx,top-rise,z+7]]));}
  }
  {const footZ=sz+19,square=cuts.beds.find(b=>b.id==='walk square'),onSquare=square?nearestOnPath([sx,1148],square.points).at:[sx,12,1148] as const;
    addFlatPad(cuts,'marketStair.landing.2','landing',[sx,(footZ+1148)/2],ms.foot[1]!,[4,1148-footZ]);
    cuts.beds.push(bed('marketStair.foot','walk',[[sx,ms.foot[1]!,footZ],[sx,ms.foot[1]!,1146],[onSquare[0],onSquare[1],onSquare[2]]]));
    // The head: a level walk across the upper street from the gondola base walk's south end.
    cuts.beds.push(bed('town.upperStreetWalk','walk',[[1480,18,1090],[1476,18,1103],[sx,sh,sz]]));}
  const stepFree=M.structures.marketStair.stepFree;
  cuts.diagnostics.push({id:'marketStair.stepFree',severity:'info',message:`Market stair is stairs only (D-C11); the step-free way is ${stepFree.route.join(' → ')} (${stepFree.length_eu} eu)`,at:[sx,sz+10],measured:stepFree.length_eu});
  cuts.beds.push(bed('town.storefront','walk',[[1475,12,1190],[1500,8,1218],[1497,3,1265]]));
  // Integrator 3 (v2.1): the bank's door is read from its host data (south wall centre), not hard-coded at [1440,1134].
  const bankHost=M.hosts.find(h=>h.id==='bank')!,bankDoor:XY=[bankHost.xy[0]!,bankHost.xy[1]!+bankHost.footprint_m[1]!/2];
  cuts.beds.push(bed('town.bankLink','walk',gradeRoute('town.bankLink',[[1455,1175],[1414,1162],[1420,1138],[1430,1138],bankDoor],()=>12,.08,[{xy:[1455,1175],height:12,reason:'square'},{xy:[1430,1138],height:16,reason:'level Kitty Plaza entry'},{xy:bankDoor,height:16,reason:'bank door'}],cuts.diagnostics)));
  // Join the town to the existing drive once, then use its graded ascent.
  // The former shortcut cut obliquely through the drive's steep shoulders twice.
  const bankWalk=cuts.beds.find(b=>b.id==='town.bankLink')!,northStart=nearestOnPath([1420,1138],bankWalk.points).at;
  const northJoin=nearestOnPath([1380,1130],cuts.beds.find(b=>b.id==='V01')!.points).at;
  cuts.beds.push(bed('town.northLink','walk',gradeRoute('town.northLink',[plan(northStart),[1400,1137],plan(northJoin)],base,.12,[{xy:plan(northStart),height:northStart[1],reason:'bank walk'},{xy:plan(northJoin),height:northJoin[1],reason:'drive junction'}],cuts.diagnostics)));
  cuts.beds.push(bed('town.quayLink','walk',gradeRoute('town.quayLink',[[1455,1175],[1423,1207],[1410,1220],[1400,1290],[1404,1316],[1420,1335]],()=>12,.08,[{xy:[1455,1175],height:12,reason:'square'},{xy:[1423,1207],height:12,reason:'level square edge'},{xy:[1400,1290],height:7,reason:'Reach walk'},{xy:[1420,1335],height:3,reason:'quay'}],cuts.diagnostics)));
  const road=cuts.beds.find(b=>b.id==='V01')!,junction=nearestOnPath([1370,1260],road.points);
  cuts.beds.push(bed('town.riverLink','walk',gradeRoute('town.riverLink',[[1400,1290],plan(junction.at)],()=>7,.12,[{xy:[1400,1290],height:7,reason:'Reach walk'},{xy:plan(junction.at),height:junction.at[1],reason:'drive'}],cuts.diagnostics)));
  // v2.6 (D-M6): the gondola base is Mountain v2's quay station; the upper street's walk to the v2.5 base [1480,1090] is retired.
  if((M.cable.G1 as {drawnBy?:string}).drawnBy!=='mountainV2')cuts.beds.push(bed('gondolaBase.walk','walk',[[1480,18,1060],[1480,18,1090]]));
  // West of the summit knoll, reaching 158 at the L02 pad's edge (a 0.7 eu lip blocked it): the
  // east detour [1320,485] crossed the last leg of walk crownFromGondola
  // 0.5-1.5 eu apart (the old generated deck there blocked the summit walk, R1-08); capped at the
  // summit height (158) so no bed raises the ground above the summit.
  // v2.6 (D-M1): the summit is Mountain v2's: the walk leaves the top of v2's road [1325,470.5] (158.2) past L02 (v2's
  // observatory) to the north lookout; it lies on v2's land, so the region carries it (v2's summit paving is its floor).
  {const summit=bed('walk summit','walk',gradeRoute('walk summit',[[1325,470.5],[1318,472],[1310,470],[1310,440]],base,.12,[{xy:[1325,470.5],height:158.2,reason:'the top of Mountain v2 road'},{xy:[1310,470],height:158,reason:'L02'}],cuts.diagnostics));regionCarryLand(summit);cuts.beds.push(summit);
    // v2.6 (D-M6): from Mountain v2's Summit Commons gondola platform (gondolaTop) to L02; carried like the summit walk.
    const g1=M.cable.G1 as unknown as {to:number[];toH:number},top=(M.thresholds.find(t=>t.id==='gondolaTop')!.xy as unknown as XY);
    if((M.cable.G1 as {drawnBy?:string}).drawnBy==='mountainV2'){const link=bed('walk summitStation','walk',gradeRoute('walk summitStation',[top,[1304,476],[1310,470]],base,.12,[{xy:top,height:g1.toH,reason:'the Summit Commons platform'},{xy:[1310,470],height:158,reason:'L02'}],cuts.diagnostics));regionCarryLand(link);cuts.beds.push(link);}}
  // W5-A (R2-04): the lane's two loops east ([1555,1205]-[1540,1240]) and south ([1520,1260]) stood over the harbour water (9.7 eu
  // void at [1556.5,1208.6]); it now stays on the headland's shelf: 94 m from the yard to the timber crossing (7.4 %), then
  // back west of the crossing to the quay (7.8 %).
  // W7-A (A1.1): the lane leaves the yard from its south-east ([1520,1196], 13 m clear of the lanes); from [1514,1190] it started 3.5 over the Year Walk's
  // two lanes crossing the yard's west half (OPEN_VOIDS homestead.lane).
  const lane=gradeRoute('homestead.lane',[[1520,1196],[1540,1198],[1544,1208],[1528,1222],[1510,1236],[1500,1250],[1488,1258],[1497,1265]],base,.08,[{xy:[1520,1196],height:12,reason:'yard'},{xy:[1500,1250],height:5,reason:'crossing'},{xy:[1497,1265],height:3,reason:'quay'}],cuts.diagnostics);cuts.beds.push(bed('homestead.lane','walk',lane));
  addFlatPad(cuts,'homestead.yard','homestead',[1520,1190],12,[26,20]);
  for(const site of M.journey.homestead.sites){
    const xy='xy'in site?site.xy as unknown as XY:site.id==='home'?M.hosts[0]!.xy as unknown as XY:[1177,912] as unknown as XY; // v1.9: 5 m east, clear of the dam gallery's stairwell
    const sizes:Record<string,XY>={home:[22,16],kitchenGarden:[15,10],landing:[12,8],workbench:[7,5],pavilion:[12,12],reserveBasin:[5,5],timberCrossing:[20,3]};
    const h=site.id==='home'?14:site.id==='reserveBasin'?52:site.id==='landing'?3:site.id==='timberCrossing'?5:heightOnBeds(cuts,xy,base,40);
    addFlatPad(cuts,`homestead.${site.id}`,'homestead',xy,h,sizes[site.id]!);
  }
  addFlatPad(cuts,'kittyPlaza','homestead',M.journey.kittyPlaza.xy as unknown as XY,16,[18,12]);
  // road (L1): the park's pad blend (6) fell short of the Drive's embankment beside it: the ground between the Drive's edge and
  // the park stepped 0.4–0.8 onto the slab. A longer blend (12) takes the Drive's batter down to the park's level.
  {const park=addFlatPad(cuts,'tidelinePark','place',M.skate.park.xy as unknown as XY,3,M.skate.park.size as unknown as XY);park.blend=12;}
  // A place may carry its own pad size (V3.1: Fallswatch's 10 × 5 deck on the west buttress's cover ridge); 8 × 8 otherwise.
  for(const p of M.places)if(p.id!=='court'){const size=(p as {size_m?:number[]}).size_m as unknown as XY|undefined,pad=addFlatPad(cuts,`place.${p.id}`,'place',p.xy as unknown as XY,p.h,size??(p.id==='L02'?[12,10]:[8,8]));
    // v2.6 (D-M3): L01 stands on Mountain v2's glass dam crest (the region draws the crest and its plaques): a deck, never earth.
    if(p.id==='L01'&&mountainV2Rule(...(p.xy as unknown as XY)).kind!=='outside'){pad.deck=true;pad.blend=0;
      // The place's 8 x 8 slab would float 25 eu over the gorge under v2's crest: L01 is a bay of v2's promenade (4 x 2.2, flush
      // with v2's deck, walkable, the region draws the promenade round it) and the instrument's plaque standing on it.
      cuts.solids=cuts.solids.filter(q=>q.id!=='place.L01.slab');
      const xy=p.xy as unknown as XY,bay=solid('place.L01.deck','deck','stone','floor',[],'crown'),plaque=solid('place.L01.plaque','plaque','metal','marker',[],'crown');
      box(bay,xy,p.h,[4,2.2],p.h-.3);box(plaque,[xy[0],xy[1]+.6],p.h+1.1,[1.4,.12],p.h);cuts.solids.push(bay,plaque);}}
}
