import {expect,it} from 'vitest';
import V2 from '../src/harbour/horizon/land/mountainV2/v2-data.json';
import {mountainSharedRoadSegments,sharedRoadSegmentAt} from '../src/harbour/horizon/land/mountainV2/sharedRoad';
import {buildCrossings,collectCentrelines,computeIntersections} from '../src/harbour/horizon/world/crossings';
import {resolveComputedCrossings} from '../src/harbour/horizon/land/beds/junctions';
import type {BedCut,LandCuts,XYZ} from '../src/harbour/horizon/land/interfaces';
const xyz=(p:readonly number[]):XYZ=>[p[0]!,p[1]!,p[2]!];
const road=()=>V2.road.samples.map(s=>xyz(s.at));
const course=()=>V2.course.points.map(xyz);
const bed=(id:string,kind:BedCut['kind'],points:XYZ[]):BedCut=>({id,kind,profile:'road',surface:'paved',points,width:9.6,shoulder:0,blend:0,clearHeight:4,maxGrade:.15,terrainCut:false,structureIds:[],districtIds:[]});
const cuts=():LandCuts=>({beds:[bed('S1','skate',course()),bed('mountainV2.road','road',road())],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]});

it('proves every full native road segment once, in reverse course order, and stops at Foot before the lane',()=>{
  const c=course(),r=road(),spans=mountainSharedRoadSegments(c,r);
  const owned=spans.flatMap(s=>Array.from({length:s.ownerSegments[1]-s.ownerSegments[0]+1},(_,i)=>s.ownerSegments[0]+i));
  expect(spans.length).toBeGreaterThan(300);
  expect(owned.sort((a,b)=>a-b)).toEqual(Array.from({length:r.length-1},(_,i)=>i));
  expect(spans[0]!.ownerSegments[1]).toBe(r.length-2);
  expect(spans.at(-1)!.ownerSegments[0]).toBe(0);
  expect(spans.at(-1)!.segment).toBeLessThan(c.length-2);
  expect(sharedRoadSegmentAt(spans,'mountainV2.road',spans.at(-1)!.segment+1,0,0,[0,0])).toBeNull();
});

it('does not share a moved course, changed road, other switchback, different route or different level',()=>{
  const c=course(),r=road(),spans=mountainSharedRoadSegments(c,r),s=spans[10]!;
  expect(sharedRoadSegmentAt(spans,s.owner,s.segment,s.ownerSegments[0],.005,[0,0])).toMatchObject({...s,match:'segment'});
  expect(sharedRoadSegmentAt(spans,s.owner,s.segment,0,0,[0,0])).toBeNull();
  expect(sharedRoadSegmentAt(spans,'V03',s.segment,s.ownerSegments[0],0,[0,0])).toBeNull();
  expect(sharedRoadSegmentAt(spans,s.owner,s.segment,s.ownerSegments[0],.021,[0,0])).toBeNull();
  const p=c[s.segment]!;c[s.segment]=[p[0]+.001,p[1],p[2]];
  expect(mountainSharedRoadSegments(c,r).some(row=>row.segment===s.segment)).toBe(false);
  const q=r[0]!;r[0]=[q[0],q[1]+.001,q[2]];
  expect(mountainSharedRoadSegments(course(),r)).toEqual([]);
});

it('keeps the actual raw chord intersections but does not build dismount pads or regrade the common native road',()=>{
  const input=cuts(),before=structuredClone(input.beds.map(b=>b.points));
  const raw=computeIntersections(collectCentrelines(input,[],true)),result=buildCrossings(input);
  expect(raw.length).toBeGreaterThan(100);
  expect(result.rawIntersections).toEqual(raw);
  // This current source fixture is one shared native route. Unlike a route-name
  // exemption, the negative fixture above must reject unrelated segment/height hits.
  expect(result.proofs.length).toBeGreaterThan(100);
  for(const proof of result.proofs){
    expect(proof.kind,proof.id).toBe('sharedStretch');
    expect(proof.built,proof.id).toBe(true);
    if(!proof.overlap)expect(proof.sharedSource,proof.id).toBeDefined();
  }
  resolveComputedCrossings(input,result.proofs,()=>0);
  expect(input.pads).toEqual([]);
  expect(input.solids).toEqual([]);
  expect(input.beds.map(b=>b.points)).toEqual(before);
});

it('still treats an unowned crossing of the same named routes as a real crossing',()=>{
  // Route identity must never waive crossing construction. These are deliberately
  // unrelated to the native source arrays, despite using the same route names.
  const input=cuts();
  input.beds[0]!.points=[[0,0,-5],[0,0,5]];
  input.beds[1]!.points=[[-5,0,0],[5,0,0]];
  const result=buildCrossings(input);
  expect(result.proofs).toHaveLength(1);
  expect(result.proofs[0]).toMatchObject({kind:'crossing',built:false});
  expect(result.proofs[0]!.sharedSource).toBeUndefined();
});

it('admits only bounded endpoint touches for the 11 saved rounding witnesses, including the Foot continuation',()=>{
  const spans=mountainSharedRoadSegments(course(),road());
  const witnesses=[
    [122,576,1236.748401009,527.140247655,.001883008],
    [162,456,1274.952870495,564.110658641,.000241783],
    [314,0,1282,720,-.000023],
    [247,197,1330.213865742,665.327396859,-.002013159],
    [284,90,1343.309228223,698.729621284,.003689379],
    [81,695,1351.251144387,551.450299908,-.003149744],
    [43,813,1353.120307247,505.550643074,-.002754832],
    [196,354,1360.140153478,605.760013346,.004206186],
    [50,788,1373.999393182,513.980026295,-.002961270],
    [52,782,1379.926548355,514.259403275,.001875555],
    [210,312,1398.430311418,604.090789868,-.003812452],
  ] as const;
  // Evidence: after/review/shared-source-endpoint-witnesses.json. The first
  // exact-span proposal missed these real hits; no physical tolerance is changed.
  for(const [segment,ownerSegment,x,z,dy] of witnesses){
    const proof=sharedRoadSegmentAt(spans,'mountainV2.road',segment,ownerSegment,dy,[x,z]);
    expect(proof,`${segment}/${ownerSegment}`).not.toBeNull();
    expect(proof!.match).toBe(segment===314?'foot-touch':ownerSegment>proof!.ownerSegments[1]?'start-touch':'end-touch');
    expect(proof!.endpoint).toBeDefined();
    // Adjacent indices away from the endpoint do not establish shared ownership.
    expect(sharedRoadSegmentAt(spans,'mountainV2.road',segment,ownerSegment,dy,[x+.02,z])).toBeNull();
    expect(sharedRoadSegmentAt(spans,'mountainV2.road',segment,ownerSegment,.021,[x,z])).toBeNull();
  }
  const foot=spans.at(-1)!,p=course()[foot.segment+1]!;
  expect(sharedRoadSegmentAt(spans,'mountainV2.road',foot.segment+2,0,0,[p[0],p[2]])).toBeNull();
  expect(spans.some(s=>s.segment===foot.segment+1)).toBe(false);
  expect(sharedRoadSegmentAt(spans.slice(0,-1),'mountainV2.road',foot.segment+1,0,0,[p[0],p[2]])).toBeNull();
});
