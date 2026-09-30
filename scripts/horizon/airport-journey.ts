// Verification only: complete flights on the baked island using production physics, wind and parked-aircraft collision.
import {readFileSync,writeFileSync} from 'node:fs';
import {constantWind,windVelocity} from '../../src/harbour/horizon/movers/shared/wind.ts';
import {decodeTerrainAsset} from '../../src/harbour/horizon/land/terrain/asset.ts';
import {createHorizonGeography} from '../../src/harbour/horizon/runtime/geography.ts';
import {airportGeography} from '../../src/harbour/horizon/airport/geography.ts';
import {AIRCRAFT_IDS,AIRCRAFT} from '../../src/harbour/horizon/airport/aircraft.ts';
import {AIRPORT} from '../../src/harbour/horizon/airport/layout.ts';
import {newAircraft,stepAircraft,aircraftExit,PLANE} from '../../src/harbour/horizon/airport/flight.ts';
const base=process.cwd()+'/';
const w=JSON.parse(readFileSync(base+'public/horizon/world/horizon-geo-1.json','utf8')),bytes=readFileSync(base+'public/horizon/terrain/horizon-geo-1.bin'),geo=createHorizonGeography(decodeTerrainAsset(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),{...w.collision,solids:w.geometry.solids,diagnostics:[]});geo.addDynamic(airportGeography());const wind=windVelocity(constantWind().sample(0,0,0,0));
const clamp=(v:number,a=-1,b=1)=>Math.max(a,Math.min(b,v)),wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));const reports=[];
for(const id of AIRCRAFT_IDS){const s=newAircraft(id);s.occupied=true;const spec=AIRCRAFT[id],log=[];let time=0;const others=AIRCRAFT_IDS.filter(v=>v!==id).map(v=>newAircraft(v));const env={...geo,wind:()=>wind,blocked(x:number,z:number,y:number,r:number){return geo.blocked(x,z,y,r)||others.some(o=>Math.abs(y-o.y)<2.5&&Math.hypot(x-o.x,z-o.z)<1.5);}};
 function go(x:number,z:number,y:number|undefined,seconds=100){const flying=y!==undefined;s.throttle=flying?(spec.stall+7)/spec.max:.09;let reached=false;for(let n=0;n<seconds/PLANE.step;n++){const dist=Math.hypot(s.x-x,s.z-z);if(dist<(flying?40:2)){reached=true;break;}const want=Math.atan2((x-s.x)/dist*s.speed,(z-s.z)/dist*s.speed-(flying?wind[1]:0)),error=wrap(want-s.yaw);const pitch=flying?clamp((y!-s.y)*.018,-.2,.2):0;stepAircraft(s,{steer:clamp(-error*(flying?2:1.3)),forward:s.grounded?(flying?-.7:0):clamp((s.pitch-pitch)*6)},env);time+=PLANE.step;if(s.disabled)break;}
 log.push({target:[x,y,z],reached,at:{...s},time});return reached&&!s.disabled;}
 let ok=go(435,AIRPORT.stands[id].z,undefined)&&go(429,552,undefined)&&go(433,575,undefined)&&go(449,920,95)&&go(700,1100,95)&&go(700,250,95)&&go(420,150,65)&&go(428,500,42);
 if(ok){s.throttle=(spec.stall+2)/spec.max;for(let n=0;n<60/PLANE.step&&!s.grounded&&!s.disabled;n++){const desired=Math.atan2(445-s.x,850-s.z);stepAircraft(s,{steer:clamp(-wrap(desired-s.yaw)*2),forward:clamp((s.pitch-(-.055))*7)},env);time+=PLANE.step;}log.push({landing:{...s},time});ok=s.grounded&&!s.disabled;}
 if(ok){s.throttle=0;s.brake=true;for(let n=0;n<8/PLANE.step;n++)stepAircraft(s,{forward:0,steer:0},env);s.brake=false;ok=go(435,AIRPORT.stands[id].z,undefined)&&go(AIRPORT.stands[id].x,AIRPORT.stands[id].z,undefined);s.throttle=0;s.brake=true;for(let n=0;n<8/PLANE.step;n++)stepAircraft(s,{forward:0,steer:0},env);}
 reports.push({id,ok,exit:aircraftExit(s,geo),log});console.log(id,ok,log.at(-1));}
writeFileSync(process.env.AIRPORT_REPORT??'/tmp/airport-flight-journeys.json',JSON.stringify(reports,null,2));
if(reports.some(r=>!r.ok||!r.exit))process.exitCode=1;
