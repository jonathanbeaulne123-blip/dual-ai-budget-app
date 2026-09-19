import { HEARTHSIDE_ROOMS, choice, identifier, type HearthsideRoom } from './contracts.ts';
import { parseHouseRoute, togetherRoomForLevel } from './houseRoutes.ts';
export const HEARTHSIDE_LABEL = (import.meta.env?.VITE_HEARTHSIDE_LABEL?.trim() || 'Hearthside').slice(0, 60);
export type HearthsideRoute = {
  version: 1; householdId: string; room: HearthsideRoom;
  object?: { kind: 'experience' | 'memory' | 'occasion' | 'note' | 'encounter'; id: string } | {kind:'piece';id:string;designId:string};
  mode: 'present' | 'remember' | 'imagine';
  surface?:'practical'|'studio'|'letters'|'occasions'|'projector'|'history'|'worktable'|'guests'|'encounters'|'wardrobe'|'restore';
  studioSelection?: {designId:string;pieceId:string};
  returnContext?: { path: string; focusId: string };
};
const collections = { experience: 'experiences', piece: 'pieces', memory: 'memories', occasion: 'occasions', note: 'notes', encounter: 'encounters' } as const;
export function hearthsideFocusId(value:unknown):string {
  if(typeof value!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9_.:%~-]{0,767}$/.test(value))throw Error('HEARTHSIDE_INVALID_FOCUS');
  return value;
}
function returnContext(path: unknown, focusId: unknown, householdId: string): NonNullable<HearthsideRoute['returnContext']> {
  if (typeof path !== 'string' || path.length > 2000 || !path.startsWith('/hearthside/')) throw Error('HEARTHSIDE_INVALID_RETURN');
  const url = new URL(path, 'https://hearth.invalid');
  if (url.origin !== 'https://hearth.invalid' || url.pathname.split('/')[1] !== 'hearthside' || url.searchParams.get('household') !== householdId) throw Error('HEARTHSIDE_INVALID_RETURN');
  url.searchParams.delete('from'); url.searchParams.delete('focus');
  return {path:`${url.pathname}${url.search}`,focusId:hearthsideFocusId(focusId)};
}
export function hearthsidePath(route: HearthsideRoute): string {
  identifier(route.householdId); choice(route.room, HEARTHSIDE_ROOMS); choice(route.mode, ['present', 'remember', 'imagine']);
  const path = route.object ? `/${collections[route.object.kind]}/${encodeURIComponent(identifier(route.object.id))}` : `/rooms/${route.room}`;
  const query = new URLSearchParams({ household: route.householdId, room: route.room, mode: route.mode });
  if(route.surface)query.set('surface',choice(route.surface,['practical','studio','letters','occasions','projector','history','worktable','guests','encounters','wardrobe','restore']));
  if (route.object?.kind==='piece')query.set('design',identifier(route.object.designId));
  if(route.studioSelection){
    if(!['studio','wardrobe'].includes(route.surface??'')||route.object?.kind==='piece')throw Error('HEARTHSIDE_INVALID_STUDIO_SELECTION');
    query.set('design',identifier(route.studioSelection.designId));query.set('piece',identifier(route.studioSelection.pieceId));
  }
  if (route.returnContext) { const back=returnContext(route.returnContext.path,route.returnContext.focusId,route.householdId);query.set('from',back.path);query.set('focus',back.focusId); }
  return `/hearthside${path}?${query}`;
}
export function parseHearthsideRoute(url: string, selectedHouseholdId: string): HearthsideRoute | null {
  try {
    const u = new URL(url, 'https://hearth.invalid');
    const house = parseHouseRoute(url, selectedHouseholdId);
    if (house?.room === 'together') {
      const addressed = u.searchParams.get('room');
      const room = addressed && HEARTHSIDE_ROOMS.includes(addressed as HearthsideRoom) ? addressed as HearthsideRoom : togetherRoomForLevel(house.level);
      return {version:1,householdId:selectedHouseholdId,room,mode:'present'};
    }
    if (!u.pathname.startsWith('/hearthside')) return null;
    const householdId = identifier(u.searchParams.get('household') ?? selectedHouseholdId);
    if (householdId !== selectedHouseholdId) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'hearthside') return null;
    const room = choice(u.searchParams.get('room') ?? (parts[1] === 'rooms' ? parts[2] : 'common') ?? 'common', HEARTHSIDE_ROOMS);
    const mode = choice(u.searchParams.get('mode') ?? 'present', ['present', 'remember', 'imagine']);
    const surface=u.searchParams.has('surface')?{surface:choice(u.searchParams.get('surface'),['practical','studio','letters','occasions','projector','history','worktable','guests','encounters','wardrobe','restore'] as const)}:{};
    const selection=u.searchParams.has('piece')||u.searchParams.has('design')&&parts[1]!=='pieces'?{studioSelection:{designId:identifier(u.searchParams.get('design')),pieceId:identifier(u.searchParams.get('piece'))}}:{};
    if(selection.studioSelection&&(!['studio','wardrobe'].includes(surface.surface??'')||parts[1]==='pieces'))return null;
    const back=u.searchParams.has('from')||u.searchParams.has('focus')?{returnContext:returnContext(u.searchParams.get('from'),u.searchParams.get('focus'),householdId)}:{};
    if (parts.length === 1 || parts.length === 3 && parts[1] === 'rooms' && HEARTHSIDE_ROOMS.includes(parts[2] as HearthsideRoom)) return { version: 1, householdId, room, mode,...surface,...selection,...back };
    const kind = Object.entries(collections).find(([, name]) => name === parts[1])?.[0] as keyof typeof collections | undefined;
    if (parts.length !== 3 || !kind) return null;
    return { version: 1, householdId, room, mode,...surface,...selection, object: kind==='piece'?{kind,id:identifier(decodeURIComponent(parts[2]!)),designId:identifier(u.searchParams.get('design'))}:{kind,id:identifier(decodeURIComponent(parts[2]!))},...back };
  } catch { return null; }
}
export function legacyHearthsideRoom(entrance: string): HearthsideRoom {
  return ['dressing', 'gallery', 'banks', 'studio'].includes(entrance) ? 'studio' : ['window', 'goals', 'wishes'].includes(entrance) ? 'conservatory' : ['projector', 'memories', 'cabinet'].includes(entrance) ? 'theatre' : 'common';
}
