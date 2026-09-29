import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildLandCuts, stationBedPositions, yearWalkStretches } from '../src/harbour/horizon/land/beds/build';
import { gradeRoute } from '../src/harbour/horizon/land/beds/solver';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { maxGrade } from '../src/harbour/horizon/land/structures/mesh';
import type { LandDiagnostic, XY } from '../src/harbour/horizon/land/interfaces';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { distance, nearestOnPath, plan } from '../src/harbour/horizon/land/structures/mesh';
import { planDistance } from '../src/harbour/horizon/land/beds/profiles';
import { onMountainV2Road } from '../src/harbour/horizon/land/mountainV2/beds';
/** v2.6 (D-M4/D-M5): a bed's grade off its region-carried stretches (on Mountain v2's land the region owns v2's own grades). */
const ownGrade=(b:{points:readonly (readonly [number,number,number])[];carried?:readonly (readonly (readonly [number,number])[])[]})=>b.points.slice(1).reduce((m,p,i)=>{const q=b.points[i]!,mid:XY=[(p[0]+q[0])/2,(p[2]+q[2])/2];if(b.carried?.some(line=>planDistance(mid,line)<1))return m;return Math.max(m,Math.abs(p[1]-q[1])/(distance(plan(p),plan(q))||1));},0);

