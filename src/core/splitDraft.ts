import { percentSplits } from "./splits.ts";
import type { Household } from "./types.ts";

export type SplitViewer = { memberId: string; view: "household" | "personal"; generation: number };
export type SplitDraft = { scope: string; percents: Record<string, number> };
export const CUT_DETENTS = [0, 30, 40, 50, 60, 100] as const;

/** Order is authority: the final party receives the remaining cents after rounding. */
export function splitDraftScope(household: Household, viewer: SplitViewer): string {
  return JSON.stringify([household.environment, household.householdId, viewer.memberId, viewer.view,
    viewer.generation, household.members.filter(member => member.active).map(member => member.id)]);
}

export function newSplitDraft(household: Household, viewer: SplitViewer): SplitDraft {
  const ids = household.members.filter(member => member.active).map(member => member.id);
  const units = Math.floor(10000 / ids.length);
  return { scope: splitDraftScope(household, viewer), percents: Object.fromEntries(ids.map((id, index) =>
    [id, (index === ids.length - 1 ? 10000 - units * index : units) / 100])) };
}

/** Preview and Confirm call the same existing integer-cent allocation kernel. */
export function splitReading(ids: string[], percents: Record<string, number>, amountCents: number) {
  if (!ids.length || new Set(ids).size !== ids.length || Object.keys(percents).length !== ids.length
    || !Number.isSafeInteger(amountCents) || amountCents <= 0
    || ids.some(id => !Number.isFinite(percents[id]) || percents[id]! < 0 || percents[id]! > 100)) {
    throw new Error("Review each member's share before Confirm.");
  }
  const splits = percentSplits(ids.map(party => ({ party, percent: percents[party]! })), amountCents);
  if (splits.some(split => !Number.isSafeInteger(split.amountCents) || split.amountCents < 0)) {
    throw new Error("These shares leave a negative remainder after rounding. Adjust the split before Confirm.");
  }
  return { splits, cents: Object.fromEntries(ids.map(id => [id, splits.find(split => split.party === id)?.amountCents ?? 0])) };
}

export function reviewedSplitPayload(draft: SplitDraft | null, household: Household, viewer: SplitViewer, amountCents: number) {
  if (!draft || draft.scope !== splitDraftScope(household, viewer)) throw new Error("The members or desk changed. Review the split again before Confirm.");
  return splitReading(household.members.filter(member => member.active).map(member => member.id), draft.percents, amountCents).splits;
}

export function editSplitDraft(draft: SplitDraft, ids: string[], memberId: string, percent: number): SplitDraft {
  if (!ids.includes(memberId) || !Number.isFinite(percent)) return draft;
  const value = Math.round(Math.max(0, Math.min(100, percent)) * 100) / 100;
  const percents = { ...draft.percents, [memberId]: value };
  if (ids.length === 2) percents[ids.find(id => id !== memberId)!] = Math.round((100 - value) * 100) / 100;
  return { ...draft, percents };
}
