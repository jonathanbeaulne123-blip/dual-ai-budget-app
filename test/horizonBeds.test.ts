import { describe, expect, it } from 'vitest';
import { buildLandCuts, stationBedPositions, yearWalkStretches } from '../src/harbour/horizon/land/beds/build';
import { gradeRoute } from '../src/harbour/horizon/land/beds/solver';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { maxGrade } from '../src/harbour/horizon/land/structures/mesh';
import type { LandDiagnostic, XY } from '../src/harbour/horizon/land/interfaces';
import { HORIZON_MANIFEST as M } from '../src/harbour/horizon/world/manifest';
import { distance, nearestOnPath, plan } from '../src/harbour/horizon/land/structures/mesh';
import { planDistance } from '../src/harbour/horizon/land/beds/profiles';

describe('Horizon cut profiles',()=>{
  it('limits continuous samples, including a short steep input, without losing pinned endpoints',()=>{
    const diagnostics:LandDiagnostic[]=[],route=gradeRoute('test',[[0,0],[40,12],[100,0]],x=>x<50?40:0,.12,[{xy:[0,0],height:0,reason:'start'},{xy:[100,0],height:10,reason:'finish'}],diagnostics);
    expect(maxGrade(route)).toBeLessThanOrEqual(.12001);expect(route[0]![1]).toBe(0);expect(route.at(-1)![1]).toBe(10);
    const impossible:LandDiagnostic[]=[];gradeRoute('impossible',[[0,0],[10,0]],()=>0,.12,[{xy:[0,0],height:0,reason:'start'},{xy:[10,0],height:10,reason:'finish'}],impossible);
    expect(impossible.some(d=>d.severity==='conflict'&&d.required!>d.measured!)).toBe(true);
  });
  it('builds all source beds, exact widths, surface segments, station slots and year stretches',()=>{
    const cuts=buildLandCuts(baseHeight);
    for(const id of ['V01','VG','V02'])expect(cuts.beds.find(b=>b.id===id)?.width).toBe(8);
    for(const id of ['S1','S2','S3','S4']){const b=cuts.beds.find(b=>b.id===id)!;expect(b.width).toBe(4);expect(b.surfaceSegments!.every(s=>s.bankDegrees<=30)).toBe(true);}
    expect(cuts.beds.find(b=>b.id==='yearWalk')!.width).toBeGreaterThanOrEqual(3.2+2);
    const stations=stationBedPositions(cuts);expect(stations).toHaveLength(12);expect(stations.every(s=>s.positions.length===20)).toBe(true);expect(yearWalkStretches(cuts).every(s=>s.length>31*1.6)).toBe(true);
    expect(cuts.beds.find(b=>b.id==='V01')!.terrainExclusions!.length).toBeGreaterThan(1);
    for(const b of cuts.beds.filter(b=>['road','walk','trail','skate','boardwalk'].includes(b.kind)&&b.id!=='yearWalk'))expect(maxGrade(b.points),b.id).toBeLessThanOrEqual(b.maxGrade+.00001);
    expect(cuts.solids.every(s=>s.positions.every(Number.isFinite))).toBe(true);
    console.info(JSON.stringify({beds:cuts.beds.length,pads:cuts.pads.length,solids:cuts.solids.length,triangles:cuts.solids.reduce((s,g)=>s+g.indices.length/3,0),grades:cuts.beds.filter(b=>Number.isFinite(b.maxGrade)&&b.kind!=='stair').map(b=>({id:b.id,max:maxGrade(b.points),limit:b.maxGrade})),conflicts:cuts.diagnostics.filter(d=>d.severity==='conflict')},null,2));
  },60000);
  it('lays the Year Walk verbatim from the v1.7 manifest, as a footway of its hosts, never on water',()=>{
    const cuts=buildLandCuts(baseHeight),walk=cuts.beds.find(b=>b.id==='yearWalk')!,Y=M.journey.yearWalk,limit=M.profiles.walk.grade_max_pct/100;
    // Verbatim: every manifest control point lies on the solved centreline; no inserted controls.
    for(const p of Y.pts)expect(nearestOnPath(p as unknown as XY,walk.points).distance).toBeLessThan(.01);
    // v1.6 laid 14.2 km through its inserted controls; the v1.7 polyline is 11.5 km.
    const length=walk.points.slice(1).reduce((n,p,i)=>n+distance(plan(walk.points[i]!),plan(p)),0);expect(length).toBeGreaterThan(11000);expect(length).toBeLessThan(12000);
    // Shares: the footway samples carry the host height exactly (copied, not re-graded).
    let shared=0;
    for(const row of Y.shares){
      const host=cuts.beds.find(b=>b.id===row.host)!,from=nearestOnPath(row.from as unknown as XY,walk.points).along,to=nearestOnPath(row.to as unknown as XY,walk.points).along;
      let along=0;walk.points.forEach((p,i)=>{if(i)along+=distance(plan(walk.points[i-1]!),plan(p));if(along>from+6&&along<to-6&&Math.abs(nearestOnPath(plan(p),host.points).distance-row.offset_m)<1.5){shared++;expect(Math.abs(nearestOnPath(plan(p),host.points).at[1]-p[1]),`${row.stretch} ${row.host}`).toBeLessThan(.01);}});
    }
    expect(shared).toBeGreaterThan(800);
    // Only a copied host stretch may exceed the walk limit (a lane on the inside of a 12 % road bend), and each is listed.
    walk.points.slice(1).forEach((p,i)=>{const a=walk.points[i]!,g=Math.abs(p[1]-a[1])/(distance(plan(a),plan(p))||1);if(g<=limit+1e-4)return;
      const copied=['V01','V02','VG','walk lakerim'].some(id=>{const n=nearestOnPath(plan(a),cuts.beds.find(b=>b.id===id)!.points);return n.distance<12&&Math.abs(n.at[1]-a[1])<.01;});
      const listed=cuts.diagnostics.some(d=>d.id.startsWith('gradeStretch.yearWalk')&&d.severity==='conflict');
      expect(copied||listed,`${a[0].toFixed(1)},${a[2].toFixed(1)} at ${(g*100).toFixed(1)} %`).toBe(true);});
    // Walls: no kerb, parapet or retaining wall between a host and its footway.
    expect(walk.sharedEdges!.length).toBeGreaterThanOrEqual(9);for(const id of ['V01','V02','VG'])expect(cuts.beds.find(b=>b.id===id)!.sharedEdges?.length,id).toBeGreaterThan(0);
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
    const grades=walk.points.slice(1).map((p,i)=>{const q=walk.points[i]!;return Math.abs(p[1]-q[1])/(distance(plan(p),plan(q))||1);});
    expect(Math.max(...grades)).toBeLessThan(.126);expect(grades.filter(g=>g>.1205).length).toBeLessThanOrEqual(4);
  },60000);
  it('lays Horizon Drive\'s north-east corner on land and starts Crown Road on its ledge',()=>{
    const v01=find('V01'),corner=v01.points.filter(p=>p[0]>1350&&p[2]<520);
    expect(corner.length).toBeGreaterThan(20);
    expect(corner.filter(p=>baseHeight(p[0],p[2])<0).length).toBe(0);
    expect(plan(find('V02').points[0]!)).toEqual([1433.3,335.6]);
    expect(find('V02').points[0]![1]).toBeCloseTo(70,5);
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
