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
export type VillageHouseAddress = { room: 'home' | 'study' | 'kitchen-table' | 'together' | 'making'; level: 'above' | 'middle' | 'below'; village: VillageLocation };

export function villageLocation(place: unknown, room?: unknown): VillageLocation | null {
  if (typeof place !== 'string' || !Object.hasOwn(VILLAGE_ROOMS, place)) return null;
  const rooms: readonly string[] = VILLAGE_ROOMS[place as VillagePlaceId];
  if (room !== undefined && (typeof room !== 'string' || !rooms.includes(room))) return null;
  return { place: place as VillagePlaceId, ...(room !== undefined ? {room: room as VillageRoomId} : {}) };
}

/**
 * The physical address for every place in Little Harbour.  Routes own this
 * table so a URL cannot say that, for example, the Fund bank is in Study.
 * The Harbour scene consumes the same address through its route rather than
 * accepting an independently-addressed physical place.
 */
export const VILLAGE_HOUSE_ADDRESSES: readonly VillageHouseAddress[] = [
  { room: 'home', level: 'middle', village: { place: 'court' } },
  { room: 'home', level: 'middle', village: { place: 'fund-bank', room: 'banking-hall' } },
  { room: 'kitchen-table', level: 'middle', village: { place: 'home', room: 'kitchen' } },
  { room: 'home', level: 'above', village: { place: 'home', room: 'loft' } },
  { room: 'home', level: 'below', village: { place: 'home', room: 'cellar' } },
  { room: 'kitchen-table', level: 'above', village: { place: 'home', room: 'atlas-nook' } },
  { room: 'study', level: 'middle', village: { place: 'library', room: 'library-floor' } },
  { room: 'study', level: 'above', village: { place: 'glasshouse', room: 'glasshouse' } },
  { room: 'making', level: 'above', village: { place: 'pottery-studio', room: 'studio-floor' } },
  { room: 'making', level: 'middle', village: { place: 'hercules-cottage', room: 'cottage-room' } },
  { room: 'together', level: 'middle', village: { place: 'boathouse', room: 'boathouse-room' } },
  { room: 'making', level: 'below', village: { place: 'campfire' } },
];

const sameVillageLocation = (left: VillageLocation, right: VillageLocation): boolean => left.place === right.place && left.room === right.room;

export function villageHouseAddress(location: VillageLocation): VillageHouseAddress | null {
  return VILLAGE_HOUSE_ADDRESSES.find(address => sameVillageLocation(address.village, location)) ?? null;
}

export function villageMatchesHouseAddress(location: VillageLocation, room: string, level: string): boolean {
  const address = villageHouseAddress(location);
  return address?.room === room && address.level === level;
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
