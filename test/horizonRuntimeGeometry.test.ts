import {describe,it,expect} from 'vitest';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {solidTriangle} from '../src/harbour/horizon/runtime/cards.ts';
import {CardBuilder} from '../src/harbour/art/cardScene.ts';
import type {LandCuts,TerrainField} from '../src/harbour/horizon/land/interfaces.ts';
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
 it('does not flip a real underside toward the sun in the shared card pipeline',()=>{
  const builder=new CardBuilder('underside','lite',{ink:'#000000'});
  solidTriangle(builder,[0,2,0],[1,2,0],[0,2,1],[1,1,1]);
  expect(builder.at(0,0).data.card.normals).toEqual([0,-1,0,0,-1,0,0,-1,0]);
 });
});
