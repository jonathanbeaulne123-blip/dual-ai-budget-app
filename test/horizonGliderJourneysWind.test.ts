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
  // v2.2 (the lookout launch, h 170): the wing now reaches the gallery's line, but at its height (−0.1 m in hand after 132.95 s;
  // still air +30.9 m in 95.2 s). Was −1.1 m after 136.7 s from the v1.6 launch.
  // v2.6 (D-M6): the launch moved to [1322,472] (still h 170), 17 m further from the gallery: −1.2 m in hand after 135.25 s
  // (still air +28.8 m in 96.9 s). Was −0.1 m after 132.95 s from [1305,482].
  it('Crown → the Lamp: reaches the gallery with no height in hand (measured −1.2 m after 135.25 s; still air +28.8 m in 96.9 s)',()=>{
    const j=flyCrownToLamp(env(0));expect(j.reached).toBe(true);expect(j.heightInHand.arrival).toBeCloseTo(-1.22,1);expect(j.seconds).toBeCloseTo(135.25,1);
  });
  it('keeps Crown → the Lamp explicitly deferred under the shipped wind (D39; measured −1.2 m in hand: no margin; v2.5 −0.1 m)',()=>{
    const j=flyCrownToLamp(env(0));expect(j.heightInHand.arrival).toBeLessThan(10);expect(j.heightInHand.arrival).toBeCloseTo(-1.22,1);   // v2.6: was −0.1
  });
  it('Crown → the strip still arrives, with 11.8 m in hand (v2.6 launch [1322,472]; 14.3 m from v2.5\'s; 1.4 m before v2.2)',()=>{
    const j=flyStraight(env(STRIP,2),'crown',[435,690],0,{arriveHeight:STRIP,stopWithin:40});
    expect(j.reached).toBe(true);expect(j.heightInHand.arrival).toBeCloseTo(11.76,1);   // v2.6 (D-M6): was 14.3
  });
  it('keeps Prow → thermal → Long Sands explicitly deferred under the shipped wind (D39; measured −0.46 m on the D-WW90 field, −2.6 on the v2.1 field, −6.4 on the v1.6 land)',()=>{
    const j=flyProwToSands(env(SANDS,15),{thermal:true});expect(j.reached).toBe(false);expect(j.heightInHand.arrival).toBeCloseTo(-0.46,1);   // D-WW90: the field moved nearer the Prow (was −2.6); still short
  });
  it('keeps Prow → Reach meadow explicitly deferred under the shipped wind (D39; measured −7.1 m to the v2.4 meadow; −14.3 m to v2.1\'s; −5.5 m on the v1.6 land)',()=>{
    const j=flyProwToMeadow(env(MEADOW,7));expect(j.reached).toBe(false);expect(j.heightInHand.arrival).toBeCloseTo(-7.08,1);
  });
});
