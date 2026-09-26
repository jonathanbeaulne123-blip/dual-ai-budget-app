import {describe,it,expect} from 'vitest';
import {restoreHorizonPosition} from '../src/harbour/horizon/runtime/savedPosition.ts';
import {validHouseBody,readHouseReturn,saveHouseReturn} from '../src/house/navigation.ts';
import {HORIZON_PRESENCE_WORLD as world,HORIZON_GEOGRAPHY as geo} from '../src/worldGeography.ts';
import type {HorizonPathGraph} from '../src/harbour/horizon/world/pathGraph.ts';
const graph:HorizonPathGraph={nodes:[{id:'safe',at:[1500,20,1100],kind:'junction',facing:1},{id:'far',at:[200,30,400],kind:'junction'}],edges:[]};
const saved={world,geo,place:'court',x:1495,y:19,z:1101,yaw:.4};
describe('Horizon saved navigation',()=>{
 it('preserves a current exact body and migrates obsolete geometry to the nearest real node',()=>{
  expect(restoreHorizonPosition(saved,graph,()=>99)).toEqual(saved);
  expect(restoreHorizonPosition({...saved,geo:'horizon-geo-0',world:'horizon:horizon-geo-0'},graph,()=>99)).toMatchObject({x:1500,y:20,z:1100,yaw:1,world,geo});
 });
 it('retains old Horizon revisions for migration but rejects invalid positions',()=>{
  expect(validHouseBody({...saved,world:'horizon:horizon-geo-0',geo:'horizon-geo-0'})).toBe(true);
  for(const change of [{x:2001},{z:-1},{y:301},{x:NaN},{world:'horizon:unknown'},{geo:''}])expect(validHouseBody({...saved,...change})).toBe(false);
 });
 it('keeps return records partitioned by household, member, environment and scope',()=>{
  const values=new Map<string,string>(),store={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const identity={environment:'development' as const,householdId:'HH-land',memberId:'MEM-land',scope:'household' as const};
  const route={householdId:'HH-land',scope:'household' as const,room:'home' as const,level:'middle' as const};
  saveHouseReturn(store,identity,route,{body:saved},'horizon');expect(readHouseReturn(store,identity,'horizon')?.body).toEqual(saved);
  expect(readHouseReturn(store,{...identity,memberId:'other'},'horizon')).toBeNull();expect(readHouseReturn(store,{...identity,scope:'personal'},'horizon')).toBeNull();
 });
});
