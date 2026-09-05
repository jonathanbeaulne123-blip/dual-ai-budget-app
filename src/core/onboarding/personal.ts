import {
  addDays,
  dateKeyInZone,
  monthKeyFromDateKey,
  weekBounds,
  type DateKey,
} from "../calendar.ts";
import type { Household } from "../types.ts";
import { workShiftIsReversed } from "../work.ts";
import { SHIFT_ORACLE_MIN_SHIFTS } from "../shiftGlance.ts";
import { onboardingCadenceProbe } from "./cadence.ts";
import { acceptedHouseholdOnboarding } from "./mode.ts";
import { memberProgress } from "./progress.ts";
import { personalModules } from "./registry.ts";
import type { ChapterId, OnboardingChapter } from "./types.ts";

export const PERSONAL_MODULE_IDS = [
  "pm-01-own-books",
  "pm-02-shifts",
  "pm-03-tips",
  "pm-04-own-plan",
  "pm-05-office",
  "pm-06-hercules",
] as const;

export type PersonalModuleId = typeof PERSONAL_MODULE_IDS[number];

export type PersonalOfferContext = {
  now: string;
  sessionId: string;
  isDesktop: boolean;
};

export type PersonalModuleTrigger = {
  eligible: boolean;
  copyKey: string;
};

export type PersonalModuleOffer = {
  module: OnboardingChapter & { id: PersonalModuleId };
  triggerCopyKey: string;
};

function isPersonalModuleId(value: string): value is PersonalModuleId {
  return PERSONAL_MODULE_IDS.includes(value as PersonalModuleId);
}

function acceptedPersonalTransactions(household: Household, memberId: string) {
  return household.transactions.filter((row) => row.createdBy === memberId
    && row.visibility === "personal"
    && !row.isDuplicate);
}

function acceptedOwnShifts(household: Household, memberId: string) {
  return household.shifts.filter((row) => row.memberId === memberId
    && row.createdBy === memberId
    && !workShiftIsReversed(household, row));
}

function completedAtDate(household: Household): DateKey | null {
  const completedAt = acceptedHouseholdOnboarding(household)?.completedAt;
  if (!completedAt || Number.isNaN(Date.parse(completedAt))) return null;
  return dateKeyInZone(new Date(completedAt), household.timezone);
}

/** Exact, pure trigger predicates from Slice 26. No predicate writes or reveals a partner-Personal fact. */
export function personalModuleTrigger(
  household: Household,
  memberId: string,
  moduleId: PersonalModuleId,
  context: PersonalOfferContext,
): PersonalModuleTrigger {
  const today = dateKeyInZone(new Date(context.now), household.timezone);
  switch (moduleId) {
    case "pm-01-own-books":
      return { eligible: acceptedPersonalTransactions(household, memberId).length >= 1, copyKey: "personal.trigger.own-books" };
    case "pm-02-shifts": {
      const cadence = onboardingCadenceProbe(household, memberId);
      const cadenceRow = memberProgress(household, memberId).rows.find((row) => row.chapterId === "ch-08-cadence");
      return {
        eligible: cadence.complete && Boolean(cadenceRow?.observedCompleteAt || cadenceRow?.acknowledgedAt),
        copyKey: "personal.trigger.shifts",
      };
    }
    case "pm-03-tips":
      return { eligible: acceptedOwnShifts(household, memberId).length >= SHIFT_ORACLE_MIN_SHIFTS, copyKey: "personal.trigger.tips" };
    case "pm-04-own-plan": {
      const month = monthKeyFromDateKey(today);
      const count = acceptedPersonalTransactions(household, memberId)
        .filter((row) => monthKeyFromDateKey(row.date) === month).length;
      return { eligible: count >= 3, copyKey: "personal.trigger.own-plan" };
    }
    case "pm-05-office":
      return { eligible: context.isDesktop && completedAtDate(household) !== null, copyKey: "personal.trigger.office" };
    case "pm-06-hercules": {
      const unlockedOn = completedAtDate(household);
      return { eligible: Boolean(unlockedOn && today >= addDays(unlockedOn, 7)), copyKey: "personal.trigger.hercules" };
    }
  }
}

export function personalTrackAvailable(household: Household): boolean {
  const record = acceptedHouseholdOnboarding(household);
  return record?.state === "complete" || record?.forcedUnlock === true;
}

export function personalModuleOfferFor(
  household: Household,
  memberId: string,
  context: PersonalOfferContext,
): PersonalModuleOffer | null {
  if (!personalTrackAvailable(household) || Number.isNaN(Date.parse(context.now)) || !context.sessionId.trim()) return null;
  const progress = memberProgress(household, memberId);
  if (progress.offersMuted || progress.personalOfferHistory.some((row) => row.sessionId === context.sessionId)) return null;
  const today = dateKeyInZone(new Date(context.now), household.timezone);
  const week = weekBounds(today);
  const offersThisWeek = progress.personalOfferHistory.filter((row) => {
    const offeredOn = dateKeyInZone(new Date(row.offeredAt), household.timezone);
    return offeredOn >= week.start && offeredOn <= week.end;
  }).length;
  if (offersThisWeek >= 2) return null;
  const month = monthKeyFromDateKey(today);
  const progressById = new Map(progress.rows.map((row) => [row.chapterId, row]));
  for (const module of personalModules()) {
    if (!isPersonalModuleId(module.id)) continue;
    const row = progressById.get(module.id);
    if (row?.acknowledgedAt || row?.skippedAt) continue;
    const declines = progress.declineMonthByModule[module.id] === month
      ? progress.declineCountByModule[module.id] ?? 0
      : 0;
    if (declines >= 2) continue;
    const trigger = personalModuleTrigger(household, memberId, module.id, context);
    if (trigger.eligible) return { module: module as OnboardingChapter & { id: PersonalModuleId }, triggerCopyKey: trigger.copyKey };
  }
  return null;
}

export function personalModuleById(moduleId: ChapterId): (OnboardingChapter & { id: PersonalModuleId }) | null {
  if (!isPersonalModuleId(moduleId)) return null;
  return (personalModules().find((module) => module.id === moduleId) as OnboardingChapter & { id: PersonalModuleId } | undefined) ?? null;
}
