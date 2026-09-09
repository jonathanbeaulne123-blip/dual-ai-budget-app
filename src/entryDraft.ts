import type { AddFormFields, AddMode } from './addSlideshow.ts';
import type { ShiftGate } from './core/shiftClock.ts';
import type { TransactionLocation } from './core/types.ts';
import type { WorkShiftDraft } from './WorkShiftFlow.tsx';

export type EntryDraft = {
  version: 1; mode: AddMode; form: AddFormFields; slide: number; details: boolean;
  launchAccountId: string | null; focusedAccountId: string | null;
  categoryTouched: boolean; codingHint: string; presetId: string | null;
  hoursDirty: boolean; shiftGate: ShiftGate; workShiftDate: string;
  workShiftDraft: WorkShiftDraft | null; location?: TransactionLocation;
  split: { members: string[]; percents: Record<string, number> } | null;
};
export function entryDraftKey(environment: string, householdId: string, memberId: string, view: string, identity: string, mode: AddMode) {
  return JSON.stringify(['hearth:add:v1', environment, householdId, memberId, view, identity, mode]);
}
const memory = new Map<string, string>();
const failedWrites = new Set<string>();
function storedEntryValue(key: string): string | null {
  if (failedWrites.has(key)) return memory.get(key) ?? null;
  try { return sessionStorage.getItem(key); } catch { return memory.get(key) ?? null; }
}
export function readEntryLocal<T>(key: string): T | null {
  const value = storedEntryValue(key);
  try { return value ? JSON.parse(value) as T : null; } catch { return null; }
}
export function writeEntryLocal(key: string, value: unknown): boolean {
  const encoded = JSON.stringify(value); memory.set(key, encoded);
  try { sessionStorage.setItem(key, encoded); failedWrites.delete(key); return true; } catch { failedWrites.add(key); return false; }
}
export function clearEntryLocal(key: string) { memory.delete(key); failedWrites.delete(key); try { sessionStorage.removeItem(key); } catch { /* Memory-only session. */ } }
export function loadEntryDraft(key: string): EntryDraft | null {
  const draft = readEntryLocal<EntryDraft>(key);
  return draft?.version === 1 && ['expense','income','transfer','shift'].includes(draft.mode)
    && draft.form && typeof draft.form.amount === 'string' && typeof draft.form.date === 'string'
    && Number.isSafeInteger(draft.slide) && draft.slide >= 0
    && typeof draft.details === 'boolean' && typeof draft.hoursDirty === 'boolean'
    && typeof draft.categoryTouched === 'boolean' && typeof draft.codingHint === 'string'
    && typeof draft.workShiftDate === 'string' && ['choose','clocked','finished','signOut'].includes(draft.shiftGate)
    && (draft.split === null || (draft.split && Array.isArray(draft.split.members) && draft.split.members.every(id=>typeof id==='string')
      && draft.split.percents && Object.values(draft.split.percents).every(n=>typeof n==='number'&&Number.isFinite(n))))
    && Object.values(draft.form).every(value=>typeof value==='string'||typeof value==='boolean') ? draft : null;
}
/** A pending confirmation owns exactly one review. Edits cannot reuse its identity. */
export function entryConfirmation(key: string, review: string): string {
  const prior = readEntrySubmission(key);
  if (!prior && storedEntryValue(key + ":confirmation") !== null) throw new Error("The saved entry receipt is damaged. Check the register before clearing this draft.");
  if (prior) {
    if (prior.review !== review) throw new Error('The previous entry is still awaiting its receipt. Reopen that review or check its status before confirming an edited entry.');
    return prior.id;
  }
  const id = crypto.randomUUID(); if (!writeEntryLocal(key + ':confirmation', { id, review })) {clearEntryLocal(key + ':confirmation');throw new Error('This tab cannot save a recovery receipt. Allow browser storage before confirming. Your draft is still here.');} return id;
}
export function clearEntryConfirmation(key: string, id: string) {
  if (readEntryLocal<{id:string}>(key + ':confirmation')?.id === id) clearEntryLocal(key + ':confirmation');
}

export type EntrySubmission = {id:string;review:string};
export function readEntrySubmission(key:string):EntrySubmission|null {
  const value=readEntryLocal<EntrySubmission>(key+':confirmation');
  return value && typeof value.id==='string' && value.id.length>0 && typeof value.review==='string' ? value : null;
}

export type EntryPresentation = { pickedAccounts: {accountId:string;fromAccountId:string;toAccountId:string}; fullForm:boolean; pictureName:string; pictureUrl:string };
export function loadEntryPresentation(key:string):EntryPresentation|null {
  const value=readEntryLocal<EntryPresentation>(key+':presentation');
  return value && value.pickedAccounts && ['accountId','fromAccountId','toAccountId'].every(k=>typeof value.pickedAccounts[k as keyof EntryPresentation['pickedAccounts']]==='string')
    && typeof value.fullForm==='boolean' && typeof value.pictureName==='string' && typeof value.pictureUrl==='string'
    && (!value.pictureUrl || /^data:image\/(jpeg|png|webp);base64,/.test(value.pictureUrl)) ? value : null;
}
