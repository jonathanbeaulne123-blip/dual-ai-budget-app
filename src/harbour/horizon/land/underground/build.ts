import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { addFlatPad, bed } from '../beds/profiles';
import { sampleSpline } from '../beds/solver';
import { buildStair, tunnel } from '../structures/build';
import { box, distance, mix, pathLength, slab, solid } from '../structures/mesh';

export const ROOM_DIMENSIONS:Record<string,{size:XY;floor:number;clear:number}>={lanternCave:{size:[46,32],floor:42,clear:18},deep:{size:[64,60],floor:38,clear:30},bellGallery:{size:[30,26],floor:90,clear:15},sealedDrift:{size:[26,18],floor:42,clear:8}};
export function buildUnderground(cuts:LandCuts,base:HeightQuery):void {
  for(const [id,room]of Object.entries(M.underground.rooms)){
    const p=room.xy as unknown as XY,{size,floor,clear}=ROOM_DIMENSIONS[id]!,pad=addFlatPad(cuts,`underground.${id}`,'place',p,floor,size,0,true);
    const walls=solid(`underground.${id}.walls`,'cavern','rock','wall',[], 'crown'),roof=solid(`underground.${id}.roof`,'cavern','rock','roof',[],'crown');
    for(let i=0;i<24;i++){
      const a=i*Math.PI/12,b=(i+1)*Math.PI/12;
      const p1:XYZ=[p[0]!+Math.cos(a)*size[0]!/2,floor,p[1]!+Math.sin(a)*size[1]!/2],p2:XYZ=[p[0]!+Math.cos(b)*size[0]!/2,floor,p[1]!+Math.sin(b)*size[1]!/2];
      // Each route-facing opening is 6m wide; passages have no invisible end cap.
      if(i!==0&&i!==11&&i!==12)slab(walls,p1,p2,.8,clear,0,clear);
    }
    if(id==='deep'){
      // An 8 x 8 shaft is left in the ceiling, aligned to the north-slope skylight.
      box(roof,[1300,430],floor+clear+.6,[64,40],floor+clear);
      box(roof,[1282,400],floor+clear+.6,[28,20],floor+clear);
      box(roof,[1318,400],floor+clear+.6,[28,20],floor+clear);
      box(roof,[1300,392],floor+clear+.6,[8,4],floor+clear);
    }else box(roof,p,floor+clear+.6,size,floor+clear);
    cuts.solids.push(walls,roof);
    const cover=base(...p)-(floor+clear+.6);if(cover<.6)cuts.diagnostics.push({id:`underground.${id}.cover`,severity:'conflict',message:`${id}: rock cover above room roof is insufficient`,at:p,measured:cover,required:.6});
    pad.serviceBedId=`underground.${id}`;
  }
  const oreControls=M.rail.ORE.pts as unknown as XY[],oreHeights=[40,42,68,68,40,57,96,110];
  const ore:XYZ[]=[];
  for(let i=1;i<oreControls.length;i++){
    const a=oreControls[i-1]!,b=oreControls[i]!,count=Math.ceil(distance(a,b)/4);
    for(let j=0;j<count;j++){const t=j/count;ore.push([mix(a[0]!,b[0]!,t),mix(oreHeights[i-1]!,oreHeights[i]!,t),mix(a[1]!,b[1]!,t)]);}
  }
  ore.push([1345,110,680]);const oreBed=bed('ORE','rail',ore,false);oreBed.clearHeight=3.2;oreBed.structureIds=['oreTunnel','southPortal'];cuts.beds.push(oreBed);tunnel('oreTunnel',ore,3.6,3.2,cuts);
  const rails=solid('ORE.rails','rail','rail','rail',['ORE'],'crown');for(let i=1;i<ore.length;i++)for(const offset of [-.45,.45])slab(rails,ore[i-1]!,ore[i]!,.09,.12,offset,.12);cuts.solids.push(rails);
  const siding=bed('ORE.siding','rail',[[1248,68,470],[1270,68,450],[1280,68,454]],false);cuts.beds.push(siding);tunnel('oreSiding',siding.points,3.6,3.2,cuts);
  const roomPassages:[string,XYZ[]][]=[['lanternCave',[[1160,42,520],[1195,42,492],[1220,42,480]]],['sealedDrift',[[1180,42,500],[1200,42,495],[1220,42,480]]],['bellGallery',[[1220,42,480],[1240,54,515],[1280,68,525],[1320,80,505],[1310,90,470]]],['deepAccess',[[1220,42,480],[1260,42,440],[1300,40.6,440]]]];
  for(const [id,points]of roomPassages){const b=bed(`underground.${id}`,'cave',points,false);b.width=6;cuts.beds.push(b);tunnel(b.id,points,6,8,cuts);}
  const throat:XYZ[]=[[1300,110,300],[1300,75,360],[1300,40,420]],throatBed=bed('underground.throat','cave',throat,false);throatBed.width=26;throatBed.clearHeight=18;cuts.beds.push(throatBed);tunnel(throatBed.id,throat,26,18,cuts);
  // The north buttress carries a deep rock hood; the 26 x 18m flight mouth remains completely open.
  const hood=solid('throat.rockHood','rockHood','rock','roof',[throatBed.id],'crown'),jambs=solid('throat.rockHood.supports','rockButtress','rock','support',[throatBed.id],'crown');
  box(hood,[1300,300],131,[38,12],128);for(const side of [-1,1])box(jambs,[1300+side*16,300],131,[4,12],109.8);cuts.solids.push(hood,jambs);
  const seaXY=sampleSpline(M.water_routes.DEEP_RUN.pts as unknown as XY[],4),sea:XYZ[]=[];let along=0;
  for(let i=0;i<seaXY.length;i++){
    if(i)along+=distance(seaXY[i-1]!,seaXY[i]!);
    // Three 12m chutes occupy the first 120m; the final four metres drain to sea level.
    const h=along<=120?40-36*(along/120):Math.max(0,4*(1-(along-120)/(M.water_routes.DEEP_RUN.length_m-120)));
    sea.push([seaXY[i]![0]!,h,seaXY[i]![1]!]);
  }
  const seaBed=bed('DEEP_RUN','cave',sea,false);seaBed.width=9;seaBed.clearHeight=6;cuts.beds.push(seaBed);tunnel('seaPassage',sea,9,6,cuts);
  buildStair('stepsPortage',[1300,40.6,440],[1420,4,505],3,cuts);
  const shaft=solid('deep.skylight.shaft','skylight','rock','wall',[],'crown');
  for(const side of [-1,1]){box(shaft,[1300+side*4.3,400],138,[.6,8.6],68);box(shaft,[1300,400+side*4.3],138,[8,.6],68);}cuts.solids.push(shaft);
  cuts.mouths.push({id:'deep.skylight',kind:'skylight',floor:40,ceiling:138,outline:[[1296,396],[1296,404],[1304,404],[1304,396]]});
  for(const [id,door]of Object.entries(M.underground.doors)){
    const width=id==='throat'?26:id==='seaDoor'?9:4,depth=id==='throat'?18:6,p=door.xy as unknown as XY;
    cuts.mouths.push({id,kind:'portal',floor:door.h,ceiling:door.h+(id==='throat'?18:id==='seaDoor'?6:3.2),outline:[[p[0]!-width/2,p[1]!-depth/2],[p[0]!-width/2,p[1]!+depth/2],[p[0]!+width/2,p[1]!+depth/2],[p[0]!+width/2,p[1]!-depth/2]]});
    if(id==='adit'||id==='southPortal'){addFlatPad(cuts,`oreStation.${id}`,'landing',p,door.h,[10,6],0,true);const frame=solid(`${id}.portal.frame`,'portal','timber','wall',['ORE'],'crown');for(const side of [-1,1])box(frame,[p[0]!+side*2.2,p[1]!],door.h+3.8,[.5,1],door.h);box(frame,p,door.h+3.8,[4.9,1],door.h+3.2);cuts.solids.push(frame);}
  }
  const link=bed('southPortal.link','walk',[[1345,110,680],[1355,110,685],[1370,110,690]]);cuts.beds.push(link);
  // Ignore only the named entrance neighbourhoods when measuring roof cover.
  let low=Infinity,lowAt:XY=[0,0];
  for(const b of cuts.beds.filter(b=>b.kind==='cave'||b.id==='ORE'))for(const p of b.points){
    if(cuts.mouths.some(m=>distance([p[0]!,p[2]!],[m.outline.reduce((s,v)=>s+v[0]!,0)/m.outline.length,m.outline.reduce((s,v)=>s+v[1]!,0)/m.outline.length])<18))continue;
    const cover=base(p[0]!,p[2]!)-(p[1]!+b.clearHeight+.6);if(cover<low){low=cover;lowAt=[p[0]!,p[2]!];}
  }
  if(low<.6)cuts.diagnostics.push({id:'underground.routeCover',severity:'conflict',message:'A tunnel roof breaches the available terrain; rock cover is not fabricated',at:lowAt,measured:low,required:.6});
  cuts.diagnostics.push({id:'underground.seaPassageLength',severity:'info',message:`Solved Sea Passage is ${pathLength(sea).toFixed(1)} eu in plan; manifest route length is 529 m and prose says 504 m`,measured:pathLength(sea),required:529});
}
