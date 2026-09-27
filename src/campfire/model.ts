import { addDays, calendarDaysBetween, formatMonthLabel, monthEndKey, monthKeyFromDateKey, shiftMonthKey, weekBounds, type DateKey, type MonthKey } from "../core/calendar.ts";
import {
  chapterMonth,
  defaultNextChapter,
  monthName,
  nextFoundationChapter,
  openChapterFor,
  pendingChapterClosure,
  pendingRitualReview,
  ritualTerms,
  ritualsForChapter,
  movesForChapter,
  type Chapter,
  type Ritual,
  type RitualTerms,
  type Win,
} from "../core/chapters.ts";
import { currentPlanVersion, evaluatePlanDrift, planAcknowledgementState, requiredPlanMemberIds, type PlanHerculesSession, type PlanLine, type PlanVersion } from "../core/planSystem.ts";
import { planSelectionForVersion, projectPlan } from "../core/planProjection.ts";
import { isMonthClosed } from "../core/statements.ts";
import { proposeAllocation } from "../core/sitDown.ts";
import type { AllocationSlice } from "../core/allocate.ts";
import type { Household } from "../core/types.ts";

/**
 * The Campfire ritual (Tool Atlas T29′, TIME.md D29, decision D3), read.
 *
 * One evening a month, two people, five beats: Arrive · Look back · Settle ·
 * Look ahead · Seal. Everything here is pure: it reads the Chapter, its
 * Rituals and Moves, the household Plan versions and their acknowledgements,
 * the Shared Sitdown turns and the closed months. It writes nothing. Every
 * write the ritual makes is an existing captured command, sent by the sheet
 * through the App's own `run` (see docs/claude/tool-atlas/HANDOFF-campfire.md).
 *
 * Two laws live here so a test can hold them without a browser:
 * - the seal needs both chairs: one person alone never seals (D3);
 * - the books close inside Settle, only once, and only when both are here.
 */

export const CAMPFIRE_BEATS = ["arrive", "look-back", "settle", "look-ahead", "seal"] as const;
export type CampfireBeat = (typeof CAMPFIRE_BEATS)[number];
export const CAMPFIRE_BEAT_TITLES: Record<CampfireBeat, string> = {
  arrive: "Arrive",
  "look-back": "Look back",
  settle: "Settle",
  "look-ahead": "Look ahead",
  seal: "Seal",
};

export function beatIndex(beat: CampfireBeat): number { return CAMPFIRE_BEATS.indexOf(beat); }
export function nextBeat(beat: CampfireBeat): CampfireBeat | null { return CAMPFIRE_BEATS[beatIndex(beat) + 1] ?? null; }
export function previousBeat(beat: CampfireBeat): CampfireBeat | null { return beatIndex(beat) > 0 ? CAMPFIRE_BEATS[beatIndex(beat) - 1] ?? null : null; }

const nameOf = (household: Pick<Household, "members">, id: string | null | undefined): string =>
  household.members.find((row) => row.id === id)?.name?.trim() || "Your partner";

/** The month the fire is keeping: the open Chapter's month, else today's month. */
export function campfireMonth(household: Pick<Household, "chapters">, today: DateKey): MonthKey {
  const open = openChapterFor(household);
  return open ? chapterMonth(open) : monthKeyFromDateKey(today);
}

/** The Shared Sitdown thread the Campfire writes into: one per month, never the weekly one. */
export const campfireSitdownId = (month: MonthKey): string => `CAMPFIRE-${month}`;
/** The weekly Sitdown's thread: one per household week (Sunday start, as the household week is). */
export const weeklySitdownId = (today: DateKey): string => `SITDOWN-WEEK-${weekBounds(today).start}`;

