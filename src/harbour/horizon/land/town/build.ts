import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { HeightQuery, LandCuts, XY } from '../interfaces';
import { addFlatPad, bed, heightOnBeds } from '../beds/profiles';
import { gradeRoute } from '../beds/solver';
import { nearestOnPath, plan } from '../structures/mesh';
import { buildStair } from '../structures/build';

export function buildTown(cuts:LandCuts,base:HeightQuery):void {
  const tiers=[['upperStreet',[1480,1080],18,[34,70]],['square',[1455,1175],12,[56,56]],['storefrontLane',[1490,1218],8,[40,12]],['quay',[1460,1295],3,[55,12]]] as const;
  for(const [id,xy,h,size]of tiers)addFlatPad(cuts,`town.${id}`,'place',xy,h,size);
  // Three flights with level landings, alongside an independently traversable 8% lane.
  for(let f=0;f<3;f++){
    const z=1150+f*7;buildStair(`marketStair.flight.${f}`,[1480,18-f*2,z],[1480,16-f*2,z+5],3,cuts);addFlatPad(cuts,`marketStair.landing.${f}`,'landing',[1480,z+6],16-f*2,[4,2]);
  }
  const ramp=gradeRoute('marketRamp',[[1480,1150],[1499,1158],[1500,1182],[1474,1180],[1480,1171]],()=>12,.08,[{xy:[1480,1150],height:18,reason:'upper landing'},{xy:[1480,1171],height:12,reason:'square'}],cuts.diagnostics);
  const b=bed('marketRamp','walk',ramp);b.surface='cobble';b.maxGrade=.08;cuts.beds.push(b);
  cuts.beds.push(bed('town.storefront','walk',[[1475,12,1190],[1500,8,1218],[1497,3,1265]]));
  cuts.beds.push(bed('town.bankLink','walk',gradeRoute('town.bankLink',[[1455,1175],[1430,1160],[1440,1134]],()=>12,.08,[{xy:[1455,1175],height:12,reason:'square'},{xy:[1440,1134],height:16,reason:'bank door'}],cuts.diagnostics)));
  cuts.beds.push(bed('town.quayLink','walk',gradeRoute('town.quayLink',[[1455,1175],[1410,1220],[1400,1290],[1420,1335]],()=>7,.08,[{xy:[1455,1175],height:12,reason:'square'},{xy:[1400,1290],height:7,reason:'Reach walk'},{xy:[1420,1335],height:3,reason:'quay'}],cuts.diagnostics)));
  const road=cuts.beds.find(b=>b.id==='V01')!,junction=nearestOnPath([1370,1260],road.points);
  cuts.beds.push(bed('town.riverLink','walk',gradeRoute('town.riverLink',[[1400,1290],plan(junction.at)],()=>7,.12,[{xy:[1400,1290],height:7,reason:'Reach walk'},{xy:plan(junction.at),height:junction.at[1],reason:'drive'}],cuts.diagnostics)));
  cuts.beds.push(bed('gondolaBase.walk','walk',[[1480,18,1060],[1480,18,1090]]));
  cuts.beds.push(bed('walk summit','walk',[[1310,154,500],[1320,156,485],[1310,158,470],[1310,160,440]]));
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
