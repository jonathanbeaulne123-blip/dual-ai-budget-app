import { expect, it } from 'vitest';
import { buildViews, projectSubject, sketchbookLens, subjectTests, PAGE_SUBJECTS, viewPixels } from '../src/harbour/horizon/world/views.ts';
import { createRayCaster } from '../src/harbour/horizon/world/raycast.ts';
import { solid, slab } from '../src/harbour/horizon/land/structures/mesh.ts';
import { HORIZON_MANIFEST } from '../src/harbour/horizon/world/manifest.ts';
import type { LandCuts, TerrainField } from '../src/harbour/horizon/land/interfaces.ts';
import {PerspectiveCamera,Vector3} from 'three';
const field: TerrainField = { revision: 'horizon-geo-1', width: 2000, depth: 1800, step: 100, columns: 21, rows: 19, heights: new Float32Array(399).fill(10), surfaces: new Uint8Array(399) };
const cuts: LandCuts = { beds: [], pads: [], mouths: [], solids: [], waters: [], diagnostics: [] };
it('keeps twelve immutable camera xy/FOV/radii and the specified flight eye height', () => {
  const views = buildViews(field, cuts); expect(views).toHaveLength(12);
  for (const v of views) { const m = HORIZON_MANIFEST.views.find(p => p.id === v.id)!; expect([v.eye[0], v.eye[2]]).toEqual(m.xy); expect([v.target[0], v.target[2]]).toEqual(m.target); expect(v.fovDegrees).toBe(m.fov_deg); expect(v.radius).toBe(m.radius_eu); expect(v.eye[1]).toBeCloseTo(v.id === 'J' ? 60 : v.floor! + 1.6); }
});
it('projects forward subjects and exposes a missing or out-of-frame subject as failure', () => {
  expect(projectSubject([0, 0, 0], [0, 0, -10], [0, 0, -20], 55).ndc).toEqual([0, 0]);
  expect(Math.abs(projectSubject([0, 0, 0], [0, 0, -10], [100, 0, -20], 55).ndc[0])).toBeGreaterThan(1);
  // v1.7 J stands at [1840,1000] h 60 looking at [1780,700] @14: pitch −8.6°, the horizon is inside its 32.3° vertical FOV.
  const views = buildViews(field, cuts), j = views.find(v => v.id === 'J')!.proof!;
  expect(j.landscape.pitchDegrees).toBeCloseTo(-8.6, 1); expect(j.horizonInFrame).toBe(true);
  // No solids are built in this fixture: every structure subject of C is 0 px, so C fails.
  expect(views.find(v => v.id === 'C')?.proof?.pass).toBe(false);
});
it('matches Three projection for pitched cameras using horizontal FOV',()=>{
  const eye=[17,31,45] as const,target=[-20,6,-70] as const,aspect=16/9,fov=55;
  const camera=new PerspectiveCamera(2*Math.atan(Math.tan(fov*Math.PI/360)/aspect)*180/Math.PI,aspect,.1,2000);
  camera.position.set(...eye);camera.lookAt(...target);camera.updateMatrixWorld(true);
  for(const point of [[-20,6,-70],[5,20,-50],[150,10,100],[-40,60,-100]]as const){const expected=new Vector3(...point).project(camera),actual=projectSubject(eye,target,point,fov,aspect);expect(actual.ndc[0]).toBeCloseTo(expected.x,8);expect(actual.ndc[1]).toBeCloseTo(expected.y,8);}
});

it('rejects an authored eye below a visible river surface even when above terrain',()=>{
 // A test river under page C's v1.7 eye [1268,1145] (terrain 10, eye 11.6, water 15).
 const wet={...cuts,waters:[{id:'river',kind:'river' as const,points:[[1268,15,1130],[1268,15,1160]] as [number,number,number][],outline:[],level:15,width:8,depth:12,bank:2}]};
 const view=buildViews(field,wet).find(v=>v.id==='C')!;
 expect(view.proof!.eyeAboveFloor).toBe(true);expect(view.proof!.eyeAboveWater).toBe(false);expect(view.proof!.pass).toBe(false);
});

