import { HORIZON_MANIFEST as M, requireScaleFactor } from '../../world/manifest';
import type { BedCut, HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { buildStructures, cableTower, SPANS } from '../structures/build';
import { box, distance, districtAt, mix, nearestOnPath, pathLength, plan, slab, solid } from '../structures/mesh';
import { pier } from '../structures/foundations';
import { buildReserves, reserveServiceLines } from '../reserves/build';
import { buildTown, squareWalkPins } from '../town/build';
import { buildHostSites } from '../town/hosts';
import { buildUnderground } from '../underground/build';
import { addFlatPad, bed, emitBedGeometry, heightOnBeds, planDistance } from './profiles';
import { gradeRoute, listSteepStretches, sampleSpline, type HeightPin } from './solver';
import { registerRowKey } from '../../world/crossings';
/** R2-03: eu inside a road tunnel's portal where its natural roof cover begins (the mouth mask hides 6 eu inside). */
export const PORTAL_CUT_INSET=3;
/** Typical grades (upper end of profiles.<kind>.grade_typ_pct): a bed rides these, not its maximum. */
const TYP={road:M.profiles.road.grade_typ_pct[1]!/100,walk:M.profiles.walk.grade_typ_pct[1]!/100,skate:M.profiles.skateMain.grade_typ_pct[1]!/100};

const pin=(xy:XY,height:number,reason:string,index?:number):HeightPin=>(index===undefined?{xy,height,reason}:{xy,height,reason,index});
const BODY_HEIGHT=1.25;
/** v1.9 (W3-A): a road that climbs between two fixed heights at one even grade after a level landing
 * of `landing` eu (Crown Road: 70 at the Drive, 110 at the turning circle). Its Year Walk footway copies
 * its heights, so an uneven climb (12 % on the tunnel ramp, flat above) put the footway over 12 %. */
function evenClimb(controls:XY[],landing:number,from:number,to:number,reason:string):HeightPin[] {
  const xy=sampleSpline(controls),arcs=[0];for(let i=1;i<xy.length;i++)arcs.push(arcs[i-1]!+distance(xy[i-1]!,xy[i]!));
  const total=arcs.at(-1)!,out:HeightPin[]=[];
  xy.forEach((p,i)=>{if(!i)return;const h=arcs[i]!<=landing?from:from+(to-from)*(arcs[i]!-landing)/(total-landing);out.push(pin(p,h,reason,i));});
  return out;
}
const routePins:Record<string,HeightPin[]>={
  V01:[pin([1400,1060],24,'Green Road junction'),pin([1480,1040],18,'upper street'),pin(M.roads.V02.pts[0] as unknown as XY,70,'Crown Road junction'),pin([900,290],48,'north pass'),pin([560,1100],12,'Bight Bridge'),pin([1350,1345],9,'Quay Bridge')],
  VG:[pin([1400,1060],24,'Horizon Drive junction'),pin([1240,1105],24,'High Span'),pin([960,860],30,'Bight spur'),pin([980,700],42,'cottage spur'),pin([974,540],40,'studio spur'),pin([945,474.5],45.5,'Year Walk February crossing at grade (v1.9)'),pin([900,290],48,'north pass')],
  V02:[pin(M.roads.V02.pts[0] as unknown as XY,70,'coast drive'),...evenClimb(M.roads.V02.pts as unknown as XY[],35,70,110,'Crown Road even climb (v1.9)'),pin([1370,690],110,'turning circle')],
  VBS:[pin([960,860],30,'Green Road'),pin([872.5,944],21.2,'S4 at grade (register S4 × VBS [874,941], W7-A: was a 1.72 step)'),pin([775,1125],14,'shore endpoint')],
  S1:[pin([1310,500],154,'Crown start'),pin([1160,935],31,'dam apron'),pin([1204,1080],12,'High Span shelf north end (v1.9: S1 rides its shelf)'),pin([1204,1098],12,'High Span shelf'),pin([1204,1133],12,'High Span shelf south end'),pin([1255,1251],5,'Reach boardwalk'),pin([1270,1330],3,'Landing finish')],
  // v2.0 D-A1: S2's Bight stretch is authored (skate.S2.levels/westRamp/deckLanes/eastDescent): see s2Profile.
  S2:[pin([480,480],38,'strip start'),pin([1020,1430],3,'park')],
  S3:[pin([1480,1060],18,'upper street'),pin([1470,1160],12,'square arrival'),pin([1440,1200],12,'square'),pin([1433,1298],3,'town quay at grade (T0 request 4: S3 ran 6-7 eu over the 3 eu quay)'),pin([1350,1345],9,'Quay Bridge'),pin([1133,1435],4,'zip underpass'),pin([1020,1430],3,'park')],
  S4:[pin([1000,520],40,'studio start'),pin([893,600],37,'Hollow Bridge'),pin([905.9,640.6],36,'Cottage front walk at grade (v1.9)'),pin([1020,1430],3,'park')],
  'walk garden':[pin([762,422],48,'Library apron'),pin([893,600],37,'Hollow Bridge'),pin([915,638],36,'Cottage front walk'),pin([930,650],38,'Cottage spur landing'),pin([990,780],56,'Glasshouse')],
  'walk lakerim':[pin([990,780],56,'Glasshouse'),pin([1161,731],55,'inlet bridge'),pin(M.walks.lakerim.pts.at(-1) as unknown as XY,52,'dam crest (v2.3: the gallery exit, not along the crest)')],
  'walk square':[pin([1455,1175],12,'square'),pin([1480,1060],18,'upper street')],
  'walk reach':[pin([1400,1290],7,'town connection'),pin([1274,1203],9.5,'Reach footbridge (v1.9: 4 m canoe clearance over the river)'),pin([1240,1130],9,'High Span walk')],
  // v2.0 D-C7: the Crown walk's own bed starts where it leaves the Year Walk's January lane (walks.crown.joinsYearWalk).
  'walk crown':[pin(M.walks.crown.joinsYearWalk.at as unknown as XY,M.walks.crown.joinsYearWalk.h,'Year Walk January lane (D-C7)'),pin([1310,500],154,'summit')],
  'walk flats':[pin([350,880],30.5,'meets the pier walk at one height (v1.9)')],
  'walk bightPier':[pin([350,880],30.5,'meets the Flats trail at one height (v1.9)')],
  'walk dune':[pin([1148,1463],3,'zip landing foot (v1.9: the dune walk starts at the stair and ramp foot, not under the stair)')],
};
type S2Data={levels:{xy:number[];h:number;why:string}[];westRamp:{from:number[];to:number[];from_h:number;to_h:number};eastDescent:{from:number[];to:number[]}};
/** v2.0 D-A1: S2 from the Wash rim to the foot of the east banked descent is one authored profile: every sample is
 * pinned, linear by arc between consecutive skate.S2.levels (the west ramp one even 5 %, the deck lanes' 8 % climbs to
 * the arch flyover at 17.6, the east descent one even 7.1 %). `deck` is the sample range the Bight Bridge carries
 * (westRamp.to → eastDescent.from: lagoon lane, flyover, sea lane), `ramp` the west ramp's range. */
export function s2Profile(controls:readonly XY[]):{pins:HeightPin[];deck:[number,number];ramp:[number,number];samples:XY[];heights:Map<number,number>} {
  const S=M.skate.S2 as unknown as S2Data,xy=sampleSpline(controls),arcs=[0];for(let i=1;i<xy.length;i++)arcs.push(arcs[i-1]!+distance(xy[i-1]!,xy[i]!));
  const at=(q:readonly number[])=>xy.reduce((best,p,i)=>distance(p,q as unknown as XY)<distance(xy[best]!,q as unknown as XY)?i:best,0);
  const marks=S.levels.map(l=>({i:at(l.xy),h:l.h})).sort((a,b)=>a.i-b.i),heights=new Map<number,number>(),pins:HeightPin[]=[];
  for(let k=1;k<marks.length;k++){const a=marks[k-1]!,b=marks[k]!;for(let i=a.i;i<=b.i;i++){const h=a.i===b.i?b.h:mix(a.h,b.h,(arcs[i]!-arcs[a.i]!)/(arcs[b.i]!-arcs[a.i]!));heights.set(i,h);}}
  heights.forEach((h,i)=>pins.push(pin(xy[i]!,h,'S2 authored profile (D-A1)',i)));
  return {pins,deck:[at(S.westRamp.to),at(S.eastDescent.from)],ramp:[at(S.westRamp.from),at(S.westRamp.to)],samples:xy,heights};
}
/** S2 on the Bight Bridge is a lane of the deck (carried: no bed deck, edge or terrain here; the bridge's own deck,
 * flyover and rails are structures'), and its west ramp crosses the Wash mouth on its own timber trestle: where the
 * ramp stands over BODY_HEIGHT above the ground its terrain is left alone (open span) and paired bents carry it. */
function carryS2(cuts:LandCuts,base:HeightQuery,b:BedCut):void {
  const pts=(M.skate.S2 as unknown as {pts:XY[]}).pts,prof=s2Profile(pts),deck=prof.samples.slice(prof.deck[0],prof.deck[1]+1);
  (b.carried??=[]).push(deck);for(const p of deck)(b.terrainExclusions??=[]).push({at:p,radius:b.width/2+1,openSpan:true});
  const trestle=solid('S2.westRamp.trestle','trestle','timber','support',['S2'],'flats');let bays=0,last:XY|undefined;
  for(let i=prof.ramp[0];i<prof.ramp[1];i++){
    const p=b.points[i]!,xy=plan(p);if(p[1]-base(...xy)<=BODY_HEIGHT)continue;
    (b.terrainExclusions??=[]).push({at:xy,radius:b.width/2+1,openSpan:true});
    // A paired bent every sample (≤ 5.2 m bays), both posts inside the deck's width, footings on the dry bed.
    if(last&&distance(last,xy)<4)continue;last=xy;bays++;
    const a=b.points[Math.max(0,i-1)]!,c=b.points[i+1]!,l=distance(plan(a),plan(c))||1,n:XY=[-(c[2]-a[2])/l,(c[0]-a[0])/l];
    for(const side of [-1,1])pier(trestle,[xy[0]+n[0]*side*(b.width/2-.35),xy[1]+n[1]*side*(b.width/2-.35)],p[1]-.6,base,[.4,.4],[1,1]);
  }
  if(trestle.indices.length){cuts.solids.push(trestle);cuts.diagnostics.push({id:'S2.westRamp.trestle',severity:'info',message:`S2's west ramp crosses the Wash mouth on ${bays} timber bents (5 % from the Wash rim to the Bight deck, D-A1)`,measured:bays});}
}
/** v2.0 D-A7 flush thresholds (Jonathan 2026-09-27): a register row resolved 'threshold' by a D-A7 ruling is one flush tread -
 * the route being laid takes the already-built route's height at the row point (#34 the pier walk comes down to the Drive,
 * #17 S4 rises to Green Road at the studio terrace). */
function flushPins(id:string,cuts:LandCuts,controls:readonly XY[]=[]):HeightPin[] {
  const out:HeightPin[]=[];
  for(const row of M.crossings as unknown as {a:string;b:string;at:unknown;resolution:string;decided?:string}[]){
    if(row.resolution!=='threshold'||!row.decided?.startsWith('D-A7')||!Array.isArray(row.at)||![row.a,row.b].includes(id))continue;
    const other=cuts.beds.find(b=>b.id===(row.a===id?row.b:row.a)),at=row.at as unknown as XY;if(!other)continue;
    const n=nearestOnPath(at,other.points);if(n.distance<3)out.push(pin(at,n.at[1],`flush threshold with ${other.id} (D-A7)`));
    // W7-A (A1.3, P16 S4 × yearWalk 0.68 of 2.4): where the other route carries Year Walk footway lanes beside it, the flush
    // tread holds the host's level across those lanes too (a landing, like the spurs'): S4 met VG flush at the studio terrace
    // and passed the September lane 6.5 m on, 0.68 under it.
    const lanes=M.journey.yearWalk.shares.filter(r=>r.host===other.id&&r.offset_m>0),reach=lanes.length?Math.max(...lanes.map(r=>r.offset_m))+b_width/2+1.2:0;
    if(n.distance<3&&reach)sampleSpline(controls).forEach((q,i)=>{if(distance(q,at)>reach)return;const m=nearestOnPath(q,other.points);if(m.distance<=reach&&lanes.some(r=>distance(q,r.from as unknown as XY)+distance(q,r.to as unknown as XY)<=distance(r.from as unknown as XY,r.to as unknown as XY)+2*reach))out.push(pin(q,m.at[1],`flush landing across ${other.id}'s footway lanes (D-A7)`,i));});
  }
  return out;
}
/** W7-A (A1.3): authored at-grade register rows between a skate line and a road whose footway walks beside it: across the road
 * and its footway (reach) the skate line takes the road's own height, so the kerb gap is one flush tread (S4 × VBS met 1.72
 * under the spur at [871.7,945.9]; S4 × walk bight 1 eu apart at [873.5,951.1]). */
const AT_GRADE=[{skate:'S4',road:'VBS',at:[874,941] as XY,reach:11}] as const;
function atGradePins(id:string,controls:readonly XY[],cuts:LandCuts):HeightPin[] {
  const out:HeightPin[]=[];
  for(const g of AT_GRADE){if(g.skate!==id)continue;const road=cuts.beds.find(b=>b.id===g.road);if(!road)continue;
    sampleSpline(controls).forEach((q,i)=>{if(distance(q,g.at)>g.reach)return;out.push(pin(q,nearestOnPath(q,road.points).at[1],`at grade with ${g.road} (W7-A)`,i));});}
  return out;
}
/** v2.0 named carriers that are not SPANS (D-C15 structures.s1Flyover, D-C9 structures.bightSpurTrestle): the route they carry
 * keeps its own grade over them, its terrain is left alone there (an open span: no fill, no counted void), and structures
 * (W5-S) stand the deck's bents outside every lower corridor. The carried stretch is the route's samples within 3 m of the
 * carrier's from→to line (and, for a self-crossing, within 3 eu of its deck, never the lower pass). */
export const NAMED_CARRIERS=[{id:'s1Flyover',route:'S1',footways:[] as string[]},{id:'bightSpurTrestle',route:'VBS',footways:['walk bight']}] as const;
function carryNamedStructures(cuts:LandCuts):void {
  for(const c of NAMED_CARRIERS){
    const s=(M.structures as unknown as Record<string,{from?:number[];to?:number[]}>)[c.id];if(!s?.from||!s.to)continue;
    const a=s.from as unknown as XY,b=s.to as unknown as XY,route=cuts.beds.find(r=>r.id===c.route);if(!route)continue;
    // The deck ends are the route's highest pass within 4 m (a self-crossing route passes twice; the flyover carries the upper).
    // Integrator 3: the carried line is the route's own points between the two ends (like structures' stretchBetween), not
    // the from→to chord: VBS bends under the trestle and the chord to the v2.1 south end left its middle 5.3 m off.
    const pick=(q:XY)=>{const d=route.points.map(p=>distance(plan(p),q)),near=d.map((_,i)=>i).filter(i=>d[i]!<=4);if(!near.length)return d.indexOf(Math.min(...d));
      const top=Math.max(...near.map(i=>route.points[i]![1]));return near.filter(i=>route.points[i]![1]>top-.5).sort((x,y)=>d[x]!-d[y]!)[0]!;};
    const [i0,i1]=[pick(a),pick(b)].sort((x,y)=>x-y) as [number,number],line:XYZ[]=route.points.slice(i0,i1+1),total=pathLength(line);
    for(const id of [c.route,...c.footways]){const r=cuts.beds.find(x=>x.id===id);if(!r)continue;const reach=id===c.route?5:9;
      for(const p of r.points){const n=nearestOnPath(plan(p),line);if(n.distance<=reach&&n.along>0&&n.along<total&&Math.abs(n.at[1]-p[1])<3)(r.terrainExclusions??=[]).push({at:plan(p),radius:r.width/2+r.shoulder+1,openSpan:true});}}
  }
}
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
  if(id==='S3'){
    const from=nearestOnPath([1470,1160],points).along,to=nearestOnPath([1440,1200],points).along;let along=0;
    for(let i=0;i<samples.length;i++){if(i)along+=distance(samples[i-1]!,samples[i]!);if(along>=from-4&&along<=to+4)out.push(pin(samples[i]!,12,'continuous square floor'));}
  }
  if(id==='V01'||id==='S4'){
    const centre=nearestOnPath([1010,1388],points).along,half=id==='V01'?10:16,height=id==='V01'?5.6:1.4;let along=0;
    for(let i=0;i<samples.length;i++){if(i)along+=distance(samples[i-1]!,samples[i]!);if(Math.abs(along-centre)<=half)out.push(pin(samples[i]!,height,'separated dune culvert crossing'));}
  }
  return out;
}
/** A bed running along another route's bridge (S2 along the Bight Bridge, S3 along the Quay
 * Bridge) is a lane of that deck: across the span it takes the deck height, instead of diving
 * to the seabed between two pins (S2 reached -2.67 under the Bight and raised a false islet). */
