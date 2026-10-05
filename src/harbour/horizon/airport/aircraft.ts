/** Three authored airframes, one set of controls. Units are metres and seconds. */
export const AIRCRAFT = {
  kestrel: {name:'Kestrel',description:'A gentle high-wing bush plane. The easiest first flight.',wing:10,length:7,rotation:13,stall:10,max:36,acceleration:4.4,pitchRate:.42,bankLimit:.58,rollRate:1.05,yawRate:.5,color:'#e8b746',trim:'#314f56',cockpit:1.15},
  swift: {name:'Swift',description:'An open-cockpit biplane. Light, responsive and playful.',wing:8.5,length:6.5,rotation:14,stall:11,max:43,acceleration:5,pitchRate:.62,bankLimit:.82,rollRate:1.65,yawRate:.75,color:'#be5541',trim:'#f4e5c9',cockpit:1.05},
  heron: {name:'Heron',description:'A steady twin-engine tourer. Broad wings and long island views.',wing:14,length:10,rotation:18,stall:14,max:48,acceleration:3.4,pitchRate:.31,bankLimit:.5,rollRate:.7,yawRate:.34,color:'#d9e6de',trim:'#347b80',cockpit:1.4},
} as const;
export type AircraftId=keyof typeof AIRCRAFT;
export const AIRCRAFT_IDS=Object.keys(AIRCRAFT) as AircraftId[];
export const FLIGHT_CONTROLS='[ / ] power · A / D bank · Q / R rudder · S climb, W descend · X brake on ground · E exit · Space parachute · C view';
export type ThrottleDetent={id:'idle'|'taxi'|'approach'|'cruise'|'full';label:string;value:number};
const round2=(v:number)=>Math.round(v*100)/100;
/** The lever's notches, lowest first. Approach sits a few m/s above the airframe's stall so a landing is one tap. */
export function throttleDetents(id:AircraftId):ThrottleDetent[]{
  const a=AIRCRAFT[id];
  return[{id:'idle',label:'Idle',value:0},{id:'taxi',label:'Taxi',value:.13},{id:'approach',label:'Approach',value:round2(Math.min(.6,(a.stall+4)/a.max))},{id:'cruise',label:'Cruise',value:.8},{id:'full',label:'Full',value:1}];
}
export const nearestDetent=(id:AircraftId,value:number)=>throttleDetents(id).reduce((best,d)=>Math.abs(d.value-value)<Math.abs(best.value-value)?d:best);
/** Keyboard steps keep their 10% feel but cling to a notch when they land close to one. */
export function stepThrottle(id:AircraftId,value:number,delta:number):number{
  const next=Math.max(0,Math.min(1,round2(value+delta))),near=nearestDetent(id,next);
  return Math.abs(near.value-next)<=.045?near.value:next;
}
