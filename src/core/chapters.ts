import {assertLegacyWinWriteAllowed} from '../hearthside/winMemory.ts';
import { captureCommand } from "../ledgerSync/capture.ts";
import { dateKeyInZone, monthKeyFromDateKey, shiftMonthKey, type DateKey, type MonthKey } from "./calendar.ts";
import { cloneHousehold } from "./household.ts";
import { nextId, nowIso } from "./ids.ts";
import type { CommitResult, Household } from "./types.ts";
import { ValidationError } from "./types.ts";
import type { TaskEvidence, TaskMoneyLink } from './tasks.ts';
import { acknowledgeTask, completeTask, saveTask, validateTask, validateTaskReferences, type Task } from './tasks.ts';
import { approveChapterConsent, chapterConsentDigest, chapterConsentFail, consentRevision, exactChapterRecord, proposeChapterConsent, shapeChapterConsent, shapeChapterParticipation, mergeChapterParticipation, selectChapterConsent, type ChapterConsent, type ChapterParticipation } from './chapterConsent.ts';
import { chapterTaskId } from './chapterTaskSource.ts';
import { canonical } from '../ledgerSync/patch.ts';
import { isValidDateKey } from './calendar.ts';
import { chapterTask, projectMoveTask, projectRitualTasks, ritualOperational, taskForMove, taskForRitual, validateRitualClosureReference } from './chapterTasks.ts';
import { fundModelMode } from "./fundRules.ts";

/**
 * The Chapter system (Vision v2 §5): Journey → Chapter → Lesson / Ritual / Move → Win → Memory.
 *
 * These are non-money objects. They live in the Shared envelope beside
 * `monthRehearsals`, are omitted from every financial hash, never reach
 * Hercules model context, and never post. Commands here return empty
 * `postedIds` so the runtime classifies them as kitchen-local writes.
 *
 * A Chapter follows the couple's Sitdown, not the calendar. At most one
 * Chapter is open at a time. A month ends; it does not pass or fail.
 *
 * Money model (D-273): a Chapter's *intended span* is a calendar month
 * (`intendedMonth`). Nothing ever closes it automatically; once its month
 * has ended, a reminder repeats (at most one nudge a day) until the Sitdown
 * closes it, and the Sitdown opens the next Chapter for the month the
 * Sitdown happens in. Skipped months read as "no Chapter", never as failed.
 */

export type ChapterState = "open" | "established" | "still-forming" | "life-changed" | "closed";
export type ChapterOutcome = Exclude<ChapterState, "open">;

export type RitualCue = "payday" | "pre-rent" | "weekly" | "sitdown" | "after-surprise" | "custom";
export type RitualState = "active" | "graduated" | "paused" | "retired";

export type MoveState = "offered" | "accepted" | "done" | "declined" | "paused";

export type WinLevel = "acknowledgment" | "shared-win" | "first" | "graduation";

export type FoundationChapterId =
  | "see-our-shared-life"
  | "make-rent-boring"
  | "share-the-mental-load"
  | "build-breathing-room"
  | "make-room-for-joy"
  | "handle-a-surprise-together";

export type Chapter = {
  version: 1;
  id: string;
  foundationId: FoundationChapterId | null;
  title: string;
  /** Why this matters to us, in the couple's words or the foundation's plain default. */
  meaning: string;
  /** What better will feel like. */
  betterFeelsLike: string;
  lessonId: string;
  openedAt: string;
  openedByMemberId: string;
  openedAtSitdownId: string | null;
  closedAt: string | null;
  closedAtSitdownId: string | null;
  state: ChapterState;
  /** What carries forward into the next Chapter, written at closing. */
  carryForward: string;
  /** The calendar month this Chapter is meant to span (D-273). Legacy rows omit it and read as the month they opened. */
  intendedMonth?: MonthKey;
  updatedAt: string;
  closure?: ChapterConsent<ChapterClosureTerms>;
};

export type Ritual = {
  version: 1;
  id: string;
  chapterId: string;
  title: string;
  cue: RitualCue;
  /** Plain words for a custom cue, or a detail for a standard one ("the Friday before rent"). */
  cueNote: string;
  ownerMemberId: string;
  backupMemberId: string | null;
  doneDefinition: string;
  recoveryMove: string;
  state: RitualState;
  /** Civil dates on which the Ritual held. Evidence, never a streak; a gap costs nothing. */
  heldOn: DateKey[];
  updatedAt: string;
  agreement?: ChapterConsent<RitualTerms>;
  participation?: ChapterParticipation[];
  taskAdoption?: { version: 1; adoptedAt: string };
  requiresMoneyEvidence?: boolean;
  moneyLink?: TaskMoneyLink | null;
  expectedAmountCents?: number | null;
  approvalViaClosure?: { chapterId: string; proposalId: string; digest: string };
};

export type Move = {
  version: 1;
  id: string;
  chapterId: string;
  ritualId: string | null;
  text: string;
  ownerMemberId: string | null;
  needsAcknowledgment: boolean;
  acknowledgedByMemberIds: string[];
  state: MoveState;
  completedAt: string | null;
  completedByMemberId: string | null;
  /** A pointer to accepted evidence (transaction, Fund event, Plan version id). Never an amount. */
  evidenceRef: string | null;
  updatedAt: string;
  taskId?: string;
  createdByMemberId?: string | null;
  sharedApprovals?: { revision: number; materialVersion: number; audience: string[]; memberIds: string[] };
};

export type RitualTerms = Pick<Ritual, 'title' | 'cue' | 'cueNote' | 'ownerMemberId' | 'backupMemberId' | 'doneDefinition' | 'recoveryMove' | 'state'> & {
  requiresMoneyEvidence: boolean; moneyLink: TaskMoneyLink | null; expectedAmountCents: number | null;
};
export type ChapterClosureTerms = { outcome: ChapterOutcome; carryForward: string; sitdownId: string | null;
  rituals: { ritualId: string; before: RitualTerms; afterState: RitualState }[];
  moves: { taskId: string; moveId: string; taskRevision: number; title: string; ownerMemberId: string | null }[];
};

export type Win = {
  version: 1;
  id: string;
  chapterId: string | null;
  level: WinLevel;
  title: string;
  evidenceRefs: string[];
  shownAt: string;
  /** Routine Wins fade after acknowledgment; a kept Memory never fades. */
  fadedAt: string | null;
  /** A shared Memory is kept when both partners choose it. */
  keptByMemberIds: string[];
  authoredNote: string;
  hideAmounts: boolean;
  updatedAt: string;
};

export type FoundationChapter = {
  id: FoundationChapterId;
  order: number;
  title: string;
  purpose: string;
  meaning: string;
  betterFeelsLike: string;
  lessonId: string;
  /** The one primary habit this Chapter introduces. */
  ritual: Pick<Ritual, "title" | "cue" | "cueNote" | "doneDefinition" | "recoveryMove">;
  firstMove: string;
  tools: readonly string[];
  closingEvidence: string;
};