function spanOf(id:string,p:XY,cuts:LandCuts,dir?:XY){
  for(const s of SPANS){if(s.route===id||s.height===undefined)continue;const route=cuts.beds.find(b=>b.id===s.route);if(!route)continue;
    const n=nearestOnPath(p,route.points),ra=route.points[n.segment]!,rb=route.points[Math.min(route.points.length-1,n.segment+1)]!,rl=distance(plan(ra),plan(rb))||1,along=!dir||Math.abs(dir[0]*(rb[0]-ra[0])/rl+dir[1]*(rb[2]-ra[2])/rl)>.9;if(along&&n.distance<=s.width/2&&distance(plan(n.at),s.at)<=s.length/2)return {span:s,height:n.at[1]};}
  return undefined;
}
function spanLanePins(id:string,controls:readonly XY[],cuts:LandCuts):HeightPin[] {
  const xy=sampleSpline(controls);return xy.flatMap((p,i)=>{const a=xy[Math.max(0,i-1)]!,c=xy[Math.min(xy.length-1,i+1)]!,l=distance(a,c)||1,hit=spanOf(id,p,cuts,[(c[0]-a[0])/l,(c[1]-a[1])/l]);return hit?[pin(p,hit.height,`${hit.span.id} deck lane`)]:[];});
}
/** After span exclusions exist: a bed's stretch on another route's span is carried by that deck. */
function carrySpanLanes(cuts:LandCuts):void {
  for(const b of cuts.beds){
    if(!b.terrainCut||b.id.startsWith('structure.')||['cable','cave','rail'].includes(b.kind))continue;
    let run:XY[]=[];const flush=()=>{if(run.length>1)(b.carried??=[]).push(run);run=[];};
    for(const p of b.points){const xy=plan(p),hit=spanOf(b.id,xy,cuts);if(hit&&Math.abs(hit.height-p[1])<.5){run.push(xy);(b.terrainExclusions??=[]).push({at:xy,radius:b.width/2+b.shoulder+1,openSpan:true});}else flush();}
    flush();
  }
}
function roadAndWalks(cuts:LandCuts,base:HeightQuery):void {
  for(const [id,row]of Object.entries(M.roads)){
    if(!('pts'in row))continue;
    const controls=row.pts as unknown as XY[],b=bed(id,row.profile,gradeRoute(id,controls,base,.12,withSpanPins(id,controls,routePins[id]),cuts.diagnostics,5,TYP.road));
    if('structures'in row)b.structureIds=row.structures.filter(x=>!(id==='VG'&&x==='hollowBridge'));cuts.beds.push(b);
  }
  for(const [id,pts]of Object.entries(M.roads.spurs)){
    const name=`spur ${id}`,at=pts[0]! as unknown as XY,start=heightOnBeds(cuts,at,base,40),heights:Record<string,number>={upperStreet:18,library:48,glasshouse:34,studio:40,cottage:38,boathouse:4};
    // W3-A: where the host road carries Year Walk footway lanes (journey.yearWalk.shares), the spur
    // holds the host's height across them (a flush landing), then grades to its end: the Cottage
    // spur met the May/September lanes 0.6 eu below them at [972,692] (a lip the body cannot climb).
    const landing:HeightPin[]=[],host=cuts.beds.filter(b=>b.kind==='road').map(b=>({b,d:nearestOnPath(at,b.points).distance})).sort((x,y)=>x.d-y.d)[0];
    const lanes=host&&host.d<3?M.journey.yearWalk.shares.filter(r=>r.host===host.b.id&&r.offset_m>0):[];
    if(host&&lanes.length){const reach=Math.max(...lanes.map(r=>r.offset_m))+5.2/2+1.2;sampleSpline(pts as unknown as XY[]).forEach((q,i)=>{const n=nearestOnPath(q,host.b.points);if(i&&n.distance<=reach&&lanes.some(r=>distance(q,r.from as unknown as XY)+distance(q,r.to as unknown as XY)<=distance(r.from as unknown as XY,r.to as unknown as XY)+2*reach))landing.push(pin(q,n.at[1],'Year Walk footway landing',i));});}
    cuts.beds.push(bed(name,'spur',gradeRoute(name,pts as unknown as XY[],base,.12,[pin(at,start,'junction'),...landing,pin(pts[pts.length-1]! as unknown as XY,heights[id]!,'spur end')],cuts.diagnostics,5,TYP.road)));
  }
  for(const [id,row]of Object.entries(M.skate)){
    if(!('pts'in row))continue;
    const pts=[...row.pts] as unknown as XY[];
    if(id==='S1')pts.splice(4,0,[1435,705],[1430,775],[1325,735]);
    // v2.0 D-A1: S2's Bight stretch follows its authored profile, never another route's deck height (spanLanePins).
    const b=bed(id,'skateMain',gradeRoute(id,pts,base,.18,[...withSpanPins(id,pts,routePins[id]),...flushPins(id,cuts,pts),...atGradePins(id,pts,cuts),...(id==='S2'?s2Profile(pts).pins:spanLanePins(id,pts,cuts))],cuts.diagnostics,5,TYP.skate));
    b.surfaceSegments=row.segments.map((segment,i)=>({from:i/row.segments.length,to:(i+1)/row.segments.length,surface:segment.surface,pace:segment.pace,bankDegrees:segment.surface==='bankedTurf'?18:0}));cuts.beds.push(b);
  }
  for(const [id,row]of Object.entries(M.walks)){
    const name=`walk ${id}`;
    // v1.9 walks.<id>.footwayOf (D-2): the walk is a footway of a host bed — its plan at offset_m from the host
    // centreline on the side of side_xy, the host's height at every point, no wall between (BedCut.sharedEdges).
    const fw=(row as unknown as {footwayOf?:{host:string;offset_m:number;side_xy:number[]}}).footwayOf,fwHost=fw?cuts.beds.find(b=>b.id===fw.host):undefined;
    if(fw&&fwHost){
      const side=fw.side_xy as unknown as XY,pts=fwHost.points.map((p,i):XYZ=>{const a=fwHost.points[Math.max(0,i-1)]!,c=fwHost.points[Math.min(fwHost.points.length-1,i+1)]!,len=Math.hypot(c[0]-a[0],c[2]-a[2])||1;let nx=-(c[2]-a[2])/len,nz=(c[0]-a[0])/len;if((side[0]-p[0])*nx+(side[1]-p[2])*nz<0){nx=-nx;nz=-nz;}return [p[0]+nx*fw.offset_m,p[1],p[2]+nz*fw.offset_m];});
      const b=bed(name,row.profile,pts);(b.sharedEdges??=[]).push({other:fwHost.id,at:pts.map(plan)});(fwHost.sharedEdges??=[]).push({other:name,at:fwHost.points.map(plan)});cuts.beds.push(b);continue;
    }
    let points=row.pts as unknown as XY[];
    if(id==='garden')points=[[762,422],[850,525],[893,600],[900,640],[915,638],[930,650],[926,680],[930,720],[960,756],[990,780]];
    if(id==='coveWalk')points=[[762,422],[780,380],[754,356],...points.slice(1)];
    // v2.0: walks.<id>.levels are exact height pins (the station walk: the station deck 150 and the summit junction 154, D-A3).
    const levels=((row as unknown as {levels?:{xy:number[];h:number;why:string}[]}).levels??[]).map(l=>pin(l.xy as unknown as XY,l.h,`level ${l.why.slice(0,40)}`));
    // D-A7 #34 (V01 × the pier walk) is not pinned here: on v2.0 the Drive stands at 21.3 at the row (28.4 on candidate 3), 9 eu
    // under the Flats junction 54 m away, and pinning the pier walk to it stepped the Year Walk's July/August turn (40 %). It stays
    // an open, owned item (groundBeds OPEN_VOIDS) for the Bight Bridge west abutment work.
    const pins=withSpanPins(name,points,[...(routePins[name]??[]),...levels,...(id==='square'?squareWalkPins(sampleSpline(points)):[])]);
    if(id==='garden')for(const p of sampleSpline(points))if(p[0]>=899&&p[0]<=916&&p[1]>=637&&p[1]<=642)pins.push(pin(p,36,'Cottage front bench'));
    const wb=bed(name,row.profile,gradeRoute(name,points,base,.12,pins,cuts.diagnostics,5,TYP.walk));
    // v2.1: walks.<id>.surface_m / shoulder_m override the profile section (the lake-rim trail carries the Year Walk's February share at its width).
    const {surface_m:sw,shoulder_m:sh}=row as unknown as {surface_m?:number;shoulder_m?:number};if(sw)wb.width=sw*requireScaleFactor();if(sh)wb.shoulder=sh*requireScaleFactor();
    cuts.beds.push(wb);
  }
  // Join the Cottage spur to the garden walk at the same contour. A short
  // public link avoids treating two nearby but disconnected paths as one.
  const spur=cuts.beds.find(b=>b.id==='spur cottage')!,garden=cuts.beds.find(b=>b.id==='walk garden')!,from=spur.points.at(-1)!;
  const joins:XYZ[]=[];
  garden.points.slice(1).forEach((b,i)=>{const a=garden.points[i]!,t=(from[1]-a[1])/(b[1]-a[1]);if(t>=0&&t<=1)joins.push([mix(a[0],b[0],t),from[1],mix(a[2],b[2],t)]);});
  const to=joins.sort((a,b)=>distance(plan(a),plan(from))-distance(plan(b),plan(from)))[0];
  if(to&&distance(plan(from),plan(to))>.01&&distance(plan(from),plan(to))<40)cuts.beds.push(bed('cottage.gardenLink','walk',[from,to]));
}
/** v2.0 D-A8: journey.stations[*].pad_rot_deg (0 when absent). */
export const stationRotation=(s:unknown):number=>(s as {pad_rot_deg?:number}).pad_rot_deg??0;
export interface StationPositions { id:string; centre:XYZ; positions:XYZ[] }
/** Two empty south-facing rows; these coordinates reserve space, never create financial beds. */
export function stationBedPositions(cuts:LandCuts):StationPositions[] {
  // The two rows turn with the pad (the same rotation convention as the pad's slab).
  return M.journey.stations.map(s=>{const pad=cuts.pads.find(p=>p.id===`station.${s.id}`);if(!pad)throw new Error(`Missing station ${s.id}`);const a=pad.rotationDegrees*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);return {id:s.id,centre:pad.centre,positions:Array.from({length:20},(_,n)=>{const dx=-14.85+(n%10)*3.3,dz=n<10?-3:3;return [pad.centre[0]!+dx*c-dz*sn,pad.centre[1]!,pad.centre[2]!+dx*sn+dz*c] as unknown as XYZ;})};});
}
export function yearWalkStretches(cuts:LandCuts):{month:number;stationId:string;length:number;spacing28:number;spacing31:number}[] {
  const walk=cuts.beds.find(b=>b.id==='yearWalk');if(!walk)return [];
  const length=pathLength(walk.points),along=M.journey.stations.map(s=>nearestOnPath(s.xy as unknown as XY,walk.points).along);
  return M.journey.stations.map((s,i)=>{const previous=along[(i+11)%12]!,current=along[i]!,d=(current-previous+length)%length;return {month:s.month,stationId:s.id,length:d,spacing28:d/28,spacing31:d/31};});
}
/** Plan intersection of segments ab and cd: [t on ab, u on cd], or undefined. */
function segmentCross(a:XY,b:XY,c:XY,d:XY):[number,number]|undefined {const r=[b[0]-a[0],b[1]-a[1]],q=[d[0]-c[0],d[1]-c[1]],den=r[0]!*q[1]!-r[1]!*q[0]!;if(Math.abs(den)<1e-9)return undefined;const t=((c[0]-a[0])*q[1]!-(c[1]-a[1])*q[0]!)/den,u=((c[0]-a[0])*r[1]!-(c[1]-a[1])*r[0]!)/den;return t>=0&&t<=1&&u>=0&&u<=1?[t,u]:undefined;}
const walkGrade=()=>M.profiles.walk.grade_max_pct/100,b_width=5.2;
const insidePad=(pad:{centre:XYZ;size:XY;rotationDegrees:number},p:XY,grow=0):boolean=>{const a=-pad.rotationDegrees*Math.PI/180,dx=p[0]-pad.centre[0],dz=p[1]-pad.centre[2];return Math.abs(dx*Math.cos(a)-dz*Math.sin(a))<=pad.size[0]/2+grow&&Math.abs(dx*Math.sin(a)+dz*Math.cos(a))<=pad.size[1]/2+grow;};
interface YearWalkShare { host:string; stretch:string; offset:number; from:number; to:number }
/** The Year Walk is laid verbatim from MANIFEST journey.yearWalk (v1.7): its own control
 * points, the manifest station pins and the walk grade. On a shared stretch it is a footway
 * of its host: the host's solved height at every sample, copied, not re-graded. */
