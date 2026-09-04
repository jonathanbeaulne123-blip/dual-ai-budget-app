// The conductor shell's geometry and the small pure rules a component must
// never compute inline (ONBOARDING_BUILD_MANUAL.md slice 7; HEARTH_UX_PACKET.md
// §13.2). The numbers below are copied verbatim from both documents — do not
// retune them here, and do not hard-code them again in OnboardingChat.tsx.
//
// This module also carries a handful of small, pure, testable rules the
// shell needs and no other module owns yet: which sitting a chapter closes,
// who conducts a chapter for a given viewer, whether the shell should
// replace the ordinary Hercules chat at all, and what an evidence card's
// footer says about where its numbers came from. None of this posts money,
// mutates anything, or reaches into the network — it only reads the
// registry, a member's own progress, and the household's onboarding record.

import type { DateKey } from "../calendar.ts";
import type { Household } from "../types.ts";
import type { EvidenceCard } from "./evidence.ts";
import { ordinaryHerculesAvailable } from "./mode.ts";
import { nextChapterFor } from "./progress.ts";
import { householdChapters } from "./registry.ts";
import type { ChapterId, OnboardingChapter, OnboardingSitting } from "./types.ts";

/** HEARTH_UX_PACKET.md §13.2, byte-for-byte. Do not hard-code these in a component. */
export const SHELL_VIEW = {
  padTop: 22,
  padSide: 20,
  railMarkWidth: 26,
  railMarkHeight: 3,
  railGap: 6,
  railToTurn: 22,
  turnToHerc: 10,
  hercToCard: 18,
  cardToAction: 20,
  actionToFoot: 26,
  navButtonHeight: 48,
  returnBarHeight: 44,
  minTouch: 44,
  hercMaxEm: 24,
} as const;

/** Three rail marks for three sittings — never twelve for twelve chapters. */
export const SITTING_MARK_COUNT = 3;

export type ShellRole = "conductor" | "witness";

/** 0-based index of the current sitting's mark among the three rail marks. */
export function sittingRailIndex(sitting: OnboardingSitting): number | null {
  if (sitting === null) return null;
  return sitting - 1;
}

const HOUSEHOLD_CHAPTERS = householdChapters();

function siblingsInSitting(sitting: OnboardingSitting): OnboardingChapter[] {
  return HOUSEHOLD_CHAPTERS.filter((row) => row.sitting === sitting);
}

/** True for the last chapter of its sitting (today: ch-03, ch-08, ch-12) — computed from the registry, not a hard-coded list. */
export function isSittingFinalChapter(chapterId: ChapterId): boolean {
  const chapter = HOUSEHOLD_CHAPTERS.find((row) => row.id === chapterId);
  if (!chapter || chapter.sitting === null) return false;
  const siblings = siblingsInSitting(chapter.sitting);
  const lastOrder = Math.max(...siblings.map((row) => row.order));
  return chapter.order === lastOrder;
}

/** True for the first chapter of its sitting — where the sitting.two.warning heads-up belongs. */
export function isSittingFirstChapter(chapterId: ChapterId): boolean {
  const chapter = HOUSEHOLD_CHAPTERS.find((row) => row.id === chapterId);
  if (!chapter || chapter.sitting === null) return false;
  const siblings = siblingsInSitting(chapter.sitting);
  const firstOrder = Math.min(...siblings.map((row) => row.order));
  return chapter.order === firstOrder;
}

/**
 * Who conducts this chapter, from this viewer's seat.
 *
 * "self", "both", and "either" all put the viewer in the conductor's seat —
 * each member works these in their own turn, or either may act. Only
 * "partner" singles someone out: the fund/charter custodian conducts, and
 * everyone else watches. With no custodian on record yet (early in sitting
 * one, before the charter is founded), this fails open to "conductor" rather
 * than silently locking a member out of a screen with nothing to show them.
 */
export function chapterRoleFor(
  chapter: OnboardingChapter,
  viewerMemberId: string,
  custodianMemberId: string | null,
): ShellRole {
  if (chapter.conductor !== "partner") return "conductor";
  if (!custodianMemberId) return "conductor";
  return viewerMemberId === custodianMemberId ? "conductor" : "witness";
}

