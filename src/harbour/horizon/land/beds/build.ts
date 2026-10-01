import {mountainRoadChain} from '../corridor/chain';
import {fitMountainHorizonJoins} from '../mountainV2/joins';
import { HORIZON_MANIFEST as M, requireScaleFactor } from '../../world/manifest';
import { buildStillwaterLink } from '../mountainV2/stillwater';
import type { BedCut, HeightQuery, LandCuts, XY, XYZ } from '../interfaces';
import { buildStructures, cableTower, duneCulvertCentre, SPANS, spanDeckLength, structureStretches } from '../structures/build';
import { box, distance, districtAt, mix, nearestOnPath, pathLength, plan, slab, solid } from '../structures/mesh';
import { bridgeFrame } from '../bridges/frames';
import { pier } from '../structures/foundations';
import { buildReserves, reserveServiceLines } from '../reserves/build';
import { buildTown, squareWalkPins } from '../town/build';
import { buildHostSites } from '../town/hosts';
import { buildUnderground, oreStationFloor } from '../underground/build';
import { addFlatPad, bed, emitBedGeometry, heightOnBeds, planDistance } from './profiles';
import { gradeRoute, listSteepStretches, sampleSpline, type HeightPin } from './solver';
import { registerRowKey } from '../../world/crossings';
import { mountainV2Rule } from '../mountainV2/ground';
import { mountainV2Road, mountainV2Promenade, mountainV2Course, mountainV2RoadFootway, onMountainV2Road, regionCarry, regionCarryRadius, regionCarryLand, MOUNTAIN_V2_ROAD_ID, MOUNTAIN_V2_SEGMENTS } from '../mountainV2/beds';
/** R2-03: eu inside a road tunnel's portal where its natural roof cover begins (the mouth mask hides 6 eu inside). */
export const PORTAL_CUT_INSET=3;
/** Typical grades (upper end of profiles.<kind>.grade_typ_pct): a bed rides these, not its maximum. */
const TYP={road:M.profiles.road.grade_typ_pct[1]!/100,walk:M.profiles.walk.grade_typ_pct[1]!/100,skate:M.profiles.skateMain.grade_typ_pct[1]!/100};