function journey(cuts:LandCuts,base:HeightQuery):YearWalkShare[] {
  const Y=M.journey.yearWalk,controls=Y.pts as unknown as XY[],limit=walkGrade(),samples=sampleSpline(controls);
  // Sample index of every control (sampleSpline emits ceil(d/5) samples per control segment).
  const controlSample=[0];for(let i=1;i<controls.length;i++)controlSample.push(controlSample[i-1]!+Math.max(1,Math.ceil(distance(controls[i-1]!,controls[i]!)/5)));
  const nearestControl=(q:XY,after=-1)=>{let best=-1,d=Infinity;controls.forEach((p,i)=>{if(i<=after)return;const e=distance(p,q);if(e<d-1e-9){d=e;best=i;}});return best;};
  const shares:YearWalkShare[]=[];
  for(const row of Y.shares){
    const host=cuts.beds.find(b=>b.id===row.host);
    if(!host){cuts.diagnostics.push({id:`yearWalk.share.${row.stretch}.${row.host}`,severity:'conflict',message:`Year Walk share host ${row.host} is not built`,at:row.from as unknown as XY});continue;}
    const a=nearestControl(row.from as unknown as XY),b=nearestControl(row.to as unknown as XY,a);
    if(a<0||b<0){cuts.diagnostics.push({id:`yearWalk.share.${row.stretch}.${row.host}`,severity:'conflict',message:'Year Walk share ends are not on the walk',at:row.from as unknown as XY});continue;}
    shares.push({host:row.host,stretch:row.stretch,offset:row.offset_m,from:controlSample[a]!,to:controlSample[b]!});
  }
  const hostHeight=(share:YearWalkShare,p:XY)=>nearestOnPath(p,cuts.beds.find(b=>b.id===share.host)!.points).at[1];
  const shareOf=(i:number)=>shares.find(s=>i>=s.from&&i<=s.to);
  const pins:HeightPin[]=[];
  // journey.yearWalk.crossings: the walk crosses S1 once, at grade, at [1255,862] (T0 request 3:
  // the crossing was 2.9 eu apart) - the walk takes S1's height there.
  const s1=cuts.beds.find(b=>b.id==='S1'),s1Cross:XY=((Y as unknown as {s1Crossing?:XY}).s1Crossing)??[1255,862];
  if(s1&&nearestOnPath(s1Cross,s1.points).distance<6)pins.push(pin(s1Cross,nearestOnPath(s1Cross,s1.points).at[1],'S1 at-grade crossing'));
  for(const s of shares)for(const i of [s.from,s.to])pins.push(pin(samples[i]!,hostHeight(s,samples[i]!),`share ${s.stretch} ${s.host} ${i===s.from?'entry':'exit'}`,i));
  // v1.9 journey.yearWalk.levels: extra height pins on unshared stretches (W3-A).
  // A level with r pins every unshared sample within r (both legs of a walk that passes twice).
  for(const l of ((Y as unknown as {levels?:{xy:number[];h:number;r?:number;why:string}[]}).levels??[])){const at=l.xy as unknown as XY;if(l.r)samples.forEach((q,i)=>{if(!shareOf(i)&&distance(q,at)<=l.r!)pins.push(pin(q,l.h,`level ${l.why.slice(0,40)}`,i));});else pins.push(pin(at,l.h,`level ${l.why.slice(0,40)}`));}
  for(const station of M.journey.stations){
    const p=Y.pins.find(q=>q.station===station.id),xy=station.xy as unknown as XY,index=samples.reduce((best,q,i)=>distance(q,xy)<distance(samples[best]!,xy)?i:best,0),share=shareOf(index);
    const h=share?hostHeight(share,samples[index]!):p?p.h:heightOnBeds(cuts,xy,base,35);
    if(share&&p&&Math.abs(p.h-h)>.5)cuts.diagnostics.push({id:`yearWalk.station.${station.id}.pin`,severity:'info',message:`Station ${station.id} lies on the ${share.host} footway; the host height ${h.toFixed(2)} replaces the manifest pin ${p.h}`,at:xy,measured:h,required:p.h});
    // The station pad is level: every walk sample on its footprint holds the station height.
    // v2.0 D-A8: a station pad may be turned (journey.stations[*].pad_rot_deg: November 90° along the Prow top).
    const pad={centre:[xy[0],h,xy[1]] as XYZ,size:M.journey.station.pad_m as unknown as XY,rotationDegrees:stationRotation(station)};
    // A turned pad (November, 90°) lies along the walk: its level stretch is the footprint itself (no 1 m apron), so the walk
    // keeps the length it needs to leave the Prow top within 12 %.
    samples.forEach((q,i)=>{if(!shareOf(i)&&insidePad(pad,q,pad.rotationDegrees?0:1))pins.push(pin(q,h,`station ${station.id} level pad`,i));});
    pins.push(pin(samples[index]!,h,`station ${station.id}`,index));
  }
  // Adjacent lanes: where the walk comes back beside itself (two months side by side, lanes a
  // few metres apart), the later lane takes the earlier lane's height, so the two read as one
  // level footway instead of two beds at different heights.
  // v1.9: crossing pins are found on a provisional solve, so the lane heights copied below already include them.
  const pre=gradeRoute('yearWalk',controls,base,limit,pins,[],5,TYP.walk);
  // journey.yearWalk.crossings: "every other crossing is at grade on a walk, a spur or a road".
  // Where the walk crosses another foot route's centreline within 2 eu of its height (a near-miss,
  // not a designed over/under), it takes that route's height (v1.7 crossed walk garden 0.6-1 eu
  // apart by the Library, a lip the body cannot climb).
  const footRoutes=cuts.beds.filter(b=>b.terrainCut&&['walk','trail'].includes(b.kind));
  // v1.9: a skate line the walk meets at grade (S4 in the Hollow) is held flush the same way.
  // W7-A (A1.3, P16 yearWalk × plot.bight.1.service 1.97 of 2.4): a plot's service drive (laid later, at its lay-by's level)
  // crosses the walk at grade: the walk rises to it (the drive is a flush junction, not a 2 m overpass on nothing).
  const gradeRoutes:{id:string;points:XYZ[]}[]=[...footRoutes,...cuts.beds.filter(b=>b.terrainCut&&b.kind==='skate'),...reserveServiceLines(cuts)];
  pre.forEach((q,i)=>{if(shareOf(i))return;for(const b of footRoutes){const n=nearestOnPath(plan(q),b.points);if(n.distance<1.5&&Math.abs(n.at[1]-q[1])<2){pins.push(pin(plan(q),n.at[1],`at-grade crossing ${b.id}`,i));break;}}});
  // W3-A: a sample spacing of 5 m misses a crossing up to 2.5 m from both samples (Scholars:
  // the Garden Walk crossing sat 0.42 eu apart and its bed walls closed the Garden Walk). Every
  // centreline crossing of a foot route within 3 eu of height holds both neighbouring samples
  // at that route's height, so the crossing is one flush tread.
  const pinned=new Set(pins.map(p=>p.index).filter((i):i is number=>i!==undefined));

  for(let i=1;i<pre.length;i++){
    if(shareOf(i)||shareOf(i-1))continue;
    const a=plan(pre[i-1]!),c=plan(pre[i]!);
    for(const b of gradeRoutes)for(let k=1;k<b.points.length;k++){
      const hit=segmentCross(a,c,plan(b.points[k-1]!),plan(b.points[k]!));if(!hit)continue;
      const hb=mix(b.points[k-1]![1],b.points[k]![1],hit[1]),hy=mix(pre[i-1]![1],pre[i]![1],hit[0]);
      if(Math.abs(hb-hy)>=3)continue;
      for(const j of [i-1,i])if(!pinned.has(j)){pins.push(pin(plan(pre[j]!),hb,`at-grade crossing ${b.id}`,j));pinned.add(j);}
    }
  }
  const first=gradeRoute('yearWalk',controls,base,limit,pins,[],5,TYP.walk),arcs=[0];for(let i=1;i<first.length;i++)arcs.push(arcs[i-1]!+distance(plan(first[i-1]!),plan(first[i]!)));
  for(let j=0;j<first.length;j++){
    if(shareOf(j))continue;
    const dir=(k:number):XY=>{const a=first[Math.max(0,k-1)]!,c=first[Math.min(first.length-1,k+1)]!,len=Math.hypot(c[0]-a[0],c[2]-a[2])||1;return [(c[0]-a[0])/len,(c[2]-a[2])/len];};
    // Lanes are 2-4 m apart and run parallel (or back the other way); switchback legs are further apart.
    let lane=-1;for(let i=0;i<j;i++)if(arcs[j]!-arcs[i]!>40&&arcs.at(-1)!-arcs[j]!+arcs[i]!>40&&distance(plan(first[i]!),plan(first[j]!))<4.5&&Math.abs(dir(i)[0]*dir(j)[0]+dir(i)[1]*dir(j)[1])>.9&&(lane<0||distance(plan(first[i]!),plan(first[j]!))<distance(plan(first[lane]!),plan(first[j]!))))lane=i;
    if(lane>=0){const a=first[lane]!,c=first[Math.min(first.length-1,lane+1)]!,t=nearestOnPath(plan(first[j]!),[a,c]).at[1];pins.push(pin(plan(first[j]!),shareOf(lane)?hostHeight(shareOf(lane)!,plan(first[j]!)):t,'adjacent lane',j));}
  }
  const solveDiagnostics:LandCuts['diagnostics']=[],points=gradeRoute('yearWalk',controls,base,limit,pins,solveDiagnostics,5,TYP.walk).map((p,i):XYZ=>{const s=shareOf(i);return s?[p[0],hostHeight(s,plan(p)),p[2]]:p;});
  const b=bed('yearWalk','walk',points);b.width=b_width;b.shoulder=1.2;b.maxGrade=limit;cuts.beds.push(b);
  // Stretches are listed on the final (host-copied) heights, not the pre-copy solve.
  cuts.diagnostics.push(...solveDiagnostics.filter(d=>!d.id.startsWith('gradeStretch.')));listSteepStretches('yearWalk',points,cuts.diagnostics,limit);
  joinCrownWalk(cuts,b);
  for(const s of M.journey.stations){const n=nearestOnPath(s.xy as unknown as XY,b.points);const p=addFlatPad(cuts,`station.${s.id}`,'station',s.xy as unknown as XY,n.at[1]!,M.journey.station.pad_m as unknown as XY,stationRotation(s));p.serviceBedId='yearWalk';p.margin=2;}
  return shares;
}
/** v2.0 D-C7: the Crown walk leaves the Year Walk's January lane at walks.crown.joinsYearWalk. Its bed starts on the lane's
 * centreline at the lane's own height (a flush junction the path graph joins), and its first metres ease from that height
 * back to its solved line at the walk grade. */