/** The committed six-Chapter foundation — a living curriculum, never a locked sequence. */
export const FOUNDATION_CHAPTERS: readonly FoundationChapter[] = [
  {
    id: "see-our-shared-life",
    order: 1,
    title: "See Our Shared Life",
    purpose: "Create a shared model without forcing full financial merging.",
    meaning: "We want to both be able to say what this home has, what it needs, and what we agreed — without either of us handing over our whole financial life.",
    betterFeelsLike: "Either of us can explain where the household truth comes from.",
    lessonId: "shared-operating-system",
    ritual: {
      title: "Bring one shared question to the Sitdown",
      cue: "sitdown",
      cueNote: "Whenever a money question comes up between us, write it down instead of carrying it.",
      doneDefinition: "One question or change we would otherwise have carried privately is on the Sitdown agenda.",
      recoveryMove: "If we skipped a Sitdown, we add the question to the next one — nothing is lost.",
    },
    firstMove: "Sign the Charter together and name who holds the Fund.",
    tools: ["Shared Home Map", "Shared Agenda Builder", "Four-Horizon View"],
    closingEvidence: "Both of us can explain the household system and reach the relevant truth.",
  },
  {
    id: "make-rent-boring",
    order: 2,
    title: "Make Rent Boring",
    purpose: "Make the most important near-term obligation dependable and emotionally lighter.",
    meaning: "Rent should be the least interesting thing that happens to us each month.",
    betterFeelsLike: "A few days before rent, we already know it is covered.",
    lessonId: "cashflow-balance",
    ritual: {
      title: "Pre-rent readiness check",
      cue: "pre-rent",
      cueNote: "The payday before rent.",
      doneDefinition: "The Fund shows rent covered, or the one gap has an owner and a plan.",
      recoveryMove: "If we missed the check, we do a two-minute version today and move one date or contribution.",
    },
    firstMove: "Choose which payday the pre-rent check belongs to.",
    tools: ["Cash-Flow Ribbon", "Coverage Ladder", "Responsibility Map"],
    closingEvidence: "Rent was understood, prepared, accepted, and completed with less uncertainty.",
  },
  {
    id: "share-the-mental-load",
    order: 3,
    title: "Share the Mental Load",
    purpose: "Make invisible financial work visible without demanding identical participation.",
    meaning: "Paying a bill is visible; remembering it, comparing, and worrying are not. Neither of us should carry that alone.",
    betterFeelsLike: "Neither of us is guessing who carries the next step.",
    lessonId: "mental-load",
    ritual: {
      title: "One whole responsibility has an owner and a backup",
      cue: "weekly",
      cueNote: "Our weekly ten minutes.",
      doneDefinition: "The responsibility shows its owner, what done means, and where the backup can find the record.",
      recoveryMove: "If the owner is unavailable, the backup does the smallest version and we re-decide at the Sitdown.",
    },
    firstMove: "Pick one recurring responsibility and write what done means.",
    tools: ["Mental-Load View", "Responsibility Map", "Backup Knowledge Card"],
    closingEvidence: "Neither partner is guessing who carries the next step.",
  },
  {
    id: "build-breathing-room",
    order: 4,
    title: "Build Breathing Room",
    purpose: "Create the first believable layer of resilience.",
    meaning: "We want one surprise not to become an emergency.",
    betterFeelsLike: "We can name the first shock we are better able to absorb.",
    lessonId: "true-expenses",
    ritual: {
      title: "A small contribution moves into the buffer",
      cue: "payday",
      cueNote: "Each payday, after the essentials.",
      doneDefinition: "The buffer Kitty Bank recorded a contribution this pay cycle, however small.",
      recoveryMove: "If a payday was tight, we skip without shame and note why at the Sitdown.",
    },
    firstMove: "Name what the buffer protects first.",
    tools: ["Buffer Runway", "True-Expense Radar", "Shock Scenario"],
    closingEvidence: "The couple can name the first shock they are better able to absorb.",
  },
  {
    id: "make-room-for-joy",
    order: 5,
    title: "Make Room for Joy",
    purpose: "Prove that financial health creates meaningful choice, not only restriction.",
    meaning: "Our money should make room for a life worth living, not only for bills.",
    betterFeelsLike: "We can see what our repeated care is making possible.",
    lessonId: "goals-tradeoffs",
    ritual: {
      title: "One contribution advances the goal we chose",
      cue: "payday",
      cueNote: "Each payday, a realistic amount toward the chosen Kitty Bank.",
      doneDefinition: "The chosen goal recorded a contribution or a planning decision this cycle.",
      recoveryMove: "If we could not contribute, we revisit the pace together — the goal stays.",
    },
    firstMove: "Choose the one goal this Chapter is for and why it matters.",
    tools: ["Goal Tradeoff Map", "Scenario Slider", "An authored celebration plan"],
    closingEvidence: "The couple can see what their repeated care is making possible.",
  },
  {
    id: "handle-a-surprise-together",
    order: 6,
    title: "Handle a Surprise Together",
    purpose: "Practise recovery before a difficult event becomes a story of failure.",
    meaning: "A setback should mean we adapt, not that we failed.",
    betterFeelsLike: "We separate the problem from blame and make one stabilizing decision together.",
    lessonId: "surprise-recovery",
    ritual: {
      title: "Short recovery Ritual after a surprise",
      cue: "after-surprise",
      cueNote: "Whenever the shared plan materially changes.",
      doneDefinition: "We named the impact, protected one thing first, and made one decision — before rebuilding the whole plan.",
      recoveryMove: "If we reacted before talking, we still run the Ritual afterwards and record what we learned.",
    },
    firstMove: "Rehearse one likely surprise in the Plan's stress rehearsal.",
    tools: ["Priority Ladder", "Recovery Plan", "What Changed Card"],
    closingEvidence: "The couple can adapt while preserving earlier progress and dignity.",
  },
];

export function foundationChapter(id: FoundationChapterId): FoundationChapter {
  const found = FOUNDATION_CHAPTERS.find((row) => row.id === id);
  if (!found) throw new ValidationError("That Chapter is not part of the foundation.");
  return found;
}

/** The next foundation Chapter the couple has not closed as established, or null when the foundation is complete. */
export function nextFoundationChapter(household: Pick<Household, "chapters">): FoundationChapter | null {
  const done = new Set((household.chapters ?? []).filter((row) => row.state === "established" || row.state === "closed").map((row) => row.foundationId));
  return FOUNDATION_CHAPTERS.find((row) => !done.has(row.id)) ?? null;
}

// ---------------------------------------------------------------------------
// Shapes and merges — fail closed, last writer wins, evidence unions.

function validIso(value: unknown, fallback: string): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
}
function str(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
function strList(value: unknown, max = 200): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((row): row is string => typeof row === "string"))].slice(0, max) : [];
}
const CHAPTER_STATES: readonly ChapterState[] = ["open", "established", "still-forming", "life-changed", "closed"];
const RITUAL_CUES: readonly RitualCue[] = ["payday", "pre-rent", "weekly", "sitdown", "after-surprise", "custom"];
const RITUAL_STATES: readonly RitualState[] = ["active", "graduated", "paused", "retired"];
const MOVE_STATES: readonly MoveState[] = ["offered", "accepted", "done", "declined", "paused"];
const WIN_LEVELS: readonly WinLevel[] = ["acknowledgment", "shared-win", "first", "graduation"];
const EPOCH = "1970-01-01T00:00:00.000Z";
export function ritualTerms(ritual: Ritual): RitualTerms {
  const { title, cue, cueNote, ownerMemberId, backupMemberId, doneDefinition, recoveryMove, state } = ritual;
  return { title, cue, cueNote, ownerMemberId, backupMemberId, doneDefinition, recoveryMove, state, requiresMoneyEvidence: ritual.requiresMoneyEvidence === true, moneyLink: ritual.moneyLink ?? null, expectedAmountCents: ritual.expectedAmountCents ?? null };
}
function shapeClosureTerms(value: unknown): ChapterClosureTerms {
  exactChapterRecord(value, ['outcome', 'carryForward', 'sitdownId', 'rituals', 'moves']);
  if (!CHAPTER_STATES.includes(value.outcome as ChapterState) || value.outcome === 'open' || typeof value.carryForward !== 'string' || value.carryForward.length > 2000 || value.sitdownId !== null && (typeof value.sitdownId !== 'string' || value.sitdownId.length > 160)) chapterConsentFail('Check the exact Chapter closure terms.');
  if (!Array.isArray(value.rituals) || !Array.isArray(value.moves) || value.rituals.length > 4000 || value.moves.length > 4000) chapterConsentFail('This Chapter closure has too many linked objects.');
  for (const row of value.rituals) { exactChapterRecord(row, ['ritualId', 'before', 'afterState']); if (typeof row.ritualId !== 'string' || !row.ritualId || !RITUAL_STATES.includes(row.afterState as RitualState)) chapterConsentFail('Check this Ritual in the closure.'); shapeRitualTerms(row.before); }
  for (const row of value.moves) { exactChapterRecord(row, ['taskId', 'moveId', 'taskRevision', 'title', 'ownerMemberId']); if (typeof row.taskId !== 'string' || typeof row.moveId !== 'string' || row.taskId !== chapterTaskId('chapter-move', row.moveId) || !Number.isSafeInteger(row.taskRevision) || Number(row.taskRevision) < 1 || typeof row.title !== 'string' || row.title.length > 240 || row.ownerMemberId !== null && typeof row.ownerMemberId !== 'string') chapterConsentFail('Check this Task in the closure.'); }
  return structuredClone(value) as ChapterClosureTerms;
}
function shapeRitualTerms(value: unknown): RitualTerms {
  exactChapterRecord(value, ['title', 'cue', 'cueNote', 'ownerMemberId', 'backupMemberId', 'doneDefinition', 'recoveryMove', 'state', 'requiresMoneyEvidence', 'moneyLink', 'expectedAmountCents']);
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 120 || typeof value.cueNote !== 'string' || value.cueNote.length > 240 || typeof value.doneDefinition !== 'string' || !value.doneDefinition.trim() || value.doneDefinition.length > 2000 || typeof value.recoveryMove !== 'string' || value.recoveryMove.length > 2000 || !RITUAL_CUES.includes(value.cue as RitualCue) || !RITUAL_STATES.includes(value.state as RitualState) || typeof value.ownerMemberId !== 'string' || !value.ownerMemberId || value.backupMemberId !== null && (typeof value.backupMemberId !== 'string' || !value.backupMemberId || value.backupMemberId === value.ownerMemberId) || typeof value.requiresMoneyEvidence !== 'boolean' || value.expectedAmountCents !== null && (!Number.isSafeInteger(value.expectedAmountCents) || Number(value.expectedAmountCents) < 0 || Number(value.expectedAmountCents) > 99_999_999)) chapterConsentFail('Check the exact Ritual terms, responsibility and recovery.');
  if (value.moneyLink !== null) {
    const link = value.moneyLink as Record<string, unknown>;
    if (link.kind === 'goal') exactChapterRecord(link, ['kind', 'goalId']);
    else if (link.kind === 'potential-expense') exactChapterRecord(link, ['kind', 'potentialExpenseId']);
    else if (link.kind === 'recurrence') exactChapterRecord(link, ['kind', 'recurrenceId', 'date']);
    else chapterConsentFail('Choose the Ritual’s existing financial reference.');
    if (Object.values(link).some(v => typeof v !== 'string' || !v || v.length > 160) || link.kind === 'recurrence' && !isValidDateKey(String(link.date))) chapterConsentFail('Choose a valid existing financial reference.');
  }
  return structuredClone(value) as RitualTerms;
}