it('holds the page horizontal FOV on a portrait phone (MANIFEST v1.7 viewRule.portrait)',()=>{
 const views=buildViews(field,cuts);
 for(const v of views){
  const m=HORIZON_MANIFEST.views.find(p=>p.id===v.id)! as typeof HORIZON_MANIFEST.views[number]&{portrait:{fov_deg:number;target:number[];target_h?:number}};
  const phone=sketchbookLens(v,390/844),wide=sketchbookLens(v,16/9);
  expect(phone.horizontalFovDegrees).toBe(Math.max(45,m.portrait.fov_deg));expect(phone.horizontalFovDegrees).toBeGreaterThanOrEqual(45);
  expect(Math.tan(phone.verticalFovDegrees*Math.PI/360)*390/844).toBeCloseTo(Math.tan(phone.horizontalFovDegrees*Math.PI/360),10);
  expect([phone.target[0],phone.target[2]]).toEqual(m.portrait.target);expect(phone.target[1]).toBe(m.portrait.target_h??m.target_h);
  expect(wide.horizontalFovDegrees).toBeCloseTo(m.fov_deg,8);
 }
 // Before the rule the 390 px capture kept the 16:9 vertical FOV: 15.3° horizontal (R1-15: the review measured 15.3°).
 const legacy=2*Math.atan(Math.tan(2*Math.atan(Math.tan(55*Math.PI/360)/(16/9))/2)*390/844)*180/Math.PI;expect(legacy).toBeLessThan(16);expect(sketchbookLens({eye:[0,0,0],target:[0,0,1],fovDegrees:55},390/844).horizontalFovDegrees).toBe(55);
});
it('names every portrait frame in the page subject list and maps it to built geometry',()=>{
 const tests=subjectTests();
 for(const v of HORIZON_MANIFEST.views as (typeof HORIZON_MANIFEST.views[number]&{portrait:{frames:string[]}})[]){for(const name of v.portrait.frames){expect(PAGE_SUBJECTS[v.id]).toContain(name);expect(tests[name]).toBeTypeOf('function');}}
});
it('counts a subject only where it is the first hit of the ID buffer (terrain and solids occlude)',()=>{
 const post=solid('highSpan.deck','bridge','stone','deck',['VG'],'notch');slab(post,[1000,20,500],[1000,20,520],8,4);
 const ray=createRayCaster(field,{solids:[post],waters:[],mouths:[]}),tests={deck:subjectTests()['the road deck']!},eye=[1000,11.6,400] as const,target=[1000,20,510] as const;
 const open=viewPixels(ray,eye,target,55,[64,36],tests,false);expect(open.subjects.deck).toBeGreaterThan(open.minPixels);expect(open.horizonInFrame).toBe(true);
 // A ridge between eye and deck, taller than the deck: 0 px, whatever the projection says.
 const ridge={...field,heights:Float32Array.from(field.heights,(_,i)=>Math.floor(i/field.columns)===5?40:10)};
 const hidden=viewPixels(createRayCaster(ridge,{solids:[post],waters:[],mouths:[]}),eye,target,55,[64,36],tests,false);expect(hidden.subjects.deck).toBe(0);
 // Looking into the ridge's face: no sky or sea at or above the eye line → the horizon is not in frame.
 const face=viewPixels(createRayCaster(ridge,{solids:[],waters:[],mouths:[]}),[1000,11.6,480],[1000,11.6,520],30,[64,36],{},false);expect(face.horizonInFrame).toBe(false);
});
it('counts what a structure carries as the structure, and the Reach channels plus the river inside the Reach as the Reach water (D-C5)',()=>{
 const deck=solid('highSpan.deck','bridge','stone','deck',['VG'],'notch');slab(deck,[1200,23,1100],[1290,23,1100],10,1);
 const rail=solid('VG.edges.notch','bed','stone','rail',['VG'],'notch');slab(rail,[1200,24.5,1096],[1290,24.5,1096],.3,1);
 const tests=subjectTests([deck,rail]),at=(id:string,point:[number,number,number])=>({kind:'solid' as const,t:1,id,sourceId:id,role:'rail' as const,point});
 expect(tests['the High Span']!(at('VG.edges.notch',[1250,24.5,1096]),[0,0,1])).toBe(true);
 // The same rail off the deck's plan is not the High Span.
 expect(tests['the High Span']!(at('VG.edges.notch',[1350,24.5,1096]),[0,0,1])).toBe(false);
 const water=(id:string,point:[number,number,number])=>({kind:'water' as const,t:1,id,point});
 // D-C5 (v2.0, views.I.subjectDefs): the lower river where it crosses the Reach landform IS the Reach water; upstream of it is not.
 expect(tests['the Reach water']!(water('water.river.lower',[1265,4,1215]),[0,0,1])).toBe(true);
 expect(tests['the Reach water']!(water('water.river.lower',[1235,9,1105]),[0,0,1])).toBe(false);
 expect(tests['the Reach water']!(water('water.reach.1',[1330,2,1300]),[0,0,1])).toBe(true);
});