function joinCrownWalk(cuts:LandCuts,walk:BedCut):void {
  const crown=cuts.beds.find(b=>b.id==='walk crown');if(!crown)return;
  const start=plan(crown.points[0]!),n=nearestOnPath(start,walk.points);if(n.distance>6)return;
  const h=n.at[1],limit=walkGrade();crown.points.unshift([n.at[0],h,n.at[2]]);
  let run=distance(plan(n.at),start);
  for(let i=1;i<crown.points.length;i++){if(i>1)run+=distance(plan(crown.points[i-1]!),plan(crown.points[i]!));const p=crown.points[i]!,lo=h-run*limit,hi=h+run*limit;if(p[1]>=lo&&p[1]<=hi)break;crown.points[i]=[p[0],Math.min(hi,Math.max(lo,p[1])),p[2]];}
}
/** After spans and tunnels have their exclusions: a shared stretch has no wall between host and
 * footway; a stretch the host carries inside its own structure (bridge deck, tunnel section,
 * or an offset-0 trail) emits no Year Walk deck, edge or terrain override. */
function settleYearWalkShares(cuts:LandCuts,shares:readonly YearWalkShare[]):void {
  const walk=cuts.beds.find(b=>b.id==='yearWalk');if(!walk)return;
  for(const s of shares){
    const host=cuts.beds.find(b=>b.id===s.host)!,stretch=walk.points.slice(s.from,s.to+1).map(plan);
    const hostAlong=[nearestOnPath(stretch[0]!,host.points).along,nearestOnPath(stretch.at(-1)!,host.points).along].sort((a,b)=>a-b);
    let along=0;const hostStretch:XY[]=[];host.points.forEach((p,i)=>{if(i)along+=distance(plan(host.points[i-1]!),plan(p));if(along>=hostAlong[0]!-5&&along<=hostAlong[1]!+5)hostStretch.push(plan(p));});
    if(s.offset>0){(walk.sharedEdges??=[]).push({other:host.id,at:stretch});if(hostStretch.length>1)(host.sharedEdges??=[]).push({other:walk.id,at:hostStretch});}
    // Carried runs: where the host sits in its own span or tunnel; at offset 0 the wider of the two carries the other.
    // W7-A (D-D8, design lead): the February share (offset 0 on the 2.5 m lake-rim trail) is carried by the Year Walk's own
    // 5.2 m section, not the other way round: the trail keeps its profile width everywhere else, so its dam end no longer
    // overhangs the dam gallery's stairwell (10.4 eu void) nor shades the dam face at 09:00 with 1.2 m shoulders.
    const hostCarries=s.offset===0&&host.width+2*host.shoulder>=walk.width+2*walk.shoulder;
    let run:XY[]=[];const flush=()=>{if(run.length>1)(walk.carried??=[]).push(run);run=[];};
    for(const p of stretch){
      const h=nearestOnPath(p,host.points),inStructure=(host.terrainExclusions??[]).some(e=>distance(plan(h.at),e.at)<e.radius),carried=inStructure||hostCarries;
      if(carried){run.push(p);(walk.terrainExclusions??=[]).push({at:p,radius:walk.width/2+walk.shoulder+1,openSpan:(host.terrainExclusions??[]).some(e=>e.openSpan&&distance(plan(h.at),e.at)<e.radius)});}else flush();
    }
    flush();
    if(s.offset===0&&!hostCarries){
      // The host's own points on the stretch (outside its spans) ride inside the Year Walk's deck: no second deck or edge.
      let own:XY[]=[];const done=()=>{if(own.length>1)(host.carried??=[]).push(own);own=[];};
      for(const p of host.points){const xy=plan(p),inStructure=(host.terrainExclusions??[]).some(e=>distance(xy,e.at)<e.radius);if(!inStructure&&planDistance(xy,stretch)<=walk.width/2)own.push(xy);else done();}
      done();
    }
  }
  reportYearWalkSeparation(cuts,walk);
}
/** The Year Walk keeps >= its width + 15 m plan separation (edge to edge) from any bed at another
 * height, so neither's cut or fill runs under the other; each violating run is reported. */
