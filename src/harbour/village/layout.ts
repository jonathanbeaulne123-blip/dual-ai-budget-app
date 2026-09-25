import {BUILDING_SITES,BUILDING_FORMS} from '../mountain/places.ts';
import type { HarbourPlaceId } from '../flag.ts';
import type { HouseLevel, HouseRoom } from '../../hearthside/houseRoutes.ts';
import type { VillageLocation } from '../../house/villageLocation.ts';

export const VILLAGE_SITES = {
  home: {spot:BUILDING_SITES.home, half:BUILDING_FORMS.home.half, door:BUILDING_FORMS.home.door, name:'Our home', exterior:'village-home', entry:'kitchen'},
  bank: {spot:[8,-26], half:[4.6,3.6], door:[0,3.35], name:'The Fund bank', exterior:'village-bank', entry:'bank'},
  library: {spot:BUILDING_SITES.library, half:BUILDING_FORMS.library.half, door:BUILDING_FORMS.library.door, name:'The Library', exterior:'village-library', entry:'library'},
  glasshouse: {spot:BUILDING_SITES.glasshouse, half:BUILDING_FORMS.glasshouse.half, door:BUILDING_FORMS.glasshouse.door, name:'The Glasshouse', exterior:'village-glasshouse', entry:'glasshouse'},
  studio: {spot:[33,10], half:[3.8,2.9], door:[1.95,2.82], name:'The Pottery Studio', exterior:'village-studio', entry:'kiln'},
  cottage: {spot:BUILDING_SITES.cottage, half:BUILDING_FORMS.cottage.half, door:BUILDING_FORMS.cottage.door, name:'Hercules’s cottage', exterior:'village-cottage', entry:'cottage'},
  boathouse: {spot:[42,-41], half:[3.6,3], door:[1.5,2.8], name:'The Boathouse', exterior:'village-boathouse', entry:'boathouse'},
} as const;
export type VillageBuilding = keyof typeof VILLAGE_SITES;
/** One physical shore clearing shared by its distant landmark and live scene. */
export const VILLAGE_WATERFRONT = { spot: [0, 69], half: [3.8, 3.6], door: [0, 3.45], yaw: Math.PI } as const;
export const SITE_FOR_PLACE: Partial<Record<HarbourPlaceId,VillageBuilding>> = {
  kitchen:'home',tower:'home',cellar:'home',atlas:'home',bank:'bank',library:'library',
  glasshouse:'glasshouse',kiln:'studio',cottage:'cottage',boathouse:'boathouse',
};
export const FLOOR_HEIGHT: Partial<Record<HarbourPlaceId,number>> = {tower:3.1,cellar:-2.7,atlas:3.1};
export const VILLAGE_ADDRESS: Record<HarbourPlaceId,{room:HouseRoom;level:HouseLevel;village:VillageLocation}> = {
  court:{room:'home',level:'middle',village:{place:'court'}},
  bank:{room:'home',level:'middle',village:{place:'fund-bank',room:'banking-hall'}},
  kitchen:{room:'kitchen-table',level:'middle',village:{place:'home',room:'kitchen'}},
  tower:{room:'home',level:'above',village:{place:'home',room:'loft'}},
  cellar:{room:'home',level:'below',village:{place:'home',room:'cellar'}},
  atlas:{room:'kitchen-table',level:'above',village:{place:'home',room:'atlas-nook'}},
  library:{room:'study',level:'middle',village:{place:'library',room:'library-floor'}},
  glasshouse:{room:'study',level:'above',village:{place:'glasshouse',room:'glasshouse'}},
  kiln:{room:'making',level:'above',village:{place:'pottery-studio',room:'studio-floor'}},
  cottage:{room:'making',level:'middle',village:{place:'hercules-cottage',room:'cottage-room'}},
  boathouse:{room:'together',level:'middle',village:{place:'boathouse',room:'boathouse-room'}},
  campfire:{room:'making',level:'below',village:{place:'campfire'}},
};
export const placeAtLocation = (location:VillageLocation):HarbourPlaceId => {
  if(location.place==='home') return location.room==='loft'?'tower':location.room==='cellar'?'cellar':location.room==='atlas-nook'?'atlas':'kitchen';
  return ({court:'court','fund-bank':'bank',library:'library',glasshouse:'glasshouse','pottery-studio':'kiln','hercules-cottage':'cottage',boathouse:'boathouse',campfire:'campfire'} as const)[location.place];
};

/** Local portals. A stair is its own explicit destination, never a generic exit to Court. */
export const ROOM_PORTALS: Partial<Record<HarbourPlaceId,readonly {id:string;to:HarbourPlaceId;at:readonly[number,number,number];label:string}[]>> = {
  kitchen:[{id:'home-up',to:'tower',at:[-2.7,0,1.9],label:'Climb to the Loft'},{id:'home-down',to:'cellar',at:[2.8,0,-1.8],label:'Down to the Cellar'}],
  tower:[{id:'home-down',to:'kitchen',at:[-2,0,1.7],label:'Down to the Kitchen'},{id:'home-atlas',to:'atlas',at:[2,0,-1.5],label:'Step into the Atlas nook'}],
  cellar:[{id:'home-up',to:'kitchen',at:[3.6,0,1.9],label:'Up to the Kitchen'}],
  atlas:[{id:'home-loft',to:'tower',at:[1.8,0,1.8],label:'Back to the Loft'}],
};
