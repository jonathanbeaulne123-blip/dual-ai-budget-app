import { askBelongsOnDesk } from "./askView.ts";
import { workShiftIsReversed } from "./work.ts";
import type { Household } from "./types.ts";

export const APRON_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Accepted receipt only. Settlement and edits never renew its six-hour window. */
export function apronReceipt(household: Household, memberId: string, now: number) {
  if (!Number.isFinite(now) || !household.members.some(member => member.id === memberId && member.active)
    || !askBelongsOnDesk(memberId, household.householdFund?.custodianMemberId)) return null;
  const shift = household.shifts.filter(row => {
    const posted = Date.parse(row.createdAt);
    return row.memberId === memberId && Number.isFinite(posted) && posted <= now
      && now < posted + APRON_WINDOW_MS && !workShiftIsReversed(household, row);
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))[0];
  if (!shift) return null;
  const timed = !!shift.jobId && Number.isSafeInteger(shift.cardTipsAfterTipOutCents)
    && [shift.immediateTipOutCents, shift.withheldTipOutCents, shift.deferredTipOutCents]
      .every(value => Number.isSafeInteger(value) && value! >= 0);
  return {
    id: `${household.environment}:${household.householdId}:${memberId}:${shift.id}`,
    shiftId: shift.id, date: shift.date, postedAt: shift.createdAt,
    expiresAt: Date.parse(shift.createdAt) + APRON_WINDOW_MS,
    hours: shift.hours, cashCents: shift.cashTipsCents,
    cardCents: timed ? shift.cardTipsAfterTipOutCents! : shift.ccTipsCents,
    tipOutCents: timed ? shift.immediateTipOutCents! + shift.withheldTipOutCents! + shift.deferredTipOutCents!
      : shift.floorTipOutCents + shift.barTipOutCents + shift.ccTipOutCents,
    timing: timed ? { immediateCents: shift.immediateTipOutCents!, withheldCents: shift.withheldTipOutCents!, deferredCents: shift.deferredTipOutCents! } : null,
  };
}
export type ApronReceipt = NonNullable<ReturnType<typeof apronReceipt>>;