export function shapeChapters(value: unknown): Chapter[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<Chapter>;
    if (row.version !== 1 || !row.id || !row.openedByMemberId || !row.title) return [];
    const openedAt = validIso(row.openedAt, EPOCH);
    return [{
      version: 1,
      id: String(row.id),
      foundationId: FOUNDATION_CHAPTERS.some((f) => f.id === row.foundationId) ? (row.foundationId as FoundationChapterId) : null,
      title: str(row.title, 120),
      meaning: str(row.meaning),
      betterFeelsLike: str(row.betterFeelsLike),
      lessonId: str(row.lessonId, 80),
      openedAt,
      openedByMemberId: String(row.openedByMemberId),
      openedAtSitdownId: row.openedAtSitdownId ? String(row.openedAtSitdownId) : null,
      closedAt: row.closedAt ? validIso(row.closedAt, openedAt) : null,
      closedAtSitdownId: row.closedAtSitdownId ? String(row.closedAtSitdownId) : null,
      state: CHAPTER_STATES.includes(row.state as ChapterState) ? (row.state as ChapterState) : "open",
      carryForward: str(row.carryForward),
      ...(typeof row.intendedMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(row.intendedMonth) ? { intendedMonth: row.intendedMonth } : {}),
      updatedAt: validIso(row.updatedAt, openedAt),
      ...(row.closure !== undefined ? { closure: shapeChapterConsent(row.closure, shapeClosureTerms) } : {}),
    } satisfies Chapter];
  });
}

export function shapeRituals(value: unknown): Ritual[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<Ritual>;
    if (row.version !== 1 || !row.id || !row.chapterId || !row.ownerMemberId || !row.title) return [];
    return [{
      version: 1,
      id: String(row.id),
      chapterId: String(row.chapterId),
      title: str(row.title, 120),
      cue: RITUAL_CUES.includes(row.cue as RitualCue) ? (row.cue as RitualCue) : "custom",
      cueNote: str(row.cueNote, 240),
      ownerMemberId: String(row.ownerMemberId),
      backupMemberId: row.backupMemberId ? String(row.backupMemberId) : null,
      doneDefinition: str(row.doneDefinition),
      recoveryMove: str(row.recoveryMove),
      state: RITUAL_STATES.includes(row.state as RitualState) ? (row.state as RitualState) : "active",
      heldOn: strList(row.heldOn, 400).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort() as DateKey[],
      updatedAt: validIso(row.updatedAt, EPOCH),
      ...(row.agreement !== undefined ? { agreement: shapeChapterConsent(row.agreement, shapeRitualTerms) } : {}),
      ...(row.participation !== undefined ? { participation: shapeChapterParticipation(row.participation) } : {}),
      ...(row.taskAdoption !== undefined ? (() => { exactChapterRecord(row.taskAdoption, ['version', 'adoptedAt']); if (row.taskAdoption.version !== 1 || validIso(row.taskAdoption.adoptedAt, '') === '') chapterConsentFail('This Ritual’s task adoption needs recovery.'); return { taskAdoption: { version: 1 as const, adoptedAt: row.taskAdoption.adoptedAt as string } }; })() : {}),
      ...(row.requiresMoneyEvidence !== undefined ? (() => { if (typeof row.requiresMoneyEvidence !== 'boolean') chapterConsentFail('This Ritual’s evidence requirement needs recovery.'); return { requiresMoneyEvidence: row.requiresMoneyEvidence }; })() : {}),
      ...(row.moneyLink !== undefined ? { moneyLink: shapeRitualTerms({ ...ritualTerms(row as Ritual), moneyLink: row.moneyLink }).moneyLink } : {}),
      ...(row.expectedAmountCents !== undefined ? { expectedAmountCents: shapeRitualTerms(ritualTerms(row as Ritual)).expectedAmountCents } : {}),
      ...(row.approvalViaClosure !== undefined ? (() => { exactChapterRecord(row.approvalViaClosure, ['chapterId', 'proposalId', 'digest']); if (row.approvalViaClosure.chapterId !== row.chapterId || typeof row.approvalViaClosure.proposalId !== 'string' || !/^[a-f0-9]{64}$/.test(String(row.approvalViaClosure.digest))) chapterConsentFail('This Ritual’s Chapter approval reference needs recovery.'); return { approvalViaClosure: structuredClone(row.approvalViaClosure) as Ritual['approvalViaClosure'] }; })() : {}),
    } satisfies Ritual];
  });
}

export function shapeMoves(value: unknown): Move[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<Move>;
    if (row.version !== 1 || !row.id || !row.chapterId || !row.text) return [];
    return [{
      version: 1,
      id: String(row.id),
      chapterId: String(row.chapterId),
      ritualId: row.ritualId ? String(row.ritualId) : null,
      text: str(row.text, 400),
      ownerMemberId: row.ownerMemberId ? String(row.ownerMemberId) : null,
      needsAcknowledgment: row.needsAcknowledgment === true,
      acknowledgedByMemberIds: strList(row.acknowledgedByMemberIds, 8),
      state: MOVE_STATES.includes(row.state as MoveState) ? (row.state as MoveState) : "offered",
      completedAt: row.completedAt ? validIso(row.completedAt, EPOCH) : null,
      completedByMemberId: row.completedByMemberId ? String(row.completedByMemberId) : null,
      evidenceRef: row.evidenceRef ? str(row.evidenceRef, 120) : null,
      updatedAt: validIso(row.updatedAt, EPOCH),
      ...(row.taskId !== undefined ? (() => { if (typeof row.taskId !== 'string' || row.taskId !== chapterTaskId('chapter-move', String(row.id))) chapterConsentFail('This Move’s canonical Task reference changed.'); return { taskId: row.taskId }; })() : {}),
      ...(row.createdByMemberId !== undefined ? { createdByMemberId: row.createdByMemberId ? String(row.createdByMemberId) : null } : {}),
      ...(row.sharedApprovals !== undefined ? (() => { exactChapterRecord(row.sharedApprovals, ['revision', 'materialVersion', 'audience', 'memberIds']); if (!Number.isSafeInteger(row.sharedApprovals.revision) || Number(row.sharedApprovals.revision) < 1 || !Array.isArray(row.sharedApprovals.audience) || row.sharedApprovals.audience.length > 16 || row.sharedApprovals.audience.some(v => typeof v !== 'string' || !v) || new Set(row.sharedApprovals.audience).size !== row.sharedApprovals.audience.length || !Number.isSafeInteger(row.sharedApprovals.materialVersion) || Number(row.sharedApprovals.materialVersion) < 1 || !Array.isArray(row.sharedApprovals.memberIds) || row.sharedApprovals.memberIds.length > 16 || row.sharedApprovals.memberIds.some(v => typeof v !== 'string' || !(row.sharedApprovals as { audience: string[] }).audience.includes(v)) || new Set(row.sharedApprovals.memberIds).size !== row.sharedApprovals.memberIds.length) chapterConsentFail('This Move’s exact acknowledgements need recovery.'); return { sharedApprovals: structuredClone(row.sharedApprovals) as Move['sharedApprovals'] }; })() : {}),
    } satisfies Move];
  });
}

export function shapeWins(value: unknown): Win[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Partial<Win>;
    if (row.version !== 1 || !row.id || !row.title) return [];
    const shownAt = validIso(row.shownAt, EPOCH);
    return [{
      version: 1,
      id: String(row.id),
      chapterId: row.chapterId ? String(row.chapterId) : null,
      level: WIN_LEVELS.includes(row.level as WinLevel) ? (row.level as WinLevel) : "acknowledgment",
      title: str(row.title, 160),
      evidenceRefs: strList(row.evidenceRefs, 20),
      shownAt,
      fadedAt: row.fadedAt ? validIso(row.fadedAt, shownAt) : null,
      keptByMemberIds: strList(row.keptByMemberIds, 8),
      authoredNote: str(row.authoredNote),
      hideAmounts: row.hideAmounts !== false,
      updatedAt: validIso(row.updatedAt, shownAt),
    } satisfies Win];
  });
}

