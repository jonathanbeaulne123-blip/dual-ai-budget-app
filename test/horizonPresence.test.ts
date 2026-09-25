import {describe,it,expect} from 'vitest';
import {createWorldTrack} from '../src/ledgerSync/worldMotion.ts';
import {decodeWorldPresence} from '../src/ledgerSync/worldPresenceWire.ts';
import {HORIZON_PRESENCE_WORLD as world,HORIZON_WORLD_BOUNDS as bounds,isPresenceWorld} from '../src/worldGeography.ts';
import {HORIZON_MANIFEST as m,requireScaleFactor} from '../src/harbour/horizon/world/manifest.ts';
const step={type:'world-step',version:1,world,x:1455,y:24,z:1200,yaw:.3,moving:true};
describe('Horizon presence trust boundary',()=>{
 it('retains full-scale coordinates and bounds the complete height envelope',()=>{
  expect(decodeWorldPresence(step)).toEqual(step);
  expect(decodeWorldPresence({...step,x:3000,z:3000,y:600})).toMatchObject({x:2000,z:1800,y:300});
  expect(decodeWorldPresence({...step,x:-5,z:-5,y:-200})).toMatchObject({x:0,z:0,y:-100});
  expect(bounds.maxX).toBe(m.extent.w*requireScaleFactor());expect(bounds.maxZ).toBe(m.extent.h*requireScaleFactor());expect(bounds.maxY).toBe(m.sky.ceiling_m*requireScaleFactor());
 });
 it('does not widen Mountain and refuses unknown revisions, absurd values or identity/money payloads',()=>{
  expect(decodeWorldPresence({...step,world:'hearth-mountain-geo-2'})).toMatchObject({x:180,z:84,y:24});
  for(const change of [{world:'horizon:horizon-geo-2'},{x:NaN},{z:Infinity},{x:1e9},{memberId:'forged'},{cents:100}])expect(()=>decodeWorldPresence({...step,...change})).toThrow();
  expect(isPresenceWorld('horizon:horizon-geo-0')).toBe(false);
 });
});


it('extrapolates a late Horizon peer within Horizon bounds rather than the legacy circular island',()=>{
 const track=createWorldTrack({renderDelayMs:0});
 track.push({world,x:1455,z:1200,y:24,yaw:0,moving:true,at:1000});
 track.push({world,x:1455.2,z:1200,y:24,yaw:0,moving:true,at:1100});
 expect(track.pose(1200)).toMatchObject({x:1455.4,z:1200,y:24});
});