describe('Horizon cut profiles',()=>{
  it('limits continuous samples, including a short steep input, without losing pinned endpoints',()=>{
    const diagnostics:LandDiagnostic[]=[],route=gradeRoute('test',[[0,0],[40,12],[100,0]],x=>x<50?40:0,.12,[{xy:[0,0],height:0,reason:'start'},{xy:[100,0],height:10,reason:'finish'}],diagnostics);
    expect(maxGrade(route)).toBeLessThanOrEqual(.12001);expect(route[0]![1]).toBe(0);expect(route.at(-1)![1]).toBe(10);
    const impossible:LandDiagnostic[]=[];gradeRoute('impossible',[[0,0],[10,0]],()=>0,.12,[{xy:[0,0],height:0,reason:'start'},{xy:[10,0],height:10,reason:'finish'}],impossible);
    expect(impossible.some(d=>d.severity==='conflict'&&d.required!>d.measured!)).toBe(true);
  });
  it('builds all source beds, exact widths, surface segments, station slots and year stretches',()=>{
    const cuts=buildLandCuts(baseHeight);
    // v2.6 (D-M4): Crown Road (V02) is retired; the Mountain Road (V03) is the new road.
    for(const id of ['V01','VG','V03'])expect(cuts.beds.find(b=>b.id===id)?.width).toBe(8);
    for(const id of ['S1','S2','S3','S4']){const b=cuts.beds.find(b=>b.id===id)!;expect(b.width).toBe(4);expect(b.surfaceSegments!.every(s=>s.bankDegrees<=30)).toBe(true);}
    expect(cuts.beds.find(b=>b.id==='yearWalk')!.width).toBeGreaterThanOrEqual(3.2+2);
    const stations=stationBedPositions(cuts);expect(stations).toHaveLength(12);expect(stations.every(s=>s.positions.length===20)).toBe(true);expect(yearWalkStretches(cuts).every(s=>s.length>31*1.6)).toBe(true);
    expect(cuts.beds.find(b=>b.id==='V01')!.terrainExclusions!.length).toBeGreaterThan(1);
    for(const b of cuts.beds.filter(b=>['road','walk','trail','skate','boardwalk'].includes(b.kind)&&b.id!=='yearWalk'))expect(ownGrade(b),b.id).toBeLessThanOrEqual(b.maxGrade+.00001);
    expect(maxGrade(cuts.beds.find(b=>b.id==='V03')!.points),'V03 at <= 10 % (D-M4)').toBeLessThanOrEqual(.10+1e-6);
    expect(cuts.solids.every(s=>s.positions.every(Number.isFinite))).toBe(true);
    console.info(JSON.stringify({beds:cuts.beds.length,pads:cuts.pads.length,solids:cuts.solids.length,triangles:cuts.solids.reduce((s,g)=>s+g.indices.length/3,0),grades:cuts.beds.filter(b=>Number.isFinite(b.maxGrade)&&b.kind!=='stair').map(b=>({id:b.id,max:maxGrade(b.points),limit:b.maxGrade})),conflicts:cuts.diagnostics.filter(d=>d.severity==='conflict')},null,2));
  },60000);
  it('lays the Year Walk verbatim from the v1.7 manifest, as a footway of its hosts, never on water',()=>{
    const cuts=buildLandCuts(baseHeight),walk=cuts.beds.find(b=>b.id==='yearWalk')!,Y=M.journey.yearWalk,limit=M.profiles.walk.grade_max_pct/100;
    // Verbatim: every manifest control point lies on the solved centreline; no inserted controls.
    for(const p of Y.pts)expect(nearestOnPath(p as unknown as XY,walk.points).distance).toBeLessThan(.01);
    // v1.6 laid 14.2 km through its inserted controls; the v1.7 polyline is 11.5 km; v2.6 (D-M5) walks January and February on
    // Mountain v2's road and the Foot instead of the Shoulder's switchbacks: 10.5 km.
    const length=walk.points.slice(1).reduce((n,p,i)=>n+distance(plan(walk.points[i]!),plan(p)),0);expect(length).toBeGreaterThan(10000);expect(length).toBeLessThan(12000);
    // Shares: the footway samples carry the host height exactly (copied, not re-graded).
    let shared=0;
    for(const row of Y.shares){
      const host=cuts.beds.find(b=>b.id===row.host)!,from=nearestOnPath(row.from as unknown as XY,walk.points).along,to=nearestOnPath(row.to as unknown as XY,walk.points).along;
      let along=0;walk.points.forEach((p,i)=>{if(i)along+=distance(plan(walk.points[i-1]!),plan(p));if(along>from+6&&along<to-6&&Math.abs(nearestOnPath(plan(p),host.points).distance-row.offset_m)<1.5){shared++;expect(Math.abs(nearestOnPath(plan(p),host.points).at[1]-p[1]),`${row.stretch} ${row.host}`).toBeLessThan(.01);}});
    }
    // Road main (L1): the Bight Bridge stretch now follows the bridge's straight frame, so ~30 samples there sit further than
    // 1.5 eu off their manifest offset from the Drive (they are carried on the deck, not copied beside it).
    expect(shared).toBeGreaterThan(750);
    // Only a copied host stretch may exceed the walk limit (a lane on the inside of a 12 % road bend), and each is listed.
    walk.points.slice(1).forEach((p,i)=>{const a=walk.points[i]!,g=Math.abs(p[1]-a[1])/(distance(plan(a),plan(p))||1);if(g<=limit+1e-4)return;
      const copied=['V01','V03','VG','walk lakerim','mountainV2.road'].some(id=>{const n=nearestOnPath(plan(a),cuts.beds.find(b=>b.id===id)!.points);return n.distance<12&&Math.abs(n.at[1]-a[1])<.01;});
      const listed=cuts.diagnostics.some(d=>d.id.startsWith('gradeStretch.yearWalk')&&d.severity==='conflict');
      expect(copied||listed,`${a[0].toFixed(1)},${a[2].toFixed(1)} at ${(g*100).toFixed(1)} %`).toBe(true);});
    // Walls: no kerb, parapet or retaining wall between a host and its footway.
    expect(walk.sharedEdges!.length).toBeGreaterThanOrEqual(9);for(const id of ['V01','V03','VG'])expect(cuts.beds.find(b=>b.id===id)!.sharedEdges?.length,id).toBeGreaterThan(0);
    // Water: no Year Walk sample over the sea or Stillwater carries a terrain override.
    const wet=walk.points.filter(p=>baseHeight(p[0],p[2])<M.seaLevel&&!walk.carried?.some(line=>planDistance(plan(p),line)<1));
    expect(wet.every(p=>walk.terrainExclusions!.some(e=>distance(plan(p),e.at)<e.radius))).toBe(true);
    const lake=M.water.stillwater;expect(walk.points.filter(p=>((p[0]-lake.cx)/lake.rx)**2+((p[2]-lake.cy)/lake.ry)**2<.9&&p[1]<lake.surface).length).toBe(0);
    // Stations sit at the walk height at their point.
    for(const s of M.journey.stations){const pad=cuts.pads.find(p=>p.id===`station.${s.id}`)!;expect(Math.abs(pad.centre[1]-nearestOnPath(s.xy as unknown as XY,walk.points).at[1])).toBeLessThan(.01);}
    // The Crown launch is the manifest's raised deck (h 170), never a terrain pad above the summit.
    const crown=cuts.pads.find(p=>p.id==='threshold.crownLaunch')!;expect(crown.centre[1]).toBe(M.sky.launches.crown.h);expect(crown.deck).toBe(true);
    for(const p of cuts.pads.filter(p=>!p.deck&&!p.underground))expect(p.centre[1],p.id).toBeLessThanOrEqual(158);
    // The gondola tower solver reports instead of clamping at the sky ceiling.
    const towers=cuts.diagnostics.filter(d=>/^cable\.G1\.tower\.\d\.ceiling$/.test(d.id));
    for(const d of towers)expect(d.measured!).toBeGreaterThan(M.sky.ceiling_m);
    const cable=cuts.beds.find(b=>b.id==='G1')!;if(!towers.length)expect(Math.max(...cable.points.map(p=>p[1]))).toBeLessThanOrEqual(M.sky.ceiling_m);
  },60000);
});

