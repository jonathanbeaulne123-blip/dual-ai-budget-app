import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {decodeTerrainAsset} from '../src/harbour/horizon/land/terrain/asset.ts';
import {sampleTerrain} from '../src/harbour/horizon/land/terrain/index.ts';
import type {LandCuts} from '../src/harbour/horizon/land/interfaces.ts';
import {buildFlightEnvelope} from '../src/harbour/horizon/world/sky.ts';
import {HORIZON_MANIFEST} from '../src/harbour/horizon/world/manifest.ts';
import {SOUTH_WIND,type WindSample} from '../src/harbour/horizon/movers/shared/wind.ts';
import {liftField} from '../src/harbour/horizon/movers/glider/lift.ts';
import {launchWing} from '../src/harbour/horizon/movers/glider/wing.ts';
import {resolveTouchdown,type LandingContext} from '../src/harbour/horizon/movers/glider/landing.ts';
import {closestApproach,flyCrownToLamp,flyDamRun,flyLampHop,flyProwToMeadow,flyProwToSands,flyThroatRun,workRidge,type Journey,type JourneyEnv} from '../src/harbour/horizon/movers/glider/journeys.ts';

// FLIGHT.md §10 row 3, flown by scripted bar/bank inputs through the pure `stepWing`.
//
// The envelope (launch pads, landing-field heights, volumes, gates) is built from the REAL baked terrain
// (public/horizon/terrain/horizon-geo-1.bin, 0.6 MB, decoded in a few ms). The wing's `ground` during these flights is
// a flat surface at the destination's height (sea level 0 over the sea / the Bight; the field's baked height for the
// Sands and the Reach meadow): §10's numbers are the flight model's arithmetic, and the baked heightfield puts three
// of the straight lines into terrain (the summit shoulder, a knoll on the Prow → meadow line, the north face in front
// of the Throat's mouth — the heightfield has no carve before the mouth mask at z 291). Those replays are measured
// separately at the bottom of this file and reported, never hidden.
//
// v2.2 (reconciled with Stage A, 27 Sep): the envelope is the v2.1 land's — the Crown launch is the summit lookout's run-off
// deck ([1305,482] h 170; it was [1310,440] h 160), gate 12 is centred on the built mouth (h 119, 24 × 16; aperture floor
// 111, was 101), the Reach meadow is [1143,1167] (was [1230,1190]) and the Sands [1095,1362] (was [1050,1440]). The flight
// model is unchanged; every measured number below is re-measured on that land, and each changed verdict says so.
const bin=readFileSync('public/horizon/terrain/horizon-geo-1.bin'),field=decodeTerrainAsset(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),'full');
const cuts:LandCuts={beds:[],pads:[],mouths:[],solids:[],waters:[],diagnostics:[]};
const envelope=buildFlightEnvelope(field,cuts);
const still:WindSample={dir:Math.PI,speed:0};
const heightOf=(id:string)=>{const l=envelope.landings.find(l=>l.id===id)!;return 'height' in l?l.height!:0;};
const env=(ground:number,hour=6,wind:WindSample=still):JourneyEnv=>({wind,lift:liftField(envelope,wind,hour),ground:()=>ground,envelope});
const SANDS=heightOf('sands'),MEADOW=heightOf('reachMeadow');
const flared=(j:Journey)=>j.final.touch!.airspeed<=9&&j.final.touch!.sink<=1.5;

describe('Crown → the Lamp',()=>{
  const j=flyCrownToLamp(env(0)),target=HORIZON_MANIFEST.journeys.targets_s['crown→lamp by glider'] as number[];
  it('arrives at the gallery with ≥ 10 m in hand (measured 30.9 m from the lookout launch; 17.3 m from the v1.6 launch)',()=>{
    expect(j.reached).toBe(true);expect(j.heightInHand.arrival).toBeGreaterThanOrEqual(10);expect(j.heightInHand.arrival).toBeCloseTo(30.9,1);
  });
  it('keeps the straight line ≥ 200 m from the Bight sink\'s centre (measured 277.3 m)',()=>{
    expect(closestApproach(j.path,[600,760])).toBeGreaterThanOrEqual(200);
    expect(j.path.every(p=>p.lift>=0)).toBe(true);
  });
  it('takes a time inside journeys.targets_s (v2.2: Stage A\'s 85–120 s stands, D34\'s 70–110 kept beside it; measured 95.2 s)',()=>{
    expect(target).toEqual([85,120]);expect(j.seconds).toBeGreaterThanOrEqual(target[0]!);expect(j.seconds).toBeLessThanOrEqual(target[1]!);expect(j.seconds).toBeCloseTo(95.2,1);
    expect(j.seconds).toBeGreaterThanOrEqual(70);expect(j.seconds).toBeLessThanOrEqual(110);   // inside D34's range too
  });
});