/**
 * The shell replaces the ordinary Hercules chat only when onboarding has
 * actually taken the household off ordinary Hercules AND this member has a
 * specific chapter waiting on them. A locked household with nothing left for
 * this particular member (an edge state Part 2's chapters will each refine
 * further) leaves the ordinary chat in place rather than showing an empty shell.
 */
export function shouldShowOnboardingShell(household: Household, memberId: string, today: DateKey): boolean {
  return !ordinaryHerculesAvailable(household) && nextChapterFor(household, memberId, today) !== null;
}

/**
 * Every evidence card cites where it came from (HEARTH_UX_PACKET.md §13.3:
 * "a provenance line at the foot — not optional"). The switch is exhaustive
 * over EvidenceCard["kind"] on purpose: a new kind added to evidence.ts
 * without a line added here is a compile error, not a silently uncited card.
 */
export function evidenceProvenanceLabel(kind: EvidenceCard["kind"]): string {
  switch (kind) {
    case "configuration":
      return "From the charter record.";
    case "account":
      return "From the accounts.";
    case "transaction":
      return "From the ledger.";
    case "receipt":
      return "From the receipt.";
    case "recurrence":
      return "From the recurring bills.";
    case "submission":
      return "From what was submitted.";
    case "approval":
      return "From the approvals record.";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/**
 * The evidence card's cap label (HEARTH_UX_PACKET.md §13.3) — short, plain,
 * and distinct from the provenance line at the card's foot. Exhaustive over
 * EvidenceCard["kind"] for the same reason evidenceProvenanceLabel is.
 */
export function evidenceCardLabel(kind: EvidenceCard["kind"]): string {
  switch (kind) {
    case "configuration":
      return "The charter";
    case "account":
      return "The accounts";
    case "transaction":
      return "The ledger";
    case "receipt":
      return "The receipt";
    case "recurrence":
      return "The recurring bills";
    case "submission":
      return "What was submitted";
    case "approval":
      return "The approvals";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export type WitnessStatusWord = "opened" | "waiting" | "submitted";
export type WitnessStatusRow = { id: string; label: string; status: WitnessStatusWord };

/**
 * Witnesses see chapter entities and plain state, never conductor field
 * values. The four partner-conducted chapters are the only witness rows in
 * v1; ch-04 may name each already-Shared account from its accepted card.
 */
export function witnessStatusRows(chapterId: ChapterId, card: EvidenceCard | null): WitnessStatusRow[] {
  switch (chapterId) {
    case "ch-04-accounts": {
      if (!card) return [{ id: "accounts", label: "Accounts", status: "waiting" }];
      return card.lines.map((line, index) => ({
        id: index === 0
          ? `household-card:${card.sourceIds.join(":")}`
          : `account:${card.sourceIds[index - 1] ?? `row-${index}`}`,
        label: line.label === "Fund card" ? "Household card" : line.label,
        status: "opened",
      }));
    }
    case "ch-05-opening":
      return [{ id: "opening-balances", label: "Opening balances", status: card ? "submitted" : "waiting" }];
    case "ch-06-fund":
      return [{ id: "household-fund", label: "Household Fund", status: card ? "opened" : "waiting" }];
    case "ch-07-recurrences":
      return [{ id: "regular-money", label: "Regular money", status: card ? "submitted" : "waiting" }];
    default:
      return [{ id: `chapter:${chapterId}`, label: "Household chapter", status: card ? "submitted" : "waiting" }];
  }
}

/** Scope disclosure while a partner-conducted chapter is still waiting. */
export function witnessChapterScopeLabel(chapterId: ChapterId): string {
  switch (chapterId) {
    case "ch-04-accounts":
      return "Shared accounts only.";
    case "ch-05-opening":
      return "Shared · opening entries";
    case "ch-06-fund":
      return "Shared · Fund setup";
    case "ch-07-recurrences":
      return "Shared · recurring bills";
    default:
      return "Shared";
  }
}

/**
 * The task card's honest-length line (HEARTH_UX_PACKET.md §13.3), rounded to
 * the nearest whole minute. No per-chapter question count exists in the
 * registry yet — Part 2's chapters are what will carry that — so this states
 * only the length, never a step count it does not have.
 */
export function taskLengthLabel(timeBudgetSeconds: number): string {
  const minutes = Math.max(1, Math.round(timeBudgetSeconds / 60));
  return minutes === 1 ? "About 1 minute." : `About ${minutes} minutes.`;
}