function latestSession(household: Pick<Household, "planHerculesSessions">, sitDownSessionId: string): PlanHerculesSession | null {
  const rows = (household.planHerculesSessions ?? []).filter((row) => row.sitDownSessionId === sitDownSessionId);
  return rows.find((row) => row.state === "active") ?? [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}
export function campfireSession(household: Pick<Household, "planHerculesSessions">, month: MonthKey): PlanHerculesSession | null {
  return latestSession(household, campfireSitdownId(month));
}
export function weeklySession(household: Pick<Household, "planHerculesSessions">, today: DateKey): PlanHerculesSession | null {
  return latestSession(household, weeklySitdownId(today));
}

export type CampfireChair = { memberId: string; name: string; here: boolean; you: boolean };

/** The two chairs: the two planning partners, and whether each has sat down at this month's fire. */
export function campfireChairs(household: Household, memberId: string, today: DateKey, session = campfireSession(household, campfireMonth(household, today))): CampfireChair[] {
  const sat = new Set(session?.participantMemberIds ?? []);
  return requiredPlanMemberIds(household).map((id) => ({ memberId: id, name: nameOf(household, id), here: sat.has(id), you: id === memberId }));
}
export const bothHere = (chairs: readonly CampfireChair[]): boolean => chairs.length === 2 && chairs.every((chair) => chair.here);

// ── The seal ────────────────────────────────────────────────────────────────

export type SealStatus =
  | { kind: "no-chapter"; next: string | null }
  | { kind: "alone" }
  | { kind: "open"; chapterId: string }
  | { kind: "waiting-for-partner"; chapterId: string; partnerName: string }
  | { kind: "needs-your-seal"; chapterId: string; sealedByName: string; proposalId: string; digest: string };

/**
 * Where the seal stands for the person holding this phone. A pending closure
 * is the first seal; the Chapter closes only when the second one lands
 * (`closeChapter`'s own consent). On your own phone the words are always
 * second person; the other name appears only on your partner's phone.
 */
export function sealStatus(household: Household, memberId: string): SealStatus {
  const chapter = openChapterFor(household);
  if (!chapter) {
    const next = nextFoundationChapter(household);
    return { kind: "no-chapter", next: next?.title ?? null };
  }
  if (household.members.filter((row) => row.active).length < 2) return { kind: "alone" };
  const pending = pendingChapterClosure(chapter);
  if (!pending || pending.approvals.length === 0) return { kind: "open", chapterId: chapter.id };
  const mine = pending.approvals.some((row) => row.memberId === memberId);
  if (mine) {
    const waiting = pending.audience.find((id) => !pending.approvals.some((row) => row.memberId === id));
    return { kind: "waiting-for-partner", chapterId: chapter.id, partnerName: nameOf(household, waiting ?? household.members.find((row) => row.active && row.id !== memberId)?.id) };
  }
  return { kind: "needs-your-seal", chapterId: chapter.id, sealedByName: nameOf(household, pending.approvals[0]?.memberId), proposalId: pending.id, digest: pending.digest };
}

export function sealWords(status: SealStatus): string {
  switch (status.kind) {
    case "no-chapter": return status.next ? `No Chapter is open · the next is ${status.next}` : "No Chapter is open";
    case "alone": return "The Campfire needs two people to seal a Chapter";
    case "open": return "Not sealed yet · both seals are needed";
    case "waiting-for-partner": return `You sealed · waiting for ${status.partnerName}`;
    case "needs-your-seal": return `Sealed by ${status.sealedByName} · your seal is needed`;
  }
}

/** One person alone never seals: a seal button exists only for a two-person household with an open Chapter this person has not sealed. */
export function canGiveSeal(status: SealStatus): boolean {
  return status.kind === "open" || status.kind === "needs-your-seal";
}

// ── The books close (inside Settle, once) ───────────────────────────────────

export type BooksCloseState = {
  monthKey: MonthKey;
  monthLabel: string;
  closed: boolean;
  /** True only when the month has ended, it is not yet closed, and both chairs are taken. */
  closable: boolean;
  reason: string | null;
};

/**
 * Which month's books close at this fire. The Chapter's month once it has
 * ended; before that, the month just gone (the current month stays open so
 * groceries still post, exactly as the old leftover guide said).
 */
export function booksCloseState(household: Household, memberId: string, today: DateKey): BooksCloseState {
  const thisMonth = monthKeyFromDateKey(today);
  const chapterMonthKey = campfireMonth(household, today);
  const monthKey = chapterMonthKey < thisMonth ? chapterMonthKey : shiftMonthKey(thisMonth, -1);
  const monthLabel = monthName(monthKey);
  const closed = isMonthClosed(household, monthKey);
  const here = bothHere(campfireChairs(household, memberId, today));
  const closable = !closed && here && monthKey < thisMonth;
  const reason = closed ? `Books closed for ${monthLabel}` : !here ? "Both chairs are taken before the books close" : null;
  return { monthKey, monthLabel, closed, closable, reason };
}

// ── Look back ───────────────────────────────────────────────────────────────

export type LookBackCard = {
  id: string;
  label: string;
  lens: PlanLine["lens"];
  intendedCents: number;
  actualCents: number;
  gapCents: number;
  status: string;
};
export type LookBackRitual = { id: string; title: string; held: number; state: Ritual["state"]; readyToGraduate: boolean; pending: boolean };
export type LookBack = {
  month: MonthKey;
  version: PlanVersion | null;
  cards: LookBackCard[];
  drift: { id: string; severity: "critical" | "attention" | "gentle"; explanation: string }[];
  rituals: LookBackRitual[];
  moves: { done: number; open: number };
  wins: Win[];
};

const STATUS_WORDS: Record<string, string> = {
  completed: "kept",
  "covered-now": "covered now",
  "depends-on-income": "waits on income",
  gap: "short",
  intention: "an intention",
  "outside-horizon": "later",
};

/** The household Plan the month kept: its active (or last superseded) version. */
export function keptPlanVersion(household: Pick<Household, "planVersions">, month: MonthKey): PlanVersion | null {
  return [...(household.planVersions ?? [])]
    .filter((row) => row.scope === "household" && row.monthKey === month && (row.state === "active" || row.state === "superseded"))
    .sort((a, b) => b.sequence - a.sequence)[0] ?? null;
}

export function lookBack(household: Household, memberId: string, today: DateKey): LookBack {
  const month = campfireMonth(household, today);
  const version = keptPlanVersion(household, month);
  let cards: LookBackCard[] = [];
  let drift: LookBack["drift"] = [];
  if (version) {
    const projection = projectPlan(household, { memberId, scope: "household", acceptedRevision: household.revision, asOf: today, through: addDays(today, 30), selection: planSelectionForVersion(version) });
    cards = projection.lines.map((row) => ({
      id: row.line.id,
      label: row.line.labelSnapshot,
      lens: row.line.lens,
      intendedCents: row.intendedCents,
      actualCents: row.actualCents,
      gapCents: row.gapCents,
      status: STATUS_WORDS[row.status] ?? row.status,
    }));
    drift = evaluatePlanDrift(household, version, today).slice(0, 3).map((row) => ({ id: row.id, severity: row.severity, explanation: row.explanation }));
  }
  const chapter = openChapterFor(household);
  const rituals = chapter ? ritualsForChapter(household, chapter.id).filter((row) => row.state !== "retired").map((row) => ({
    id: row.id, title: row.title, held: row.heldOn.length, state: row.state,
    readyToGraduate: row.state === "active" && row.heldOn.length >= 3, pending: Boolean(pendingRitualReview(row)),
  })) : [];
  const moves = chapter ? movesForChapter(household, chapter.id) : [];
  const wins = (household.wins ?? []).filter((row) => !row.fadedAt && !row.keptByMemberIds.includes(memberId)
    && (chapter ? row.chapterId === chapter.id || row.shownAt.slice(0, 7) === month : row.shownAt.slice(0, 7) === month));
  return {
    month, version, cards, drift, rituals, wins,
    moves: { done: moves.filter((row) => row.state === "done").length, open: moves.filter((row) => row.state === "offered" || row.state === "accepted").length },
  };
}

// ── Settle ──────────────────────────────────────────────────────────────────

/** The exact terms that propose a Ritual's graduation or retirement; the other person agrees to the same terms. */
export function settleRitualTerms(ritual: Ritual, choice: "graduate" | "retire"): RitualTerms {
  return { ...ritualTerms(ritual), state: choice === "graduate" ? "graduated" : "retired" };
}

/** The leftover guide's first proposal, with Protect never suggested: a goal kept for Protect is not offered. */
export function campfireAllocationSlices(household: Household, today: DateKey): AllocationSlice[] {
  const protect = new Set(household.goals.filter((goal) => goal.envelope?.kind === "protect").map((goal) => goal.id));
  return proposeAllocation(household, today).filter((slice) => !(slice.kind === "goal" && protect.has(slice.targetId)));
}

// ── Look ahead ──────────────────────────────────────────────────────────────

export type WaitingCard = {
  version: PlanVersion;
  month: MonthKey;
  rolls: PlanLine[];
  fresh: PlanLine[];
  acknowledgedByYou: boolean;
  complete: boolean;
  waitingFor: string | null;
};
export type AgendaRow = { id: string; label: string; nextStep: string; who: string; inPlanner: boolean };
export type LookAhead = {
  month: MonthKey;
  monthLabel: string;
  /** Next month's household card, whatever its state. */
  next: PlanVersion | null;
  /** Household cards proposed for this month or next, face down until both have sat. */
  waiting: WaitingCard[];
  agenda: AgendaRow[];
};

export function lookAhead(household: Household, memberId: string, today: DateKey): LookAhead {
  const month = campfireMonth(household, today);
  const nextMonth = shiftMonthKey(month, 1);
  const next = currentPlanVersion(household, "household", nextMonth);
  const required = requiredPlanMemberIds(household);
  const waiting = (household.planVersions ?? [])
    .filter((row) => row.scope === "household" && row.state === "proposed" && (row.monthKey === month || row.monthKey === nextMonth))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey) || b.sequence - a.sequence)
    .map((version) => {
      const ack = planAcknowledgementState(household, version);
      const missing = required.find((id) => !ack.acknowledgedMemberIds.includes(id) && id !== memberId);
      return {
        version, month: version.monthKey,
        rolls: version.lines.filter((line) => line.cadence !== "one-time"),
        fresh: version.lines.filter((line) => line.cadence === "one-time"),
        acknowledgedByYou: ack.acknowledgedMemberIds.includes(memberId),
        complete: ack.complete,
        waitingFor: ack.complete ? null : missing ? nameOf(household, missing) : null,
      };
    });
  const agendaSource = next ?? keptPlanVersion(household, month);
  const agenda = (agendaSource?.lines ?? []).filter((line) => line.decision?.nextStep).map((line) => ({
    id: line.id,
    label: line.labelSnapshot,
    nextStep: line.decision!.nextStep!,
    who: line.responsibility?.kind === "member" ? nameOf(household, line.responsibility.memberId) : "Both of us",
    inPlanner: Boolean(household.tasks?.some((task) => task.planReference?.planLineId === line.id && task.planReference.planVersionId === agendaSource!.id && !task.deleted)),
  }));
  return { month: nextMonth, monthLabel: formatMonthLabel(nextMonth), next, waiting, agenda };
}