describe('the Prow → Long Sands and the Reach meadow',()=>{
  // CHANGED on the v2.1 land (open item, RECONCILE.md): Stage A moved the Sands landing 88 m nearer the Prow, so the straight
  // glide now arrives (+3.5 m) and the afternoon thermal is no longer what earns the Sands (FLIGHT: 'Long Sands (afternoon)').
  it('reaches the Sands in still air straight from the Prow on the v2.1 land (+3.5 m in hand; −2.0 m on the v1.6 land)',()=>{
    for(const hour of [7,14]){const j=flyProwToSands(env(SANDS,hour));expect(j.reached).toBe(true);expect(j.heightInHand.arrival).toBeCloseTo(3.5,1);}
  });
  it('does not reach it at 07:00 by the thermal either: the Prow thermal is off before 08:00',()=>{
    const j=flyProwToSands(env(SANDS,7),{thermal:true});expect(j.reached).toBe(false);
  });
  it('reaches the Sands at 14:00 after ≤ 60 s in the Prow thermal (measured 1.6 s in the core, 24.7 m in hand)',()=>{
    const j=flyProwToSands(env(SANDS,14),{thermal:true});
    expect(j.reached).toBe(true);expect(j.measures.secondsInThermal).toBeLessThanOrEqual(60);expect(j.heightInHand.arrival).toBeGreaterThan(0);
    expect(j.heightInHand.arrival).toBeCloseTo(24.7,1);
    expect(j.path.some(p=>p.lift>1)).toBe(true);
  });
  // REDUCED on the v2.1 land: the meadow moved 90 m west ([1143,1167]); 9.9 m in hand at the field edge (was 24.5).
  it('reaches the Reach meadow at any hour and walks off it (9.9 m in hand at the field edge)',()=>{
    for(let hour=0;hour<24;hour+=1){
      const j=flyProwToMeadow(env(MEADOW,hour));
      expect(j.reached).toBe(true);expect(j.heightInHand.arrival).toBeGreaterThan(5);expect(j.heightInHand.arrival).toBeCloseTo(9.9,1);expect(j.final.phase).toBe('touchdown');expect(flared(j)).toBe(true);
    }
  });
});

describe('the courses',()=>{
  // REGRESSED on the v2.1 land (open item, RECONCILE.md): both gates are threaded (the scripted pilot's S-turns now stop
  // 80 m out, journeys.ts), but the v1.7 Reach meadow is 120 m west-south-west of the High Span (gate 3 at h 17, 40 × 12):
  // the wing touches down 127 m from its centre, short of the field. Was: onto the meadow in 64.2 s.
  it('Dam Run: through the spillway arch (±6 × ±6) and under the High Span (40 × 12); lands 127 m short of the v2.1 meadow',()=>{
    const j=flyDamRun(env(MEADOW));
    expect(j.gates.map(g=>g.id)).toEqual(['damArch','highSpan']);
    expect(j.gates.every(g=>g.inside)).toBe(true);
    expect(Math.abs(j.heightInHand.gate4!)).toBeLessThanOrEqual(6);expect(Math.abs(j.heightInHand.gate3!)).toBeLessThanOrEqual(6);
    expect(j.reached).toBe(false);expect(j.measures.touchdownFromMeadow).toBeCloseTo(127.4,0);expect(flared(j)).toBe(true);
    expect(j.path.some(p=>p.airspeed>=16.9)).toBe(true);
  });
  it('Lamp Hop: under the Bight Bridge (gate 5), onto the Bight, a fade to the sandbar (measured 13.5 s)',()=>{
    const j=flyLampHop(env(0));
    expect(j.gates).toHaveLength(1);expect(j.gates[0]!.inside).toBe(true);expect(j.reached).toBe(true);
    const sandbar={id:'shore.sandbar',at:[600,1,1110] as const,label:'the sandbar'};
    const ctx:LandingContext={surface:()=>({y:-8,slope:1,material:'sand',walkable:true}),water:()=>({id:'water.bight',y:0}),district:()=>({id:'bight',kind:'wild'}),nearestShoreNode:()=>sandbar,nearestApron:()=>null,inHostFootprint:()=>false,envelope};
    const {x,y,z,touch}=j.final;
    expect(resolveTouchdown(ctx,{x,y,z},{airspeed:touch!.airspeed,sink:touch!.sink})).toMatchObject({kind:'fadeShore',node:sandbar,label:'→ the sandbar',wet:20});
  });
});