function reportYearWalkSeparation(cuts:LandCuts,walk:BedCut):void {
  const others=cuts.beds.filter(b=>b!==walk&&b.terrainCut&&!['cable','cave','rail'].includes(b.kind)&&!b.id.startsWith('structure.'));
  const runs=new Map<string,{min:number;at:XY;dh:number;n:number}>();
  const inExclusion=(b:BedCut,p:XY)=>(b.terrainExclusions??[]).some(e=>distance(p,e.at)<e.radius);
  for(const p of walk.points){
    const xy=plan(p);if(inExclusion(walk,xy)||walk.carried?.some(line=>planDistance(xy,line)<1))continue;
    for(const o of others){
      const n=nearestOnPath(xy,o.points),edge=n.distance-walk.width/2-walk.shoulder-o.width/2-o.shoulder,dh=Math.abs(n.at[1]-p[1]);
      if(edge>=15||dh<=BODY_HEIGHT||inExclusion(o,plan(n.at)))continue;
      // Proximity is a problem only where one bed's cut or fill reaches the other: a
      // 1:1 bank over the plan gap must fit the height difference.
      if(edge>dh)continue;
      const key=o.id,r=runs.get(key);if(!r||edge<r.min)runs.set(key,{min:edge,at:xy,dh,n:(r?.n??0)+1});else r.n++;
    }
  }
  // The walk against itself (switchback legs): samples far apart along the walk but close in plan.
  const pts=walk.points,arcs=[0];for(let i=1;i<pts.length;i++)arcs.push(arcs[i-1]!+distance(plan(pts[i-1]!),plan(pts[i]!)));
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
    if(arcs[j]!-arcs[i]!<40||arcs.at(-1)!-arcs[j]!+arcs[i]!<40)continue;
    const edge=distance(plan(pts[i]!),plan(pts[j]!))-walk.width-walk.shoulder*2,dh=Math.abs(pts[i]![1]-pts[j]![1]);
    if(edge>=15||dh<=BODY_HEIGHT||edge>dh)continue;
    const r=runs.get('yearWalk');if(!r||edge<r.min)runs.set('yearWalk',{min:edge,at:plan(pts[i]!),dh,n:(r?.n??0)+1});else r.n++;
  }
  for(const [id,r]of runs)cuts.diagnostics.push({id:`yearWalk.separation.${id}`,severity:'conflict',message:`Year Walk runs ${r.min.toFixed(1)} eu edge-to-edge from ${id} at ${r.dh.toFixed(1)} eu height difference (${r.n} samples); the rule is width + 15 m plan separation or one shared bed`,at:r.at,measured:r.min,required:15});
}
/** v2.0 D-A3: the G1 tower tops are solved, never authored or clamped: each is the lowest top that keeps every span
 * profiles.cable.clear_eu over the ground (1 % sag), the station throats (MANIFEST cable.G1.towerSolve, 25 m) excepted.
 * A top above sky.ceiling fails the bake with the tower's place. */
