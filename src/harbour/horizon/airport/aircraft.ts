/** Three authored airframes, one set of controls. Units are metres and seconds. */
export const AIRCRAFT = {
  kestrel: {name:'Kestrel',description:'A gentle high-wing bush plane. The easiest first flight.',wing:10,length:7,rotation:13,stall:10,max:36,acceleration:4.4,pitchRate:.42,bankLimit:.58,rollRate:1.05,color:'#e8b746',trim:'#314f56',cockpit:1.15},
  swift: {name:'Swift',description:'An open-cockpit biplane. Light, responsive and playful.',wing:8.5,length:6.5,rotation:14,stall:11,max:43,acceleration:5,pitchRate:.62,bankLimit:.82,rollRate:1.65,color:'#be5541',trim:'#f4e5c9',cockpit:1.05},
  heron: {name:'Heron',description:'A steady twin-engine tourer. Broad wings and long island views.',wing:14,length:10,rotation:18,stall:14,max:48,acceleration:3.4,pitchRate:.31,bankLimit:.5,rollRate:.7,color:'#d9e6de',trim:'#347b80',cockpit:1.4},
} as const;
export type AircraftId=keyof typeof AIRCRAFT;
export const AIRCRAFT_IDS=Object.keys(AIRCRAFT) as AircraftId[];
export const FLIGHT_CONTROLS='[ / ] power · A / D turn · S climb, W descend · X brake on ground · E exit · Space parachute · C view';