describe('the Throat Run',()=>{
  const base=flyThroatRun(env(0));
  // CHANGED on the v2.1 land (open item): at trim from the lookout launch (10 m higher) the wing crosses gate 10 9.2 m over its
  // centre, 1.2 m above the ±8 aperture (was +3.8, inside); gate 10 (north face, h 130) was not re-seated with the launch.
  it('flies the 25 m-radius turn, lines up on the axis and reaches the mouth plane (measured mouth −9.9 m, gate 10 +9.2 m, 54.5 s)',()=>{
    expect(base.gates[0]).toMatchObject({id:'northFace',inside:false});expect(base.gates[0]!.vertical).toBeCloseTo(9.2,1);
    expect(base.measures.turnRadius).toBeCloseTo(25,1);expect(base.measures.turnOffset).toBeCloseTo(50,0);
    expect(Math.abs(base.measures.mouthLateral!)).toBeLessThan(1);expect(Math.abs(base.measures.mouthHeading!)).toBeLessThan(25*Math.PI/180);expect(Math.abs(base.measures.mouthBank!)).toBeLessThan(20*Math.PI/180);
    expect(base.heightInHand.mouth).toBeCloseTo(-9.9,1);
  });
  // The Throat is earned (design lead, 26 Sep). FLIGHT §0 estimated ~1 m in hand for Crown → gate 10 → 60 m out → 180° at
  // 25 m → back in. Flown, the track is 240 + 60 + 79 + ~165 m plus the turn's 1/cos(45°) and the S-turn's bank: the
  // wing reaches the mouth's plane 5.2 m under the aperture floor (101) — close, not in. Straight from the Crown is a miss.
  it('reaches the mouth\'s plane from the Crown in still air with ≥ −10 m in hand (measured −9.9 m under the v2.2 floor 111: a miss)',()=>{
    expect(base.heightInHand.mouth).toBeGreaterThanOrEqual(-10);expect(base.heightInHand.mouth).toBeLessThan(0);expect(base.reached).toBe(false);
  });
  // v2.2: the mouth is 10 m higher (the gate-centred aperture's floor is 111), so the ridge that earns the Throat is 210 m
  // (129 s of beating from the lookout launch; 190 m in 126 s on the v1.6 land). 190 m now arrives 6.9 m under the floor.
  const ridge=workRidge(env(0,6,SOUTH_WIND),210),after=flyThroatRun(env(0,6,SOUTH_WIND),{from:ridge.final});
  it('190 m of ridge is no longer enough on the v2.1 land (mouth −6.9 m, a miss)',()=>{
    const low=workRidge(env(0,6,SOUTH_WIND),190),miss=flyThroatRun(env(0,6,SOUTH_WIND),{from:low.final});
    expect(low.reached).toBe(true);expect(miss.reached).toBe(false);expect(miss.heightInHand.mouth).toBeCloseTo(-6.9,1);
  });
  it('works the ridge to 210 m in the 4 m/s south wind (measured 129 s beating), then enters the Throat and splashes',()=>{
    expect(ridge.reached).toBe(true);expect(ridge.final.y).toBeGreaterThanOrEqual(210);expect(ridge.measures.secondsOnRidge).toBeCloseTo(129.5,0);
    expect(ridge.path.some(p=>p.lift>=2-1e-9)).toBe(true);
    expect(after.reached).toBe(true);expect(after.measures.insideAperture).toBe(1);expect(after.heightInHand.mouth).toBeCloseTo(12.7,1);
    expect(after.corridor).toMatchObject({phase:'touchdown',splash:'big',echoes:3});
    expect(Math.abs(after.corridor!.z-420)).toBeLessThanOrEqual(10);
  });
  // FLIGHT §0 as ruled: the ridge earns the Throat. The ridge sits 230 m south of the launch, so the flight back north with
  // the tailwind, the turn's drift and the 160 m leg into the 4 m/s wind eat most of the gain: +2.6 m, but inside.
  it('enters the corridor after ridge to 210 m in the south wind: ≥ 0 m in hand, inside the aperture (measured +12.7 m)',()=>{
    expect(after.heightInHand.mouth).toBeGreaterThanOrEqual(0);expect(after.measures.insideAperture).toBe(1);expect(after.reached).toBe(true);
  });
  it('turns ridge height into mouth height one for one in still air (from over the Crown at 190 m, 20 m over the h 170 launch: measured 10.5 m in hand)',()=>{
    const crown=envelope.launchPads!.find(p=>p.id==='crown')!,high=flyThroatRun(env(0),{from:{...launchWing(crown.edge,Math.PI),y:190}});
    expect(high.heightInHand.mouth!-base.heightInHand.mouth!).toBeCloseTo(190-crown.edge[0]![1],0);expect(high.heightInHand.mouth).toBeCloseTo(10.5,1);
    // 10.5 m over the floor is inside the 16 m aperture (was 24.8 m over the v1.6 floor, above its 18 m top).
  });
});

