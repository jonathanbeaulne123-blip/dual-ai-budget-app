import {expect,it} from 'vitest';
import {emptyWorldDefinition} from '../src/harbour/horizon/world/empty.ts';
import type {WorldDefinition} from '../src/harbour/horizon/world/definition.ts';

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
