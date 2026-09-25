import { HORIZON_MANIFEST as M, requireScaleFactor } from '../../world/manifest';
import type { HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { buildStructures, SPANS } from '../structures/build';
import { box, distance, districtAt, mix, nearestOnPath, pathLength, plan, slab, solid } from '../structures/mesh';
import { buildReserves } from '../reserves/build';
import { buildTown } from '../town/build';
import { buildHostSites } from '../town/hosts';
import { buildUnderground } from '../underground/build';
import { addFlatPad, bed, emitBedGeometry, heightOnBeds } from './profiles';
import { gradeRoute, sampleSpline, type HeightPin } from './solver';

const pin=(xy:XY,height:number,reason:string):HeightPin=>({xy,height,reason});
const routePins:Record<string,HeightPin[]>={
  V01:[pin([1400,1060],24,'Green Road junction'),pin([1480,1040],18,'upper street'),pin([1500,340],70,'Crown Road junction'),pin([900,290],48,'north pass'),pin([560,1100],12,'Bight Bridge'),pin([1350,1345],9,'Quay Bridge')],
  VG:[pin([1400,1060],24,'Horizon Drive junction'),pin([1240,1105],24,'High Span'),pin([960,860],30,'Bight spur'),pin([980,700],42,'cottage spur'),pin([974,540],40,'studio spur'),pin([900,290],48,'north pass')],
  V02:[pin([1500,340],70,'coast drive'),pin([1370,690],110,'turning circle')],
  VBS:[pin([960,860],30,'Green Road'),pin([775,1125],14,'shore endpoint')],
  S1:[pin([1310,500],154,'Crown start'),pin([1160,935],31,'dam apron'),pin([1204,1098],12,'High Span shelf'),pin([1255,1251],5,'Reach boardwalk'),pin([1270,1330],3,'Landing finish')],
  S2:[pin([480,480],38,'strip start'),pin([560,1100],12,'Bight Bridge'),pin([1020,1430],3,'park')],
  S3:[pin([1480,1060],18,'upper street'),pin([1470,1160],16,'market lane'),pin([1440,1200],12,'square'),pin([1350,1345],9,'Quay Bridge'),pin([1133,1435],4,'zip underpass'),pin([1020,1430],3,'park')],
  S4:[pin([1000,520],40,'studio start'),pin([893,600],37,'Hollow Bridge'),pin([1020,1430],3,'park')],
  'walk garden':[pin([740,400],48,'Library'),pin([893,600],37,'Hollow Bridge'),pin([990,780],56,'Glasshouse')],
  'walk lakerim':[pin([990,780],56,'Glasshouse'),pin([1161,731],52,'inlet bridge'),pin([1140,905],52,'dam crest')],
  'walk square':[pin([1455,1175],12,'square'),pin([1480,1060],18,'upper street')],
  'walk reach':[pin([1400,1290],7,'town connection'),pin([1274,1203],6,'Reach footbridge'),pin([1240,1130],9,'High Span walk')],
  'walk crown':[pin([1370,690],110,'turning circle'),pin([1310,500],154,'summit')],
  'walk crownFromGondola':[pin([1360,560],112,'station'),pin([1310,500],154,'summit')],
};
/** Pin each complete span flat before grading its two approaches. */
function withSpanPins(id:string,controls:XY[],pins:HeightPin[]=[]):HeightPin[] {
  const samples=sampleSpline(controls),points:XYZ[]=samples.map(p=>[p[0],0,p[1]]),out=[...pins];
  for(const span of SPANS.filter(s=>s.route===id&&s.height!==undefined)){
    const hit=nearestOnPath(span.at,points),travel=[0];for(let i=1;i<points.length;i++)travel.push(travel[i-1]!+distance(plan(points[i-1]!),plan(points[i]!)));
    for(const delta of [-span.length/2,0,span.length/2]){
      const target=hit.along+delta;let best=0;travel.forEach((d,i)=>{if(Math.abs(d-target)<Math.abs(travel[best]!-target))best=i;});out.push(pin(samples[best]!,span.height!,`${span.id} ${delta<0?'entry':delta>0?'exit':'centre'}`));
    }
    travel.forEach((d,i)=>{if(Math.abs(d-hit.along)<=span.length/2)out.push(pin(samples[i]!,span.height!,`${span.id} deck ${i}`));});
  }
  return out;
}
function roadAndWalks(cuts:LandCuts,base:HeightQuery):void {
  for(const [id,row]of Object.entries(M.roads)){
    if(!('pts'in row))continue;
    const controls=row.pts as unknown as XY[],b=bed(id,row.profile,gradeRoute(id,controls,base,.12,withSpanPins(id,controls,routePins[id]),cuts.diagnostics));
    if('structures'in row)b.structureIds=row.structures.filter(x=>!(id==='VG'&&x==='hollowBridge'));cuts.beds.push(b);
  }
  for(const [id,pts]of Object.entries(M.roads.spurs)){
    const name=`spur ${id}`,at=pts[0]! as unknown as XY,start=heightOnBeds(cuts,at,base,40),heights:Record<string,number>={upperStreet:18,library:48,glasshouse:34,studio:40,cottage:38,boathouse:4};
    cuts.beds.push(bed(name,'spur',gradeRoute(name,pts as unknown as XY[],base,.12,[pin(at,start,'junction'),pin(pts[pts.length-1]! as unknown as XY,heights[id]!,'spur end')],cuts.diagnostics)));
  }
  for(const [id,row]of Object.entries(M.skate)){
    if(!('pts'in row))continue;
    const pts=[...row.pts] as unknown as XY[];
    if(id==='S1')pts.splice(4,0,[1435,705],[1430,775],[1325,735]);
    const b=bed(id,'skateMain',gradeRoute(id,pts,base,.18,withSpanPins(id,pts,routePins[id]),cuts.diagnostics));
    b.surfaceSegments=row.segments.map((segment,i)=>({from:i/row.segments.length,to:(i+1)/row.segments.length,surface:segment.surface,pace:segment.pace,bankDegrees:segment.surface==='bankedTurf'?18:0}));cuts.beds.push(b);
  }
  for(const [id,row]of Object.entries(M.walks)){
    const name=`walk ${id}`;
    let points=row.pts as unknown as XY[];
    if(id==='garden')points=[[762,422],...points.slice(1)];
    if(id==='coveWalk')points=[[762,422],[780,380],[754,356],...points.slice(1)];
    if(id==='crown')points=[[1370,690],[1445,665],[1425,605],[1340,620],[1400,540],[1360,470],[1310,500]];
    if(id==='crownFromGondola')points=[[1360,560],[1405,595],[1450,565],[1430,500],[1350,440],[1310,500]];
    cuts.beds.push(bed(name,row.profile,gradeRoute(name,points,base,.12,withSpanPins(name,points,routePins[name]),cuts.diagnostics)));
  }
}
export interface StationPositions { id:string; centre:XYZ; positions:XYZ[] }
/** Two empty south-facing rows; these coordinates reserve space, never create financial beds. */
export function stationBedPositions(cuts:LandCuts):StationPositions[] {
  return M.journey.stations.map(s=>{const pad=cuts.pads.find(p=>p.id===`station.${s.id}`);if(!pad)throw new Error(`Missing station ${s.id}`);return {id:s.id,centre:pad.centre,positions:Array.from({length:20},(_,n)=>[pad.centre[0]!-14.85+(n%10)*3.3,pad.centre[1]!,pad.centre[2]!+(n<10?-3:3)] as unknown as XYZ)};});
}
export function yearWalkStretches(cuts:LandCuts):{month:number;stationId:string;length:number;spacing28:number;spacing31:number}[] {
  const walk=cuts.beds.find(b=>b.id==='yearWalk');if(!walk)return [];
  const length=pathLength(walk.points),along=M.journey.stations.map(s=>nearestOnPath(s.xy as unknown as XY,walk.points).along);
  return M.journey.stations.map((s,i)=>{const previous=along[(i+11)%12]!,current=along[i]!,d=(current-previous+length)%length;return {month:s.month,stationId:s.id,length:d,spacing28:d/28,spacing31:d/31};});
}
function journey(cuts:LandCuts,base:HeightQuery):void {
  const source=M.journey.yearWalk.pts as unknown as XY[];
  // The two Crown approaches take long contour returns; their short diagram chords cannot hold 12%.
  const controls:XY[]=[source[0]!,[1440,710],[1450,865],[1360,940],...source.slice(1,-2),[1520,1190],[1580,1050],[1600,860],[1590,700],[1500,340],[1445,430],[1445,520],[1400,620],[1370,690],source[0]!];
  const stationPins=M.journey.stations.map(s=>pin(s.xy as unknown as XY,s.id==='jan'?110:s.id==='feb'?53:s.id==='dec'?12:heightOnBeds(cuts,s.xy as unknown as XY,base,35),`station ${s.id}`));
  stationPins.push(pin([1480,1060],18,'upper street'),pin([1370,690],110,'turning circle'));
  const b=bed('yearWalk','walk',gradeRoute('yearWalk',controls,base,.12,stationPins,cuts.diagnostics));b.width=5.2;b.shoulder=1.2;cuts.beds.push(b);
  for(const s of M.journey.stations){const n=nearestOnPath(s.xy as unknown as XY,b.points);const p=addFlatPad(cuts,`station.${s.id}`,'station',s.xy as unknown as XY,n.at[1]!,M.journey.station.pad_m as unknown as XY);p.serviceBedId='yearWalk';p.margin=2;}
}
function cables(cuts:LandCuts,base:HeightQuery):void {
  const g=M.cable.G1,controls:XYZ[]=[[g.from[0]!,g.fromH,g.from[1]!],...g.towers.map((p,i)=>[p[0]!,Math.max(mix(g.fromH,g.toH,(i+1)/4),base(...p as unknown as XY)+8),p[1]!] as unknown as XYZ),[g.to[0]!,g.toH,g.to[1]!]];
  // Project clearance constraints onto the three free tower heights. Endpoint heights stay frozen.
  // Raising each tower by the same deficit produces spurious giant towers near a fixed endpoint.
  const constraints:{i:number;t:number;required:number;at:XY}[]=[];
  for(let i=1;i<controls.length;i++){
    const a=controls[i-1]!,b=controls[i]!,span=distance(plan(a),plan(b));
    for(let k=1;k<32;k++){
      const t=k/32,x=mix(a[0],b[0],t),z=mix(a[2],b[2],t),at:XY=[x,z];
      // Loading platforms are an intentional cable-to-feet boundary, not an overhead crossing.
      if(distance(at,plan(controls[0]!))<14||distance(at,plan(controls.at(-1)!))<14)continue;
      let surface=Math.max(base(x,z),heightOnBeds(cuts,at,base,8));
      for(const pad of cuts.pads){const angle=-pad.rotationDegrees*Math.PI/180,dx=x-pad.centre[0],dz=z-pad.centre[2];if(!pad.underground&&Math.abs(dx*Math.cos(angle)-dz*Math.sin(angle))<pad.size[0]/2&&Math.abs(dx*Math.sin(angle)+dz*Math.cos(angle))<pad.size[1]/2)surface=pad.centre[1];}
      let required=surface+8+span*.01*4*t*(1-t);
      for(const p of cuts.pads.filter(p=>/^plot\.terraces\.\d$/.test(p.id)))if(distance(at,plan(p.centre))<40)required=Math.max(required,p.centre[1]+12+span*.01*4*t*(1-t));
      constraints.push({i,t,required,at});
    }
  }
  for(let pass=0;pass<16;pass++)for(const q of constraints){const a=controls[q.i-1]!,b=controls[q.i]!,deficit=q.required-mix(a[1],b[1],q.t);if(deficit<=.0001)continue;const wa=q.i>1?1-q.t:0,wb=q.i<controls.length-1?q.t:0,denom=wa*wa+wb*wb;
    if(wa)controls[q.i-1]=[a[0],Math.min(300,a[1]+deficit*wa/denom),a[2]];
    if(wb)controls[q.i]=[b[0],Math.min(300,b[1]+deficit*wb/denom),b[2]];
  }
  for(const q of constraints){const actual=mix(controls[q.i-1]![1],controls[q.i]![1],q.t);if(actual<q.required-.01)cuts.diagnostics.push({id:`cable.G1.clear.${q.i}.${q.t}`,severity:'conflict',message:'Fixed gondola endpoint cannot meet terrain clearance below the 300m sky ceiling',at:q.at,measured:actual,required:q.required});}
  const gondola:XYZ[]=[];
  for(let i=1;i<controls.length;i++){const a=controls[i-1]!,b=controls[i]!,len=distance(plan(a),plan(b));for(let k=0;k<32;k++){const t=k/32;gondola.push([mix(a[0]!,b[0]!,t),mix(a[1]!,b[1]!,t)-len*.01*4*t*(1-t),mix(a[2]!,b[2]!,t)]);}}gondola.push(controls[controls.length-1]!);
  cuts.beds.push(bed('G1','cable',gondola,false));const towers=solid('G1.towers','tower','stone','support',['G1'],'prow');controls.slice(1,-1).forEach(p=>{const ground=base(p[0]!,p[2]!);box(towers,plan(p),p[1]!,[1.5,1.5],ground-.25);box(towers,plan(p),ground+.4,[4,4],ground-.25);});cuts.solids.push(towers);
  const z=M.cable.ZIP,len=distance(z.from as unknown as XY,z.to as unknown as XY),zip=Array.from({length:129},(_,k)=>{const t=k/128;return [mix(z.from[0]!,z.to[0]!,t),mix(z.fromH,z.toH,t)-len*z.sag_pct/100*4*t*(1-t),mix(z.from[1]!,z.to[1]!,t)] as unknown as XYZ;});cuts.beds.push(bed('ZIP','cable',zip,false));
  const cross:XY=[1442,921],clear=nearestOnPath(cross,zip).at[1]!-nearestOnPath(cross,gondola).at[1]!;cuts.diagnostics.push({id:'cable.ZIP.G1',severity:clear<8?'conflict':'info',message:'Measured ZIP clearance above the sagged gondola at the fixed crossing',at:cross,measured:clear,required:8});
  for(const [id,points]of [['G1',gondola],['ZIP',zip]]as const){const geometry=solid(`${id}.cable`,'cable','metal','rail',[id],'prow');for(let i=1;i<points.length;i++)slab(geometry,points[i-1]!,points[i]!,.09,.09);cuts.solids.push(geometry);}
  let roofMin=Infinity,terrainMin=Infinity;for(const p of zip){terrainMin=Math.min(terrainMin,p[1]!-base(p[0]!,p[2]!));for(const h of M.hosts)if(Math.abs(p[0]!-h.xy[0]!)<=h.footprint_m[0]!/2&&Math.abs(p[2]!-h.xy[1]!)<=h.footprint_m[1]!/2)roofMin=Math.min(roofMin,p[1]!-h.h-h.roofH_eu);}
  if(roofMin<12)cuts.diagnostics.push({id:'cable.ZIP.roofs',severity:'conflict',message:'Fixed sagged zip line fails a host roof clearance',measured:roofMin,required:12});
  if(terrainMin<8)cuts.diagnostics.push({id:'cable.ZIP.terrain',severity:'conflict',message:'Fixed zip line fails terrain clearance; endpoints were not moved',measured:terrainMin,required:8});
}
function thresholds(cuts:LandCuts,base:HeightQuery):XY[] {
  const positions:XY[]=[];
  const make=(id:string,p:XY,h?:number)=>{const height=h??heightOnBeds(cuts,p,base,40),pad=addFlatPad(cuts,id,'threshold',p,height,[6,5]);positions.push(p);const marker=solid(`${id}.marker`,'threshold','stone','marker',[],districtAt(...p));box(marker,p,height+.025,[2,.6],height-.05);cuts.solids.push(marker);pad.margin=1;};
  for(const row of M.thresholds){
    if(typeof row.xy==='string'){Object.entries(M.water_routes.FERRY.piers).forEach(([id,p])=>make(`threshold.${row.id}.${id}`,p as unknown as XY,1));continue;}
    if(Array.isArray(row.xy[0]!))(row.xy as number[][]).forEach((p,i)=>make(`threshold.${row.id}.${i+1}`,p as unknown as XY));
    else {const exact:Record<string,number>={gondolaBase:18,gondolaTop:112,adit:40,southPortal:110,prowPlatform:100,crownLaunch:160,zipLanding:12,lampGallery:25,deepJetty:40.6,seaDoorJetty:1,lampDock:1,bightShoreJetty:1,floatDock:1.2,boathouseDock:1,landingQuay:3,stepsFoot:4};make(`threshold.${row.id}`,row.xy as unknown as XY,exact[row.id]!);}
  }
  M.crossings.forEach((row,i)=>{if(row.resolution==='threshold'){
    if(Array.isArray(row.at))make(`crossing.${i}`,row.at as unknown as XY);
    else if(row.at.includes('465,700'))make(`crossing.${i}`,[465,700]);
  }});
  return positions;
}
/** Offline only: no geometry is constructed at module evaluation. */
export function buildLandCuts(baseHeight:HeightQuery):LandCuts {
  if(requireScaleFactor()!==1)throw new Error('Horizon Pass 1 was authored at confirmed factor 1.0; re-solve every profile for another factor');
  const cuts:LandCuts={beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  roadAndWalks(cuts,baseHeight);journey(cuts,baseHeight);buildTown(cuts,baseHeight);buildReserves(cuts,baseHeight);buildHostSites(cuts,baseHeight);buildStructures(cuts,baseHeight);buildUnderground(cuts,baseHeight);
  // Exclude the surface field under bridges and road tunnels, retaining natural water and roof cover.
  for(const spec of SPANS){const route=cuts.beds.find(b=>b.id===spec.route);if(route)(route.terrainExclusions??=[]).push({at:spec.at,radius:spec.length/2+2});}
  for(const [id,route,length]of [['prowTunnel','V01',90],['shoulderTunnel','V02',110],['duneCulvert','S4',32]]as const){const b=cuts.beds.find(b=>b.id===route);if(b)(b.terrainExclusions??=[]).push({at:M.structures[id]!.xy as unknown as XY,radius:length/2+2});}
  cables(cuts,baseHeight);const markers=thresholds(cuts,baseHeight);
  for(const b of cuts.beds)if(!b.id.startsWith('structure.')&&!b.id.startsWith('underground.')&&!['ORE','DEEP_RUN','ORE.siding','prowTunnel','shoulderTunnel','duneCulvert'].includes(b.id))emitBedGeometry(b,cuts,baseHeight,markers);
  return cuts;
}