describe('the same flights over the baked terrain (report)',()=>{
  // Clearance above max(terrain, sea level) along each recorded path, from 1 s after launch (the graded pad's lip).
  const clearance=(j:Journey)=>{let min=Infinity;for(const p of j.path){if(p.phase==='touchdown'||p.t<1)continue;min=Math.min(min,p.y-Math.max(0,sampleTerrain(field,p.x,p.z)));}return min;};
  it('Crown → Lamp clears the summit\'s south-west shoulder (measured +12.3 m from the lookout launch; +0.4 m on the v1.6 land)',()=>{expect(clearance(flyCrownToLamp(env(0)))).toBeGreaterThanOrEqual(0);});
  it('Prow → thermal → Sands clears the terrain (measured +21.5 m)',()=>{expect(clearance(flyProwToSands(env(SANDS,14),{thermal:true}))).toBeGreaterThanOrEqual(0);});
  it('Lamp Hop clears the terrain',()=>{expect(clearance(flyLampHop(env(0)))).toBeGreaterThanOrEqual(0);});
  it('keeps the Prow → Reach meadow land request visible (measured −21.7 m at [1410, 866]; −13.4 m at [1450, 872] on the v1.6 land)',()=>{expect(clearance(flyProwToMeadow(env(MEADOW,7)))).toBeCloseTo(-21.7,1);});
  it('keeps the Dam Run land request visible (measured −1.8 m at [1300, 656]; −18.9 m at [1300, 621] on the v1.6 land)',()=>{expect(clearance(flyDamRun(env(MEADOW)))).toBeCloseTo(-1.8,1);});
  // RESOLVED on the v2.1 land: the ridge approach cleared −5.5 m at [1310, 535] (the old gondola top-station shoulder); from
  // the lookout launch it clears +11.1 m.
  it('clears the Crown ridge approach (measured +11.1 m; −5.5 m at [1310, 535] on the v1.6 land)',()=>{expect(clearance(workRidge(env(0,6,SOUTH_WIND),210))).toBeCloseTo(11.1,1);});
  it('keeps the Throat approach land request visible (measured −29.9 m before the mouth; −35.3 m on the v1.6 land)',()=>{expect(clearance(flyThroatRun(env(0)))).toBeCloseTo(-29.9,1);});
});
