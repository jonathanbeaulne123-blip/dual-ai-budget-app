import {describe,it,expect} from 'vitest';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {solidTriangle} from '../src/harbour/horizon/runtime/cards.ts';
import {CardBuilder} from '../src/harbour/art/cardScene.ts';
import type {LandCuts,TerrainField} from '../src/harbour/horizon/land/interfaces.ts';
import {resolveComputedCrossings} from '../src/harbour/horizon/land/beds/junctions.ts';
import {bed} from '../src/harbour/horizon/land/beds/profiles.ts';
import {solid,box} from '../src/harbour/horizon/land/structures/mesh.ts';
const field:TerrainField={revision:'horizon-geo-1',width:100,depth:100,step:50,columns:3,rows:3,heights:new Float32Array(9),surfaces:new Uint8Array(9)};
const empty:LandCuts={beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
describe('rendered Horizon geometry owns collision',()=>{
 it('keeps the bridge underside and lower walking ground distinct',()=>{
  const deck=solid('bridge','bridge','stone','deck',[],'harbour');box(deck,[50,50],8,[20,8],7.4);deck.walkable=true;
  const query=createHorizonGeography(field,{...empty,solids:[deck]});
  expect(query.surface(50,50,0)?.y).toBe(0);expect(query.surface(50,50,8)?.y).toBe(8);expect(query.ceiling(50,50,0)).toBeCloseTo(7.4);expect(query.blocked(50,50,7)).toBe(true);
 });
 it('uses cave floors below the surface and prevents walking through a wall',()=>{
  const floor=solid('caveFloor','cave','stone','floor',[],'crown');box(floor,[50,50],20,[30,30],19);floor.walkable=true;
  const wall=solid('caveWall','cave','stone','wall',[],'crown');box(wall,[55,50],25,[1,30],19);
  const query=createHorizonGeography({...field,heights:new Float32Array(9).fill(100)},{...empty,solids:[floor,wall]});
  expect(query.surface(50,50,20)?.y).toBe(20);expect(query.blocked(54.4,50,20)).toBe(true);expect(query.blocked(50,50,20)).toBe(false);
 });
 it('steps onto a low visible lip without allowing a parapet crossing',()=>{
  const kerb=solid('lip','kerb','stone','wall');box(kerb,[50,50],.3,[1,5],0);
  const rail=solid('rail','rail','stone','rail');box(rail,[60,50],1.05,[1,5],0);
  const query=createHorizonGeography(field,{...empty,solids:[kerb,rail]});
  expect(query.blocked(49.3,50,0)).toBe(false);expect(query.blocked(59.3,50,0)).toBe(true);
  expect(query.blocker(59.3,50,0,.3,[1,0])).toBe('rail');expect(query.blocker(59.3,50,0,.3,[-1,0])).toBeNull();
 });
 it('stops at visible lake water while allowing a bridge above it',()=>{
  const lake={id:'lake',kind:'lake' as const,outline:[[30,30],[70,30],[70,70],[30,70]] as [number,number][],points:[],level:50,width:40,depth:5,bank:1};
  const query=createHorizonGeography(field,{...empty,waters:[lake]});
  expect(query.submerged(50,50,46)).toBe(true);expect(query.submerged(50,50,51)).toBe(false);expect(query.submerged(10,10,46)).toBe(false);
 });
 it('opens an already registered junction through regenerated retaining walls',()=>{
  const wall=solid('a.retaining','retainingWall','stone','wall',['a']);box(wall,[50,50],1.2,[50,.6],-2);
  const cuts:LandCuts={...empty,beds:[bed('a','walk',[[20,0,50],[80,0,50]]),bed('b','walk',[[50,0,20],[50,0,80]])],pads:[],solids:[wall],diagnostics:[]};
  expect(createHorizonGeography(field,cuts).blocked(50,49.6,0)).toBe(true);
  resolveComputedCrossings(cuts,[{id:'ab',a:'a',b:'b',at:[50,50],heightA:0,heightB:0,resolution:'threshold',requiredClearance:0,built:true,clearancePass:true}],()=>0);
  const query=createHorizonGeography(field,cuts);expect(query.blocked(50,49.6,0)).toBe(false);expect(query.blocked(70,49.6,0)).toBe(true);
 });
 it('does not flip a real underside toward the sun in the shared card pipeline',()=>{
  const builder=new CardBuilder('underside','lite',{ink:'#000000'});
  solidTriangle(builder,[0,2,0],[1,2,0],[0,2,1],[1,1,1]);
  expect(builder.at(0,0).data.card.normals).toEqual([0,-1,0,0,-1,0,0,-1,0]);
 });
});

it('shares appended static collision with hulls without exposing dynamic decks or mutating query results',()=>{
 const query=createHorizonGeography(field,empty),hull=query.staticOnly;
 const retained=query.surface(50,50,0)!,before={...retained};
 const remove=query.addDynamic({surface:()=>({id:'yacht',y:12,nx:0,ny:1,nz:0,material:'wood',slope:0}),ceiling:()=>15,contact:()=>({id:'yacht',nx:1,nz:0})});
 expect(query.surface(50,50,12)?.id).toBe('yacht');expect(query.blocker(50,50,12)).toBe('yacht');expect(query.ceiling(50,50,12)).toBe(15);
 expect(hull.surface(50,50,12)?.id).toBe('terrain');expect(hull.blocked(50,50,12)).toBe(false);expect(hull.ceiling(50,50,12)).toBe(Infinity);
 const deck=solid('bridge','bridge','stone','deck',[],'harbour');box(deck,[50,50],8,[20,8],7.4);deck.walkable=true;query.addSolids([deck]);
 expect(hull.surface(50,50,8)?.id).toBe('bridge');expect(hull.ceiling(50,50,0)).toBeCloseTo(7.4);expect(query.indexStats.chunks).toBe(1);
 remove();expect(query.surface(50,50,8)).toEqual(hull.surface(50,50,8));expect(retained).toEqual(before);
});


describe('static query results survive face rejection and streamed growth',()=>{
 it('retains supported and overhead faces inside the existing barycentric fringe',()=>{
  const top=solid('fringe-top','landing','stone','deck');top.positions=[50,8,50,50,8,51,51,8,50];top.indices=[0,1,2];
  const underside=solid('fringe-under','landing','stone','wall');underside.positions=[50,9,50,51,9,50,50,9,51];underside.indices=[0,1,2];
  const g=createHorizonGeography(field,{...empty,solids:[top,underside]});
  // The admitted point is outside the exact XZ AABB, but inside the established
  // projected face tolerance. Neither surface nor ceiling may lose it.
  expect(g.surface(50-.5e-6,50.5,8)?.id).toBe(top.id);
  expect(g.ceiling(50-.5e-6,50.5,8)).toBeCloseTo(9,12);
  expect(g.contact(50-.5e-6,50.5,8,.01)?.id).toBe(underside.id);
  expect(g.surface(50-2e-6,50.5,8)?.id).toBe('terrain');
  expect(g.ceiling(50-2e-6,50.5,8)).toBe(Infinity);
 });
 it('preserves last equal-height surface, first wall contact and dynamic priority',()=>{
  const a=solid('deck-first','landing','stone','deck'),b=solid('deck-last','landing','stone','deck');
  for(const s of[a,b])box(s,[50,50],8,[4,4],7.5);
  const wallA=solid('wall-first','rail','stone','rail'),wallB=solid('wall-last','rail','stone','rail');
  for(const s of[wallA,wallB])box(s,[60,50],1.05,[1,5],0);
  const g=createHorizonGeography(field,{...empty,solids:[a,b,wallA,wallB]});
  expect(g.surface(50,50,8)?.id).toBe(b.id);
  expect(g.blocker(59.3,50,0,.3,[1,0])).toBe(wallA.id);
  expect(g.blocker(59.3,50,0,.3,[-1,0])).toBeNull();
  const remove=g.addDynamic({surface:()=>({id:'dynamic-tie',y:8,nx:0,ny:1,nz:0,material:'wood',slope:0}),ceiling:()=>Infinity,contact:()=>({id:'dynamic-first',nx:-1,nz:0})});
  expect(g.surface(50,50,8)?.id).toBe(b.id);expect(g.blocker(59.3,50,0,.3,[1,0])).toBe('dynamic-first');
  remove();expect(g.blocker(59.3,50,0,.3,[1,0])).toBe(wallA.id);
 });
 it('keeps tiny supported faces and vertical walls distinct from degenerate faces',()=>{
  const thin=solid('thin-top','landing','stone','deck');thin.positions=[50,8,50,50,8,50+2e-8,51,8,50];thin.indices=[0,1,2];
  const collapsed=solid('collapsed','landing','stone','deck');collapsed.positions=[50,100,50,50.5,100,50,51,100,50];collapsed.indices=[0,1,2];
  const wall=solid('vertical-wall','rail','stone','rail');wall.positions=[50,0,55,50,8,55,51,8,55];wall.indices=[0,1,2];
  const g=createHorizonGeography(field,{...empty,solids:[thin,collapsed,wall]});
  expect(g.surface(50.25,50+5e-9,8)?.id).toBe(thin.id);
  expect(g.surface(50.25,50+5e-9,100)?.id).toBe(thin.id);
  expect(g.ceiling(50.25,50+5e-9,0)).toBe(Infinity);
  expect(g.contact(50.5,54.9,7,.3,undefined,false,.65)?.id).toBe(wall.id);
 });
 it('retains earlier chunk answers when enough later faces force index growth',()=>{
  const deck=solid('earlier-bridge','bridge','stone','deck');box(deck,[50,50],8,[20,8],7.4);
  const wall=solid('earlier-wall','rail','stone','rail');box(wall,[60,70],1.05,[1,5],0);
  const g=createHorizonGeography(field,empty);g.addSolids([deck,wall]);
  const before={surface:g.surface(50,50,8),ceiling:g.ceiling(50,50,0),contact:g.contact(59.3,70,0,.3,[1,0])};
  const later=solid('later-chunk','landing','stone','deck');later.positions=[10,2,10,10,2,11,11,2,10];later.indices=Array.from({length:1100},()=>[0,1,2]).flat();g.addSolids([later]);
  expect(g.indexStats.triangles).toBeGreaterThan(1024);expect(g.indexStats.chunks).toBe(2);
  expect({surface:g.surface(50,50,8),ceiling:g.ceiling(50,50,0),contact:g.contact(59.3,70,0,.3,[1,0])}).toEqual(before);
  expect(g.surface(10.25,10.25,2)?.id).toBe(later.id);
 });
});
