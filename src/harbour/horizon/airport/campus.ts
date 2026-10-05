import * as THREE from 'three';
import type {HorizonGeography} from '../movers/shared/registry.ts';
import type {MoverBody,ModeId} from '../movers/shared/mode.ts';
import type {VehicleDressing} from '../movers/shared/vehicleArt.ts';
import {AIRCRAFT,AIRCRAFT_IDS,type AircraftId} from './aircraft.ts';
import {AIRPORT,AIRPORT_SEATS} from './layout.ts';
import {newAircraft,restoreAircraft,aircraftExit,createAircraftController,type AircraftState} from './flight.ts';
import {airportArt,aircraftArt} from './art.ts';
import {airportGeography} from './geography.ts';
export type AirportAction={id:string;label:string};
export function createAirport(scene:THREE.Scene,geography:HorizonGeography,theme:VehicleDressing,storage:{load():unknown;save(states:AircraftState[]):void},wind?:()=>readonly[number,number]){
 let aircraft=AIRCRAFT_IDS.map(id=>newAircraft(id)),saveFailed=false;
 try{const data=storage.load();aircraft=restoreAircraft(data)??aircraft;}catch{/* Exactly three default aircraft; no airborne controller restored. */}
 let art=airportArt(theme),planes=aircraft.map(s=>aircraftArt(s.id,theme));scene.add(art.root,...planes.map(p=>p.root));
 const off=geography.addDynamic(airportGeography());
 let seated:typeof AIRPORT_SEATS[number]|null=null;
 const selected=()=>aircraft.find(s=>s.occupied)??null;
 function save(){try{storage.save(aircraft);saveFailed=false;}catch{saveFailed=true;}}
 const near=(b:MoverBody,x:number,y:number,z:number,r:number)=>Math.hypot(b.x-x,b.y-y,b.z-z)<r;
 function actions(body:MoverBody,mode:ModeId):AirportAction[]{
  const s=selected();if(s&&mode==='plane')return[{id:'exit',label:s.grounded?'Park & get out':'Leave aircraft · freefall'},...(s.disabled?[{id:'recover:'+s.id,label:'Recover aircraft to its stand'}]:[])];
  if(mode!=='feet')return[];if(seated)return[{id:'stand',label:'Stand up'}];
  const out:AirportAction[]=[];for(const seat of AIRPORT_SEATS)if(near(body,seat.x,38,seat.z,1.8))out.push({id:'sit:'+seat.id,label:'Sit and watch the airfield'});
  for(const s of aircraft)if(!s.disabled&&s.grounded&&near(body,s.x,s.y,s.z,4.5))out.push({id:'board:'+s.id,label:`Fly ${AIRCRAFT[s.id].name}`});
  if(near(body,399,38,665,6))out.push({id:'info',label:'Read the flight board'});
  if(near(body,394,38,650,10))for(const s of aircraft)if(s.disabled||Math.hypot(s.x-AIRPORT.stands[s.id].x,s.z-AIRPORT.stands[s.id].z)>3)out.push({id:'recover:'+s.id,label:`Bring ${AIRCRAFT[s.id].name} back to its stand`});
  return out;
 }
 function recover(id:AircraftId){const s=aircraft.find(s=>s.id===id);if(!s)return false;const at=AIRPORT.stands[id];if(aircraft.some(p=>p!==s&&(p.grounded||!p.disabled)&&Math.hypot(p.x-at.x,p.z-at.z)<(AIRCRAFT[p.id].wing+AIRCRAFT[id].wing)/2+1))return false;Object.assign(s,newAircraft(id));save();return true;}
 return{aircraft,selected,actions,recover,save,seated:()=>seated,stand(){seated=null;},sit(id:string){seated=AIRPORT_SEATS.find(s=>s.id===id)??null;return seated;},
  controller(id:AircraftId){const s=aircraft.find(s=>s.id===id)!;return createAircraftController(s,{...geography,wind,blocked(x,z,y,r){if(geography.blocked(x,z,y,r))return true;return aircraft.some(other=>other!==s&&(other.grounded||!other.disabled)&&Math.abs(y-other.y)<2.5&&Math.hypot(x-other.x,z-other.z)<1.5);}});},
  exit:()=>{const s=selected();return s?aircraftExit(s,geography):null;},
  power(value:number){const s=selected();if(s&&!s.disabled){s.throttle=Math.max(0,Math.min(1,value));s.brake=false;}},
  /** One tap on the ground: full-ish power and an assisted rotation. The pilot's own pitch input takes over at once. */
  takeoff(){const s=selected();if(!s||s.disabled||!s.grounded)return false;s.throttle=.85;s.brake=false;s.takeoff=true;return true;},brake(on:boolean){const s=selected();if(s)s.brake=on;},
  state(){const s=selected();return{selected:s?.id??null,power:s?Math.round(s.throttle*100):0,speed:s?Math.round(s.speed*3.6):0,grounded:s?.grounded??true,disabled:s?.disabled??false,assist:s?.takeoff??false,pitch:s?.pitch??0,bank:s?.bank??0,velocity:s?[s.vx,s.vy,s.vz]:[0,0,0],saveFailed,inventory:aircraft.map(p=>({id:p.id,name:AIRCRAFT[p.id].name,available:!p.disabled,at:{x:p.x,y:p.y,z:p.z}}))};},
  update(dt:number,journey:boolean,eye:THREE.Vector3,night:number,firstPerson:boolean){art.update(journey,eye,night,wind?.());planes.forEach((p,i)=>{p.update(aircraft[i]!,dt,firstPerson&&aircraft[i]!.occupied);if(journey)p.root.visible=false;});},
  setTheme(next:VehicleDressing){art.dispose();planes.forEach(p=>p.dispose());art=airportArt(next);planes=aircraft.map(s=>aircraftArt(s.id,next));scene.add(art.root,...planes.map(p=>p.root));},
  dispose(){save();off();art.dispose();planes.forEach(p=>p.dispose());},
 };
}
