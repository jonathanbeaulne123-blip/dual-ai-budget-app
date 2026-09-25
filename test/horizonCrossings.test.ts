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
  const beds: BedCut[] = ['a', 'b'].map((id, i) => ({ id, kind: 'walk', profile: 'walk', surface: 'gravel', points: i ? [[5, 0, -5], [5, 0, 5]] : [[0, 0, 0], [10, 0, 0]], width: 2, shoulder: 0, blend: 0, clearHeight: 2, maxGrade: .12, terrainCut: true, structureIds: [], districtIds: [] }));
  const cuts: LandCuts = { beds, pads: [], mouths: [], waters: [], solids: [], diagnostics: [] };
  const result = buildCrossings(cuts).proofs[0]!;
  expect(result).toMatchObject({ registered: false, proposed: true, resolution: 'threshold', built: false });
  expect(result.id).toMatch(/^[a-z][a-zA-Z0-9]+$/);
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
  const channel=(id:string,points:BedCut['points'])=>({id,kind:'river' as const,points,outline:[] as readonly [number,number][],level:0,width:8,depth:2,bank:1});
  const cuts:LandCuts={beds:[],pads:[],mouths:[],solids:[],diagnostics:[],waters:[channel('water.river.lower',[[0,0,0],[10,0,0]]),channel('water.reach.1',[[5,0,0],[5,0,10]])]};
  const result=buildCrossings(cuts,[{id:'RIVER_RUN',bedIds:[],mode:'row',points:[[0,0,0],[10,0,0]]}]);
  expect(result.rawIntersections.length).toBeGreaterThan(result.proofs.length);
  expect(result.proofs.every(p=>p.kind==='waterConfluence'&&p.built&&!p.padId)).toBe(true);
});