export const G1_THROAT_M=25;
function cables(cuts:LandCuts,base:HeightQuery):void {
  const g=M.cable.G1,clear=M.profiles.cable.clear_eu??8,SAG=.01;
  const controls:XYZ[]=[[g.from[0]!,g.fromH,g.from[1]!],...g.towers.map(p=>[p[0]!,base(...p as unknown as XY)+clear,p[1]!] as unknown as XYZ),[g.to[0]!,g.toH,g.to[1]!]];
  const floor=controls.map(p=>p[1]);
  const constraints:{i:number;t:number;required:number;at:XY}[]=[];
  for(let i=1;i<controls.length;i++){
    const a=controls[i-1]!,b=controls[i]!,span=distance(plan(a),plan(b));
    for(let k=1;k<64;k++){
      const t=k/64,x=mix(a[0],b[0],t),z=mix(a[2],b[2],t),at:XY=[x,z];
      // Loading platforms are an intentional cable-to-feet boundary (the station throat), not an overhead crossing.
      if(distance(at,plan(controls[0]!))<G1_THROAT_M||distance(at,plan(controls.at(-1)!))<G1_THROAT_M)continue;
      let surface=Math.max(base(x,z),heightOnBeds(cuts,at,base,8));
      for(const pad of cuts.pads){const angle=-pad.rotationDegrees*Math.PI/180,dx=x-pad.centre[0],dz=z-pad.centre[2];if(!pad.underground&&Math.abs(dx*Math.cos(angle)-dz*Math.sin(angle))<pad.size[0]/2&&Math.abs(dx*Math.sin(angle)+dz*Math.cos(angle))<pad.size[1]/2)surface=Math.max(surface,pad.centre[1]);}
      let required=surface+clear+span*SAG*4*t*(1-t);
      for(const p of cuts.pads.filter(p=>/^plot\.terraces\.\d$/.test(p.id)))if(distance(at,plan(p.centre))<40)required=Math.max(required,p.centre[1]+12+span*SAG*4*t*(1-t));
      constraints.push({i,t,required,at});
    }
  }
  const ceilingOf=()=>M.sky.ceiling_m,last=controls.length-1,need=(j:number)=>{let h=floor[j]!;for(const q of constraints){
    if(q.i===j&&j>0)h=Math.max(h,(q.required-(1-q.t)*controls[j-1]![1])/q.t);
    if(q.i-1===j&&j<last)h=Math.max(h,(q.required-q.t*controls[j+1]![1])/(1-q.t));}return h;};
  // Feasible first (raise each tower to what its spans need, repeated), then each tower down to its own minimum given its
  // neighbours, the tallest first: the result keeps every constraint and no tower can come down alone.
  for(let pass=0;pass<64;pass++){let moved=0;for(let j=1;j<last;j++){const h=need(j);if(h>controls[j]![1]+1e-6){controls[j]=[controls[j]![0],h,controls[j]![2]];moved++;}}if(!moved)break;}
  for(let pass=0;pass<32;pass++){let moved=0;for(const j of Array.from({length:last-1},(_,k)=>k+1).sort((a,b)=>controls[b]![1]-controls[a]![1])){const h=need(j);if(h<controls[j]![1]-1e-6){controls[j]=[controls[j]![0],h,controls[j]![2]];moved++;}}if(!moved)break;}
  // Three towers (the authored line): search the middle top; the outer two then take their own minimum (each bears on a
  // fixed station). Keep the set with the shortest tallest tower above its ground, then the least total.
  if(last===4){
    const tall=(j:number)=>controls[j]![1]-floor[j]!,score=()=>[Math.max(tall(1),tall(2),tall(3)),tall(1)+tall(2)+tall(3)] as const;
    let best=controls.map(p=>[...p] as XYZ),bestScore=score();
    for(let h2=floor[2]!;h2<=ceilingOf();h2+=.25){
      controls[2]=[controls[2]![0],h2,controls[2]![2]];
      for(let k=0;k<4;k++)for(const j of [1,3])controls[j]=[controls[j]![0],need(j),controls[j]![2]];
      if(need(2)>h2+1e-6)continue;const sc=score();if(sc[0]<bestScore[0]-1e-6||Math.abs(sc[0]-bestScore[0])<=1e-6&&sc[1]<bestScore[1]){best=controls.map(p=>[...p] as XYZ);bestScore=sc;}
    }
    best.forEach((p,i)=>{controls[i]=p;});
  }
  // Never clamped: a top the fixed stations force above the sky ceiling fails the bake, located.
  const ceiling=M.sky.ceiling_m;
  controls.slice(1,-1).forEach((p,i)=>{
    if(p[1]>ceiling)throw new Error(`cable.G1.tower.${i+1}.ceiling: G1 tower ${i+1} at [${p[0].toFixed(1)},${p[2].toFixed(1)}] must reach ${p[1].toFixed(1)} eu to keep ${clear} eu over the ground, above the ${ceiling} eu sky ceiling (D-A3: no clamp)`);
    cuts.diagnostics.push({id:`cable.G1.tower.${i+1}`,severity:'info',message:`G1 tower ${i+1} top solved to ${p[1].toFixed(1)} eu (ground ${base(p[0],p[2]).toFixed(1)}, ${(p[1]-base(p[0],p[2])).toFixed(1)} tall; lowest top keeping ${clear} eu over the ground at 1 % sag)`,at:plan(p),measured:p[1],required:ceiling});
  });
  for(const q of constraints){const actual=mix(controls[q.i-1]![1],controls[q.i]![1],q.t);if(actual<q.required-.01)cuts.diagnostics.push({id:`cable.G1.clear.${q.i}.${q.t}`,severity:'conflict',message:'Fixed gondola endpoint cannot meet terrain clearance',at:q.at,measured:actual,required:q.required});}
  const gondola:XYZ[]=[];
  for(let i=1;i<controls.length;i++){const a=controls[i-1]!,b=controls[i]!,len=distance(plan(a),plan(b));for(let k=0;k<32;k++){const t=k/32;gondola.push([mix(a[0]!,b[0]!,t),mix(a[1]!,b[1]!,t)-len*.01*4*t*(1-t),mix(a[2]!,b[2]!,t)]);}}gondola.push(controls[controls.length-1]!);
  cuts.beds.push(bed('G1','cable',gondola,false));// Integrator 3 (W5-S request 3): each tower is structures' cableTower - four legs on footings, head frame, bracing.
  const towers=solid('G1.towers','tower','stone','support',['G1'],'prow'),bracing=solid('G1.towers.bracing','beam','metal','support',['G1'],'prow');controls.slice(1,-1).forEach(p=>cableTower(towers,bracing,plan(p),p[1]!,base));cuts.solids.push(towers);if(bracing.indices.length)cuts.solids.push(bracing);
  const z=M.cable.ZIP,len=distance(z.from as unknown as XY,z.to as unknown as XY),zip=Array.from({length:129},(_,k)=>{const t=k/128;return [mix(z.from[0]!,z.to[0]!,t),mix(z.fromH,z.toH,t)-len*z.sag_pct/100*4*t*(1-t),mix(z.from[1]!,z.to[1]!,t)] as unknown as XYZ;});cuts.beds.push(bed('ZIP','cable',zip,false));
  // v2.0 D-A2: the register row decides the order (ZIP under G1); the separation is signed by that order.
  const zipRow=M.crossings.find(r=>r.a==='ZIP'&&r.b==='G1'),under=zipRow?.resolution==='under',at0=(zipRow?.at??[1442,921]) as unknown as XY;
  // The measured crossing is where the two plans meet: the nearest pair of samples.
  let cross=at0,best=Infinity;for(const p of zip){const n=nearestOnPath(plan(p),gondola);if(n.distance<best&&distance(plan(p),at0)<40){best=n.distance;cross=plan(p);}}
  const sep=(nearestOnPath(cross,zip).at[1]!-nearestOnPath(cross,gondola).at[1]!)*(under?-1:1);
  cuts.diagnostics.push({id:'cable.ZIP.G1',severity:sep<clear?'conflict':'info',message:`Measured ZIP ${under?'under':'over'} G1 separation at the crossing (register order)`,at:cross,measured:sep,required:clear});
  // The rope meets each station at its bullwheel, above head height: within 16 eu of a
  // platform the cable solid never drops below platform + body clearance, so it is not a
  // tripwire across the platform or the base walk (A3-02). The bed keeps the true line.
  const CABLE_HEAD=2.6;
  const lifted=(points:readonly XYZ[]):XYZ[]=>{const ends=[points[0]!,points.at(-1)!];return points.map(p=>{let y=p[1];for(const e of ends){const d=distance(plan(p),plan(e));if(d<16)y=Math.max(y,e[1]+CABLE_HEAD);}return [p[0],y,p[2]] as XYZ;});};
  for(const [id,points]of [['G1',gondola],['ZIP',zip]]as const){const line=lifted(points),geometry=solid(`${id}.cable`,'cable','metal','rail',[id],'prow');for(let i=1;i<line.length;i++)slab(geometry,line[i-1]!,line[i]!,.09,.09);cuts.solids.push(geometry);}
  let roofMin=Infinity,terrainMin=Infinity;for(const p of zip){terrainMin=Math.min(terrainMin,p[1]!-base(p[0]!,p[2]!));for(const h of M.hosts)if(Math.abs(p[0]!-h.xy[0]!)<=h.footprint_m[0]!/2&&Math.abs(p[2]!-h.xy[1]!)<=h.footprint_m[1]!/2)roofMin=Math.min(roofMin,p[1]!-h.h-h.roofH_eu);}
  if(roofMin<12)cuts.diagnostics.push({id:'cable.ZIP.roofs',severity:'conflict',message:'Fixed sagged zip line fails a host roof clearance',measured:roofMin,required:12});
  if(terrainMin<8)cuts.diagnostics.push({id:'cable.ZIP.terrain',severity:'conflict',message:'Fixed zip line fails terrain clearance; endpoints were not moved',measured:terrainMin,required:8});
}
function thresholds(cuts:LandCuts,base:HeightQuery):XY[] {
  const positions:XY[]=[];
  // v1.9: a threshold on a jetty stands at that jetty's deck (docks now sit 0.6 over the water they reach).
  const jettyTop=(p:XY)=>{for(const s of cuts.solids){if(!s.id.startsWith('jetty.')||s.role!=='deck')continue;let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,y1=-Infinity;const q=s.positions;for(let i=0;i<q.length;i+=3){x0=Math.min(x0,q[i]!);x1=Math.max(x1,q[i]!);y1=Math.max(y1,q[i+1]!);z0=Math.min(z0,q[i+2]!);z1=Math.max(z1,q[i+2]!);}if(p[0]>=x0-.5&&p[0]<=x1+.5&&p[1]>=z0-.5&&p[1]<=z1+.5)return y1;}return undefined;};
  const make=(id:string,p:XY,h0?:number)=>{
    const h=h0===undefined?undefined:jettyTop(p)??h0,height=h??heightOnBeds(cuts,p,base,40),underground=['threshold.deepJetty','threshold.stepsFoot'].includes(id),ground=base(...p);
    // A threshold above its ground or over water is a raised deck (tower top, gallery, jetty):
    // it never shapes the heightfield; its supports belong to the structure that carries it.
    const deck=!underground&&(height-ground>BODY_HEIGHT||ground<M.seaLevel);
    const pad=addFlatPad(cuts,id,'threshold',p,height,[6,5],0,underground);if(deck){pad.deck=true;pad.blend=0;
      // On a structure's own deck at this height (Crown launch, cable platforms, lamp gallery, jetties) the deck is the
      // floor: no second pad slab floats beside it (structures.padFloating). The pad stays as the threshold's footprint.
      const onDeck=cuts.solids.some(s=>(s.role==='deck'||s.role==='floor')&&s.id!==`${id}.slab`&&(()=>{let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,y1=-Infinity;const q=s.positions;for(let i=0;i<q.length;i+=3){x0=Math.min(x0,q[i]!);x1=Math.max(x1,q[i]!);y1=Math.max(y1,q[i+1]!);z0=Math.min(z0,q[i+2]!);z1=Math.max(z1,q[i+2]!);}return p[0]>=x0&&p[0]<=x1&&p[1]>=z0&&p[1]<=z1&&Math.abs(y1-height)<.5;})());
      if(onDeck)cuts.solids=cuts.solids.filter(s=>s.id!==`${id}.slab`);}
    if(!underground&&!deck&&ground-height>BODY_HEIGHT)cuts.diagnostics.push({id:`${id}.pit`,severity:'conflict',message:`${id} is authored ${(ground-height).toFixed(1)} eu below its ground; the pad would dig a pit`,at:p,measured:height,required:ground});
    positions.push(p);const marker=solid(`${id}.marker`,'threshold','stone','marker',[],districtAt(...p));box(marker,p,height+.025,[2,.6],height-.05);cuts.solids.push(marker);pad.margin=1;};
  for(const row of M.thresholds){
    if(typeof row.xy==='string'){Object.entries(M.water_routes.FERRY.piers).forEach(([id,p])=>make(`threshold.${row.id}.${id}`,p as unknown as XY,1));continue;}
    if(Array.isArray(row.xy[0]!))(row.xy as number[][]).forEach((p,i)=>make(`threshold.${row.id}.${i+1}`,p as unknown as XY));
    else {const exact:Record<string,number>={gondolaBase:M.cable.G1.fromH,gondolaTop:M.cable.G1.toH,adit:40,southPortal:110,prowPlatform:M.sky.launches.prow.h,crownLaunch:M.sky.launches.crown.h,zipLanding:12,lampGallery:M.sky.launches.lampGallery.h,deepJetty:40.6,seaDoorJetty:1,lampDock:1,bightShoreJetty:1,floatDock:1.2,boathouseDock:1,landingQuay:3,stepsFoot:4};make(`threshold.${row.id}`,row.xy as unknown as XY,exact[row.id]!);}
  }
  // Only authored register rows make a dismount pad: rows accepted from the bake (source 'bake v1.8') are flush
  // junctions, footways or unresolved proposals, never a new marker (R1-88).
  M.crossings.forEach((row,i)=>{if(row.resolution==='threshold'&&!(row as {source?:string}).source){
    // Register pads are named by the row's route names (registerRowKey), not its list index (R1-68).
    if(Array.isArray(row.at))make(registerRowKey(i),row.at as unknown as XY);
    else if(row.at.includes('465,700'))make(registerRowKey(i),[465,700]);
  }});
  return positions;
}
/** A bed never raises the sea floor or a lake bed: where its centreline is over open water
 * (outside its own span, tunnel or carried stretch) its terrain override is withheld and the
 * stretch is reported, never filled into a causeway or a false islet. */