function mergeById<T extends { id: string; updatedAt: string }>(left: T[], right: T[], combine?: (a: T, b: T) => T): T[] {
  const rows = new Map(left.map((row) => [row.id, row]));
  for (const incoming of right) {
    const existing = rows.get(incoming.id);
    if (!existing) { rows.set(incoming.id, incoming); continue; }
    const newest = existing.updatedAt >= incoming.updatedAt ? existing : incoming;
    rows.set(incoming.id, combine ? combine(newest, newest === existing ? incoming : existing) : newest);
  }
  return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function mergeChapters(left: Chapter[] = [], right: Chapter[] = []): Chapter[] {
  return mergeById(left, right, (newest, other) => {
    const selected = selectChapterConsent(newest.closure, other.closure);
    return selected === other.closure && other.closure ? other : newest;
  });
}
export function mergeRituals(left: Ritual[] = [], right: Ritual[] = []): Ritual[] {
  return mergeById(left, right, (newest, other) => {
    const selected = selectChapterConsent(newest.agreement, other.agreement);
    const base = selected === other.agreement && other.agreement ? other : newest;
    const peer = base === newest ? other : newest;
    // Old clients cannot erase an adoption or authorize changed shared terms.
    const modern = base.agreement || base.taskAdoption ? base : peer.taskAdoption ? peer : base;
    const closure = !modern.approvalViaClosure && peer.approvalViaClosure && consentRevision(modern.agreement) === consentRevision(peer.agreement) ? peer : modern;
    if (newest.agreement && other.agreement && consentRevision(newest.agreement) === consentRevision(other.agreement) && !newest.approvalViaClosure && !other.approvalViaClosure && canonical(ritualTerms(newest)) !== canonical(ritualTerms(other))) chapterConsentFail('Conflicting Ritual terms need authoritative recovery.');
    return { ...closure, participation: mergeChapterParticipation(newest.participation, other.participation), ...(newest.taskAdoption || other.taskAdoption ? { taskAdoption: newest.taskAdoption ?? other.taskAdoption } : {}), heldOn: [...new Set([...newest.heldOn, ...other.heldOn])].sort() as DateKey[] };
  });
}
export function mergeMoves(left: Move[] = [], right: Move[] = []): Move[] {
  return mergeById(left, right, (newest, other) => {
    if (!newest.taskId && !other.taskId) return { ...newest, acknowledgedByMemberIds: [...new Set([...newest.acknowledgedByMemberIds, ...other.acknowledgedByMemberIds])] };
    if (newest.taskId && other.taskId && newest.taskId !== other.taskId) chapterConsentFail('Conflicting Move identities need authoritative recovery.');
    const a = newest.sharedApprovals, b = other.sharedApprovals;
    if (a && b && a.revision === b.revision && canonical(a) !== canonical(b)) chapterConsentFail('Conflicting Move approvals need authoritative recovery.');
    const base = !newest.taskId || b && (!a || b.revision > a.revision) ? other : newest;
    return { ...base };
  });
}
export function mergeWins(left: Win[] = [], right: Win[] = []): Win[] {
  return mergeById(left, right, (newest, other) => ({ ...newest, keptByMemberIds: [...new Set([...newest.keptByMemberIds, ...other.keptByMemberIds])] }));
}

// ---------------------------------------------------------------------------
// Read helpers

export function openChapterFor(household: Pick<Household, "chapters">): Chapter | null {
  return (household.chapters ?? []).find((row) => row.state === "open") ?? null;
}
export function ritualsForChapter(household: Pick<Household, "rituals" | 'tasks'>, chapterId: string): Ritual[] {
  return (household.rituals ?? []).filter((row) => row.chapterId === chapterId).map(row => projectRitualTasks(household, row));
}
export function movesForChapter(household: Pick<Household, "moves" | 'tasks'>, chapterId: string): Move[] {
  return (household.moves ?? []).filter((row) => row.chapterId === chapterId).map(row => projectMoveTask(household, row));
}
/** Graduated habits holding quietly outside the monthly foreground. */
export function ourRhythm(household: Pick<Household, "rituals" | 'tasks'> & Partial<Pick<Household, 'chapters'>>): Ritual[] {
  return (household.rituals ?? []).filter((row) => row.state === "graduated" || (row.state === "paused" || row.state === "active") && household.chapters?.some(chapter => chapter.id === row.chapterId && chapter.state === "established")).map(row => projectRitualTasks(household, row));
}
/** The next Move: the first offered or accepted Move in the open Chapter, owner-first for the signed-in member. */
export function nextMove(household: Pick<Household, "chapters" | "moves" | 'tasks'>, memberId: string): Move | null {
  const chapter = openChapterFor(household);
  if (!chapter) return null;
  const candidates = movesForChapter(household, chapter.id).filter((row) => row.state === "offered" || row.state === "accepted");
  return candidates.find((row) => row.ownerMemberId === memberId) ?? candidates.find((row) => !row.ownerMemberId) ?? candidates[0] ?? null;
}
/** Recent Win still on display (not faded, or kept as a Memory). */
export function recentWin(household: Pick<Household, "wins">, now = nowIso()): Win | null {
  const rows = (household.wins ?? []).filter((row) => !row.fadedAt || row.fadedAt > now);
  return rows.sort((a, b) => b.shownAt.localeCompare(a.shownAt))[0] ?? null;
}
export function memories(household: Pick<Household, "wins" | "members">): Win[] {
  const required = household.members.filter((m) => m.active).map((m) => m.id);
  return (household.wins ?? []).filter((row) => required.length > 0 && required.every((id) => row.keptByMemberIds.includes(id)));
}
/** A Ritual is ready to graduate once it has held three times; the couple still chooses. */
export function ritualReadyToGraduate(ritual: Ritual): boolean {
  return ritual.state === "active" && ritual.heldOn.length >= 3;
}

/**
 * The celebration ladder (Vision v2 §5.5) as a pure function from evidence to level.
 * Pressure (critical drift) reverses the ladder: nothing celebrates.
 */
export function celebrationLevel(input: {
  kind: "move" | "ritual-held" | "first" | "chapter-graduation";
  holdCount?: number;
  underPressure?: boolean;
}): WinLevel | null {
  if (input.underPressure) return null;
  switch (input.kind) {
    case "move": return "acknowledgment";
    case "ritual-held": return (input.holdCount ?? 0) >= 3 ? "shared-win" : "acknowledgment";
    case "first": return "first";
    case "chapter-graduation": return "graduation";
  }
}

// ---------------------------------------------------------------------------
// Commands — non-money, kitchen-local, member-validated.

function requireMember(household: Household, memberId: string): void {
  if (!household.members.some((member) => member.active && member.id === memberId)) {
    throw new ValidationError("Only an active household member can do this.");
  }
}
function partnerOf(household: Household, memberId: string): string | null {
  return household.members.find((member) => member.active && member.id !== memberId)?.id ?? null;
}
function commitChapters(previous: Household, next: Household, label: string, at: string): CommitResult {
  next.lastCommittedAt = at;
  return {
    household: next,
    warnings: [],
    postedIds: [],
    undo: { id: nextId("UNDO-CHAPTER-", []), label, snapshot: previous, postedIds: [], commandKind: "updateChapters" },
  };
}
function validMonth(value: unknown): MonthKey | null {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}
function findChapter(household: Household, chapterId: string): Chapter {
  const row = (household.chapters ?? []).find((c) => c.id === chapterId);
  if (!row) throw new ValidationError("That Chapter is no longer available.");
  return row;
}
const activeAudience = (household: Household) => household.members.filter(member => member.active).map(member => member.id).sort();
export const ritualAgreementRevision = (ritual: Ritual) => consentRevision(ritual.agreement);
export const chapterClosureRevision = (chapter: Chapter) => consentRevision(chapter.closure);
export function pendingRitualReview(ritual: Ritual) { return ritual.agreement?.proposals.find(p => p.state === 'pending') ?? null; }
export function pendingChapterClosure(chapter: Chapter) { return chapter.closure?.proposals.find(p => p.state === 'pending') ?? null; }
function findRitual(household: Household, ritualId: string): Ritual {
  const ritual = household.rituals?.find(row => row.id === ritualId);
  if (!ritual) chapterConsentFail('That Ritual is no longer available.');
  return ritual;
}
function putChapterTask(household: Household, task: Task): void {
  household.tasks = [...(household.tasks ?? []).filter(row => row.id !== task.id), task];
}
function ritualBasis(ritual: Ritual): string { return chapterConsentDigest({ terms: ritualTerms(ritual), accepted: ritual.agreement?.acceptedProposalId ?? null }); }
function closureBasis(household: Household, chapter: Chapter): string {
  return chapterConsentDigest({ chapter: { id: chapter.id, title: chapter.title, meaning: chapter.meaning, betterFeelsLike: chapter.betterFeelsLike, state: chapter.state, openedAt: chapter.openedAt },
    rituals: (household.rituals ?? []).filter(row => row.chapterId === chapter.id).map(row => ({ id: row.id, terms: ritualTerms(row), agreement: row.agreement?.acceptedProposalId ?? null })).sort((a, b) => a.id.localeCompare(b.id)),
    tasks: (household.tasks ?? []).filter(row => row.chapterId === chapter.id && row.chapterSource).map(row => ({ id: row.id, revision: row.revision })).sort((a, b) => a.id.localeCompare(b.id)),
    legacyMoves: (household.moves ?? []).filter(row => row.chapterId === chapter.id && !row.taskId),
  });
}
function newRitualAgreement(household: Household, ritual: Ritual, memberId: string, at: string) {
  if (activeAudience(household).length < 2) return { version: 1 as const, revision: 1, legacyBaseline: false, acceptedProposalId: null, proposals: [] };
  return proposeChapterConsent<RitualTerms>(undefined, { expectedRevision: 0, identity: `ritual-${ritual.id}`, terms: ritualTerms(ritual), basis: ritualBasis(ritual), audience: activeAudience(household), memberId, at, legacyBaseline: false });
}

export type EditRitualInput = { memberId: string; ritualId: string; expectedRevision: number; terms: RitualTerms; at?: string };
export const editRitual = captureCommand('editRitual', (household: Household, input: EditRitualInput): CommitResult => {
  requireMember(household, input.memberId); const ritual = findRitual(household, input.ritualId), at = input.at ?? nowIso();
  const terms = shapeRitualTerms(input.terms); requireMember(household, terms.ownerMemberId); if (terms.backupMemberId) requireMember(household, terms.backupMemberId);
  // Validate references against this authenticated household without creating any
  // operational occurrence merely to prepare a shared proposal.
  const validation = taskForRitual({ ...household, tasks: [] }, { ...ritual, ...terms }, '2000-01-01', at, false, input.memberId); validateTaskReferences(household, validation);
  const next = cloneHousehold(household), target = findRitual(next, ritual.id);
  target.agreement = proposeChapterConsent(ritual.agreement, { expectedRevision: input.expectedRevision, identity: `ritual-${ritual.id}`, terms, basis: ritualBasis(ritual), audience: activeAudience(household), memberId: input.memberId, at, legacyBaseline: !ritual.agreement });
  target.updatedAt = at; return commitChapters(household, next, 'Proposed the exact Ritual changes', at);
});
export type AcknowledgeRitualChangeInput = { memberId: string; ritualId: string; expectedRevision: number; proposalId: string; digest: string; at?: string };
export const acknowledgeRitualChange = captureCommand('acknowledgeRitualChange', (household: Household, input: AcknowledgeRitualChangeInput): CommitResult => {
  requireMember(household, input.memberId); const ritual = findRitual(household, input.ritualId), at = input.at ?? nowIso();
  const result = approveChapterConsent(ritual.agreement, { ...input, basis: ritualBasis(ritual), audience: activeAudience(household), at });
  if (result.accepted) { requireMember(household, result.proposal.terms.ownerMemberId); if (result.proposal.terms.backupMemberId) requireMember(household, result.proposal.terms.backupMemberId); }
  const next = cloneHousehold(household), target = findRitual(next, ritual.id); target.agreement = result.consent;
  if (result.accepted) { Object.assign(target, result.proposal.terms); delete target.approvalViaClosure; }
  target.updatedAt = at; return commitChapters(household, next, result.accepted ? 'Both agreed to this Ritual' : 'Agreed to the exact Ritual review', at);
});
export const setRitualParticipation = captureCommand('setRitualParticipation', (household: Household, input: { memberId: string; ritualId: string; expectedMemberRevision: number; paused: boolean; at?: string }): CommitResult => {
  requireMember(household, input.memberId); const ritual = findRitual(household, input.ritualId), at = input.at ?? nowIso();
  const own = ritual.participation?.find(row => row.memberId === input.memberId);
  if ((own?.revision ?? 0) !== input.expectedMemberRevision || typeof input.paused !== 'boolean') chapterConsentFail('Your participation changed. Read its current state.');
  const next = cloneHousehold(household), target = findRitual(next, ritual.id);
  target.participation = [...(target.participation ?? []).filter(row => row.memberId !== input.memberId), { version: 1, memberId: input.memberId, revision: input.expectedMemberRevision + 1, paused: input.paused, updatedAt: at }];
  target.updatedAt = at; return commitChapters(household, next, input.paused ? 'Paused your own Ritual participation' : 'Resumed your own Ritual participation', at);
});
export const adoptChapterTasks = captureCommand('adoptChapterTasks', (household: Household, input: { memberId: string; chapterId?: string; at?: string }): CommitResult => {
  requireMember(household, input.memberId); const at = input.at ?? nowIso(), next = cloneHousehold(household);
  if (input.chapterId) findChapter(household, input.chapterId);
  for (const move of next.moves ?? []) if ((!input.chapterId || move.chapterId === input.chapterId) && !move.taskId) {
    const task = taskForMove(next, move, at, true, move.createdByMemberId ?? null); putChapterTask(next, task); move.taskId = task.id; move.sharedApprovals = { revision: 1, materialVersion: task.chapterSource!.materialVersion, audience: activeAudience(next), memberIds: [] }; move.updatedAt = at;
  }
  for (const ritual of next.rituals ?? []) if ((!input.chapterId || ritual.chapterId === input.chapterId) && !ritual.taskAdoption) {
    for (const day of ritual.heldOn) putChapterTask(next, taskForRitual(next, ritual, day, at, true, input.memberId));
    ritual.taskAdoption = { version: 1, adoptedAt: at }; ritual.updatedAt = at;
  }
  return commitChapters(household, next, 'Connected earlier Chapter records to their Tasks', at);
});
export const prepareRitualOccurrence = captureCommand('prepareRitualOccurrence', (household: Household, input: { memberId: string; ritualId: string; onDate: DateKey; expectedRevision: number; at?: string }): CommitResult => {
  requireMember(household, input.memberId); const ritual = findRitual(household, input.ritualId), at = input.at ?? nowIso();
  if (ritualAgreementRevision(ritual) !== input.expectedRevision || !isValidDateKey(input.onDate)) chapterConsentFail('Choose the current Ritual and a valid occurrence date.');
  validateRitualClosureReference(household, ritual);
  if (!ritualOperational(ritual)) chapterConsentFail('Both of you need to agree to this active Ritual before preparing an occurrence.');
  if (ritual.requiresMoneyEvidence && !ritual.moneyLink) chapterConsentFail('Choose the existing bank, bill or planned expense in this Ritual’s shared review first.');
  if (!ritual.taskAdoption) chapterConsentFail('Connect the earlier Ritual history to its Tasks first.');
  if (ritual.participation?.some(row => row.memberId === input.memberId && row.paused)) chapterConsentFail('You paused your participation. Resume when you are ready.');
  const task = taskForRitual(household, ritual, input.onDate, at, false, input.memberId); validateTaskReferences(household, task);
  const next = cloneHousehold(household); putChapterTask(next, task); return commitChapters(household, next, 'Prepared this dated Ritual Task', at);
});

export type OpenChapterInput = {
  memberId: string;
  foundationId?: FoundationChapterId;
  custom?: { title: string; meaning: string; lessonId?: string; betterFeelsLike?: string };
  sitdownId?: string;
  /** The calendar month this Chapter spans; defaults to the Toronto month of `at`. */
  intendedMonth?: MonthKey;
  at?: string;
};

export const openChapter = captureCommand("openChapter", function openChapter(household: Household, input: OpenChapterInput): CommitResult {
  requireMember(household, input.memberId);
  if (openChapterFor(household)) throw new ValidationError("Close the current Chapter at a Sitdown before opening the next one.");
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const ids = (next.chapters ?? []).map((row) => row.id);
  const foundation = input.foundationId ? foundationChapter(input.foundationId) : null;
  if (!foundation && !input.custom?.title.trim()) throw new ValidationError("Give the Chapter a name, or choose one from the foundation.");
  const chapter: Chapter = {
    version: 1,
    id: nextId("CHAP-", ids),
    foundationId: foundation?.id ?? null,
    title: (foundation?.title ?? input.custom!.title).trim().slice(0, 120),
    meaning: (input.custom?.meaning ?? foundation?.meaning ?? "").trim().slice(0, 2000),
    betterFeelsLike: (input.custom?.betterFeelsLike ?? foundation?.betterFeelsLike ?? "").trim().slice(0, 2000),
    lessonId: (input.custom?.lessonId ?? foundation?.lessonId ?? "").slice(0, 80),
    openedAt: at,
    openedByMemberId: input.memberId,
    openedAtSitdownId: input.sitdownId ?? null,
    closedAt: null,
    closedAtSitdownId: null,
    state: "open",
    carryForward: "",
    // D-273 months are written only for a household the money model sorted (or when a month is asked for), so a
    // flags-off build never writes month data that would make older phones reload (D-282, review M1).
    ...(input.intendedMonth !== undefined || fundModelMode(household) === 2
      ? { intendedMonth: validMonth(input.intendedMonth) ?? monthKeyFromDateKey(dateKeyInZone(new Date(at))) }
      : {}),
    updatedAt: at,
  };
  next.chapters = [...(next.chapters ?? []), chapter];
  if (foundation) {
    const ritual: Ritual = {
      version: 1,
      id: nextId("RIT-", (next.rituals ?? []).map((row) => row.id)),
      chapterId: chapter.id,
      ...foundation.ritual,
      ownerMemberId: input.memberId,
      backupMemberId: partnerOf(household, input.memberId),
      state: "active",
      heldOn: [],
      updatedAt: at,
      taskAdoption: { version: 1, adoptedAt: at },
      requiresMoneyEvidence: foundation.id === 'build-breathing-room',
    };
    ritual.agreement = newRitualAgreement(next, ritual, input.memberId, at);
    next.rituals = [...(next.rituals ?? []), ritual];
    const move: Move = {
      version: 1,
      id: nextId("MOVE-", (next.moves ?? []).map((row) => row.id)),
      chapterId: chapter.id,
      ritualId: null,
      text: foundation.firstMove,
      ownerMemberId: null,
      needsAcknowledgment: false,
      acknowledgedByMemberIds: [],
      state: "offered",
      completedAt: null,
      completedByMemberId: null,
      evidenceRef: null,
      updatedAt: at,
      createdByMemberId: input.memberId,
    };
    const task = taskForMove(next, move, at, false, input.memberId); putChapterTask(next, task); move.taskId = task.id;
    move.sharedApprovals = { revision: 1, materialVersion: 1, audience: activeAudience(next), memberIds: [] };
    next.moves = [...(next.moves ?? []), move];
  }
  return commitChapters(household, next, `Opened the Chapter "${chapter.title}"`, at);
});

export type AddRitualInput = {
  memberId: string;
  chapterId: string;
  title: string;
  cue: RitualCue;
  cueNote?: string;
  ownerMemberId?: string;
  backupMemberId?: string | null;
  doneDefinition: string;
  recoveryMove?: string;
  requiresMoneyEvidence?: boolean;
  moneyLink?: TaskMoneyLink | null;
  expectedAmountCents?: number | null;
  at?: string;
};

export const addRitual = captureCommand("addRitual", function addRitual(household: Household, input: AddRitualInput): CommitResult {
  requireMember(household, input.memberId);
  const chapter = findChapter(household, input.chapterId);
  if (chapter.state !== "open") throw new ValidationError("Rituals join an open Chapter.");
  if (!input.title.trim()) throw new ValidationError("Name the Ritual.");
  if (!input.doneDefinition.trim()) throw new ValidationError("Say what done looks like.");
  const owner = input.ownerMemberId ?? input.memberId;
  requireMember(household, owner);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const ritual: Ritual = {
    version: 1,
    id: nextId("RIT-", (next.rituals ?? []).map((row) => row.id)),
    chapterId: chapter.id,
    title: input.title.trim().slice(0, 120),
    cue: input.cue,
    cueNote: (input.cueNote ?? "").trim().slice(0, 240),
    ownerMemberId: owner,
    backupMemberId: input.backupMemberId === undefined ? partnerOf(household, owner) : input.backupMemberId,
    doneDefinition: input.doneDefinition.trim().slice(0, 2000),
    recoveryMove: (input.recoveryMove ?? "").trim().slice(0, 2000),
    state: "active",
    heldOn: [],
    updatedAt: at,
    taskAdoption: { version: 1, adoptedAt: at },
    requiresMoneyEvidence: input.requiresMoneyEvidence === true,
    moneyLink: input.moneyLink ?? null, expectedAmountCents: input.expectedAmountCents ?? null,
  };
  const terms = shapeRitualTerms(ritualTerms(ritual)); if (terms.backupMemberId) requireMember(household, terms.backupMemberId);
  validateTaskReferences(household, taskForRitual({ ...household, tasks: [] }, ritual, at.slice(0, 10) as DateKey, at, false, input.memberId));
  ritual.agreement = newRitualAgreement(next, ritual, input.memberId, at); next.rituals = [...(next.rituals ?? []), ritual];
  return commitChapters(household, next, `Added the Ritual "${input.title.trim()}"`, at);
});

export const recordRitualHeld = captureCommand("recordRitualHeld", function recordRitualHeld(household: Household, input: { memberId: string; ritualId: string; onDate: DateKey; expectedTaskRevision?: number; evidence?: TaskEvidence | null; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  if (!isValidDateKey(input.onDate)) throw new ValidationError("Use a civil date.");
  const at = input.at ?? nowIso();
  const ritual = findRitual(household, input.ritualId), task = chapterTask(household, { kind: 'ritual-occurrence', sourceId: ritual.id, onDate: input.onDate });
  if (!ritual.taskAdoption || !task || input.expectedTaskRevision !== task.revision) chapterConsentFail('Prepare and read this exact dated Task before recording that the Ritual held.');
  const result = completeTask(household, { memberId: input.memberId, id: task.id, expectedRevision: input.expectedTaskRevision, evidence: input.evidence, completedAt: at });
  return commitChapters(household, result.household, `"${ritual.title}" held`, at);
});

export const setRitualState = captureCommand("setRitualState", function setRitualState(household: Household, input: { memberId: string; ritualId: string; state: RitualState; expectedRevision?: number; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const ritual = findRitual(household, input.ritualId);
  if (input.expectedRevision === undefined) chapterConsentFail('Read the current Ritual review before changing its shared state. You can pause your own participation at any time.');
  return editRitual(household, { memberId: input.memberId, ritualId: ritual.id, expectedRevision: input.expectedRevision, terms: { ...ritualTerms(ritual), state: input.state }, at: input.at });
});

export type OfferMoveInput = { memberId: string; chapterId: string; text: string; ownerMemberId?: string | null; ritualId?: string | null; needsAcknowledgment?: boolean; moneyLink?: TaskMoneyLink | null; expectedAmountCents?: number | null; at?: string };

export const offerMove = captureCommand("offerMove", function offerMove(household: Household, input: OfferMoveInput): CommitResult {
  requireMember(household, input.memberId);
  const chapter = findChapter(household, input.chapterId);
  if (chapter.state !== "open") throw new ValidationError("Moves belong to an open Chapter.");
  if (!input.text.trim()) throw new ValidationError("Say the Move in a few words.");
  if (input.ownerMemberId) requireMember(household, input.ownerMemberId);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const move: Move = {
    version: 1,
    id: nextId("MOVE-", (next.moves ?? []).map((row) => row.id)),
    chapterId: chapter.id,
    ritualId: input.ritualId ?? null,
    text: input.text.trim().slice(0, 400),
    ownerMemberId: input.ownerMemberId ?? null,
    needsAcknowledgment: input.needsAcknowledgment === true,
    acknowledgedByMemberIds: [],
    state: "offered",
    completedAt: null,
    completedByMemberId: null,
    evidenceRef: null,
    updatedAt: at,
    createdByMemberId: input.memberId,
  };
  const baseTask = taskForMove(next, move, at, false, input.memberId), task = validateTask({ ...baseTask, moneyLink: input.moneyLink ?? null, expectedAmountCents: input.expectedAmountCents ?? null }); validateTaskReferences(next, task);
  putChapterTask(next, task); move.taskId = task.id; move.sharedApprovals = { revision: 1, materialVersion: 1, audience: activeAudience(next), memberIds: input.needsAcknowledgment ? [input.memberId] : [] };
  next.moves = [...(next.moves ?? []), move];
  return commitChapters(household, next, "Offered a Move", at);
});

export const respondToMove = captureCommand("respondToMove", function respondToMove(household: Household, input: { memberId: string; moveId: string; response: "accept" | "decline" | "pause" | "acknowledge"; expectedTaskRevision?: number; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const at = input.at ?? nowIso();
  let next = cloneHousehold(household);
  const move = (next.moves ?? []).find((row) => row.id === input.moveId);
  if (!move) throw new ValidationError("That Move is no longer available.");
  let task = chapterTask(next, { kind: 'chapter-move', sourceId: move.id, onDate: null });
  if (!move.taskId || !task || task.revision !== input.expectedTaskRevision) chapterConsentFail('Read or connect this exact Task before responding to its Move.');
  if (task.completedAt || task.deleted) throw new ValidationError("That Move is already done or no longer open.");
  if (input.response === "acknowledge") {
    const previous = move.sharedApprovals?.materialVersion === task.chapterSource!.materialVersion && canonical(move.sharedApprovals.audience) === canonical(activeAudience(next)) ? move.sharedApprovals.memberIds : [];
    move.sharedApprovals = { revision: (move.sharedApprovals?.revision ?? 0) + 1, materialVersion: task.chapterSource!.materialVersion, audience: activeAudience(next), memberIds: [...new Set([...previous, input.memberId])].sort() };
  } else if (input.response === 'accept') {
    if (task.assigneeId !== null && task.assigneeId !== input.memberId && task.backupId !== input.memberId) chapterConsentFail('This task belongs to its responsible member. You cannot take it away from them.');
    if (task.assigneeId === null) {
      next = saveTask(next, { memberId: input.memberId, id: task.id, expectedRevision: task.revision, task: { ...task, assigneeId: input.memberId } }).household;
      task = next.tasks!.find(row => row.id === task!.id)!;
    }
    const own = task.participation?.find(row => row.memberId === input.memberId);
    if (own?.paused) { task = { ...task, revision: task.revision + 1, updatedAt: at, participation: task.participation!.map(row => row.memberId === input.memberId ? { ...row, revision: row.revision + 1, paused: false, updatedAt: at } : row) }; putChapterTask(next, task); }
    if (!task.acknowledgedBy.includes(input.memberId)) next = acknowledgeTask(next, { memberId: input.memberId, id: task.id, expectedRevision: task.revision }).household;
  } else {
    const own = task.participation?.find(row => row.memberId === input.memberId);
    putChapterTask(next, { ...task, revision: task.revision + 1, updatedAt: at, participation: [...(task.participation ?? []).filter(row => row.memberId !== input.memberId), { version: 1, memberId: input.memberId, revision: (own?.revision ?? 0) + 1, paused: true, updatedAt: at }] });
  }
  move.updatedAt = at;
  const verb = input.response === "acknowledge" ? "acknowledged" : input.response === "accept" ? "accepted" : input.response === "decline" ? "declined" : "paused";
  return commitChapters(household, next, `Move ${verb}`, at);
});

export const completeMove = captureCommand("completeMove", function completeMove(household: Household, input: { memberId: string; moveId: string; expectedTaskRevision?: number; evidence?: TaskEvidence | null; evidenceRef?: string; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const at = input.at ?? nowIso();
  const move = (household.moves ?? []).find((row) => row.id === input.moveId);
  if (!move) throw new ValidationError("That Move is no longer available.");
  const task = chapterTask(household, { kind: 'chapter-move', sourceId: move.id, onDate: null });
  if (!move.taskId || !task || input.expectedTaskRevision !== task.revision) chapterConsentFail('Read or connect this exact Task before completing its Move.');
  if (input.evidenceRef !== undefined) chapterConsentFail('Choose the actual accepted receipt; an unverified text reference cannot complete a task.');
  const result = completeTask(household, { memberId: input.memberId, id: task.id, expectedRevision: task.revision, evidence: input.evidence, completedAt: at }), next = result.household;
  const completed = projectMoveTask(next, move);
  // A completed Move earns a quiet acknowledgment. It fades after a day unless kept.
  next.wins = [...(next.wins ?? []), {
    version: 1,
    id: nextId("WIN-", (next.wins ?? []).map((row) => row.id)),
    chapterId: move.chapterId,
    level: "acknowledgment",
    title: completed.text,
    evidenceRefs: completed.evidenceRef ? [completed.evidenceRef] : [],
    shownAt: at,
    fadedAt: new Date(Date.parse(at) + 24 * 60 * 60 * 1000).toISOString(),
    keptByMemberIds: [],
    authoredNote: "",
    hideAmounts: true,
    updatedAt: at,
  }];
  return commitChapters(household, next, "Move done", at);
});

export type RecordWinInput = { memberId: string; level: WinLevel; title: string; chapterId?: string | null; evidenceRefs?: string[]; at?: string };

export const recordWin = captureCommand("recordWin", function recordWin(household: Household, input: RecordWinInput): CommitResult {
  requireMember(household, input.memberId);
  if (!input.title.trim()) throw new ValidationError("Name what happened.");
  if ((input.level === "first" || input.level === "graduation") && !(input.evidenceRefs?.length)) {
    throw new ValidationError("A First or a graduation needs accepted evidence behind it.");
  }
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const fades = input.level === "acknowledgment" ? 1 : input.level === "shared-win" ? 7 : null;
  next.wins = [...(next.wins ?? []), {
    version: 1,
    id: nextId("WIN-", (next.wins ?? []).map((row) => row.id)),
    chapterId: input.chapterId ?? openChapterFor(household)?.id ?? null,
    level: input.level,
    title: input.title.trim().slice(0, 160),
    evidenceRefs: [...new Set(input.evidenceRefs ?? [])].slice(0, 20),
    shownAt: at,
    fadedAt: fades ? new Date(Date.parse(at) + fades * 24 * 60 * 60 * 1000).toISOString() : null,
    keptByMemberIds: [],
    authoredNote: "",
    hideAmounts: true,
    updatedAt: at,
  }];
  return commitChapters(household, next, "Recognized a Win", at);
});

/** Keeping a Memory is opt-in and authored; a shared Memory is kept when both partners choose it. */
export const keepWinAsMemory = captureCommand("keepWinAsMemory", function keepWinAsMemory(household: Household, input: { memberId: string; winId: string; authoredNote?: string; hideAmounts?: boolean; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  assertLegacyWinWriteAllowed(household);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const win = (next.wins ?? []).find((row) => row.id === input.winId);
  if (!win) throw new ValidationError("That Win is no longer available.");
  if (win.level === "acknowledgment") throw new ValidationError("Routine acknowledgments fade; a First, Shared Win, or graduation can become a Memory.");
  win.keptByMemberIds = [...new Set([...win.keptByMemberIds, input.memberId])];
  if (typeof input.authoredNote === "string") win.authoredNote = input.authoredNote.trim().slice(0, 2000);
  if (typeof input.hideAmounts === "boolean") win.hideAmounts = input.hideAmounts;
  win.fadedAt = null;
  win.updatedAt = at;
  return commitChapters(household, next, "Kept a Memory", at);
});

export const dismissWin = captureCommand("dismissWin", function dismissWin(household: Household, input: { memberId: string; winId: string; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const win = (next.wins ?? []).find((row) => row.id === input.winId);
  if (!win) throw new ValidationError("That Win is no longer available.");
  if (win.keptByMemberIds.length) throw new ValidationError("A kept Memory stays; it can be edited, not dismissed.");
  win.fadedAt = at;
  win.updatedAt = at;
  return commitChapters(household, next, "Let a Win fade", at);
});

export type CloseChapterInput = { memberId: string; chapterId: string; outcome: ChapterOutcome; carryForward?: string; sitdownId?: string; expectedRevision?: number; proposalId?: string; digest?: string; reviewDigest?: string; at?: string };

export function reviewChapterClosure(household: Household, input: Pick<CloseChapterInput, 'chapterId' | 'outcome' | 'carryForward' | 'sitdownId'>): { terms: ChapterClosureTerms; reviewDigest: string; expectedRevision: number } {
  const chapter = findChapter(household, input.chapterId);
  const terms: ChapterClosureTerms = shapeClosureTerms({ outcome: input.outcome, carryForward: (input.carryForward ?? '').trim(), sitdownId: input.sitdownId ?? null,
    rituals: (household.rituals ?? []).filter(row => row.chapterId === chapter.id && row.state === 'active').map(row => ({ ritualId: row.id, before: ritualTerms(row), afterState: input.outcome === 'established' ? 'graduated' : input.outcome === 'life-changed' || input.outcome === 'closed' ? 'retired' : row.state })).sort((a, b) => a.ritualId.localeCompare(b.ritualId)),
    moves: (household.tasks ?? []).filter(row => row.chapterId === chapter.id && row.chapterSource?.kind === 'chapter-move' && !row.deleted && !row.completedAt).map(row => ({ taskId: row.id, moveId: row.chapterSource!.sourceId, taskRevision: row.revision, title: row.title, ownerMemberId: row.assigneeId })).sort((a, b) => a.taskId.localeCompare(b.taskId)),
  });
  return { terms, expectedRevision: chapterClosureRevision(chapter), reviewDigest: chapterConsentDigest({ terms, basis: closureBasis(household, chapter), audience: activeAudience(household) }) };
}

/** A month ends; it does not pass or fail. "Established" graduates the Chapter's Rituals into Our Rhythm. */
export const closeChapter = captureCommand("closeChapter", function closeChapter(household: Household, input: CloseChapterInput): CommitResult {
  requireMember(household, input.memberId);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const chapter = (next.chapters ?? []).find((row) => row.id === input.chapterId);
  if (!chapter) throw new ValidationError("That Chapter is no longer available.");
  if (chapter.state !== "open") throw new ValidationError("That Chapter is already closed.");
  if (input.expectedRevision === undefined) chapterConsentFail('Read the exact current Chapter closure before proposing or agreeing.');
  if ((household.moves ?? []).some(move => move.chapterId === chapter.id && !move.taskId)) chapterConsentFail('Connect earlier Chapter Moves to their Tasks before reviewing closure.');
  const review = reviewChapterClosure(household, input), terms = review.terms;
  if (!input.proposalId) {
    if (input.reviewDigest !== review.reviewDigest) chapterConsentFail("Read the affected Rituals and Tasks in this exact closure review before giving your agreement.");
    chapter.closure = proposeChapterConsent(chapter.closure, { expectedRevision: input.expectedRevision, identity: `closure-${chapter.id}`, terms, basis: closureBasis(household, chapter), audience: activeAudience(household), memberId: input.memberId, at, legacyBaseline: !chapter.closure });
    chapter.updatedAt = at; return commitChapters(household, next, 'Proposed the exact Chapter closure', at);
  }
  const approved = approveChapterConsent(chapter.closure, { expectedRevision: input.expectedRevision, proposalId: input.proposalId, digest: input.digest ?? '', basis: closureBasis(household, chapter), audience: activeAudience(household), memberId: input.memberId, at });
  if (canonical(approved.proposal.terms) !== canonical(terms)) chapterConsentFail('The displayed closure changed. Read its exact current review.');
  chapter.closure = approved.consent;
  if (!approved.accepted) { chapter.updatedAt = at; return commitChapters(household, next, 'Agreed to the exact Chapter closure', at); }
  chapter.state = input.outcome;
  chapter.closedAt = at;
  chapter.closedAtSitdownId = input.sitdownId ?? null;
  chapter.carryForward = (input.carryForward ?? "").trim().slice(0, 2000);
  chapter.updatedAt = at;
  for (const ritual of next.rituals ?? []) {
    if (ritual.chapterId !== chapter.id || ritual.state !== "active") continue;
    if (input.outcome === "established") ritual.state = "graduated";
    else if (input.outcome === "life-changed" || input.outcome === "closed") ritual.state = "retired";
    ritual.approvalViaClosure = { chapterId: chapter.id, proposalId: approved.proposal.id, digest: approved.proposal.digest };
    ritual.updatedAt = at;
  }
  for (const change of terms.moves) {
    const task = next.tasks!.find(row => row.id === change.taskId)!;
    const participation = activeAudience(household).map(memberId => { const own = task.participation?.find(row => row.memberId === memberId); return { version: 1 as const, memberId, revision: (own?.revision ?? 0) + 1, paused: true, updatedAt: at }; });
    putChapterTask(next, { ...task, revision: task.revision + 1, updatedAt: at, participation });
  }
  if (input.outcome === "established") {
    next.wins = [...(next.wins ?? []), {
      version: 1,
      id: nextId("WIN-", (next.wins ?? []).map((row) => row.id)),
      chapterId: chapter.id,
      level: "graduation",
      title: `${chapter.title} is part of our rhythm now`,
      evidenceRefs: [chapter.id],
      shownAt: at,
      fadedAt: null,
      keptByMemberIds: [],
      authoredNote: "",
      hideAmounts: true,
      updatedAt: at,
    }];
  }
  const label = input.outcome === "established" ? `"${chapter.title}" graduated into Our Rhythm`
    : input.outcome === "still-forming" ? `"${chapter.title}" carried forward`
      : input.outcome === "life-changed" ? `"${chapter.title}" closed — life changed`
        : `"${chapter.title}" closed`;
  return commitChapters(household, next, label, at);
});

// ---------------------------------------------------------------------------
// Chapters as calendar months (D-273).

/** The month a Chapter is meant to span; legacy rows read as the Toronto month they opened. */
export function chapterMonth(chapter: Pick<Chapter, "intendedMonth" | "openedAt">): MonthKey {
  return chapter.intendedMonth ?? monthKeyFromDateKey(dateKeyInZone(new Date(chapter.openedAt)));
}

export type ChapterReminder = {
  chapterId: string;
  title: string;
  /** The month the open Chapter was meant for. */
  intendedMonth: MonthKey;
  /** Whole calendar months since that month ended (1 = last month). */
  monthsOpenPast: number;
  message: string;
  /** True when this device may nudge today (at most one nudge a day); the in-app line shows regardless. */
  nudge: boolean;
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (month: MonthKey): string => MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;

/**
 * The repeating reminder: the open Chapter's month has ended and no Sitdown
 * has closed it. Never closes anything. `lastNudgedOn` is the device's own
 * record of the last nudge (Q defaulted: at most one nudge a day).
 */
export function chapterReminder(household: Pick<Household, "chapters">, input: { today: DateKey; lastNudgedOn?: DateKey | null }): ChapterReminder | null {
  const open = openChapterFor(household);
  if (!open) return null;
  const month = chapterMonth(open);
  const current = monthKeyFromDateKey(input.today);
  if (month >= current) return null;
  let monthsOpenPast = 0;
  for (let cursor = month; cursor < current && monthsOpenPast < 1200; cursor = shiftMonthKey(cursor, 1)) monthsOpenPast += 1;
  return {
    chapterId: open.id,
    title: open.title,
    intendedMonth: month,
    monthsOpenPast,
    message: `“${open.title}” is still open from ${monthName(month)}. It closes at our next Sitdown, whenever that is.`,
    nudge: input.lastNudgedOn !== input.today,
  };
}

export type ChapterMonthRow = { month: MonthKey; chapterId: string | null; kind: "own" | "still-open" | "none" };

/**
 * Everything is divided by Chapters. Each month in the range shows the
 * Chapter that was meant for it, the earlier Chapter still open across it,
 * or "no Chapter" — a skipped month is never a failure.
 */
export function chapterMonths(household: Pick<Household, "chapters">, from: MonthKey, to: MonthKey): ChapterMonthRow[] {
  const chapters = shapeChapters(household.chapters).map((row) => {
    const start = chapterMonth(row);
    const end = row.state === "open" ? "9999-12" : row.closedAt ? monthKeyFromDateKey(dateKeyInZone(new Date(row.closedAt))) : start;
    return { row, start, end };
  });
  const rows: ChapterMonthRow[] = [];
  for (let month = from; month <= to && rows.length < 1200; month = shiftMonthKey(month, 1)) {
    const own = chapters.filter((item) => item.start === month).sort((a, b) => b.row.openedAt.localeCompare(a.row.openedAt))[0];
    if (own) { rows.push({ month, chapterId: own.row.id, kind: "own" }); continue; }
    const spanning = chapters.find((item) => item.start < month && month < item.end);
    rows.push(spanning ? { month, chapterId: spanning.row.id, kind: "still-open" } : { month, chapterId: null, kind: "none" });
  }
  return rows;
}

/** The lesson the next Chapter opens with when nobody picks one: the next foundation Chapter, else a month of our own. */
export function defaultNextChapter(household: Pick<Household, "chapters">, month: MonthKey): Pick<OpenChapterInput, "foundationId" | "custom"> {
  const foundation = nextFoundationChapter(household);
  if (foundation) return { foundationId: foundation.id };
  return { custom: { title: `Our ${monthName(month)}`, meaning: "A month to keep what works and try one small thing.", lessonId: "cashflow-balance" } };
}

export type CloseAndOpenChapterInput = CloseChapterInput & {
  /** Today in Toronto; the next Chapter belongs to this month (Q-C). */
  today: DateKey;
  next?: Pick<OpenChapterInput, "foundationId" | "custom">;
};

/**
 * The merged check-in's last step (F2/F5): the Sitdown closes the open
 * Chapter with the outcome the couple chose (Rituals retire only on that
 * choice) and opens the next Chapter for the Sitdown's month, in one command.
 */
export const closeChapterAtSitdown = captureCommand("closeChapterAtSitdown", function closeChapterAtSitdown(household: Household, input: CloseAndOpenChapterInput): CommitResult {
  const closed = closeChapter(household, input);
  const month = monthKeyFromDateKey(input.today);
  const choice = input.next ?? defaultNextChapter(closed.household, month);
  const opened = openChapter(closed.household, { memberId: input.memberId, ...choice, intendedMonth: month, ...(input.sitdownId ? { sitdownId: input.sitdownId } : {}), ...(input.at ? { at: input.at } : {}) });
  return { ...opened, undo: { ...opened.undo, snapshot: household, label: "Closed our Chapter and opened the next" } };
});

/** True once any Chapter carries a calendar month; an older client would drop it, so it must reload first. */
export function hasChapterMonthData(household: Pick<Household, "chapters">): boolean {
  return (household.chapters ?? []).some((row) => row.intendedMonth !== undefined);
}
/** Only the combined close-and-open always writes a month; a plain openChapter is judged by the data it leaves. */
export const CHAPTER_MONTH_COMMAND_KINDS = ["closeChapterAtSitdown"];
