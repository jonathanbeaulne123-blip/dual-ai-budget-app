import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../src/harbour/horizon/runtime/geography.ts';
import {airportGeography} from '../src/harbour/horizon/airport/geography.ts';
import {AIRPORT,AIRPORT_DECKS} from '../src/harbour/horizon/airport/layout.ts';
import {AIRCRAFT_IDS} from '../src/harbour/horizon/airport/aircraft.ts';
import {newAircraft,stepAircraft,PLANE} from '../src/harbour/horizon/airport/flight.ts';
import {createCruiserState,stepCruiser,cruiserDismount} from '../src/harbour/horizon/movers/cruiser/sim.ts';
import type {WorldDefinition} from '../src/harbour/horizon/world/definition.ts';
const world=JSON.parse(readFileSync('public/horizon/world/horizon-geo-1.json','utf8')) as WorldDefinition;
const bytes=readFileSync('public/horizon/terrain/horizon-geo-1.bin');
const geo=createHorizonGeography(decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),{...world.collision!,solids:world.geometry!.solids,diagnostics:[]});geo.addDynamic(airportGeography());
describe('Airport on the actual baked island',()=>{
 it('connected walking surfaces reach terminal, terrace, hangar and observation roof',()=>{
  for(const d of AIRPORT_DECKS){for(let i=0;i<=30;i++){const f=i/30,x=d.a[0]+(d.b[0]-d.a[0])*f,z=d.a[2]+(d.b[2]-d.a[2])*f,y=d.a[1]+(d.b[1]-d.a[1])*f,s=geo.surface(x,z,y);expect(s?.y,`${d.id} ${x},${z} support`).toBeCloseTo(y,1);expect(geo.blocker(x,z,y),`${d.id} ${x},${y},${z}`).toBeNull();}}
 });
 it('the mounted cruiser clears the terminal floor and drives in and back out',()=>{
  let s=createCruiserState({x:AIRPORT.roadEdge[0],y:AIRPORT.roadEdge[1],z:AIRPORT.roadEdge[2],yaw:1.673});
  const points=[[377.389,691.312],[378,685],[378,659],[378,650],[389,650],[378,650],[378,659],[378,685],[377.389,691.312],[367.439,692.332]] as const;
  for(const [x,z]of points){let reached=false;for(let n=0;n<7200;n++){const dx=x-s.x,dz=z-s.z;if(Math.hypot(dx,dz)<1.2){reached=true;break;}const e=Math.atan2(Math.sin(Math.atan2(dx,dz)-s.yaw),Math.cos(Math.atan2(dx,dz)-s.yaw));s=stepCruiser(s,{forward:Math.abs(e)>1?0:.24,steer:Math.max(-1,Math.min(1,-e*2)),jump:false},geo);}
   expect(reached,JSON.stringify({target:[x,z],state:s})).toBe(true);expect(s.grounded).toBe(true);
  }expect(cruiserDismount(geo,s)).not.toBeNull();
 });
 it('road edge joins the current road height',()=>{const [x,y,z]=AIRPORT.roadEdge;const staticSurface=geo.staticOnly.surface(x,z,y+.3);expect(staticSurface?.y).toBeCloseTo(y,1);});
 for(const id of AIRCRAFT_IDS)it(`${id} takes off along the real runway without terrain collision`,()=>{const a=AIRPORT.runway.a,b=AIRPORT.runway.b,s=newAircraft(id,{x:a[0]+1,y:38,z:a[2]+17,yaw:Math.atan2(b[0]-a[0],b[2]-a[2])});s.occupied=true;s.throttle=.9;for(let n=0;n<12/PLANE.step;n++){stepAircraft(s,{forward:s.grounded?-.5:Math.max(-1,Math.min(1,(s.pitch-.15)*8)),steer:0},geo);if(s.disabled)break;}expect(s.disabled,JSON.stringify(s)).toBe(false);expect(s.grounded).toBe(false);expect(s.y).toBeGreaterThan(40);});
 it('terminal doors and roof ramp connect to actual floors',()=>{for(const [x,y,z]of [[394,38,662],[405,38,675],[382,42.2,685]]){expect(geo.blocker(x!,z!,y!)).toBeNull();expect(geo.surface(x!,z!,y!)?.y).toBeCloseTo(y!,1);}});
});
