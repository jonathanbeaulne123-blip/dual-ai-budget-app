import {expect,it} from 'vitest';
import {emptyWorldDefinition} from '../src/harbour/horizon/world/empty.ts';
import type {WorldDefinition} from '../src/harbour/horizon/world/definition.ts';
import {createLandWorld} from '../src/harbour/horizon/world/build.ts';

it('makes a typed, geometry-free v3 fixture that survives JSON transport',()=>{
  const world:WorldDefinition=emptyWorldDefinition();
  expect(world.id).toBe('horizon');
  expect(world.geographyRevision).toBe('horizon-geo-0');
  expect(world.heightfield).toEqual({kind:'empty',revision:'horizon-geo-0'});
  expect(world.water).toEqual([]);
  expect(world.beds).toEqual([]);
  expect(world.journey.yearWalk.points).toEqual([]);
  expect(JSON.parse(JSON.stringify(world))).toEqual(world);
  expect(emptyWorldDefinition('horizon-geo-test').heightfield).toEqual({kind:'empty',revision:'horizon-geo-test'});
});

it('assembles named v3 data from typed cuts while exposing missing physical work',()=>{
  const field={revision:'horizon-geo-1' as const,width:2000,depth:1800,step:100,columns:21,rows:19,heights:new Float32Array(399).fill(10),surfaces:new Uint8Array(399)};
  const world=createLandWorld(field,{beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]},{terrainAsset:{url:'/horizon/terrain/horizon-geo-1.bin',bytes:1234,step:100}});
  expect(world.geographyRevision).toBe('horizon-geo-1');expect(world.hosts).toHaveLength(7);expect(world.districts).toHaveLength(13);
  expect(world.journey.stations).toHaveLength(12);expect(world.journey.homestead).toHaveLength(7);expect(world.lanterns).toEqual([]);
  expect(world.collision?.walkableSlopeDegrees).toBe(40);expect(world.sky.gates).toHaveLength(12);expect(world.views).toHaveLength(12);
  expect(world.diagnostics?.some(d=>d.severity==='conflict')).toBe(true);
  expect(world.journeyMeasurements?.every(j=>typeof j.seconds==='number'||j.seconds===null)).toBe(true);
  expect(JSON.parse(JSON.stringify(world)).heightfield.bytes).toBe(1234);
  expect(()=>createLandWorld({...field,revision:'horizon-geo-2'} as never,{beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]})).toThrow(/revision/);
});
