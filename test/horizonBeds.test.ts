import { describe, expect, it } from 'vitest';
import { buildLandCuts, stationBedPositions, yearWalkStretches } from '../src/harbour/horizon/land/beds/build';
import { gradeRoute } from '../src/harbour/horizon/land/beds/solver';
import { baseHeight } from '../src/harbour/horizon/land/terrain';
import { maxGrade } from '../src/harbour/horizon/land/structures/mesh';
import type { LandDiagnostic } from '../src/harbour/horizon/land/interfaces';

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
    for(const b of cuts.beds.filter(b=>['road','walk','trail','skate','boardwalk'].includes(b.kind)))expect(maxGrade(b.points),b.id).toBeLessThanOrEqual(b.maxGrade+.00001);
    expect(cuts.solids.every(s=>s.positions.every(Number.isFinite))).toBe(true);
    console.info(JSON.stringify({beds:cuts.beds.length,pads:cuts.pads.length,solids:cuts.solids.length,triangles:cuts.solids.reduce((s,g)=>s+g.indices.length/3,0),grades:cuts.beds.filter(b=>Number.isFinite(b.maxGrade)&&b.kind!=='stair').map(b=>({id:b.id,max:maxGrade(b.points),limit:b.maxGrade})),conflicts:cuts.diagnostics.filter(d=>d.severity==='conflict')},null,2));
  },60000);
});
