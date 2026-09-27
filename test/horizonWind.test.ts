import {expect,it} from 'vitest';
import {constantWind,SOUTH_WIND,windVelocity} from '../src/harbour/horizon/movers/shared/wind.ts';

it('blows from the south at 4 m/s everywhere and always until the wind clock lands',()=>{
  const wind=constantWind();
  for(const [x,y,z,t] of [[0,0,0,0],[1310,160,440,90],[540,25,1195,86_400]] as const)expect(wind.sample(x,y,z,t)).toEqual({dir:Math.PI,speed:4});
  expect(SOUTH_WIND).toEqual({dir:Math.PI,speed:4});
  expect(()=>{(wind.sample(0,0,0,0) as {speed:number}).speed=9;}).toThrow();
});
it('turns a from-direction into the air velocity in engine axes (north is −z)',()=>{
  const [vx,vz]=windVelocity(SOUTH_WIND);expect(vx).toBeCloseTo(0,9);expect(vz).toBeCloseTo(-4,9);
  const west=windVelocity({dir:3*Math.PI/2,speed:2});expect(west[0]).toBeCloseTo(2,9);expect(west[1]).toBeCloseTo(0,9);
  const north=windVelocity({dir:0,speed:1});expect(north[1]).toBeCloseTo(1,9);
  expect(constantWind({dir:Math.PI/2,speed:6}).sample(0,0,0,0)).toEqual({dir:Math.PI/2,speed:6});
});