function guardWater(cuts:LandCuts,base:HeightQuery):void {
  const lakes=['stillwater','cup'].map(id=>M.water[id as 'stillwater'|'cup']);
  const wet=(x:number,z:number)=>{const g=base(x,z);return g<M.seaLevel?M.seaLevel:lakes.find(l=>((x-l.cx)/l.rx)**2+((z-l.cy)/l.ry)**2<=1&&g<l.surface)?.surface;};
  for(const b of cuts.beds){
    if(!b.terrainCut||['cable','cave','rail'].includes(b.kind))continue;
    let count=0,first:XY|undefined,deepest=Infinity;
    for(const p of b.points){
      const xy=plan(p),level=wet(...xy);if(level===undefined)continue;
      if((b.terrainExclusions??[]).some(e=>distance(xy,e.at)<e.radius))continue;
      (b.terrainExclusions??=[]).push({at:xy,radius:b.width/2+b.shoulder+1});
      count++;first??=xy;deepest=Math.min(deepest,p[1]-level);
    }
    if(count)cuts.diagnostics.push({id:`bed.${b.id}.overWater`,severity:'conflict',message:`${b.id}: ${count} centreline samples over open water outside a named span; no terrain fill is emitted there (deck ${deepest.toFixed(2)} eu relative to the water)`,at:first,measured:count,required:0});
  }
}
/** Rail holds profiles.rail.grade_max_pct (6 %) except the two named exceptions: the chain-lift
 * incline (profiles.rail.chainLift, along the line between its ends) and the drop (rail.ORE.drop).
 * Every other stretch over 6 % is a conflict; the chain lift's own maximum is listed. */
