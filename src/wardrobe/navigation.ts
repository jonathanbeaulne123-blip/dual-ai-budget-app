/** Pure navigation helpers for the dressing room: search, slot cycling, colour-first and device-local recents. */
import { COMPANION_SLOTS, type CompanionSlot, type LookV1 } from '../core/herculesCompanionContracts.ts';
import { COLLECTIONS, FITTING_ITEMS, WARDROBE_COLOURS } from './catalogue.ts';
export type FittingItem = typeof FITTING_ITEMS[number];
const LABELS: Record<string, string> = { head: 'Head', eyewear: 'Eyewear', neckwear: 'Neckwear', body: 'Body', outerwear: 'Outerwear', charm: 'Charm', tail: 'Tail' };
export const slotLabel = (slot: string) => LABELS[slot] ?? slot;
export const SLOT_ORDER: readonly CompanionSlot[] = COMPANION_SLOTS;
export type SlotFilter = 'all' | CompanionSlot;
const collectionName = (id: string) => COLLECTIONS.find(c => c.id === id)?.name ?? (id === 'legacy' ? 'Old favourites' : id);
function normalize(text: string) { return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
/** Every word of the query must appear in the piece's name, collection, slot, shape or detail. */
export function searchPieces(items: readonly FittingItem[], query: string): FittingItem[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return [...items];
  return items.filter(item => { const haystack = normalize([item.name, collectionName(item.collection), item.collection, item.slot, item.shape, item.detail].join(' ')); return words.every(word => haystack.includes(word)); });
}
export function piecesInColour(items: readonly FittingItem[], colour: string): FittingItem[] { return items.filter(item => item.variants.includes(colour)); }
/** Colours that at least one piece offers, in catalogue order, so colour-first never shows an empty swatch. */
export function availableColours(items: readonly FittingItem[] = FITTING_ITEMS): string[] {
  const used = new Set<string>(); for (const item of items) for (const v of item.variants) if (v !== 'legacy-original') used.add(v);
  return Object.keys(WARDROBE_COLOURS).filter(c => used.has(c));
}
/** Cycle the visible pieces of one slot. `null` (nothing worn) steps to the first or last piece. */
export function cyclePiece(visible: readonly FittingItem[], slot: CompanionSlot, currentId: string | null, direction: 1 | -1): FittingItem | null {
  const pool = visible.filter(item => item.slot === slot);
  if (!pool.length) return null;
  const index = currentId ? pool.findIndex(item => item.id === currentId) : -1;
  if (index < 0) return direction > 0 ? pool[0]! : pool[pool.length - 1]!;
  return pool[(index + direction + pool.length) % pool.length]!;
}
export function wornPieces(look: LookV1): { slot: CompanionSlot; item: FittingItem | null; itemId: string; variantId: string }[] {
  return SLOT_ORDER.flatMap(slot => { const value = look.selections[slot]; return value ? [{ slot, item: FITTING_ITEMS.find(p => p.id === value.itemId) ?? null, itemId: value.itemId, variantId: value.variantId }] : []; });
}
export const RECENT_LIMIT = 12;
export function readRecent(storage: Pick<Storage, 'getItem'> | null, key: string): string[] {
  try { const value = JSON.parse(storage?.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && FITTING_ITEMS.some(p => p.id === v)).slice(0, RECENT_LIMIT) : []; } catch { return []; }
}
export function pushRecent(list: readonly string[], id: string): string[] { return [id, ...list.filter(x => x !== id)].slice(0, RECENT_LIMIT); }
export function writeRecent(storage: Pick<Storage, 'setItem'> | null, key: string, list: readonly string[]): boolean { try { storage?.setItem(key, JSON.stringify(list.slice(0, RECENT_LIMIT))); return Boolean(storage); } catch { return false; } }
/** True when a keyboard shortcut must stay quiet: the person is typing. */
export function typingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable=true]'));
}
