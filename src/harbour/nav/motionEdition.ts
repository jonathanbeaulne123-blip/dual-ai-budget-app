import { editionAvailability } from './editionAvailability.ts';

export const MOTION_KEY = 'hearth:motion';
export type MotionEdition = 'illustrated' | 'flat';

/** The reader's chosen edition. Storage failure defaults to illustrated. */
export function readMotionEdition(storage?: Pick<Storage, 'getItem'>): MotionEdition {
  try { return (storage ?? window.localStorage).getItem(MOTION_KEY) === 'flat' ? 'flat' : 'illustrated'; }
  catch { return 'illustrated'; }
}

/** Shared writer for the Quick Sheet and the Desk flip. */
export function chooseMotionEdition(next: MotionEdition, storage?: Pick<Storage, 'setItem'>): void {
  if (next === 'illustrated' && editionAvailability().reason) return;
  try { (storage ?? window.localStorage).setItem(MOTION_KEY, next === 'flat' ? 'flat' : ''); }
  catch { /* Preferences are a convenience; the sheet still works without storage. */ }
  try { window.dispatchEvent(new CustomEvent(MOTION_KEY, { detail: next })); }
  catch { /* jsdom without CustomEvent is still fine. */ }
}
