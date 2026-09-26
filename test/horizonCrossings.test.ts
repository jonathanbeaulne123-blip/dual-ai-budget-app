import { expect, it } from 'vitest';
import { buildCrossings, computeIntersections, type Centreline } from '../src/harbour/horizon/world/crossings.ts';
import type { LandCuts, BedCut } from '../src/harbour/horizon/land/interfaces.ts';
const line = (id: string, points: Centreline['points']): Centreline => ({ id, points, clearHeight: 4, kind: 'road', structureIds: [] });
it('finds skew, endpoint and collinear crossings without exempting the Deep shared point', () => {
  const result = computeIntersections([line('ORE', [[1200, 44, 420], [1300, 44, 420], [1400, 44, 420]]), line('DEEP_RUN', [[1300, 40, 420], [1300, 30, 500]]), line('shared', [[1250, 40, 420], [1350, 40, 420]])]);
  expect(result.filter(p => p.a === 'ORE' && p.b === 'DEEP_RUN')).toHaveLength(1);
  expect(result.find(p => p.b === 'DEEP_RUN')).toMatchObject({ at: [1300, 420], heightA: 44, heightB: 40 });
  expect(result.some(p => p.overlap)).toBe(true);
});
it('does not turn an unbuilt crossing into a passing registered resolution', () => {
  // A road meeting a walk at grade is a mode-change threshold: without a pad and marker it is not built.
  const beds: BedCut[] = ['a', 'b'].map((id, i) => ({ id, kind: i ? 'walk' : 'road', profile: 'walk', surface: 'gravel', points: i ? [[5, 0, -5], [5, 0, 5]] : [[0, 0, 0], [10, 0, 0]], width: 2, shoulder: 0, blend: 0, clearHeight: 2, maxGrade: .12, terrainCut: true, structureIds: [], districtIds: [] }));
  const cuts: LandCuts = { beds, pads: [], mouths: [], waters: [], solids: [], diagnostics: [] };
  const result = buildCrossings(cuts).proofs[0]!;
  expect(result).toMatchObject({ registered: false, proposed: true, resolution: 'threshold', kind: 'crossing', built: false });
  expect(result.id).toBe('cross.a.b.1');
  // Two foot routes meeting flush are a path junction: built without a marker (R1-88).
  const walks = { ...cuts, beds: beds.map(b => ({ ...b, kind: 'walk' as const })) };
  expect(buildCrossings(walks).proofs[0]).toMatchObject({ kind: 'junction', resolution: 'threshold', built: true });
});
it('does not count an ordinary floating bed as a built bridge, and measures a supported deck underside',()=>{
  const beds:BedCut[]=['upper','lower'].map((id,i)=>({id,kind:'road',profile:'road',surface:'paved',points:i?[[-5,0,0],[5,0,0]]:[[0,5,-5],[0,5,5]],width:2,shoulder:0,blend:0,clearHeight:5,maxGrade:.12,terrainCut:true,structureIds:[],districtIds:[]}));
  const deck={id:'upper.bed',kind:'bed',positions:[-1,4.4,-1,-1,4.4,1,1,4.4,1,1,4.4,-1,-1,5,-1,-1,5,1,1,5,1,1,5,-1],indices:[0,2,1,0,3,2,4,5,6,4,6,7],surface:'paved',districtId:'harbour',bedIds:['upper'],walkable:true,role:'deck' as const};
  const cuts:LandCuts={beds,pads:[],mouths:[],waters:[],solids:[deck],diagnostics:[]};
  expect(buildCrossings(cuts).proofs[0]?.built).toBe(false);
  cuts.solids.push({...deck,id:'upper.supports',kind:'pier',role:'support',positions:deck.positions.map((v,i)=>i%3===1?v-1:v+2),walkable:false});
  const proof=buildCrossings(cuts).proofs[0]!;expect(proof.clearHeight).toBeCloseTo(4.4);expect(proof.clearancePass).toBe(false);expect(proof.built).toBe(false);
});
it('retains raw water intersections while recognizing a continuous confluence without basin furniture',()=>{
  const channel=(id:string,points:BedCut['points'])=>({id,kind:'river' as const,points,outline:[] as [number,number][],level:0,width:8,depth:2,bank:1});
  const cuts:LandCuts={beds:[],pads:[],mouths:[],solids:[],diagnostics:[],waters:[channel('water.river.lower',[[0,0,0],[10,0,0]]),channel('water.reach.1',[[5,0,0],[5,0,10]])]};
  const result=buildCrossings(cuts,[{id:'RIVER_RUN',bedIds:[],mode:'row',points:[[0,0,0],[10,0,0]]}]);
  expect(result.rawIntersections.length).toBeGreaterThan(result.proofs.length);
  expect(result.proofs.every(p=>p.kind==='waterConfluence'&&p.built&&!p.padId)).toBe(true);
});

