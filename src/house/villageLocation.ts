/** Physical locations are independent of the house's existing functional addresses. */
export const VILLAGE_ROOMS = {
  court: [], home: ['kitchen', 'loft', 'cellar', 'atlas-nook'],
  'fund-bank': ['banking-hall'], library: ['library-floor'], glasshouse: ['glasshouse'],
  'pottery-studio': ['studio-floor'], 'hercules-cottage': ['cottage-room'],
  boathouse: ['boathouse-room'], campfire: [],
} as const;
export type VillagePlaceId = keyof typeof VILLAGE_ROOMS;
export type VillageRoomId = typeof VILLAGE_ROOMS[VillagePlaceId][number];
export type VillageLocation = { place: VillagePlaceId; room?: VillageRoomId };

export function villageLocation(place: unknown, room?: unknown): VillageLocation | null {
  if (typeof place !== 'string' || !Object.hasOwn(VILLAGE_ROOMS, place)) return null;
  const rooms: readonly string[] = VILLAGE_ROOMS[place as VillagePlaceId];
  if (room !== undefined && (typeof room !== 'string' || !rooms.includes(room))) return null;
  return { place: place as VillagePlaceId, ...(room !== undefined ? {room: room as VillageRoomId} : {}) };
}

export function legacyVillageLocationFor(route: {room:string;level:string;surface?:string}): VillageLocation {
  if (route.surface === 'queen') return {place:'fund-bank',room:'banking-hall'};
  if (route.room === 'home') return route.level === 'above' ? {place:'home',room:'loft'} : route.level === 'below' ? {place:'home',room:'cellar'} : {place:'court'};
  if (route.room === 'study') return route.level === 'middle' ? {place:'library',room:'library-floor'} : {place:'glasshouse',room:'glasshouse'};
  if (route.room === 'kitchen-table') return {place:'home',room:route.level === 'above' ? 'atlas-nook' : 'kitchen'};
  if (route.room === 'together') return {place:'boathouse',room:'boathouse-room'};
  if (route.room === 'making') return route.level === 'above' ? {place:'pottery-studio',room:'studio-floor'} : route.level === 'below' ? {place:'campfire'} : {place:'hercules-cottage',room:'cottage-room'};
  return {place:'court'};
}