// ── The panel line for the Campfire host (B2 renders it) ────────────────────

/** Cards, reviews and seals waiting on this person: the "needs you" count. */
export function needsYouCount(household: Household, memberId: string, today: DateKey): number {
  const chapter = openChapterFor(household);
  const rituals = chapter ? ritualsForChapter(household, chapter.id).filter((row) => {
    const pending = pendingRitualReview(row);
    return pending && !pending.approvals.some((approval) => approval.memberId === memberId);
  }).length : 0;
  const cards = lookAhead(household, memberId, today).waiting.filter((row) => !row.acknowledgedByYou).length;
  return rituals + cards;
}

export type CampfireState = {
  /** The compact panel line: "Chapter closes in 5 days · 1 card needs you". */
  line: string;
  month: MonthKey | null;
  closesInDays: number | null;
  overdue: boolean;
  needsYou: number;
  seal: SealStatus;
};

function chapterWords(chapter: Chapter | null, today: DateKey): { words: string; closesInDays: number | null; overdue: boolean } {
  if (!chapter) return { words: "No Chapter open", closesInDays: null, overdue: false };
  const month = chapterMonth(chapter);
  if (month < monthKeyFromDateKey(today)) return { words: `Chapter still open from ${monthName(month)}`, closesInDays: 0, overdue: true };
  const days = Math.max(0, calendarDaysBetween(today, monthEndKey(month)));
  return { words: days === 0 ? "Chapter closes today" : days === 1 ? "Chapter closes tomorrow" : `Chapter closes in ${days} days`, closesInDays: days, overdue: false };
}

/**
 * The Campfire host's compact panel, as one line (pure). The seal outranks the
 * card count: a waiting seal is the one thing the fire is asking about.
 */
export function campfireState(household: Household, memberId: string, today: DateKey): CampfireState {
  const chapter = openChapterFor(household);
  const { words, closesInDays, overdue } = chapterWords(chapter, today);
  const seal = sealStatus(household, memberId);
  const needsYou = needsYouCount(household, memberId, today);
  const tail = seal.kind === "waiting-for-partner" ? `waiting for ${seal.partnerName}`
    : seal.kind === "needs-your-seal" ? `Sealed by ${seal.sealedByName} · your seal is needed`
      : needsYou > 0 ? `${needsYou} ${needsYou === 1 ? "card needs" : "cards need"} you` : null;
  return { line: tail ? `${words} · ${tail}` : words, month: chapter ? chapterMonth(chapter) : null, closesInDays, overdue, needsYou, seal };
}

/** The next Chapter the seal would open when nobody picks one (the foundation's next, else a month of our own). */
export function nextChapterChoice(household: Household, today: DateKey) {
  return defaultNextChapter(household, monthKeyFromDateKey(today));
}