// ---- Wave 7 · R3-74 (with R3-53, R3-59, D-D7): the baked proof is honest where review 3's probe fails a page ----
it('G: daylight is sky seen THROUGH the skylight shaft only — never terrain, never the shaft walls, never sky up the Throat (D-D7)', () => {
  // A 10 × 10 shaft box from y 60 to 130 over [95..105, 95..105] (the bounds are what the test reads).
  const tube = solid('deep.skylight.shaft', 'rock', 'rock', 'wall', [], 'undercroft'); slab(tube, [100, 130, 95], [100, 130, 105], 10, 70);
  const t = subjectTests([tube], field), shaft = t['the skylight shaft']!, mouth = t["the Throat's mouth of daylight"]!, sky = { kind: 'sky', t: Infinity, id: 'sky' } as const;
  // Straight up the shaft from under it: through its foot (60) and its top (130).
  expect(shaft(sky, [0, 1, 0], [100, 40, 100])).toBe(true); expect(mouth(sky, [0, 1, 0], [100, 40, 100])).toBe(true);
  // Sky beside the shaft (up the Throat), rock, and the shaft's own wall never count.
  expect(shaft(sky, [0, .8, -.6], [100, 40, 100])).toBe(false);
  expect(mouth({ kind: 'terrain', t: 5, id: 'terrain', point: [100, 150, 100] }, [0, 1, 0], [100, 40, 100])).toBe(false);
  expect(shaft({ kind: 'solid', t: 5, id: 'deep.skylight.shaft', sourceId: 'deep.skylight.shaft', role: 'wall', point: [95, 80, 100] }, [0, 1, 0], [100, 40, 100])).toBe(false);
});
it('H: the open sea beyond the terrain grid is horizon, not the west sea (R3-59: 78 px claimed, the capture shows a haze band)', () => {
  const t = subjectTests([], field), west = t['the west sea']!, sea = t['the sea']!;
  const on = { kind: 'water', t: 400, id: 'water.sea', point: [200, 0, 600] } as const, off = { kind: 'water', t: 900, id: 'water.sea', point: [-300, 0, 330] } as const;
  expect(west(on, [-1, -.1, 0])).toBe(true); expect(west(off, [-1, -.05, 0])).toBe(false); expect(sea(off, [-1, -.05, 0])).toBe(false);
});
it('the honest proof on candidate 5\'s bake fails exactly where review 3\'s P27 fails (R3-74): G and H at 1440 × 900', async () => {
  const { readFileSync } = await import('node:fs'), { decodeTerrainAsset } = await import('../src/harbour/horizon/land/terrain/asset.ts');
  const world = JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json', 'utf8')), bytes = readFileSync('public/horizon/terrain/horizon-geo-1.bin');
  const baked = decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'full');
  const views = buildViews(baked, { ...world.collision, solids: world.geometry.solids.map((q: { id: string; sourceId?: string }) => ({ ...q, id: q.sourceId ?? q.id.split('@')[0] })) });
  const list = (k: 'passLandscape' | 'passPortrait') => views.filter(v => v.proof![k]).map(v => v.id).join(''), px = (id: string, s: string) => views.find(v => v.id === id)!.proof!.subjects.find(q => q.id === s)!;
  // Review 3 P27: 1440 × 900 fails G (captures) and H; 390 × 844 fails A, C, G, H, L. D's phone surf is the one named
  // disagreement: P27 draws no fog (1.2 ‰), the proof fogs the lite frame (0 px of 8 legible) — R3-55, it stays red.
  expect(list('passLandscape')).toBe('ABCDEFIJKL'); expect(list('passPortrait')).toBe('BEFIJK');
  for (const s of ["the Throat's mouth of daylight", 'the skylight shaft']) expect([px('G', s).pixels, px('G', s).portraitPixels]).toEqual([0, 0]);
  expect([px('H', 'the west sea').pixels, px('H', 'the west sea').portraitPixels]).toEqual([0, 0]);
}, 60_000);
