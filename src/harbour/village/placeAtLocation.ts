import type { HarbourPlaceId } from '../flag.ts';
import type { VillageLocation } from '../../house/villageLocation.ts';

/** Flat route lookup; no illustrated village geometry is needed. */
export const placeAtLocation = (location:VillageLocation):HarbourPlaceId => {
  if(location.place==='home') return location.room==='loft'?'tower':location.room==='cellar'?'cellar':location.room==='atlas-nook'?'atlas':'kitchen';
  return ({court:'court','fund-bank':'bank',library:'library',glasshouse:'glasshouse','pottery-studio':'kiln','hercules-cottage':'cottage',boathouse:'boathouse',campfire:'campfire'} as const)[location.place];
};