// v1.9 (Stage A, W3-A): the numbers the door walks, the journeys and P08/P12/P31 depend on, measured on the source build.
describe('Horizon v1.9 beds (W3-A)',()=>{
  const cuts=buildLandCuts(baseHeight),find=(id:string)=>cuts.beds.find(b=>b.id===id)!;
  const walk=find('yearWalk'),garden=find('walk garden');
  it('keeps the Year Walk off the Garden Walk at Scholars and every stretch of it within the 12 % walk grade',()=>{
    // [802,468]: the March in-leg ran 3-4 eu over the Garden Walk's shoulder (the Glasshouse and Cottage door walks stopped there).
    const near=walk.points.filter(p=>distance(plan(p),[802,468])<14);
    for(const p of near){const g=nearestOnPath(plan(p),garden.points);if(g.distance<6)expect(Math.abs(g.at[1]-p[1]),`Year Walk ${plan(p).map(v=>v.toFixed(1))}`).toBeLessThan(.5);}
    // Every Garden Walk crossing within 3 eu is held flush (segment test): the two Scholars crossings meet within 0.48.
    // Source build (before the world's junction regrade): no 5 m sample over 12.6 %; the only samples over 12.05 % are
    // footway copies on the inside of a host's bend (Crown Road's last bend 12.09 %, the NE shelf corner 12.5 %).
    // v2.6 (D-M5): the January and February lanes on Mountain v2's road copy v2's own grades (to 14 %, steeper on a hairpin's
    // inside); the region owns them, so the walk-grade rule is measured off v2's road.
    // Road main: measured on the Year Walk the island carries (the committed bake, after the junction solve re-syncs the
    // footways to their hosts' final heights); the source build's footway copies predate the Drive's structure pins.
    const baked=(JSON.parse(gunzipSync(readFileSync('public/horizon/world/horizon-geo-1.index.json.gz')).toString('utf8')) as {beds:{id:string;points:[number,number,number][]}[]}).beds.find(b=>b.id==='yearWalk')!.points;
    const grades=baked.slice(1).map((p,i)=>{const q=baked[i]!;return onMountainV2Road([(p[0]+q[0])/2,(p[2]+q[2])/2])?0:Math.abs(p[1]-q[1])/(distance(plan(p),plan(q))||1);});
    expect(Math.max(...grades)).toBeLessThan(.126);expect(grades.filter(g=>g>.1205).length).toBeLessThanOrEqual(4);
  },60000);
  it('lays Horizon Drive\'s north-east corner on land at the height it held for Crown Road (retired, D-M4)',()=>{
    const v01=find('V01'),corner=v01.points.filter(p=>p[0]>1350&&p[2]<520);
    expect(corner.length).toBeGreaterThan(20);
    expect(corner.filter(p=>baseHeight(p[0],p[2])<0).length).toBe(0);
    expect(cuts.beds.some(b=>b.id==='V02')).toBe(false);
    expect(nearestOnPath([1433.3,335.6],v01.points).at[1]).toBeCloseTo(70,1);
  },60000);
  it('holds the Cottage spur at Green Road\'s height across the Year Walk footway lanes',()=>{
    const spur=find('spur cottage'),vg=find('VG');
    for(const p of spur.points){const n=nearestOnPath(plan(p),vg.points);if(n.distance<=9.5+2.6+1.2&&n.distance>1)expect(Math.abs(p[1]-n.at[1])).toBeLessThan(.05);}
  },60000);
  it('makes the Bight trail the Bight Shore spur\'s footway and serves the hangar bay from the strip (D-2, P31)',()=>{
    const trail=find('walk bight'),vbs=find('VBS');
    expect(trail.points.length).toBe(vbs.points.length);
    trail.points.forEach((p,i)=>{expect(p[1]).toBeCloseTo(vbs.points[i]![1],6);expect(distance(plan(p),plan(vbs.points[i]!))).toBeCloseTo(4.2,1);});
    const service=find('plot.flats.1.service'),pad=cuts.pads.find(p=>p.id==='plot.flats.1')!;
    expect(pad.size).toEqual([11,18]);expect(service.points.at(-1)![0]).toBeCloseTo(pad.centre[0]-5.5,5);
    expect(cuts.beds.some(b=>b.id==='hangar.access')).toBe(false);
  },60000);
});
describe('Horizon v2.0 beds (W5-A, Jonathan\'s rulings 2026-09-27)',()=>{
  const cuts=buildLandCuts(baseHeight),find=(id:string)=>cuts.beds.find(b=>b.id===id)!;
  const hAt=(id:string,at:XY)=>nearestOnPath(at,find(id).points).at[1];
  const grade=(a:readonly number[],b:readonly number[])=>Math.abs(b[1]!-a[1]!)/distance(plan(a as never),plan(b as never));
  it('lays the summit station walk to L02 and the Crown walk on Mountain v2\'s road (D-M5, D-M6; v2.5: D-A3, D-C7 retired)',()=>{
    expect(cuts.beds.some(b=>b.id==='walk crownFromGondola')).toBe(false);
    const station=find('walk summitStation'),top=M.thresholds.find(t=>t.id==='gondolaTop')!.xy as unknown as XY;
    expect(plan(station.points[0]!)).toEqual(top);expect(station.points[0]![1]).toBeCloseTo(M.cable.G1.toH,5);
    expect(plan(station.points.at(-1)!)).toEqual([1310,470]);expect(maxGrade(station.points)).toBeLessThanOrEqual(.12);
    // The Crown walk is v2's road verge (left, 2.4) from the Hearth terrace to the summit: v2's heights, carried by the region.
    const crown=find('walk crown'),road=find('mountainV2.road'),F=M.walks.crown.footwayOf as {offset_m:number;from_s:number};
    expect(crown.points.every(p=>Math.abs(nearestOnPath(plan(p),road.points).distance-F.offset_m)<.6)).toBe(true);
    expect(crown.points.every(p=>Math.abs(nearestOnPath(plan(p),road.points).at[1]-p[1])<.35)).toBe(true);
    expect(crown.carried!.flat().length).toBeGreaterThanOrEqual(crown.points.length);
    expect(distance(plan(crown.points.at(-1)!),[1325,470.5])).toBeLessThan(4);
  },120000);
  it('lays G1 as Mountain v2\'s gondola: authored tower tops, the cabin path at the platforms, no zip crossing (D-M6)',()=>{
    const towers=[1,2,3].map(i=>cuts.diagnostics.find(d=>d.id===`cable.G1.tower.${i}`)!),G=M.cable.G1 as unknown as {authoredTowers:number[];hang_eu:number;towers:number[][]};
    expect(towers.every(t=>t.severity==='info'&&t.measured!<M.sky.ceiling_m)).toBe(true);
    towers.forEach((t,i)=>{expect(t.at).toEqual(G.towers[i]);expect(t.measured!+G.hang_eu).toBeCloseTo(G.authoredTowers[i]!,5);});
    expect(cuts.diagnostics.filter(d=>d.id.startsWith('cable.G1.clear')||d.id.endsWith('.ceiling'))).toEqual([]);
    const zip=cuts.diagnostics.find(d=>d.id==='cable.ZIP.G1')!;expect(zip.severity).toBe('info');expect(zip.message).toContain('do not cross');
    const g1=find('G1');expect(g1.points[0]![1]).toBeCloseTo(M.cable.G1.fromH,5);expect(g1.points.at(-1)![1]).toBeCloseTo(M.cable.G1.toH,5);
    const top=cuts.pads.find(p=>p.id==='threshold.gondolaTop')!;expect(top.centre[1]).toBe(M.cable.G1.toH);expect(top.deck).toBe(true);
    // The region draws v2's towers and terminals: the Horizon keeps only the rope and the towers' footings.
    expect(cuts.solids.some(s=>s.id==='G1.towers')).toBe(false);expect(cuts.solids.some(s=>s.id.startsWith('platform.gondola'))).toBe(false);
    expect(cuts.solids.some(s=>s.id==='G1.towers.footings')).toBe(true);
  },120000);
  it('lays S2 on its authored Bight profile: a 5 % west ramp on a trestle, the deck lanes carried, a 7.1 % east descent (D-A1)',()=>{
    const s2=find('S2'),S=M.skate.S2 as unknown as {levels:{xy:XY;h:number}[]};
    for(const l of S.levels)expect(Math.abs(hAt('S2',l.xy)-l.h),`${l.xy}`).toBeLessThan(.01);
    const stretch=(from:XY,to:XY)=>{const a=nearestOnPath(from,s2.points).segment,b=nearestOnPath(to,s2.points).segment;return s2.points.slice(a+1,b+1);};
    const ramp=stretch([485,800],[466.1,1021.3]),rampGrades=ramp.slice(1).map((p,i)=>grade(ramp[i]!,p));
    expect(Math.min(...rampGrades)).toBeGreaterThan(.047);expect(Math.max(...rampGrades)).toBeLessThan(.053);
    const descent=stretch([655.9,1175.7],[712,1230]),dg=descent.slice(1).map((p,i)=>grade(descent[i]!,p));
    expect(Math.min(...dg)).toBeGreaterThan(.066);expect(Math.max(...dg)).toBeLessThan(.076);
    // The deck stretch is carried by the bridge (no S2 deck, edge or terrain there) and never raises the seabed.
    const carried=s2.carried!.flat();expect(planDistance([548,1078.7],carried)).toBeLessThan(3);expect(planDistance([621.5,1151.6],carried)).toBeLessThan(3);
    const trestle=cuts.solids.find(s=>s.id==='S2.westRamp.trestle')!;expect(trestle.role).toBe('support');
    expect(cuts.diagnostics.find(d=>d.id==='S2.westRamp.trestle')!.measured).toBeGreaterThanOrEqual(15);
    expect(cuts.solids.some(s=>s.id.startsWith('S2.bed')&&(()=>{for(let i=0;i<s.positions.length;i+=3)if(planDistance([s.positions[i]!,s.positions[i+2]!],[[548,1078.7],[564.1,1111.4]])<1)return true;return false;})())).toBe(false);
  },120000);
  it('turns November\'s pad 90°, makes the D-A7 thresholds flush, retires the market ramp and keeps the homestead lane on land',()=>{
    const nov=cuts.pads.find(p=>p.id==='station.nov')!;expect(nov.rotationDegrees).toBe(90);expect(plan(nov.centre)).toEqual([1626,904]);
    // #34 V01 × the pier walk stays open (groundBeds OPEN_VOIDS, D-A7 #34): v2.0 moved the Drive to 21.3 there.
    expect(maxGrade(find('walk bightPier').points)).toBeLessThanOrEqual(.12+1e-6);
    expect(Math.abs(hAt('S4',[973,538])-hAt('VG',[973,538]))).toBeLessThan(.3); // VG's crown vs S4 at the kerb gap
    expect(Math.abs(hAt('S4',[905.9,640.6])-hAt('walk garden',[905.9,640.6]))).toBeLessThan(.05);
    expect(cuts.beds.some(b=>b.id==='marketRamp')).toBe(false);
    // The square walk is the step-free way up: from the square's edge to the upper street it climbs at most 8 %.
    const square=find('walk square');expect(maxGrade(square.points.filter(p=>p[2]<=1148))).toBeLessThanOrEqual(.08+1e-6);
    for(const p of square.points)if(Math.abs(p[0]-1455)<=28&&Math.abs(p[2]-1175)<=28)expect(p[1]).toBeCloseTo(12,5);
    expect(square.points.at(-1)![1]).toBeCloseTo(18,5);
    const lane=find('homestead.lane');expect(lane.points.filter(p=>baseHeight(p[0],p[2])<M.seaLevel).length).toBe(0);expect(maxGrade(lane.points)).toBeLessThanOrEqual(.08+1e-6);
  },120000);
  it('leaves the named carriers\' routes as open spans: VBS on the trestle (D-C9; v2.6: the S1 flyover is retired with the Shoulder sweep, D-M5)',()=>{
    const s1=find('S1'),open=(b:typeof s1,at:XY)=>(b.terrainExclusions??[]).some(e=>e.openSpan&&distance(e.at,at)<e.radius);
    expect(M.structures).not.toHaveProperty('s1Flyover');expect(open(s1,[1345,744])).toBe(false);
    const vbsMid=plan(nearestOnPath([904.9,891.5],find('VBS').points).at);expect(open(find('VBS'),vbsMid)).toBe(true);expect(open(find('walk bight'),[904.9,891.5])).toBe(true);
  },120000);
});
describe('Horizon v2.3 beds (W7-A, Wave 7)',()=>{
  const cuts=buildLandCuts(baseHeight),find=(id:string)=>cuts.beds.find(b=>b.id===id)!;
  const hAt=(id:string,at:XY)=>nearestOnPath(at,find(id).points).at[1];
  it('D-D8: the lake-rim trail keeps its 2.5 m profile, the Year Walk carries the February share, and the trail ends on the sill\'s east lip (v2.6)',()=>{
    const rim=find('walk lakerim'),yw=find('yearWalk');
    expect(rim.width).toBe(2.5);expect(plan(rim.points.at(-1)!)).toEqual([1166,905]);expect(rim.points.at(-1)![1]).toBeCloseTo(52,5);
    // The trail's own deck and edges stop where the Year Walk carries it; the Year Walk is not carried there any more.
    const onShare=plan(nearestOnPath([1215,745],rim.points).at);expect(rim.carried!.some(line=>planDistance(onShare,line)<1)).toBe(true);expect((yw.carried??[]).some(line=>planDistance(onShare,line)<1)).toBe(false);
    // Nothing of the trail within 3 m of the dam gallery's stairwell or south of the crest walk's line (it overhung it 10.4 eu).
    expect(rim.points.every(p=>!(p[0]>1155&&p[0]<1173&&p[2]>906.5))).toBe(true);
    expect(rim.points.filter(p=>p[0]<1160&&p[2]>880).length).toBe(0);
  },120000);
  it('seats the market stair on the upper street: head at 18 on the street\'s edge, foot at 12 joined to the square walk',()=>{
    const flights=[0,1,2].map(f=>find(`marketStair.flight.${f}`));
    expect(flights[0]!.points[0]).toEqual([1472,18,1115]);expect(flights[2]!.points.at(-1)).toEqual([1472,12,1134]);
    const street=cuts.pads.find(p=>p.id==='town.upperStreet')!;expect(street.centre[2]+street.size[1]/2).toBeCloseTo(1115,5);expect(street.centre[1]).toBe(18);
    const foot=find('marketStair.foot'),square=find('walk square');expect(nearestOnPath(plan(foot.points.at(-1)!),square.points).distance).toBeLessThan(.01);
    expect(foot.points.every(p=>Math.abs(p[1]-12)<.3)).toBe(true);
    expect(find('town.upperStreetWalk').points.at(-1)).toEqual([1472,18,1115]);
  },120000);
  it('A1.3: S4 meets the Year Walk flush at the studio terrace (0.68 of 2.4 under) and S4 × VBS is one tread (1.72 step)',()=>{
    expect(Math.abs(hAt('S4',[968.6,540.6])-hAt('yearWalk',[968.6,540.6]))).toBeLessThan(.25);
    expect(Math.abs(hAt('S4',[871.7,945.9])-hAt('VBS',[871.7,945.9]))).toBeLessThan(.25);
    expect(Math.abs(hAt('S4',[873.5,951.1])-hAt('walk bight',[873.5,951.1]))).toBeLessThan(.3);
    expect(maxGrade(find('S4').points)).toBeLessThanOrEqual(.18+1e-6);expect(maxGrade(find('VBS').points)).toBeLessThanOrEqual(.12+1e-6);
  },120000);
  it('A1.3 / D-D2: the June lane meets plot bight.1\'s service drive at grade (1.97 of 2.4 under) within the walk grade',()=>{
    const service=find('plot.bight.1.service'),yw=find('yearWalk');
    let best={d:Infinity,dh:Infinity};for(const p of yw.points){const n=nearestOnPath(plan(p),service.points);if(n.distance<best.d)best={d:n.distance,dh:Math.abs(n.at[1]-p[1])};}
    expect(best.d).toBeLessThan(2);expect(best.dh).toBeLessThan(.25);
    expect(maxGrade(yw.points.filter(p=>distance(plan(p),[856.7,935])<40))).toBeLessThanOrEqual(M.profiles.walk.grade_max_pct/100+1e-6);
  },120000);
  it('the homestead lane leaves the yard east of the Year Walk\'s lanes (it started 3.5 over them)',()=>{
    const lane=find('homestead.lane'),yw=find('yearWalk');
    expect(plan(lane.points[0]!)).toEqual([1520,1196]);expect(maxGrade(lane.points)).toBeLessThanOrEqual(.08+1e-6);expect(lane.points[0]![1]).toBeCloseTo(12,5);
    expect(lane.points.slice(0,4).every(p=>nearestOnPath(plan(p),yw.points).distance>yw.width/2+yw.shoulder+lane.width/2)).toBe(true);
  },120000);
});
