// Desktop conducting and the persistent return message
// (ONBOARDING_BUILD_MANUAL.md slice 9; HEARTH_UX_PACKET.md §13.5, plate 13).
//
// "A chapter's navigation button calls onGo(target.tab), closes chat, and
// leaves a persistent instruction... Not a toast. It does not time out."
// Only a passing completion probe removes it.
//
// This module is deliberately inert: it holds no timer, listens to no
// route, and owns no click handler — see the fence in
// test/onboarding-return.test.ts. Everything here is either a pure read of
// household data (who should navigate where, and whether the chapter that
// sent them there is still outstanding) or a plain phone-local read/write,
// the same shape as core/locationPrefs.ts's loadPhonePlacePrefs /
// savePhonePlacePrefs. The two React surfaces that call it (Hercules.tsx's
// "Open {surface}" bubble control, and App.tsx's onGo wiring) own every
// event listener; this file owns none.
//
// Slice 12 adds plate 13's mobile bar to HerculesPresence, using the same
// record as the existing desktop status furniture. This module remains only
// the scoped, timer-free record and probe; React owns the presentation.

import type { DateKey } from "../calendar.ts";
import type { Environment, Household } from "../types.ts";
import type { HearthTab } from "../hercules.ts";
import { nextChapterFor } from "./progress.ts";
import { chapterRoleFor } from "./shellView.ts";
import type { ChapterId, NavTarget } from "./types.ts";

/**
 * Whether this member should see a navigate control right now, and where it
 * would take them. Conductor-only (a witness has nothing to press — the
 * shell rule from slice 8 holds here too) and only for a chapter whose
 * registry row actually lists "navigate" among its actions; a target
 * without that action is a registry error the tests in
 * test/onboarding-registry.test.ts already guard, not something this
 * function needs to re-validate.
 */
export function onboardingNavigationTarget(
  household: Household,
  memberId: string,
  today: DateKey,
): { chapterId: ChapterId; target: NavTarget } | null {
  const chapter = nextChapterFor(household, memberId, today);
  if (!chapter || !chapter.target) return null;
  const custodianMemberId = household.charter?.custodianMemberId ?? household.householdFund?.custodianMemberId ?? null;
  if (chapterRoleFor(chapter, memberId, custodianMemberId) !== "conductor") return null;
  if (!chapter.actions.includes("navigate")) return null;
  return { chapterId: chapter.id, target: chapter.target };
}

const SURFACE_LABELS: Record<HearthTab, string> = {
  home: "Home",
  plan: "Plan",
  calendar: "Calendar",
  shift: "Shifts",
  ledger: "Books",
  more: "More",
  add: "Add",
};

/** Matches the app's own nav labels (App.tsx's <nav>) where one exists, spelled out for the sentence it sits in rather than abbreviated for a tab strip. */
export function navTargetSurfaceLabel(tab: HearthTab): string {
  return SURFACE_LABELS[tab] ?? "Hercules";
}

export type ReturnMessageRecord = {
  environment: Environment;
  householdId: string;
  memberId: string;
  chapterId: ChapterId;
  tab: HearthTab;
  setAt: string;
};

function storageKey(environment: Environment, householdId: string, memberId: string): string {
  return `hearth:onboardingReturn:${environment}:${householdId}:${memberId}`;
}

function defaultStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function shapeRecord(raw: unknown): ReturnMessageRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<ReturnMessageRecord>;
  if (
    (row.environment !== "development" && row.environment !== "production")
    || typeof row.householdId !== "string" || !row.householdId.trim()
    || typeof row.memberId !== "string" || !row.memberId.trim()
    || typeof row.chapterId !== "string" || !row.chapterId.trim()
    || typeof row.tab !== "string" || !row.tab.trim()
    || typeof row.setAt !== "string" || !row.setAt.trim()
  ) return null;
  return {
    environment: row.environment,
    householdId: row.householdId.trim(),
    memberId: row.memberId.trim(),
    chapterId: row.chapterId.trim(),
    tab: row.tab as HearthTab,
    setAt: row.setAt,
  };
}

/** Phone-local only, exactly like core/locationPrefs.ts — this is a nudge about this device's own last navigation, never household data, and it is never part of the household snapshot or hosted books. */
export function loadReturnMessage(
  environment: Environment,
  householdId: string,
  memberId: string,
  store: Storage | null = defaultStore(),
): ReturnMessageRecord | null {
  try {
    return shapeRecord(JSON.parse(store?.getItem(storageKey(environment, householdId, memberId)) ?? "null"));
  } catch {
    return null;
  }
}

export function saveReturnMessage(
  record: ReturnMessageRecord,
  store: Storage | null = defaultStore(),
): ReturnMessageRecord {
  try {
    store?.setItem(storageKey(record.environment, record.householdId, record.memberId), JSON.stringify(record));
  } catch {
    // Private mode / quota — the instruction stays in-memory for this render only.
  }
  return record;
}

export function clearReturnMessage(
  environment: Environment,
  householdId: string,
  memberId: string,
  store: Storage | null = defaultStore(),
): void {
  try {
    store?.removeItem(storageKey(environment, householdId, memberId));
  } catch {
    // Nothing to clean up if storage already refused to hold it.
  }
}

/**
 * The one and only thing that ends a persistent return instruction: the
 * chapter that sent this member away is no longer waiting on them — it
 * advanced (they finished it) or the household moved past needing it. No
 * timer, no route listener, no dismiss control reaches this function; it is
 * a plain read of the same nextChapterFor the rest of onboarding already
 * trusts as the source of truth for "whose turn, for what."
 */
export function returnMessageProbePassed(record: ReturnMessageRecord, household: Household, today: DateKey): boolean {
  const chapter = nextChapterFor(household, record.memberId, today);
  return chapter?.id !== record.chapterId;
}

/**
 * What Hercules.tsx actually renders from: the stored record, but only when
 * it still names this exact household/environment and its probe has not
 * yet passed. A record left over from a different household (a dev reset,
 * a different member signing in on a shared phone) or one whose chapter
 * already cleared is not an active instruction — it is stale storage, and
 * this function is where that distinction is made every render, not by any
 * one-time cleanup pass.
 */
export function activeReturnMessage(
  record: ReturnMessageRecord | null,
  household: Household,
  today: DateKey,
): ReturnMessageRecord | null {
  if (!record) return null;
  if (record.environment !== household.environment || record.householdId !== household.householdId) return null;
  if (returnMessageProbePassed(record, household, today)) return null;
  return record;
}
