import { HORIZON_MANIFEST as M } from '../../world/manifest';
import type { BedCut, HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { addFlatPad, bed, heightOnBeds } from '../beds/profiles';
import { gradeRoute } from '../beds/solver';
import { box, distance, districtAt, mix, nearestOnPath, plan, slab, solid } from './mesh';

export interface SpanSpec { id:string; at:XY; route:string; length:number; width:number; height?:number; clear?:number; covered?:boolean; supportSpacing?:number }
export const SPANS:SpanSpec[]=[
  {id:'highSpan',at:[1240,1105],route:'VG',length:104,width:10,height:24,clear:14,supportSpacing:12},
  {id:'quayBridge',at:[1350,1345],route:'V01',length:90,width:16,height:9,clear:4},
  {id:'bightBridge',at:[560,1100],route:'V01',length:230,width:17,height:12,clear:8},
  {id:'apronBridge',at:[1158,949],route:'S1',length:45,width:4,height:31,clear:5},
  {id:'hollowBridge',at:[893,600],route:'walk garden',length:32,width:8,height:37,clear:4,covered:true},
  {id:'inletFootbridge',at:[1161,731],route:'walk lakerim',length:28,width:3,height:52,clear:1},
  {id:'reachFootbridge',at:[1274,1203],route:'walk reach',length:48,width:3,height:6,clear:1},
  {id:'washFootbridge',at:[514,895],route:'walk bightPier',length:18,width:3,clear:2},
  {id:'reachBoardwalk',at:[1255,1251],route:'S1',length:112,width:4,height:5,clear:1},
  {id:'timberCrossing',at:[1500,1250],route:'homestead.lane',length:20,width:3,height:5,clear:2},
];
function axisAt(b:BedCut|undefined,at:XY):XY {
  if(!b)return [1,0];const n=nearestOnPath(at,b.points),a=b.points[n.segment]!,p=b.points[Math.min(n.segment+1,b.points.length-1)]!,len=distance(plan(a),plan(p))||1;return [(p[0]!-a[0]!)/len,(p[2]!-a[2]!)/len];
}
/** Piers leave the navigable centre of a waterway and the High Span's 40m gate aperture open. */
export function buildSpan(spec:SpanSpec,cuts:LandCuts,base:HeightQuery):void {
  const route=cuts.beds.find(b=>b.id===spec.route),axis=axisAt(route,spec.at),normal:XY=[-axis[1]!,axis[0]!];
  const h=spec.height??heightOnBeds(cuts,spec.at,base),a:XYZ=[spec.at[0]!-axis[0]!*spec.length/2,h,spec.at[1]!-axis[1]!*spec.length/2],b:XYZ=[spec.at[0]!+axis[0]!*spec.length/2,h,spec.at[1]!+axis[1]!*spec.length/2];
  const deck=solid(`${spec.id}.deck`,spec.covered?'coveredFootbridge':'bridge','stone','deck',[spec.route],districtAt(...spec.at));slab(deck,a,b,spec.width,.6);
  const piers=solid(`${spec.id}.supports`,'pier','stone','support',[spec.route],deck.districtId),rails=solid(`${spec.id}.rails`,'parapet','stone','rail',[spec.route],deck.districtId);
  const count=Math.ceil(spec.length/(spec.supportSpacing??12));
  for(let i=0;i<=count;i++){
    const t=i/count,along=(t-.5)*spec.length;
    if(spec.id==='highSpan'&&Math.abs(along)<22)continue;
    for(const side of [-1,1]){
      const p:XY=[mix(a[0]!,b[0]!,t)+normal[0]!*side*(spec.width/2-.6),mix(a[2]!,b[2]!,t)+normal[1]!*side*(spec.width/2-.6)];
      const ground=Math.min(base(...p),h-(spec.clear??2));
      box(piers,p,ground+.4,[2.4,2.4],ground-.25);box(piers,p,h-.6,[.8,.8],ground);box(piers,p,h-.5,[1.4,1.4],h-.9);
    }
  }
  for(const side of [-1,1]){
    slab(rails,a,b,.25,1,side*(spec.width/2-.125),1);slab(rails,a,b,.4,.15,side*(spec.width/2-.125),1.15);
  }
  cuts.solids.push(deck,piers,rails);
  const structuralBed=bed(`structure.${spec.id}`,spec.route.startsWith('walk')?'walk':'road',[a,b],false);structuralBed.width=spec.width;structuralBed.structureIds=[spec.id];cuts.beds.push(structuralBed);
  // The source corridor is split at the span limits so no water is raised to its deck.
  if(route)route.structureIds.push(spec.id);
  if(spec.covered){
    const roof=solid(`${spec.id}.roof`,'roof','stone','roof',[spec.route],deck.districtId);slab(roof,a,b,spec.width+1,.35,0,4);cuts.solids.push(roof);
    const posts=solid(`${spec.id}.posts`,'post','timber','support',[spec.route],deck.districtId);
    for(const t of [0,.25,.5,.75,1])for(const s of [-1,1])box(posts,[mix(a[0]!,b[0]!,t)+normal[0]!*s*(spec.width/2),mix(a[2]!,b[2]!,t)+normal[1]!*s*(spec.width/2)],h+4,[.25,.25],h);cuts.solids.push(posts);
  }
}
export function tunnel(id:string,points:XYZ[],width:number,clear:number,cuts:LandCuts,district='crown'):void {
  const floor=solid(`${id}.floor`,'tunnel','stone','floor',[id],district),walls=solid(`${id}.walls`,'tunnel','rock','wall',[id],district),roof=solid(`${id}.roof`,'tunnel','rock','roof',[id],district);
  for(let i=1;i<points.length;i++){
    slab(floor,points[i-1]!,points[i]!,width,.6);slab(walls,points[i-1]!,points[i]!,.6,clear,width/2+.3,clear);slab(walls,points[i-1]!,points[i]!,.6,clear,-width/2-.3,clear);slab(roof,points[i-1]!,points[i]!,width+1.2,.6,0,clear+.6);
  }
  cuts.solids.push(floor,walls,roof);
}
export function buildStair(id:string,from:XYZ,to:XYZ,width:number,cuts:LandCuts):void {
  const stepCount=Math.ceil(Math.abs(to[1]!-from[1]!)/.17),steps=solid(`${id}.treads`,'stair','stone','deck',[id],districtAt(from[0]!,from[2]!)),rails=solid(`${id}.rails`,'handrail','metal','rail',[id],steps.districtId);
  for(let i=0;i<stepCount;i++){
    const t=i/stepCount,u=(i+1)/stepCount,h=mix(from[1]!,to[1]!,u),a:XYZ=[mix(from[0]!,to[0]!,t),h,mix(from[2]!,to[2]!,t)],b:XYZ=[mix(from[0]!,to[0]!,u),h,mix(from[2]!,to[2]!,u)];
    slab(steps,a,b,width,.35+Math.abs(to[1]!-from[1]!)/stepCount);
  }
  for(const s of [-1,1]){slab(rails,from,to,.09,.09,s*width/2,1.05);slab(rails,from,to,.3,.7,s*(width/2+.2),.6);}
  cuts.solids.push(steps,rails);const b=bed(id,'stair',[from,to],false);b.maxGrade=10;cuts.beds.push(b);
}
function dock(id:string,p:XY,height:number,cuts:LandCuts,base:HeightQuery,width=5,length=12):void {
  const a:XYZ=[p[0]!,height,p[1]!-length/2],b:XYZ=[p[0]!,height,p[1]!+length/2],deck=solid(`${id}.deck`,'jetty','boardwalk','deck',[id],districtAt(...p)),piles=solid(`${id}.supports`,'pile','timber','support',[id],deck.districtId),rails=solid(`${id}.rails`,'handrail','metal','rail',[id],deck.districtId);
  slab(deck,a,b,width,.35);for(let offset=-length/2;offset<=length/2+.01;offset+=3)for(const side of [-1,1]){const xy:XY=[p[0]!+side*(width/2-.2),p[1]!+offset];box(piles,xy,height-.2,[.3,.3],Math.min(-2,base(...xy))-.25);}
  slab(rails,a,b,.09,.09,width/2,1.05);slab(rails,a,b,.09,.09,-width/2,1.05);cuts.solids.push(deck,piles,rails);const bcut=bed(id,'boardwalk',[a,b],false);bcut.width=width;bcut.structureIds=[id];cuts.beds.push(bcut);
}
export function buildStructures(cuts:LandCuts,base:HeightQuery):void {
  SPANS.forEach(s=>buildSpan(s,cuts,base));
  // Supported west-wall shelf and the lower walking gallery are separate High Span levels.
  for(const [id,h,width,x] of [['highSpan.shelf',12,4,1204],['highSpan.walk',9,3,1240]] as const){
    const a:XYZ=[x,h,1078],b:XYZ=[x,h,1135],deck=solid(`${id}.deck`,'shelf','stone','deck',[id==='highSpan.shelf'?'S1':'walk reach'],'notch'),brackets=solid(`${id}.supports`,'corbel','rock','support',deck.bedIds,'notch'),rail=solid(`${id}.rail`,'handrail','metal','rail',deck.bedIds,'notch');slab(deck,a,b,width,.6);
    for(let z=1078;z<=1135;z+=10)box(brackets,[x-width/2,z],h-.5,[width+1,1.2],Math.min(base(x-width/2,z)-.2,h-2));slab(rail,a,b,.09,.09,width/2,1.05);cuts.solids.push(deck,brackets,rail);
  }
  for(const [id,route,length,width,clear] of [['prowTunnel','V01',90,10,5],['shoulderTunnel','V02',110,10,5],['duneCulvert','S4',32,5,3]] as const){
    const s=M.structures[id]!,xy=s.xy as unknown as XY,b=cuts.beds.find(p=>p.id===route)!,axis=axisAt(b,xy),h=heightOnBeds(cuts,xy,base)-(id==='duneCulvert'?4:0),a:XYZ=[xy[0]!-axis[0]!*length/2,h,xy[1]!-axis[1]!*length/2],end:XYZ=[xy[0]!+axis[0]!*length/2,h,xy[1]!+axis[1]!*length/2];
    tunnel(id,[a,end],width,clear,cuts,districtAt(...xy));
    for(const [index,p]of [a,end].entries())cuts.mouths.push({id:`${id}.portal.${index}`,kind:'portal',floor:h,ceiling:h+clear,outline:[[p[0]!-width/2,p[2]!-3],[p[0]!-width/2,p[2]!+3],[p[0]!+width/2,p[2]!+3],[p[0]!+width/2,p[2]!-3]]});
    const tunnelBed=bed(id,route==='S4'?'skateMain':'road',[a,end],false);tunnelBed.width=width;tunnelBed.structureIds=[id];cuts.beds.push(tunnelBed);
  }
  // The crest spans a real opening; the curved shoulders carry the spillway to its abutments.
  const dam=solid('dam.wall','dam','stone','wall',[],'lakeside'),crest=solid('dam.crest','dam','stone','deck',['walk damCrest'],'lakeside');
  for(let i=0;i<22;i++){
    const x=1118+i*2,arch=Math.abs(x-1140)<10?34+Math.sqrt(Math.max(0,100-(x-1140)**2)):27;
    box(dam,[x+1,905],52,[2.03,5],arch);if(Math.abs(x-1140)>=10)box(dam,[x+1,905],arch,[2.03,8],20);
  }
  slab(crest,[1118,52,903],[1162,52,903],4,.6);cuts.solids.push(dam,crest);cuts.beds.push(bed('walk damCrest','walk',[[1118,52,903],[1162,52,903]],false));
  const bowl=solid('dam.apron','halfPipe','apron','deck',['S1'],'notch');
  for(let i=0;i<16;i++){const x=1135+i*2,x2=x+2,h=31+7*((x-1151)/16)**2,h2=31+7*((x2-1151)/16)**2;slab(bowl,[x,h,935],[x2,h2,935],22,.6);}cuts.solids.push(bowl);
  cuts.beds.push(bed('dam.apron.level','skateMain',[[1168,31,923],[1168,31,947]],false));
  for(let f=0;f<3;f++)buildStair(`damGallery.flight.${f}`,[1165,31+f*7,920-f*12],[1165,38+f*7,910-f*12],3,cuts);
  buildStair('damPortage',[1150,50,910],[1169,25,963],3,cuts);
  // Dry Wash bowl: the invert remains an ordinary ground line, with a bank on either side.
  const wash=solid('wash.bowl','bowl','ochre','deck',['S2'],'flats');for(let i=-12;i<12;i++){const h=heightOnBeds(cuts,[465,700],base)+5*(i/12)**2,h2=heightOnBeds(cuts,[465,700],base)+5*((i+1)/12)**2;slab(wash,[465+i,h,665],[466+i,h2,665],72,.6);}cuts.solids.push(wash);
  // Runway and mooring foundations contain no lamps, windsock, hangar or balloon props in Pass 1.
  const strip=bed('strip','road',[[425,38,520],[445,38,860]]);strip.width=30;cuts.beds.push(strip);
  addFlatPad(cuts,'hangar','place',[455,600],38,[40,30]);addFlatPad(cuts,'windsock.footing','place',[440,500],38,[1,1]);addFlatPad(cuts,'balloon.footing','place',[520,470],base(520,470),[14,14]);
  Object.entries(M.structures.jetties).forEach(([id,p])=>dock(`jetty.${id}`,p as unknown as XY,id==='deep'?40.6:1,cuts,base));
  Object.entries(M.water_routes.FERRY.piers).forEach(([id,p])=>dock(`ferry.${id}`,p as unknown as XY,1,cuts,base,6,16));
  dock('floatplaneDock',M.structures.floatplaneDock as unknown as XY,1.2,cuts,base,8,20);
  dock('landingQuay',M.structures.landingQuay.xy as unknown as XY,3,cuts,base,8,32);
  const q=M.structures.townQuay;cuts.beds.push(bed('town quay','walk',[[...q.from.slice(0,1),3,q.from[1]!] as unknown as XYZ,[q.to[0]!,3,q.to[1]!]],false));
  const seaTop:XYZ=[1620,base(1620,760),760];buildStair('seaStair',[1705,1,775],seaTop,3,cuts);
  for(const [id,xy,h]of [['gondolaBase',M.cable.G1.from,M.cable.G1.fromH],['gondolaTop',M.cable.G1.to,M.cable.G1.toH],['prowPlatform',M.cable.ZIP.from,M.cable.ZIP.fromH],['zipLanding',M.cable.ZIP.to,M.cable.ZIP.toH]] as const){
    addFlatPad(cuts,`platform.${id}`,'landing',xy as unknown as XY,h,[10,8]);const supports=solid(`platform.${id}.supports`,'tower','stone','support',[],districtAt(xy[0]!,xy[1]!));for(const x of [-4,4])for(const z of [-3,3])box(supports,[xy[0]!+x,xy[1]!+z],h-.35,[.7,.7],Math.min(h-1,base(xy[0]!+x,xy[1]!+z))-.25);cuts.solids.push(supports);
  }
  buildStair('zipLanding.stair',[1130,12,1440],[1145,3,1460],3,cuts);
  const ramp=gradeRoute('zipLanding.ramp',[[1130,1440],[1090,1445],[1080,1470],[1145,1460]],()=>3,.08,[{xy:[1130,1440],height:12,reason:'deck'},{xy:[1145,1460],height:3,reason:'sand'}],cuts.diagnostics);cuts.beds.push(bed('zipLanding.ramp','walk',ramp));
}