const pin=(xy:XY,height:number,reason:string,index?:number):HeightPin=>(index===undefined?{xy,height,reason}:{xy,height,reason,index});
const BODY_HEIGHT=1.25;
// v2.6 (D-M4): evenClimb (Crown Road's even climb between the Drive and the turning circle) is retired with V02.
const routePins:Record<string,HeightPin[]>={
  // v2.6 (D-M4): Crown Road (V02) is retired; the Drive keeps the height it held at the old junction (70 at [1433.3,335.6]) so
  // nothing on the north-east drive moves; V03 takes V01's own height at its junction.
  // road (L1): the Drive holds 24.5 at the pier walk's flush crossing (D-A7 #34, [402.3,894.5]): at 21 the pier walk could not
  // come down to it within 12 % and the junction solve lifted 220 m of the Drive 7.5 eu off its own footway lanes; at 24.5 the
  // pier walk meets it within 10 % and the Drive falls ≤ 10 % to the Bight Bridge.
  V01:[pin([1400,1060],24,'Green Road junction'),pin([1480,1040],18,'upper street'),pin([1433.3,335.6],70,'the north-east drive (v2.5 Crown Road junction height, kept)'),pin([900,290],48,'north pass'),pin([402.3,894.5],24.5,'the pier walk flush crossing (D-A7 #34, road L1)'),pin([560,1100],12,'Bight Bridge'),pin([1350,1345],9,'Quay Bridge')],
  VG:[pin([1400,1060],24,'Horizon Drive junction'),pin([1240,1105],24,'High Span'),pin([960,860],30,'Bight spur'),pin([980,700],42,'cottage spur'),pin([974,540],40,'studio spur'),pin([945,474.5],45.5,'Year Walk February crossing at grade (v1.9)'),pin([900,290],48,'north pass')],
  VBS:[pin([960,860],30,'Green Road'),pin([872.5,944],21.2,'S4 at grade (register S4 × VBS [874,941], W7-A: was a 1.72 step)'),pin([775,1125],14,'shore endpoint')],
  // v2.6 (D-M5): S1's upper half is Mountain v2's course (laid exactly, mountainV2Course); these pins grade the Horizon stretch
  // from the quay finish: the sill's rock shelf at 31 (was the Dam apron), the High Span shelf, the Reach boardwalk, the Landing.
  S1:[pin([1270.5,836.5],52.9,'the Foot bridge over the mountain brook (s1InflowBridge: 1.25 clear over 50.6)'),pin([1170.2,929],31,'the sill shelf, east edge (v2.5: the apron\'s level bay)'),pin([1160,935],31,'the sill shelf (v2.5: dam apron)'),pin([1204,1080],12,'High Span shelf north end (v1.9: S1 rides its shelf)'),pin([1204,1098],12,'High Span shelf'),pin([1204,1133],12,'High Span shelf south end'),pin([1255,1251],5,'Reach boardwalk'),pin([1270,1330],M.structures.landingQuay.finish_h,'Landing finish (v2.4: the islet\'s natural ground, W7-S request)')],
  // v2.0 D-A1: S2's Bight stretch is authored (skate.S2.levels/westRamp/deckLanes/eastDescent): see s2Profile.
  S2:[pin([480,480],38,'strip start'),pin([1020,1430],3,'park')],
  S3:[pin([1480,1060],18,'upper street'),pin([1470,1160],12,'square arrival'),pin([1440,1200],12,'square'),pin([1433,1298],3,'town quay at grade (T0 request 4: S3 ran 6-7 eu over the 3 eu quay)'),pin([1360,1340],9,'Quay Bridge deck edge (integrator 4, W7-S request 1: S3 joined the 9 deck at 8.5-8.7)'),pin([1350,1345],9,'Quay Bridge'),pin([1133,1435],4,'zip underpass'),pin([1020,1430],3,'park')],
  S4:[pin([1000,520],40,'studio start'),pin([893,600],37,'Hollow Bridge'),pin([905.9,640.6],36,'Cottage front walk at grade (v1.9)'),pin([1020,1430],3,'park')],
  'walk garden':[pin([762,422],48,'Library apron'),pin([893,600],37,'Hollow Bridge'),pin([915,638],36,'Cottage front walk'),pin([930,650],38,'Cottage spur landing'),pin([990,780],56,'Glasshouse')],
  // v2.6: the Inlet Footbridge (55 over the upper river) is retired with the upper river; the trail ends on the sill's east lip.
  'walk lakerim':[pin([990,780],56,'Glasshouse'),pin(M.walks.lakerim.pts.at(-1) as unknown as XY,52,'the sill\'s east lip (v2.3: the dam gallery exit)')],
  'walk square':[pin([1455,1175],12,'square'),pin([1480,1060],18,'upper street')],
  'walk reach':[pin([1400,1290],7,'town connection'),pin([1274,1203],9.5,'Reach footbridge (v1.9: 4 m canoe clearance over the river)'),pin([1240,1130],9,'High Span walk')],
  'walk flats':[pin([350,880],30.5,'meets the pier walk at one height (v1.9)')],
  'walk bightPier':[pin([350,880],30.5,'meets the Flats trail at one height (v1.9)')],
  'walk dune':[pin([1148,1463],3,'zip landing foot (v1.9: the dune walk starts at the stair and ramp foot, not under the stair)')],
  // road (L1): the Library spur crosses the Year Walk 12 eu before the October station pad (45.5): at the spur's 46.7 the walk
  // could not come down to the pad within 12 % and both the crossing and the pad's edge stepped 0.6–0.9. The spur dips to 46.2.
  'spur library':[pin([806.1,336.9],46.2,'the Year Walk crossing before the October station (road L1)')],
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
type SkateRow={pts:number[][];segments:{name:string;pace:string;surface:string;start?:number[]}[]};
/** v2.6 (D-M5): S1's upper half is Mountain v2's race course, laid on its exact points (summit start → the quay finish gate);
 * where it runs on v2's land the region carries it (regionCarryLand: no Horizon cut, deck or wall). Below the quay finish the
 * Horizon stretch (the sill, the Notch shelf, the Reach, the Landing) is graded as before from the finish's own height.
 * Segments run from each MANIFEST `segments[i].start` (the nearest point of the built line) to the next. */
function s1OnMountain(cuts:LandCuts,base:HeightQuery,row:SkateRow,upperPts:number):BedCut {
  const upper=mountainV2Course(),finish=upper.at(-1)!,controls=[plan(finish),...(row.pts.slice(upperPts) as unknown as XY[])];
  const pins=[pin(plan(finish),finish[1],'Mountain v2 quay finish gate (D-M5)'),...withSpanPins('S1',controls,routePins.S1),...flushPins('S1',cuts,controls),...atGradePins('S1',controls,cuts),...spanLanePins('S1',controls,cuts)];
  const lower=gradeRoute('S1',controls,base,.18,pins,cuts.diagnostics,5,TYP.skate),b=bed('S1','skateMain',[...upper,...lower.slice(1)]);
  const carried=regionCarryLand(b),arcs=[0];for(let i=1;i<b.points.length;i++)arcs.push(arcs[i-1]!+distance(plan(b.points[i-1]!),plan(b.points[i]!)));
  const total=arcs.at(-1)!||1,starts=row.segments.map(g=>g.start?nearestOnPath(g.start as unknown as XY,b.points).along/total:0);
  b.surfaceSegments=row.segments.map((g,i)=>({from:i?starts[i]!:0,to:i<row.segments.length-1?starts[i+1]!:1,surface:g.surface,pace:g.pace,bankDegrees:g.surface==='bankedTurf'?18:0}));
  cuts.diagnostics.push({id:'bed.S1.mountainV2',severity:'info',message:`S1: ${upper.length} Mountain v2 course points (summit start → quay finish, ${MOUNTAIN_V2_SEGMENTS.length} v2 segments), ${carried} carried by the region on v2's land; ${lower.length-1} Horizon samples to the Landing (D-M5)`,at:plan(finish),measured:total});
  return b;
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
function flushPins(id:string,cuts:LandCuts,controls:readonly XY[]=[],onlyRoads=false):HeightPin[] {
  const out:HeightPin[]=[];
  for(const row of M.crossings as unknown as {a:string;b:string;at:unknown;resolution:string;decided?:string}[]){
    if(row.resolution!=='threshold'||!row.decided?.startsWith('D-A7')||!Array.isArray(row.at)||![row.a,row.b].includes(id))continue;
    const other=cuts.beds.find(b=>b.id===(row.a===id?row.b:row.a)),at=row.at as unknown as XY;if(!other||onlyRoads&&other.kind!=='road')continue;
    const n=nearestOnPath(at,other.points);if(n.distance<3)out.push(pin(at,n.at[1],`flush threshold with ${other.id} (D-A7)`));
    // W7-A (A1.3, P16 S4 × yearWalk 0.68 of 2.4): where the other route carries Year Walk footway lanes beside it, the flush
    // tread holds the host's level across those lanes too (a landing, like the spurs'): S4 met VG flush at the studio terrace
    // and passed the September lane 6.5 m on, 0.68 under it.
    const lanes=M.journey.yearWalk.shares.filter(r=>r.host===other.id&&r.offset_m>0),reach=lanes.length?Math.max(...lanes.map(r=>r.offset_m))+b_width/2+1.2:0;
    // road (L1): for a walk meeting a road (onlyRoads) only the samples on the lanes' own side of the road are held (the pier walk
    // west of the Drive keeps its own grade down to it; the July/August lanes are on the lagoon side).
    const side=(q:XY,m:{at:XYZ;segment:number})=>{const a=other.points[m.segment]!,b=other.points[Math.min(other.points.length-1,m.segment+1)]!;return Math.sign((b[0]-a[0])*(q[1]-m.at[2])-(b[2]-a[2])*(q[0]-m.at[0]));};
    const laneSides=new Set(lanes.map(r=>{const f=r.from as unknown as XY;return side(f,nearestOnPath(f,other.points));}));
    if(n.distance<3&&reach)sampleSpline(controls).forEach((q,i)=>{if(distance(q,at)>reach)return;const m=nearestOnPath(q,other.points);if(onlyRoads&&m.distance>other.width/2+other.shoulder&&!laneSides.has(side(q,m)))return;if(m.distance<=reach&&lanes.some(r=>distance(q,r.from as unknown as XY)+distance(q,r.to as unknown as XY)<=distance(r.from as unknown as XY,r.to as unknown as XY)+2*reach))out.push(pin(q,m.at[1],`flush landing across ${other.id}'s footway lanes (D-A7)`,i));});
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
export const NAMED_CARRIERS=[{id:'s1Flyover',route:'S1',footways:[] as string[]},{id:'bightSpurTrestle',route:'VBS',footways:['walk bight']},{id:'prowLoopFootbridge',route:'yearWalk',footways:[] as string[]}] as const;
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
function withSpanPins(id:string,controls:XY[],pins:HeightPin[]=[],straight?:ReadonlySet<number>):HeightPin[] {
  const samples=sampleSpline(controls,5,straight),points:XYZ[]=samples.map(p=>[p[0],0,p[1]]),out=[...pins];
  for(const span of SPANS.filter(s=>s.route===id&&s.height!==undefined)){
    const hit=nearestOnPath(span.at,points),travel=[0];for(let i=1;i<points.length;i++)travel.push(travel[i-1]!+distance(plan(points[i-1]!),plan(points[i]!)));
    // road (L1): the route is level over exactly the deck's length (structures spanDeckLength), so it meets both deck ends flush.
    const half=spanDeckLength(span)/2;
    for(const delta of [-half,0,half]){
      const target=hit.along+delta;let best=0;travel.forEach((d,i)=>{if(Math.abs(d-target)<Math.abs(travel[best]!-target))best=i;});out.push(pin(samples[best]!,span.height!,`${span.id} ${delta<0?'entry':delta>0?'exit':'centre'}`));
    }
    travel.forEach((d,i)=>{if(Math.abs(d-hit.along)<=half+.01)out.push(pin(samples[i]!,span.height!,`${span.id} deck ${i}`));});
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
/** road (L1): a skate line ending in the Tideline park is at the park's level (3) across the park's pad and 1 eu round it: S4
 * came in 0.9 under the park's edge and held the ground there under the slab (a 0.84 step between the Drive's embankment and the
 * park). */
function parkPins(controls:readonly XY[]):HeightPin[] {
  const park=M.skate.park as unknown as {xy:number[];size:number[]},c=park.xy as unknown as XY,half:XY=[park.size[0]!/2+1,park.size[1]!/2+1];
  return sampleSpline(controls).flatMap((q,i)=>Math.abs(q[0]-c[0])<=half[0]&&Math.abs(q[1]-c[1])<=half[1]?[pin(q,3,'the Tideline park level (road L1)',i)]:[]);
}
/** road (L1): the main roads a skate line may ride at grade (their deck is its surface there). */
const LANE_HOSTS=['V01','VG','V03'];
/** road (L1): a skate line whose provisional solve runs within 1.5 eu of a main road's height inside that road's paved width
 * plus its own half width takes the road's height there (pins by sample), and the samples just beyond ease away at its grade. */
function roadLanePins(id:string,controls:readonly XY[],cuts:LandCuts,pins:readonly HeightPin[],base:HeightQuery):HeightPin[] {
  const roads=cuts.beds.filter(b=>LANE_HOSTS.includes(b.id));if(!roads.length)return [];
  const pre=gradeRoute(id,controls,base,.18,pins,[],5,TYP.skate),out:HeightPin[]=[],own=M.profiles.skateMain.surface_m[1]!/2;
  pre.forEach((p,i)=>{for(const r of roads){const n=nearestOnPath(plan(p),r.points);if(n.distance<=r.width/2+r.shoulder+own&&Math.abs(n.at[1]-p[1])<1.5){out.push(pin(plan(p),n.at[1],`on ${r.id}'s carriageway (road L1)`,i));break;}}});
  return out;
}
/** road (L1): the stretch of a skate line lying inside a main road's paved width at the road's height is carried by the road's
 * deck: it emits no deck, edge or wall of its own there (S3's lane edges stood 0.85–0.96 over the Drive's carriageway). */
function carryRoadLanes(cuts:LandCuts):void {
  const roads=cuts.beds.filter(b=>LANE_HOSTS.includes(b.id));
  for(const b of cuts.beds){if(b.kind!=='skate'||!b.terrainCut)continue;
    let run:XY[]=[];const flush=()=>{if(run.length>1)(b.carried??=[]).push(run);run=[];};
    for(const p of b.points){const xy=plan(p),on=roads.some(r=>{const n=nearestOnPath(xy,r.points);return n.distance<=r.width/2+r.shoulder&&Math.abs(n.at[1]-p[1])<.05;});if(on)run.push(xy);else flush();}
    flush();}
}
/** road (L1, the one-road-on-structures rule): a road's stretch that a structure's own deck or floor carries (structureStretches)
 * is carried by it: the road emits no second deck, shoulder, kerb, edge or wall there (V01.bed lay on the Quay and Bight decks
 * and the gallery floor, V01.edges stood inside the Quay's rails). The bed keeps its points: the corridor, crossings, the path
 * graph and the Journey read them; the structure's deck top is the same surface (its route is pinned to the deck height). */
function carryStructureStretches(cuts:LandCuts):void {
  for(const r of structureStretches(cuts.beds)){
    const b=cuts.beds.find(x=>x.id===r.bedId);if(!b)continue;
    const arcs=[0];for(let i=1;i<b.points.length;i++)arcs.push(arcs[i-1]!+distance(plan(b.points[i-1]!),plan(b.points[i]!)));
    if(r.structureId==='hollowBridge'){
      // Exact deck boundaries: filtering coarse walk control points left the last
      // 5.61 m carrying its own internal edge. Split before suppressing segments,
      // so the guard on the approach outside the bridge remains present.
      const first=bridgeFrame(b.points,r.from),last=bridgeFrame(b.points,r.to);
      const inside=b.points.filter((_,i)=>arcs[i]!>r.from&&arcs[i]!<r.to);
      (b.carried??=[]).push([first,...inside,last].map(plan));
      b.points=[...b.points.filter((_,i)=>arcs[i]!<r.from),first,...inside,last,...b.points.filter((_,i)=>arcs[i]!>r.to)];
    }else{
    const run=b.points.filter((_,i)=>arcs[i]!>=r.from+.5&&arcs[i]!<=r.to-.5).map(plan);if(run.length>1)(b.carried??=[]).push(run);
    }
  }
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
/** W3-A: where a route starts on a road that carries Year Walk footway lanes (journey.yearWalk.shares), the route holds the host's
 * height across them (a flush landing), then grades to its end: the Cottage spur met the May/September lanes 0.6 eu below them
 * at [972,692] (a lip the body cannot climb). road (L1): shared by the spurs and the roads (VBS). */
function footwayLanding(cuts:LandCuts,controls:readonly XY[],step=5,width=0):HeightPin[] {
  const at=controls[0]!,landing:HeightPin[]=[],host=cuts.beds.filter(b=>b.kind==='road').map(b=>({b,d:nearestOnPath(at,b.points).distance})).sort((x,y)=>x.d-y.d)[0];
  const lanes=host&&host.d<3?M.journey.yearWalk.shares.filter(r=>r.host===host.b.id&&r.offset_m>0):[];
  if(host&&lanes.length){const reach=Math.max(...lanes.map(r=>r.offset_m))+5.2/2+1.2;sampleSpline(controls,step).forEach((q,i)=>{const n=nearestOnPath(q,host.b.points);if(i&&n.distance<=reach&&lanes.some(r=>distance(q,r.from as unknown as XY)+distance(q,r.to as unknown as XY)<=distance(r.from as unknown as XY,r.to as unknown as XY)+2*reach))landing.push(pin(q,n.at[1],'Year Walk footway landing',i));});}
  // road (L1): a road leaving another road lies flush on it wherever its own bed overlaps the host's paved width (the Boathouse
  // spur leaves the Drive at a shallow angle on its 7 % climb and stood 0.55 under it for 4 m, a lip the cruiser stalled on).
  if(host&&host.d<3&&width>0){const reach=host.b.width/2+host.b.shoulder+width/2;sampleSpline(controls,step).forEach((q,i)=>{if(!i||landing.some(p=>p.index===i))return;const n=nearestOnPath(q,host.b.points);if(n.distance<=reach)landing.push(pin(q,n.at[1],`flush on ${host.b.id} (road L1)`,i));});}
  return landing;
}
/** road (L1): the step (eu) spurs are sampled at: fine enough that their flush run on the host road holds (a spur is ≤ 160 eu). */
const SPUR_STEP=2.5;
/** road (L1, ROAD.md §2.4): the Drive's grade limit (the profile's 12 % stays the limit of every other road). */
export const V01_GRADE=.10;
/** road (L1): control segments of a road laid straight because a straight structure owns them: V01 between the Bight Bridge's
 * manifest ends (structures.bightBridge.ends), so the road across the span follows the deck's axis (it drifted 7.2 eu off it). */
export function straightSegments(id:string,controls:readonly XY[]):Set<number> {
  const out=new Set<number>();if(id!=='V01')return out;
  const e=M.structures.bightBridge.ends,w=e.west as unknown as XY,x=e.east as unknown as XY;
  for(let i=0;i<controls.length-1;i++)if(distance(controls[i]!,w)<.01&&distance(controls[i+1]!,x)<.01)out.add(i);
  return out;
}
function roadAndWalks(cuts:LandCuts,base:HeightQuery):void {
  // v2.6 (D-M4): Mountain v2's own road is the mountain's road: a Horizon bed on v2's exact line, carried by the region
  // (it shapes no baked ground and draws nothing), so wheels, the Year Walk's lanes and the Crown walk can share it.
  cuts.beds.push(mountainV2Road(),mountainV2Promenade());
  for(const [id,row]of Object.entries(M.roads)){
    if(!('pts'in row))continue;
    // v2.6: roads.<id>.grade_max_pct (V03 at 10 %) and .levels (height pins); a road starting on a built road takes its height.
    // road (L1, ROAD.md §2.4): the Drive keeps ≤ 10 % (V01_GRADE); other roads their own maximum or the profile's 12 %.
    const r=row as unknown as {grade_max_pct?:number;levels?:{xy:number[];h:number;why:string}[]},limit=r.grade_max_pct?r.grade_max_pct/100:id==='V01'?V01_GRADE:.12;
    const controls=row.pts as unknown as XY[],start=cuts.beds.filter(b=>b.kind==='road'&&b.terrainCut).map(b=>nearestOnPath(controls[0]!,b.points)).sort((a,b)=>a.distance-b.distance)[0];
    const extra=[...(r.levels??[]).map(l=>pin(l.xy as unknown as XY,l.h,`level ${l.why.slice(0,40)}`)),...(id!=='V01'&&start&&start.distance<3&&!(routePins[id]??[]).some(p=>distance(p.xy,controls[0]!)<1)?[pin(controls[0]!,start.at[1],'junction on the built road')]:[])];
    // road (L1): a road on a straight structure is laid straight between its ends (V01 on the Bight Bridge's frame), and a road's
    // profile is faired into vertical curves (ROAD.md §2.4); a road ending on a built road also takes its height at the end.
    const straight=straightSegments(id,controls),end=cuts.beds.filter(b=>b.kind==='road'&&b.terrainCut).map(b=>nearestOnPath(controls.at(-1)!,b.points)).sort((a,b)=>a.distance-b.distance)[0];
    if(id!=='V01'&&end&&end.distance<3&&!(routePins[id]??[]).some(p=>distance(p.xy,controls.at(-1)!)<1))extra.push(pin(controls.at(-1)!,end.at[1],'junction on the built road (end)'));
    // road (L1): a road leaving a built road that carries Year Walk footway lanes holds the host's height across them (the spurs'
    // flush landing, W3-A): VBS dropped 0.86 under the VG west lanes it crosses at the Green Road junction.
    if(id!=='V01'&&start&&start.distance<3)extra.push(...footwayLanding(cuts,controls,5,row.profile==="road"?M.profiles.road.surface_m*requireScaleFactor():M.profiles.spur.surface_m*requireScaleFactor()));
    const b=bed(id,row.profile,gradeRoute(id,controls,base,limit,withSpanPins(id,controls,[...(routePins[id]??[]),...extra],straight),cuts.diagnostics,5,Math.min(limit,TYP.road),{straight,fair:true}));
    b.maxGrade=limit;if('structures'in row)b.structureIds=row.structures.filter(x=>!(id==='VG'&&x==='hollowBridge'));cuts.beds.push(b);
  }
  for(const [id,pts]of Object.entries(M.roads.spurs)){
    const name=`spur ${id}`,at=pts[0]! as unknown as XY,start=heightOnBeds(cuts,at,base,40),heights:Record<string,number>={upperStreet:18,library:48,glasshouse:34,studio:40,cottage:38,boathouse:4.6};// road (L1): boathouse 4 → 4.6: the spur leaves the Drive flush at 8.2 and could not fall to 4 within 12 % over its 36 eu (14.9 %); the Boathouse approach takes the 1.6 to the door at ≤ 8 %.
    // W3-A: where the host road carries Year Walk footway lanes (journey.yearWalk.shares), the spur
    // holds the host's height across them (a flush landing), then grades to its end: the Cottage
    // spur met the May/September lanes 0.6 eu below them at [972,692] (a lip the body cannot climb).
    const landing=footwayLanding(cuts,pts as unknown as XY[],SPUR_STEP,M.profiles.spur.surface_m*requireScaleFactor());
    // road (L1): spurs are faired roads too, sampled at SPUR_STEP; routePins['spur <id>'] adds authored heights.
    cuts.beds.push(bed(name,'spur',gradeRoute(name,pts as unknown as XY[],base,.12,[pin(at,start,'junction'),...landing,...(routePins[name]??[]),pin(pts[pts.length-1]! as unknown as XY,heights[id]!,'spur end')],cuts.diagnostics,SPUR_STEP,TYP.road,{fair:true})));
  }
  for(const [id,row]of Object.entries(M.skate)){
    if(!('pts'in row))continue;
    const v2=(row as unknown as {mountainV2?:{upperPts:number}}).mountainV2;
    if(id==='S1'&&v2){cuts.beds.push(s1OnMountain(cuts,base,row as unknown as SkateRow,v2.upperPts));continue;}
    const pts=[...row.pts] as unknown as XY[];
    // v2.0 D-A1: S2's Bight stretch follows its authored profile, never another route's deck height (spanLanePins).
    const skatePins=[...withSpanPins(id,pts,routePins[id]),...flushPins(id,cuts,pts),...atGradePins(id,pts,cuts),...(id==='S2'?s2Profile(pts).pins:spanLanePins(id,pts,cuts)),...parkPins(pts)];
    // road (L1): where the line runs on a road's carriageway at grade (S3 along the Drive off the Quay Bridge's south end) it takes
    // the road's height across the road's paved width and its own (roadLanePins): no step between the lane and the carriageway.
    const b=bed(id,'skateMain',gradeRoute(id,pts,base,.18,[...skatePins,...roadLanePins(id,pts,cuts,skatePins,base)],cuts.diagnostics,5,TYP.skate));
    b.surfaceSegments=row.segments.map((segment,i)=>({from:i/row.segments.length,to:(i+1)/row.segments.length,surface:segment.surface,pace:segment.pace,bankDegrees:segment.surface==='bankedTurf'?18:0}));cuts.beds.push(b);
  }
  for(const [id,row]of Object.entries(M.walks)){
    const name=`walk ${id}`;
    // v1.9 walks.<id>.footwayOf (D-2): the walk is a footway of a host bed — its plan at offset_m from the host
    // centreline on the side of side_xy, the host's height at every point, no wall between (BedCut.sharedEdges).
    const fw=(row as unknown as {footwayOf?:{host:string;offset_m:number;side_xy?:number[];side?:'left'|'right';from_s?:number;to_s?:number}}).footwayOf,fwHost=fw?cuts.beds.find(b=>b.id===fw.host):undefined;
    // v2.6: a footway of Mountain v2's road (walks.crown) takes its stretch [from_s, to_s] on one side of the uphill direction;
    // like its host it is carried by the region.
    if(fw&&fwHost&&fw.host===MOUNTAIN_V2_ROAD_ID){
      const pts=mountainV2RoadFootway(fw.offset_m,fw.side??'left',fw.from_s,fw.to_s),b=bed(name,row.profile,pts,true);
      (b.sharedEdges??=[]).push({other:fwHost.id,at:pts.map(plan)});regionCarry(b);cuts.beds.push(b);continue;
    }
    if(fw&&fwHost&&fw.side_xy){
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
    // road (L1): a walk registered as a flush threshold with a road (D-A7: #34 the pier walk comes down to the Drive) takes the
    // road's height at the row and across its footway lanes (flushPins), so the junction solve never lifts the road to the walk.
    const pins=withSpanPins(name,points,[...(routePins[name]??[]),...levels,...(id==='square'?squareWalkPins(sampleSpline(points)):[]),...flushPins(name,cuts,points,true)]);
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
  // v2.6: s1Crossing null = the walk does not cross S1 on the Horizon (it walks v2's road beside the course).
  const s1=cuts.beds.find(b=>b.id==='S1'),s1Row=(Y as unknown as {s1Crossing?:XY|null}).s1Crossing,s1Cross:XY=s1Row===null?[NaN,NaN]:s1Row??[1255,862];
  if(s1&&s1Row!==null&&nearestOnPath(s1Cross,s1.points).distance<6)pins.push(pin(s1Cross,nearestOnPath(s1Cross,s1.points).at[1],'S1 at-grade crossing'));
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
  // road (L1): the walk crosses a road (V01, VG, V03, a spur) at the road's own height: the walk comes to the road, never the
  // road to the walk (the junction solve lowered the Drive 2.4 eu to the walk at the harbour, [1512.6,1026]).
  const roadBeds=cuts.beds.filter(b=>b.terrainCut&&b.kind==='road'&&!b.id.startsWith('structure.'));
  const gradeRoutes:{id:string;points:XYZ[]}[]=[...footRoutes,...cuts.beds.filter(b=>b.terrainCut&&b.kind==='skate'),...reserveServiceLines(cuts),...roadBeds];
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
  // road (L1): across a road crossing every walk sample whose bed reaches the road's paved area (paved half + the walk's half
  // width) within 15 eu of the crossing is flush with the road at its nearest point: the walk's deck never stands proud of,
  // or sinks under, the carriageway it crosses.
  {const arcsPre=[0];for(let i=1;i<pre.length;i++)arcsPre.push(arcsPre[i-1]!+distance(plan(pre[i-1]!),plan(pre[i]!)));
    const crossings:{road:BedCut;along:number}[]=[];
    for(let i=1;i<pre.length;i++){if(shareOf(i)||shareOf(i-1))continue;const a=plan(pre[i-1]!),c=plan(pre[i]!);
      for(const r of roadBeds)for(let k=1;k<r.points.length;k++){const hit=segmentCross(a,c,plan(r.points[k-1]!),plan(r.points[k]!));if(!hit)continue;
        const hb=mix(r.points[k-1]![1],r.points[k]![1],hit[1]),hy=mix(pre[i-1]![1],pre[i]![1],hit[0]);if(Math.abs(hb-hy)<3)crossings.push({road:r,along:mix(arcsPre[i-1]!,arcsPre[i]!,hit[0])});}}
    for(const {road,along} of crossings){const reach=road.width/2+road.shoulder+b_width/2+1.2;
      pre.forEach((q,j)=>{if(shareOf(j)||Math.abs(arcsPre[j]!-along)>15)return;const n=nearestOnPath(plan(q),road.points);if(n.distance>reach)return;
        const k=pins.findIndex(p=>p.index===j);const p=pin(plan(q),n.at[1],`flush across ${road.id} (road L1)`,j);if(k>=0)pins[k]=p;else pins.push(p);pinned.add(j);});}}
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
  // v2.6: an unshared stretch on Mountain v2's land (the January station's step onto the Hearth terrace) is the region's ground.
  regionCarryLand(b);
  // Stretches are listed on the final (host-copied) heights, not the pre-copy solve.
  cuts.diagnostics.push(...solveDiagnostics.filter(d=>!d.id.startsWith('gradeStretch.')));listSteepStretches('yearWalk',points,cuts.diagnostics,limit,.08,onMountainV2Road);
  joinCrownWalk(cuts,b);
  for(const s of M.journey.stations){const n=nearestOnPath(s.xy as unknown as XY,b.points);const p=addFlatPad(cuts,`station.${s.id}`,'station',s.xy as unknown as XY,n.at[1]!,M.journey.station.pad_m as unknown as XY,stationRotation(s));p.serviceBedId='yearWalk';p.margin=2;
    // v2.6 (D-M5): a station on Mountain v2's land (January, the Hearth terrace) is carried: v2's terrace is its floor, no earth.
    if(mountainV2Rule(...(s.xy as unknown as XY)).kind==='land'){p.deck=true;p.blend=0;}}
  return shares;
}
/** v2.0 D-C7: the Crown walk leaves the Year Walk's January lane at walks.crown.joinsYearWalk. Its bed starts on the lane's
 * centreline at the lane's own height (a flush junction the path graph joins), and its first metres ease from that height
 * back to its solved line at the walk grade. */
function joinCrownWalk(cuts:LandCuts,walk:BedCut):void {
  const crown=cuts.beds.find(b=>b.id==='walk crown');if(!crown||crown.carried?.length)return; // v2.6: a v2-road footway joins by its host
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
      // v2.6: on a region-carried host (Mountain v2's road) the lane's whole reach is excluded (regionCarryRadius), not its section.
      if(carried){run.push(p);(walk.terrainExclusions??=[]).push({at:p,radius:host.id===MOUNTAIN_V2_ROAD_ID?regionCarryRadius(walk):walk.width/2+walk.shoulder+1,openSpan:(host.terrainExclusions??[]).some(e=>e.openSpan&&distance(plan(h.at),e.at)<e.radius)});}else flush();
    }
    flush();
    // v2.6 (D-M4): a lane in a v2.6 manifest road tunnel (the Mountain Road Tunnel on V03) keeps the tunnel's natural cover
    // exactly as its host does: the tunnel's own cover circle, not the lane's 4.8 eu section circle (the lane's 15 eu blend
    // otherwise cut a trench to the lane's grade down the hill over the tube, 98 → 52 eu on the road's axis).
    for(const [id,route]of roadTunnels().slice(2)){if(route!==host.id)continue;
      const e=(host.terrainExclusions??[]).find(e=>!e.openSpan&&distance(e.at,(M.structures as unknown as Record<string,{xy:number[]}>)[id]!.xy as unknown as XY)<1e-6);
      if(e&&stretch.some(p=>distance(p,e.at)<e.radius)&&!(walk.terrainExclusions??[]).some(w=>w.radius===e.radius&&distance(w.at,e.at)<1e-6))(walk.terrainExclusions??=[]).push({at:e.at,radius:e.radius});}
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
  // v2.6 (D-M6): G1 is Mountain v2's gondola: its tower tops are v2's authored tops (cable.G1.authoredTowers), the rope meets each
  // station hang_eu over its platform and sags sag_pct; the Horizon never re-solves them (the tower solve below is the v2.5 path).
  const g=M.cable.G1 as unknown as {from:number[];to:number[];fromH:number;toH:number;towers:number[][];authoredTowers?:number[];hang_eu?:number;sag_pct?:number;drawnBy?:string},clear=M.profiles.cable.clear_eu??8,authored=g.authoredTowers?.length===g.towers.length,hang=authored?g.hang_eu??0:0,SAG=authored?(g.sag_pct??1)/100:.01;
  // The bed is the cabin floor's path (a station's platform, a tower's rope top less the hang), as in v2.5 (fromH/toH = the decks).
  const controls:XYZ[]=[[g.from[0]!,g.fromH,g.from[1]!],...g.towers.map((p,i)=>[p[0]!,authored?g.authoredTowers![i]!-hang:base(...p as unknown as XY)+clear,p[1]!] as unknown as XYZ),[g.to[0]!,g.toH,g.to[1]!]];
  const floor=controls.map(p=>p[1]);
  const constraints:{i:number;t:number;required:number;at:XY}[]=[];
  for(let i=1;i<controls.length;i++){
    const a=controls[i-1]!,b=controls[i]!,span=distance(plan(a),plan(b));
    for(let k=1;k<64;k++){
      const t=k/64,x=mix(a[0],b[0],t),z=mix(a[2],b[2],t),at:XY=[x,z];
      // Loading platforms are an intentional cable-to-feet boundary (the station throat), not an overhead crossing.
      const throat=(g as {throat_m?:number}).throat_m??G1_THROAT_M;if(distance(at,plan(controls[0]!))<throat||distance(at,plan(controls.at(-1)!))<throat)continue;
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
  if(!authored)for(let pass=0;pass<64;pass++){let moved=0;for(let j=1;j<last;j++){const h=need(j);if(h>controls[j]![1]+1e-6){controls[j]=[controls[j]![0],h,controls[j]![2]];moved++;}}if(!moved)break;}
  if(!authored)for(let pass=0;pass<32;pass++){let moved=0;for(const j of Array.from({length:last-1},(_,k)=>k+1).sort((a,b)=>controls[b]![1]-controls[a]![1])){const h=need(j);if(h<controls[j]![1]-1e-6){controls[j]=[controls[j]![0],h,controls[j]![2]];moved++;}}if(!moved)break;}
  // Three towers (the authored line): search the middle top; the outer two then take their own minimum (each bears on a
  // fixed station). Keep the set with the shortest tallest tower above its ground, then the least total.
  if(last===4&&!authored){
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
    if(authored)cuts.diagnostics.push({id:`cable.G1.tower.${i+1}`,severity:'info',message:`G1 tower ${i+1} rope top ${(p[1]+hang).toFixed(1)} eu authored by Mountain v2 (cabin path ${p[1].toFixed(1)}; ground ${base(p[0],p[2]).toFixed(1)}, ${(p[1]+hang-base(p[0],p[2])).toFixed(1)} tall; D-M6)`,at:plan(p),measured:p[1],required:ceiling});
    else cuts.diagnostics.push({id:`cable.G1.tower.${i+1}`,severity:'info',message:`G1 tower ${i+1} top solved to ${p[1].toFixed(1)} eu (ground ${base(p[0],p[2]).toFixed(1)}, ${(p[1]-base(p[0],p[2])).toFixed(1)} tall; lowest top keeping ${clear} eu over the ground at 1 % sag)`,at:plan(p),measured:p[1],required:ceiling});
  });
  // v2.6: an authored (v2) line is measured, never moved: a span under clearance is reported (v2 owns its line; a conflict keeps it visible).
  for(const q of constraints){const actual=mix(controls[q.i-1]![1],controls[q.i]![1],q.t),required=q.required;
    if(actual<required-.01)cuts.diagnostics.push({id:`cable.G1.clear.${q.i}.${q.t}`,severity:'conflict',message:authored?`Mountain v2's gondola rope (authored towers, ${(SAG*100).toFixed(1)} % sag) passes ${(actual-required+clear).toFixed(1)} eu over the baked ground or a bed here (${clear} required)`:'Fixed gondola endpoint cannot meet terrain clearance',at:q.at,measured:actual,required});}
  const gondola:XYZ[]=[];
  for(let i=1;i<controls.length;i++){const a=controls[i-1]!,b=controls[i]!,len=distance(plan(a),plan(b));for(let k=0;k<32;k++){const t=k/32;gondola.push([mix(a[0]!,b[0]!,t),mix(a[1]!,b[1]!,t)-len*SAG*4*t*(1-t),mix(a[2]!,b[2]!,t)]);}}gondola.push(controls[controls.length-1]!);
  cuts.beds.push(bed('G1','cable',gondola,false));// Integrator 3 (W5-S request 3): each tower is structures' cableTower - four legs on footings, head frame, bracing.
  // v2.6 (D-M6): the region draws v2's towers, ropes and terminals (cable.G1.drawnBy): the Horizon keeps the line, not the solids.
  const drawnHere=g.drawnBy!=='mountainV2';
  // The region draws v2's towers; the Horizon records each tower's footing (a flush concrete block under v2's legs, bedIds G1) so
  // the rope's crossings over Horizon routes are proven against a load path, and keeps the rope itself (coincident with v2's).
  if(!drawnHere){const footings=solid('G1.towers.footings','footing','stone','support',['G1'],'crown');controls.slice(1,-1).forEach(p=>{const xy=plan(p),g0=base(...xy);box(footings,xy,g0+.1,[3.2,3.2],g0-1.2);});cuts.solids.push(footings);}
  if(drawnHere){const towers=solid('G1.towers','tower','stone','support',['G1'],'prow'),bracing=solid('G1.towers.bracing','beam','metal','support',['G1'],'prow');controls.slice(1,-1).forEach(p=>cableTower(towers,bracing,plan(p),p[1]!,base));cuts.solids.push(towers);if(bracing.indices.length)cuts.solids.push(bracing);}
  const z=M.cable.ZIP,len=distance(z.from as unknown as XY,z.to as unknown as XY),zip=Array.from({length:129},(_,k)=>{const t=k/128;return [mix(z.from[0]!,z.to[0]!,t),mix(z.fromH,z.toH,t)-len*z.sag_pct/100*4*t*(1-t),mix(z.from[1]!,z.to[1]!,t)] as unknown as XYZ;});cuts.beds.push(bed('ZIP','cable',zip,false));
  // v2.0 D-A2: the register row decides the order (ZIP under G1); the separation is signed by that order.
  const zipRow=M.crossings.find(r=>r.a==='ZIP'&&r.b==='G1'),under=zipRow?.resolution==='under',at0=(zipRow?.at??[1442,921]) as unknown as XY;
  // The measured crossing is where the two plans meet: the nearest pair of samples. v2.6: Mountain v2's G1 no longer meets the zip
  // (its row is retired, MANIFEST retired_v2_6.crossings); the closest plan approach is reported instead.
  if(zipRow){let cross=at0,best=Infinity;for(const p of zip){const n=nearestOnPath(plan(p),gondola);if(n.distance<best&&distance(plan(p),at0)<40){best=n.distance;cross=plan(p);}}
    const sep=(nearestOnPath(cross,zip).at[1]!-nearestOnPath(cross,gondola).at[1]!)*(under?-1:1);
    cuts.diagnostics.push({id:'cable.ZIP.G1',severity:sep<clear?'conflict':'info',message:`Measured ZIP ${under?'under':'over'} G1 separation at the crossing (register order)`,at:cross,measured:sep,required:clear});}
  else{let best=Infinity,at:XY=plan(zip[0]!);for(const p of zip){const n=nearestOnPath(plan(p),gondola);if(n.distance<best){best=n.distance;at=plan(p);}}
    cuts.diagnostics.push({id:'cable.ZIP.G1',severity:'info',message:`ZIP and G1 do not cross in plan (v2.6, D-M6); closest approach ${best.toFixed(1)} eu`,at,measured:best,required:0});}
  // The rope meets each station at its bullwheel, above head height: within 16 eu of a
  // platform the cable solid never drops below platform + body clearance, so it is not a
  // tripwire across the platform or the base walk (A3-02). The bed keeps the true line.
  const CABLE_HEAD=2.6;
  const lifted=(points:readonly XYZ[]):XYZ[]=>{const ends=[points[0]!,points.at(-1)!];return points.map(p=>{let y=p[1];for(const e of ends){const d=distance(plan(p),plan(e));if(d<16)y=Math.max(y,e[1]+CABLE_HEAD);}return [p[0],y,p[2]] as XYZ;});};
  // v2.6: Mountain v2's rope is the cabin path + hang_eu everywhere (its stations' bullwheels stand over the platforms).
  for(const [id,points]of [['G1',gondola],['ZIP',zip]]as [string,XYZ[]][]){const line=id==='G1'&&authored?points.map(p=>[p[0],p[1]+hang,p[2]] as XYZ):lifted(points),geometry=solid(`${id}.cable`,'cable','metal','rail',[id],'prow');for(let i=1;i<line.length;i++)slab(geometry,line[i-1]!,line[i]!,.09,.09);cuts.solids.push(geometry);}
  let roofMin=Infinity,terrainMin=Infinity;for(const p of zip){terrainMin=Math.min(terrainMin,p[1]!-base(p[0]!,p[2]!));for(const h of M.hosts)if(Math.abs(p[0]!-h.xy[0]!)<=h.footprint_m[0]!/2&&Math.abs(p[2]!-h.xy[1]!)<=h.footprint_m[1]!/2)roofMin=Math.min(roofMin,p[1]!-h.h-h.roofH_eu);}
  if(roofMin<12)cuts.diagnostics.push({id:'cable.ZIP.roofs',severity:'conflict',message:'Fixed sagged zip line fails a host roof clearance',measured:roofMin,required:12});
  if(terrainMin<8)cuts.diagnostics.push({id:'cable.ZIP.terrain',severity:'conflict',message:'Fixed zip line fails terrain clearance; endpoints were not moved',measured:terrainMin,required:8});
}
function thresholds(cuts:LandCuts,base:HeightQuery):XY[] {
  const positions:XY[]=[];
  // v1.9: a threshold on a jetty stands at that jetty's deck (docks now sit 0.6 over the water they reach).
  const jettyTop=(p:XY)=>{for(const s of cuts.solids){if(!s.id.startsWith('jetty.')||s.role!=='deck')continue;let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,y1=-Infinity;const q=s.positions;for(let i=0;i<q.length;i+=3){x0=Math.min(x0,q[i]!);x1=Math.max(x1,q[i]!);y1=Math.max(y1,q[i+1]!);z0=Math.min(z0,q[i+2]!);z1=Math.max(z1,q[i+2]!);}if(p[0]>=x0-.5&&p[0]<=x1+.5&&p[1]>=z0-.5&&p[1]<=z1+.5)return y1;}return undefined;};
  const make=(id:string,p:XY,h0?:number)=>{
    // road (L1): an unauthored threshold on a road's carriageway takes the road's height (the V01 × Reach walk register pad took
    // the walk's 5.7 under the Drive's 9.2, and its blend dug a 3.5 eu pit under the Drive's edge).
    const onRoad=h0===undefined?cuts.beds.filter(b=>b.kind==='road'&&b.terrainCut&&!b.id.startsWith('structure.')).map(b=>({b,n:nearestOnPath(p,b.points)})).filter(r=>r.n.distance<=r.b.width/2+r.b.shoulder).sort((a,c)=>a.n.distance-c.n.distance)[0]:undefined;
    const h=id==='threshold.southPortal'?oreStationFloor(cuts,p[0],p[1],h0!):h0===undefined?onRoad?.n.at[1]:jettyTop(p)??h0,height=h??heightOnBeds(cuts,p,base,40),underground=['threshold.deepJetty','threshold.stepsFoot'].includes(id),ground=base(...p);
    // A threshold above its ground or over water is a raised deck (tower top, gallery, jetty):
    // it never shapes the heightfield; its supports belong to the structure that carries it.
    // v2.6: on Mountain v2's land a threshold stands on the region's platform or paving (the Summit Commons platform, the
    // summit start gate, the South Portal on v2's road): a deck, never earth (a pad's fill raised v2's summit edge by 3).
    const deck=!underground&&(height-ground>BODY_HEIGHT||ground<M.seaLevel||mountainV2Rule(...p).kind==='land');
    const pad=addFlatPad(cuts,id,'threshold',p,height,[6,5],0,underground);if(deck){pad.deck=true;pad.blend=0;
      // On a structure's own deck at this height (Crown launch, cable platforms, lamp gallery, jetties) the deck is the
      // floor: no second pad slab floats beside it (structures.padFloating). The pad stays as the threshold's footprint.
      const onDeck=cuts.solids.some(s=>(s.role==='deck'||s.role==='floor')&&s.id!==`${id}.slab`&&(()=>{let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,y1=-Infinity;const q=s.positions;for(let i=0;i<q.length;i+=3){x0=Math.min(x0,q[i]!);x1=Math.max(x1,q[i]!);y1=Math.max(y1,q[i+1]!);z0=Math.min(z0,q[i+2]!);z1=Math.max(z1,q[i+2]!);}return p[0]>=x0&&p[0]<=x1&&p[1]>=z0&&p[1]<=z1&&Math.abs(y1-height)<.5;})());
      // v2.6 (R5-02): a cable platform on Mountain v2's land stands on the region's own station platform (v2 art and
      // surfaces, not a Horizon solid): the pad keeps its footprint for the offer, the slab is the region's (no floating slab).
      const regionPlatform=!onDeck&&mountainV2Rule(...p).kind==='land'&&(id.startsWith('threshold.funicular.')||id==='threshold.gondolaTop'||id==='threshold.gondolaBase');
      if(onDeck||regionPlatform||id==='threshold.southPortal')cuts.solids=cuts.solids.filter(s=>s.id!==`${id}.slab`);}
    // road (L1): a threshold on a road's carriageway at the road's height (a dismount mark on the Green Road, the Bight spur) has
    // the road as its floor: no flat slab laid over the graded road (a 6 × 5 slab stood 0.2 proud of VG and VBS at one end).
    if(cuts.beds.some(b=>b.kind==='road'&&b.terrainCut&&!b.id.startsWith('structure.')&&(()=>{const n=nearestOnPath(p,b.points);return n.distance<b.width/2+b.shoulder&&Math.abs(n.at[1]-height)<.5;})())){cuts.solids=cuts.solids.filter(s=>s.id!==`${id}.slab`);pad.deck=true;pad.blend=0;}
    // Integrator 4 (W7-S request 5): a manifest threshold that takes its bed's height (no authored height: skateLineStarts on
    // S1/S4) stands on that bed's own graded cut, which the bed makes anyway — built ground, not a pit. Authored heights and
    // register pads are still checked.
    if(!underground&&!deck&&(h0!==undefined||!id.startsWith('threshold.'))&&ground-height>BODY_HEIGHT)cuts.diagnostics.push({id:`${id}.pit`,severity:'conflict',message:`${id} is authored ${(ground-height).toFixed(1)} eu below its ground; the pad would dig a pit`,at:p,measured:height,required:ground});
    positions.push(p);const marker=solid(`${id}.marker`,'threshold','stone','marker',[],districtAt(...p));box(marker,p,height+.025,[2,.6],height-.05);cuts.solids.push(marker);pad.margin=1;};
  for(const row of M.thresholds){
    if(typeof row.xy==='string'){Object.entries(M.water_routes.FERRY.piers).forEach(([id,p])=>make(`threshold.${row.id}.${id}`,p as unknown as XY,1));continue;}
    if(Array.isArray(row.xy[0]!))(row.xy as number[][]).forEach((p,i)=>make(`threshold.${row.id}.${i+1}`,p as unknown as XY));
    else {const exact:Record<string,number>={gondolaBase:M.cable.G1.fromH,gondolaTop:M.cable.G1.toH,adit:40,southPortal:M.underground.doors.southPortal.h,prowPlatform:M.sky.launches.prow.h,crownLaunch:M.sky.launches.crown.h,zipLanding:12,lampGallery:M.sky.launches.lampGallery.h,deepJetty:40.6,seaDoorJetty:1,lampDock:1,bightShoreJetty:1,floatDock:1.2,boathouseDock:1,landingQuay:M.structures.landingQuay.finish_h,stepsFoot:4};
      // v2.6 (R5-02): a threshold row may carry its own authored height `h` (the funicular platforms on Mountain v2's viaduct).
      const authored=(row as {h?:number}).h;make(`threshold.${row.id}`,row.xy as unknown as XY,exact[row.id]??(typeof authored==='number'?authored:undefined));}
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
  const lakes=['stillwater'].map(id=>M.water[id as 'stillwater']); // v2.6: the Cup is retired (MANIFEST retired_v2_6)
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
/** Road tunnels: the Prow gallery and the dune culvert (v2.0), and every MANIFEST structures.<id> of kind tunnel with a
 * `route` (v2.6: the Mountain Road Tunnel on V03). The Shoulder Tunnel on Crown Road is retired (D-M4). */
export function roadTunnels():[string,string,number][] {
  const S=M.structures as unknown as Record<string,{kind?:string;route?:string;length_m?:number}>;
  return [['prowTunnel','V01',90],['duneCulvert','S4',32],...Object.entries(S).filter(([,t])=>t&&typeof t==='object'&&t.kind==='tunnel'&&t.route).map(([id,t]):[string,string,number]=>[id,t.route!,t.length_m??60])];
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
  // v2.6 (D-M4): the Shoulder Tunnel is retired with Crown Road; MANIFEST tunnels with a `route` (the Mountain Road Tunnel on
  // V03) keep their natural cover the same way.
  for(const [id,route,length]of roadTunnels()){const b=cuts.beds.find(b=>b.id===route);if(!b)continue;
    if((M.structures as unknown as Record<string,{kind?:string}>)[id]?.kind==='gallery')continue;
    const at=id==='duneCulvert'?duneCulvertCentre(cuts,b):(M.structures as unknown as Record<string,{xy:number[]}>)[id]!.xy as unknown as XY,e:{at:XY;radius:number;terrainAt?:XY;terrainRadius?:number}={at,radius:length/2+2};
    (b.terrainExclusions??=[]).push(e);}
  // road (L1): the Drive crosses the dune culvert on an embankment (the culvert runs through it; its tube is the passage): the
  // 12 eu exclusion that stood here left the Drive 2–3.5 eu over the dunes for 24 m with nothing under its edges.
  settleYearWalkShares(cuts,shares);{const s2=cuts.beds.find(b=>b.id==='S2');if(s2)carryS2(cuts,baseHeight,s2);}carryNamedStructures(cuts);carrySpanLanes(cuts);carryRoadLanes(cuts);carryStructureStretches(cuts);guardWater(cuts,baseHeight);checkRailGrades(cuts);
  buildStillwaterLink(cuts,baseHeight);
  cables(cuts,baseHeight);const markers=thresholds(cuts,baseHeight);
  fitMountainHorizonJoins(cuts,baseHeight);
  for(const b of cuts.beds)if(!b.id.startsWith('structure.')&&!b.id.startsWith('underground.')&&!['ORE','DEEP_RUN','ORE.siding','prowTunnel','duneCulvert'].includes(b.id))emitBedGeometry(b,cuts,baseHeight,markers);
  // Publish the existing native town lane as road metadata. The region's S1 mesh remains
  // its sole floor: this bed cuts no terrain and emits no replacement geometry.
  const chain=mountainRoadChain(cuts.beds);
  if(chain){const part=chain.parts[1]!,points=chain.points.filter((_,i)=>chain.widths[i]!.s>=part.from-1e-6&&chain.widths[i]!.s<=part.to+1e-6);
    const lane=bed(part.id,'road',points,false);lane.width=7;lane.shoulder=0;regionCarry(lane);cuts.beds.push(lane);}
  return cuts;
}
