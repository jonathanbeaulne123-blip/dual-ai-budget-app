import { stableImportHash } from "./core/importInbox/hash.ts";
import type { OpenShift, SevenShiftsTimesheetDraft, PostWorkShiftInput, ShiftAttendanceReviewDraft } from "./core/index.ts";
import type { WorkShiftDraft, WorkShiftFormState } from "./WorkShiftFlow.tsx";
import type { WorkShiftCommandScope } from "./workShiftScope.ts";

export type CountSource = { initialDraft: WorkShiftDraft | null; inboxDraft: SevenShiftsTimesheetDraft | null; punch: OpenShift | null; warnings: string[]; envelopeVersion?: string };
export type CountDraft = { version: 1; id: string; revision: number; source: CountSource; form: WorkShiftFormState | null; submission?: { confirmationId: string; input: PostWorkShiftInput; attendance?: ShiftAttendanceReviewDraft | null } };
export type WorkShiftDraftCallbacks = { scope?: WorkShiftCommandScope; onAccepted: () => void; onRejected: () => void };
export type CountDraftStamp = { key: string; id: string; revision: number; confirmationId?: string };
export type DraftStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const countDraftKey = (scope: WorkShiftCommandScope) => `hearth:count-draft:${JSON.stringify([scope.environment, scope.householdId, scope.memberId])}`;
export const countSourceIdentity = (source: CountSource) => stableImportHash(JSON.stringify(source.inboxDraft ?? source.initialDraft ?? source.punch ?? null));
export const newCountDraft = (source: CountSource): CountDraft => ({ version: 1, id: crypto.randomUUID(), revision: 0, source, form: null });

export function readCountDraft(store: DraftStore, key: string): CountDraft | null {
  try {
    const row = JSON.parse(store.getItem(key) ?? "null") as CountDraft | null;
    if (!row || row.version !== 1 || typeof row.id !== "string" || !Number.isSafeInteger(row.revision) || row.revision < 0 || !row.source || !Array.isArray(row.source.warnings)) return null;
    if (row.form) {
      const form = row.form;
      const strings = [form.date, form.jobId, form.roleId, form.hoursDigits, form.paidBreakDigits, form.unpaidBreakDigits, form.activeMoney, form.customersServed, form.staffingCount, form.eventTag, form.weatherGlass, form.cashAccountId, form.wagesDepositAccountId, form.cardDepositAccountId, form.wagesVisibility, form.cashVisibility, form.cardVisibility, form.tipOutVisibility, form.note, form.surpriseName, form.reviewedFingerprint, form.scheduleKey];
      if (strings.some(value => typeof value !== "string") || typeof form.hoursTouched !== "boolean" || !Number.isInteger(form.step) || form.step < 0 || form.step > 3 || !form.money || Object.values(form.money).some(value => typeof value !== "string") || !form.attendance || Object.values(form.attendance).some(value => !["scheduled-assumed", "user-confirmed-present", "user-confirmed-absent"].includes(value)) || !Array.isArray(form.surpriseHelpers) || form.surpriseHelpers.some(value => typeof value !== "string")) return null;
    }
    return row;
  } catch { return null; }
}

/** A late accepted receipt must never remove subsequent edits or another draft. */
export function clearAcceptedCountDraft(store: DraftStore, stamp: CountDraftStamp): boolean {
  const current = readCountDraft(store, stamp.key);
  if (!current || current.id !== stamp.id || current.revision !== stamp.revision || (stamp.confirmationId !== undefined && current.submission?.confirmationId !== stamp.confirmationId)) return false;
  store.setItem(`${stamp.key}:accepted`, JSON.stringify({ id: current.id, sourceIdentity: countSourceIdentity(current.source) }));
  store.removeItem(stamp.key);
  return true;
}

export function saveCountDraft(store: DraftStore, key: string, current: CountDraft, form: WorkShiftFormState): CountDraft {
  const saved = readCountDraft(store, key);
  if (JSON.parse(store.getItem(`${key}:accepted`) ?? "null")?.id === current.id || (saved ? saved.id !== current.id || saved.revision !== current.revision : current.revision > 0)) throw new Error("This draft changed in another open form. Reopen it to continue.");
  if (current.submission || JSON.stringify(current.form) === JSON.stringify(form)) return current;
  const next = { ...current, revision: current.revision + 1, form };
  store.setItem(key, JSON.stringify(next));
  return next;
}