function checkRailGrades(cuts:LandCuts):void {
  const limit=M.profiles.rail.grade_max_pct/100,lift=M.profiles.rail.chainLift,drop=M.rail.ORE.drop.at as unknown as XY;
  for(const b of cuts.beds.filter(b=>b.kind==='rail')){
    const from=nearestOnPath(lift.from as unknown as XY,b.points),to=nearestOnPath(lift.to as unknown as XY,b.points);
    let along=0;const incline:XY[]=[];
    if(from.distance<20&&to.distance<20)b.points.forEach((p,i)=>{if(i)along+=distance(plan(b.points[i-1]!),plan(p));if(along>=Math.min(from.along,to.along)&&along<=Math.max(from.along,to.along))incline.push(plan(p));});
    const exempt=(at:XY)=>(incline.length>1&&planDistance(at,incline)<2)||distance(at,drop)<20;
    listSteepStretches(b.id,b.points,cuts.diagnostics,limit,limit,exempt);
    if(incline.length>1){let max=0;for(let i=1;i<b.points.length;i++){const a=b.points[i-1]!,c=b.points[i]!,mid:XY=[(a[0]+c[0])/2,(a[2]+c[2])/2];if(planDistance(mid,incline)<2)max=Math.max(max,Math.abs(c[1]-a[1])/(distance(plan(a),plan(c))||1));}
      cuts.diagnostics.push({id:`rail.${b.id}.chainLift`,severity:'info',message:`${b.id}: the named chain-lift incline (${lift.from.join(',')} to ${lift.to.join(',')}) is exempt from ${M.profiles.rail.grade_max_pct} %; its maximum is ${(max*100).toFixed(1)} %`,at:lift.from as unknown as XY,measured:max,required:limit});}
  }
}
/** Offline only: no geometry is constructed at module evaluation. */
export function buildLandCuts(baseHeight:HeightQuery):LandCuts {
  if(requireScaleFactor()!==1)throw new Error('Horizon Pass 1 was authored at confirmed factor 1.0; re-solve every profile for another factor');
  const cuts:LandCuts={beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  roadAndWalks(cuts,baseHeight);const shares=journey(cuts,baseHeight);buildTown(cuts,baseHeight);buildReserves(cuts,baseHeight);buildHostSites(cuts,baseHeight);buildStructures(cuts,baseHeight);buildUnderground(cuts,baseHeight);
  // Exclude the surface field under bridges and road tunnels, retaining natural water and roof cover.
  // v1.9: a span also carries its route's footways (beds sharing an edge with it): no terrain fill under them either.
  for(const spec of SPANS){for(const b of cuts.beds.filter(b=>b.id===spec.route||(b.sharedEdges??[]).some(e=>e.other===spec.route&&e.at.some(p=>distance(p,spec.at)<spec.length/2+2))))(b.terrainExclusions??=[]).push({at:spec.at,radius:spec.length/2+2,openSpan:true});}
  // R2-03: a road tunnel's natural cover ends PORTAL_CUT_INSET inside each portal, so the road cut (and its clearance,
  // one raster diagonal further out) reaches the portal face: the cut-to-cover lattice step then lies inside the mouth mask.
  // Only the Shoulder Tunnel's north portal (Crown Road's lower end) had the step; its south portal keeps its cover (walk
  // crownFromGondola crosses over it), so the cover circle slides south: north edge 3 eu inside, south edge unchanged.
  // v2.0 D-A4: the Prow is a gallery (the hill is one wall, a colonnade the other): no natural cover is kept over the Drive and
  // its verges - the road cuts the hillside as usual and structures roof it; a cover circle left the verges in the hill.
  for(const [id,route,length]of [['prowTunnel','V01',90],['shoulderTunnel','V02',110],['duneCulvert','S4',32]]as const){const b=cuts.beds.find(b=>b.id===route);if(!b)continue;
    if((M.structures[id] as {kind?:string}).kind==='gallery')continue;
    const at=M.structures[id]!.xy as unknown as XY,e:{at:XY;radius:number;terrainAt?:XY;terrainRadius?:number}={at,radius:length/2+2};
    if(id==='shoulderTunnel'){const pts=b.points.map(plan),n=nearestOnPath(at,b.points),i=Math.min(pts.length-1,n.segment+1),dir=[pts[i]![0]-pts[n.segment]![0],pts[i]![1]-pts[n.segment]![1]],l=Math.hypot(dir[0]!,dir[1]!)||1,shift=(PORTAL_CUT_INSET+2)/2;
      e.terrainAt=[at[0]+dir[0]!/l*shift,at[1]+dir[1]!/l*shift];e.terrainRadius=length/2+2-shift;}
    (b.terrainExclusions??=[]).push(e);}
  cuts.beds.find(b=>b.id==='V01')!.terrainExclusions!.push({at:[1010,1388],radius:12});
  settleYearWalkShares(cuts,shares);{const s2=cuts.beds.find(b=>b.id==='S2');if(s2)carryS2(cuts,baseHeight,s2);}carryNamedStructures(cuts);carrySpanLanes(cuts);guardWater(cuts,baseHeight);checkRailGrades(cuts);
  cables(cuts,baseHeight);const markers=thresholds(cuts,baseHeight);
  for(const b of cuts.beds)if(!b.id.startsWith('structure.')&&!b.id.startsWith('underground.')&&!['ORE','DEEP_RUN','ORE.siding','prowTunnel','shoulderTunnel','duneCulvert'].includes(b.id))emitBedGeometry(b,cuts,baseHeight,markers);
  return cuts;
}
