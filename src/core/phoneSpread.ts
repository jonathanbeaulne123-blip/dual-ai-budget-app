import { workShiftIsReversed } from "./work.ts";
import { askBelongsOnDesk } from "./askView.ts";
import { tipWeather } from "./insights.ts";
import { tipWeekdaySpark } from "./officeWide.ts";
import type { Household } from "./types.ts";

export const PHONE_CHAPTERS = {
  in: { name: "Money in", pages: ["streams", "paydays", "members", "tips"] },
  out: { name: "Money out", pages: ["shape", "next-out", "week", "categories"] },
  leftover: { name: "Leftover", pages: ["ask", "shelf", "deferral"] },
} as const;
export type PhoneChapter = keyof typeof PHONE_CHAPTERS;
export type PhoneReading = typeof PHONE_CHAPTERS[PhoneChapter]["pages"][number];
export const PHONE_READING_NAMES: Record<PhoneReading, string> = {
  streams: "The two streams", paydays: "Payday ticks", members: "Contributions by member", tips: "Your tip spark",
  shape: "The shape", "next-out": "Next out", week: "This week", categories: "Top categories",
  ask: "The Ask", shelf: "The shelf", deferral: "Moving a goal claim",
};

/** The aggregate tip reader must never see a partner's shift, even in Shared. */
export function ownPhoneTipSpark(household: Household, memberId: string, today: string) {
  if (!household.members.some(member => member.id === memberId && member.active)
    || !askBelongsOnDesk(memberId, household.householdFund?.custodianMemberId)) return null;
  return tipWeekdaySpark(tipWeather({ ...household, shifts: household.shifts.filter(shift => shift.memberId === memberId && !workShiftIsReversed(household, shift)) }, today));
}
