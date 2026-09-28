import {describe,expect,it} from 'vitest';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import type {LandCuts,TerrainField,WaterCut} from '../src/harbour/horizon/land/interfaces.ts';
import {realHorizon} from './fixtures/horizonFlight.ts';

const field:TerrainField={revision:'horizon-geo-1',width:100,depth:100,step:50,columns:3,rows:3,heights:new Float32Array(9).fill(100),surfaces:new Uint8Array(9)};
const empty:LandCuts={beds:[],pads:[],mouths:[],waters:[],solids:[],diagnostics:[]};
const pool=(id:string,level:number,depth:number,underground=false):WaterCut=>({id,kind:underground?'deep':'lake',outline:[[30,30],[70,30],[70,70],[30,70]],points:[],level,width:40,depth,bank:1,underground});

describe('pedestrian water height respects underground rooms',()=>{
  it('recognizes the authored Deep pool underfoot while hulls stay on exposed water',()=>{
    const {geography}=realHorizon(),x=1315,z=420;
    const floor=geography.surface(x,z,38);
    expect(floor?.y).toBe(38);
    expect(geography.waterLevel(x,z,38)).toBe(40);
    expect(geography.waterLevel(x,z,39.5)).toBe(40);
    expect(geography.submerged(x,z,38)).toBe(true);
    expect(geography.waterLevel(x,z)).toBeNull();
    expect(geography.waterLevel(x,z,geography.ground(x,z))).toBeNull();
  });

  it('selects the occupied pool instead of a lake overhead, and keeps lower dry rooms dry',()=>{
    const geography=createHorizonGeography(field,{...empty,waters:[pool('lake',50,5),pool('deep',40,7,true)]});
    expect(geography.waterLevel(50,50,38)).toBe(40);
    expect(geography.waterLevel(50,50,20)).toBeNull();
    expect(geography.waterLevel(50,50,48)).toBe(50);
    expect(geography.waterLevel(50,50)).toBe(50);
    expect(geography.waterLevel(10,10,38)).toBeNull();
  });

  it('keeps a dry room above the underground pool out of its swimming volume',()=>{
    const geography=createHorizonGeography(field,{...empty,waters:[pool('deep',40,7,true)]});
    expect(geography.waterLevel(50,50,40.6)).toBe(40);
    expect(geography.waterLevel(50,50,42)).toBeNull();
    expect(geography.waterLevel(50,50,100)).toBeNull();
  });

  it('preserves offshore sea fallback without flooding a dry floor beneath an underground pool',()=>{
    const seabed={...field,heights:new Float32Array(9).fill(-2)};
    const sea=createHorizonGeography(seabed,empty);
    expect(sea.waterLevel(50,50)).toBe(0);
    expect(sea.waterLevel(50,50,-.5)).toBe(0);
    const layered=createHorizonGeography(seabed,{...empty,waters:[pool('deep',10,2,true)]});
    expect(layered.waterLevel(50,50,-2)).toBeNull();
    expect(layered.waterLevel(50,50)).toBe(0);
  });
});
