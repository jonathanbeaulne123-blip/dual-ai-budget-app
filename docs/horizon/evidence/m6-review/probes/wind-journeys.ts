// Probe W1 (reviewer): the §10 journeys in the build's own wind. The runtime's env uses constantWind() = SOUTH_WIND
// (4 m/s from the south, always, FLIGHT §2.2); test/horizonGliderJourneys.test.ts flies them in still air.
// Same pilots, same flat-ground convention as the test, only the wind differs. Also the Crown launch direction.
import {readFileSync} from 'node:fs';
import {decodeTerrainAsset} from '../../../../../src/harbour/horizon/land/terrain/asset.ts';
import {sampleTerrain} from '../../../../../src/harbour/horizon/land/terrain/index.ts';
import type {LandCuts} from '../../../../../src/harbour/horizon/land/interfaces.ts';
import {buildFlightEnvelope} from '../../../../../src/harbour/horizon/world/sky.ts';
import {SOUTH_WIND,type WindSample} from '../../../../../src/harbour/horizon/movers/shared/wind.ts';
import {liftField} from '../../../../../src/harbour/horizon/movers/glider/lift.ts';
import {padHeading} from '../../../../../src/harbour/horizon/movers/glider/wing.ts';
import {flyCrownToLamp,flyProwToMeadow,flyProwToSands,flyStraight,type JourneyEnv} from '../../../../../src/harbour/horizon/movers/glider/journeys.ts';
const bin=readFileSync('public/horizon/terrain/horizon-geo-1.bin'),field=decodeTerrainAsset(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),'full');
const cuts:LandCuts={beds:[],pads:[],mouths:[],solids:[],waters:[],diagnostics:[]};
const envelope=buildFlightEnvelope(field,cuts);
const still:WindSample={dir:Math.PI,speed:0};
const env=(ground:number,hour:number,wind:WindSample):JourneyEnv=>({wind,lift:liftField(envelope,wind,hour),ground:()=>ground,envelope});
const h=(id:string)=>{const l=envelope.landings.find(l=>l.id===id)!;return 'height' in l?l.height!:0;};
const out:Record<string,unknown>={};
for(const [name,wind] of [['still',still],['south4',SOUTH_WIND]] as const){
  const lamp=flyCrownToLamp(env(0,11,wind));
  const strip=flyStraight(env(h('strip'),2,wind),'crown',[435,690],0,{arriveHeight:h('strip'),stopWithin:40});
  const sands=flyProwToSands(env(h('sands'),15,wind),{thermal:true});
  const meadow=flyProwToMeadow(env(h('reachMeadow'),7,wind));
  out[name]={crownToLamp:{reached:lamp.reached,seconds:+lamp.seconds.toFixed(1),arrival:+lamp.heightInHand.arrival!.toFixed(1)},
    crownToStrip:{reached:strip.reached,seconds:+strip.seconds.toFixed(1),arrival:+strip.heightInHand.arrival!.toFixed(1)},
    prowThermalSands:{reached:sands.reached,arrival:+sands.heightInHand.arrival!.toFixed(1),secondsInThermal:+(sands.measures.secondsInThermal??0).toFixed(1)},
    prowMeadow:{reached:meadow.reached,arrival:+(meadow.heightInHand.arrival??NaN).toFixed(1)}};
}
const ground=(x:number,z:number)=>sampleTerrain(field,x,z);
const crown=envelope.launchPads!.find(p=>p.id==='crown')!.edge;
out.crownLaunchHeading={facingSouth:padHeading(crown,0,(x,z)=>ground(x,z)),facingNorth:padHeading(crown,Math.PI,(x,z)=>ground(x,z)),note:'0 = south, ±π = north (mode.ts yaw)'};
console.log(JSON.stringify(out,null,1));
