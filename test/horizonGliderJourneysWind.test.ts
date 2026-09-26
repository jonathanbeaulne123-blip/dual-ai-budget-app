import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import type {LandCuts} from '../src/harbour/horizon/land/interfaces.ts';
import {buildFlightEnvelope} from '../src/harbour/horizon/world/sky.ts';
import {SOUTH_WIND,constantWind,type WindSample} from '../src/harbour/horizon/movers/shared/wind.ts';
import {liftField} from '../src/harbour/horizon/movers/glider/lift.ts';
import {flyCrownToLamp,flyProwToMeadow,flyProwToSands,flyStraight,type JourneyEnv} from '../src/harbour/horizon/movers/glider/journeys.ts';

// M6 review (R6-03): FLIGHT §0/§10's journeys, flown by the same scripted pilots and the same flat-ground convention as
// test/horizonGliderJourneys.test.ts, but in the wind the build actually flies — `constantWind()`, 4 m/s from the south,
// everywhere, always (FLIGHT §2.2) — instead of still air. The three routes outside the shipped wind envelope are
// explicit ordinary assertions below, so they cannot hide behind an expected-failure marker; they remain deferred
// acceptance routes until the D39 wind/retarget ruling and related land requests are settled.
const bin=readFileSync('public/horizon/terrain/horizon-geo-1.bin'),field=decodeTerrainAsset(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),'full');
const cuts:LandCuts={beds:[],pads:[],mouths:[],solids:[],waters:[],diagnostics:[]};
const envelope=buildFlightEnvelope(field,cuts);
const heightOf=(id:string)=>{const l=envelope.landings.find(l=>l.id===id)!;return 'height' in l?l.height!:0;};
const env=(ground:number,hour=6,wind:WindSample=SOUTH_WIND):JourneyEnv=>({wind,lift:liftField(envelope,wind,hour),ground:()=>ground,envelope});
const SANDS=heightOf('sands'),MEADOW=heightOf('reachMeadow'),STRIP=heightOf('strip');

describe('the journeys in the build\'s wind (4 m/s from the south)',()=>{
  it('is the wind the runtime flies: constantWind() is SOUTH_WIND everywhere, always',()=>{
    const w=constantWind();expect(w.sample(0,0,0,0)).toEqual(SOUTH_WIND);expect(w.sample(1500,300,900,86400)).toEqual({dir:Math.PI,speed:4});
  });
  it('Crown → the Lamp: falls short of the gallery (measured −1.1 m after 136.7 s; still air +17.3 m in 98.1 s)',()=>{
    const j=flyCrownToLamp(env(0));expect(j.reached).toBe(false);expect(j.heightInHand.arrival).toBeCloseTo(-1.1,1);expect(j.seconds).toBeCloseTo(136.7,1);
  });
  it('keeps Crown → the Lamp explicitly deferred under the shipped wind (D39; measured −1.1 m)',()=>{
    const j=flyCrownToLamp(env(0));expect(j.reached).toBe(false);expect(j.heightInHand.arrival).toBeCloseTo(-1.1,1);
  });
  it('Crown → the strip still arrives, with 1.4 m in hand (still air 21.3 m)',()=>{
    const j=flyStraight(env(STRIP,2),'crown',[435,690],0,{arriveHeight:STRIP,stopWithin:40});
    expect(j.reached).toBe(true);expect(j.heightInHand.arrival).toBeCloseTo(1.4,1);
  });
  it('keeps Prow → thermal → Long Sands explicitly deferred under the shipped wind (D39; measured −6.4 m)',()=>{
    const j=flyProwToSands(env(SANDS,15),{thermal:true});expect(j.reached).toBe(false);expect(j.heightInHand.arrival).toBeCloseTo(-6.4,1);
  });
  it('keeps Prow → Reach meadow explicitly deferred under the shipped wind (D39; measured −5.5 m)',()=>{
    const j=flyProwToMeadow(env(MEADOW,7));expect(j.reached).toBe(false);expect(j.heightInHand.arrival).toBeCloseTo(-5.5,1);
  });
});