const bed=(id:string,kind:BedCut['kind'],points:BedCut['points'],clearHeight=2.4):BedCut=>({id,kind,profile:kind,surface:'gravel',points,width:3,shoulder:0,blend:0,clearHeight,maxGrade:.12,terrainCut:true,structureIds:[],districtIds:[]});
it('keeps crossing ids stable across a no-op re-bake and a 1 cm move, and derives them from the route names (R1-68)',()=>{
  const make=(dz:number):LandCuts=>({beds:[bed('walk garden','walk',[[0,5,0],[200,5,0]]),bed('V01','road',[[50,0,-50+dz],[50,0,50+dz]]),bed('S4','skate',[[150,0,-50],[150,0.01,50]])],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]});
  const one=buildCrossings(make(0)).proofs.map(p=>p.id),two=buildCrossings(make(0)).proofs.map(p=>p.id),moved=buildCrossings(make(.01)).proofs.map(p=>p.id);
  expect(one).toEqual(two);expect(moved).toEqual(one);expect(new Set(one).size).toBe(one.length);
  expect(one.sort()).toEqual(['cross.s4.walkGarden.1','cross.v01.walkGarden.1']);
});
it('measures headroom from the lower surface to the upper underside, not centreline to centreline (R1-39)',()=>{
  // 2.95 eu between centrelines over a rail (clear 3.2): the 0.6 eu deck leaves 2.35 → fails; it used to pass on 2.95 when an unrelated check… and a 4.2 eu gap passes.
  const low=(gap:number):LandCuts=>({beds:[bed('ORE','rail',[[0,0,0],[100,0,0]],3.2),bed('yearWalk','walk',[[50,gap,-50],[50,gap,50]])],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]});
  const tight=buildCrossings(low(2.95)).proofs[0]!;expect(tight.clearHeight).toBeCloseTo(2.35,6);expect(tight.clearancePass).toBe(false);
  const clear=buildCrossings(low(4.2)).proofs[0]!;expect(clear.clearHeight).toBeCloseTo(3.6,6);expect(clear.clearancePass).toBe(true);
  // A cable 107 eu over a rail in rock: measured over the ground (60 → 47 eu clear), not failed by the tunnel floor.
  const rock:LandCuts={beds:[bed('ORE','rail',[[0,40,0],[100,40,0]],3.2),bed('G1','cable',[[50,107,-50],[50,107,50]],8)],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  const cable=buildCrossings(rock,[],{ground:()=>60}).proofs[0]!;expect(cable.clearHeight).toBeCloseTo(47,6);expect(cable.clearancePass).toBe(true);expect(cable.built).toBe(true);
});
it('matches register rows only within 10 eu of the authored point (was 65, R1-38)',()=>{
  const cuts:LandCuts={beds:[bed('VG','road',[[1200,24,1105],[1280,24,1105]]),bed('river lower','walk',[[1240,8,1060],[1240,8,1150]])],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  expect(buildCrossings(cuts).proofs[0]).toMatchObject({registered:true,manifestIndex:0});
  const far={...cuts,beds:[bed('VG','road',[[1200,24,1125],[1280,24,1125]]),bed('river lower','walk',[[1265,8,1060],[1265,8,1150]])]};
  expect(buildCrossings(far).proofs[0]).toMatchObject({registered:false,proposed:true});
});
it('records a bed inside a lake outline as a water-body conflict, once per wet run (R1-01, R1-103)',()=>{
  const lake={id:'water.stillwater',kind:'lake' as const,points:[],outline:[[0,0],[100,0],[100,100],[0,100]] as [number,number][],level:50,width:0,depth:8,bank:2};
  const cuts:LandCuts={beds:[bed('yearWalk','walk',[[-50,52,50],[150,49,50]])],pads:[],mouths:[],waters:[lake],solids:[],diagnostics:[]};
  const inside=(w:{level:number},x:number,z:number)=>x>=0&&x<=100&&z>=0&&z<=100?w.level:null;
  const proofs=buildCrossings(cuts,[],{waterAt:inside}).proofs.filter(p=>p.kind==='waterBody');
  expect(proofs).toHaveLength(1);expect(proofs[0]).toMatchObject({a:'yearWalk',b:'water.stillwater',built:false,registered:false});expect(proofs[0]!.overlapLength).toBeGreaterThan(40);
});
it('classes a Year Walk footway of its host (MANIFEST v1.7 shares) and a collinear run as one record',()=>{
  // May: the walk is Green Road's west footway from [997,1006.7] to [994.1,612.3]; here laid on the host's line at its height.
  const cuts:LandCuts={beds:[bed('VG','road',[[997,20,1010],[995,20,800],[994,20,610]]),bed('yearWalk','walk',[[980,20,900],[996,20,900],[996,20,850],[980,20,850]])],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  const proofs=buildCrossings(cuts).proofs;expect(proofs.length).toBeGreaterThan(0);
  expect(proofs.every(p=>p.kind==='footway'&&p.registered&&p.built)).toBe(true);
  const run:LandCuts={beds:[bed('walk a','walk',[[0,5,0],[10,5,0],[20,5,0],[30,5,0]]),bed('walk b','walk',[[5,5,0],[15,5,0],[25,5,0]])],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
  const shared=buildCrossings(run).proofs;expect(shared).toHaveLength(1);expect(shared[0]).toMatchObject({kind:'sharedStretch',built:true});expect(shared[0]!.overlapLength).toBeCloseTo(20,6);
});
import { registerRowKey } from '../src/harbour/horizon/world/crossings.ts';
it('names register thresholds by their routes, so inserting a row does not rename the others (R1-68)',()=>{
  const rows=[{a:'S2',b:'water wash'},{a:'walk garden',b:'S4'},{a:'walk garden',b:'S4'}];
  expect(registerRowKey(2,rows)).toBe('crossing.walkGarden.s4.2');
  const inserted=[{a:'V01',b:'yearWalk'},...rows];
  expect(registerRowKey(3,inserted)).toBe(registerRowKey(2,rows));expect(registerRowKey(1,inserted)).toBe('crossing.s2.waterWash.1');
});
