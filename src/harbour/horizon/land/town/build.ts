import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { HeightQuery, LandCuts, XY } from '../interfaces';
import { addFlatPad, bed, heightOnBeds } from '../beds/profiles';
import { gradeRoute } from '../beds/solver';
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
