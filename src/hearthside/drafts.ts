import { decodeExperience, decodeMemory, decodeNote, object, textValue, type SharedExperience, type MemoryComposition, type PlacedNote } from './contracts.ts';

export type HearthsideDrafts = { experience: SharedExperience | null; memory: MemoryComposition | null; note: PlacedNote | null };
export const emptyDrafts = (): HearthsideDrafts => ({ experience: null, memory: null, note: null });

/** Private device drafts may have an unfinished title; all other fields use the shared contracts. */
export function readHearthsideDrafts(storage: Storage, key: string): HearthsideDrafts {
  const raw = storage.getItem(key);
  if (!raw) return emptyDrafts();
  if (raw.length > 128 * 1024) throw Error('The recovery draft is too large.');
  const row = object(JSON.parse(raw), ['experience', 'memory', 'note']);
  function draft<T extends SharedExperience | MemoryComposition>(value: unknown, decode: (input: unknown) => T): T | null {
    if (value === null) return null;
    if (!value || typeof value !== 'object') throw Error('Invalid recovery draft.');
    const title = textValue((value as {title?: unknown}).title, 240, true);
    return { ...decode({ ...value, title: title.trim() ? title : 'Unfinished draft' }), title };
  }
  let note: PlacedNote | null = null;
  if (row.note !== null) {
    if (!row.note || typeof row.note !== 'object') throw Error('Invalid recovery note.');
    const text = textValue((row.note as {text?: unknown}).text, 4000, true);
    note = { ...decodeNote({ ...row.note, text: text.trim() ? text : 'Unfinished draft' }), text };
  }
  return { experience: draft(row.experience, decodeExperience), memory: draft(row.memory, decodeMemory), note };
}
