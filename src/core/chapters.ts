import { captureCommand } from "../ledgerSync/capture.ts";
import type { DateKey } from "./calendar.ts";
import { cloneHousehold } from "./household.ts";
import { nextId, nowIso } from "./ids.ts";
import type { CommitResult, Household } from "./types.ts";
import { ValidationError } from "./types.ts";

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
  updatedAt: string;
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
      updatedAt: validIso(row.updatedAt, openedAt),
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
  return mergeById(left, right);
}
export function mergeRituals(left: Ritual[] = [], right: Ritual[] = []): Ritual[] {
  return mergeById(left, right, (newest, other) => ({ ...newest, heldOn: [...new Set([...newest.heldOn, ...other.heldOn])].sort() as DateKey[] }));
}
export function mergeMoves(left: Move[] = [], right: Move[] = []): Move[] {
  return mergeById(left, right, (newest, other) => ({ ...newest, acknowledgedByMemberIds: [...new Set([...newest.acknowledgedByMemberIds, ...other.acknowledgedByMemberIds])] }));
}
export function mergeWins(left: Win[] = [], right: Win[] = []): Win[] {
  return mergeById(left, right, (newest, other) => ({ ...newest, keptByMemberIds: [...new Set([...newest.keptByMemberIds, ...other.keptByMemberIds])] }));
}

// ---------------------------------------------------------------------------
// Read helpers

export function openChapterFor(household: Pick<Household, "chapters">): Chapter | null {
  return (household.chapters ?? []).find((row) => row.state === "open") ?? null;
}
export function ritualsForChapter(household: Pick<Household, "rituals">, chapterId: string): Ritual[] {
  return (household.rituals ?? []).filter((row) => row.chapterId === chapterId);
}
export function movesForChapter(household: Pick<Household, "moves">, chapterId: string): Move[] {
  return (household.moves ?? []).filter((row) => row.chapterId === chapterId);
}
/** Graduated habits holding quietly outside the monthly foreground. */
export function ourRhythm(household: Pick<Household, "rituals">): Ritual[] {
  return (household.rituals ?? []).filter((row) => row.state === "graduated");
}
/** The next Move: the first offered or accepted Move in the open Chapter, owner-first for the signed-in member. */
export function nextMove(household: Pick<Household, "chapters" | "moves">, memberId: string): Move | null {
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
function findChapter(household: Household, chapterId: string): Chapter {
  const row = (household.chapters ?? []).find((c) => c.id === chapterId);
  if (!row) throw new ValidationError("That Chapter is no longer available.");
  return row;
}

export type OpenChapterInput = {
  memberId: string;
  foundationId?: FoundationChapterId;
  custom?: { title: string; meaning: string; lessonId?: string; betterFeelsLike?: string };
  sitdownId?: string;
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
    };
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
    };
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
  next.rituals = [...(next.rituals ?? []), {
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
  }];
  return commitChapters(household, next, `Added the Ritual "${input.title.trim()}"`, at);
});

export const recordRitualHeld = captureCommand("recordRitualHeld", function recordRitualHeld(household: Household, input: { memberId: string; ritualId: string; onDate: DateKey; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.onDate)) throw new ValidationError("Use a civil date.");
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const ritual = (next.rituals ?? []).find((row) => row.id === input.ritualId);
  if (!ritual) throw new ValidationError("That Ritual is no longer available.");
  if (ritual.state === "retired") throw new ValidationError("A retired Ritual does not hold.");
  ritual.heldOn = [...new Set([...ritual.heldOn, input.onDate])].sort() as DateKey[];
  ritual.updatedAt = at;
  return commitChapters(household, next, `"${ritual.title}" held`, at);
});

export const setRitualState = captureCommand("setRitualState", function setRitualState(household: Household, input: { memberId: string; ritualId: string; state: RitualState; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const ritual = (next.rituals ?? []).find((row) => row.id === input.ritualId);
  if (!ritual) throw new ValidationError("That Ritual is no longer available.");
  ritual.state = input.state;
  ritual.updatedAt = at;
  const label = input.state === "graduated" ? `"${ritual.title}" moved into Our Rhythm` : `"${ritual.title}" is now ${input.state}`;
  return commitChapters(household, next, label, at);
});

export type OfferMoveInput = { memberId: string; chapterId: string; text: string; ownerMemberId?: string | null; ritualId?: string | null; needsAcknowledgment?: boolean; at?: string };

export const offerMove = captureCommand("offerMove", function offerMove(household: Household, input: OfferMoveInput): CommitResult {
  requireMember(household, input.memberId);
  const chapter = findChapter(household, input.chapterId);
  if (chapter.state !== "open") throw new ValidationError("Moves belong to an open Chapter.");
  if (!input.text.trim()) throw new ValidationError("Say the Move in a few words.");
  if (input.ownerMemberId) requireMember(household, input.ownerMemberId);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  next.moves = [...(next.moves ?? []), {
    version: 1,
    id: nextId("MOVE-", (next.moves ?? []).map((row) => row.id)),
    chapterId: chapter.id,
    ritualId: input.ritualId ?? null,
    text: input.text.trim().slice(0, 400),
    ownerMemberId: input.ownerMemberId ?? null,
    needsAcknowledgment: input.needsAcknowledgment === true,
    acknowledgedByMemberIds: input.needsAcknowledgment ? [input.memberId] : [],
    state: "offered",
    completedAt: null,
    completedByMemberId: null,
    evidenceRef: null,
    updatedAt: at,
  }];
  return commitChapters(household, next, "Offered a Move", at);
});

export const respondToMove = captureCommand("respondToMove", function respondToMove(household: Household, input: { memberId: string; moveId: string; response: "accept" | "decline" | "pause" | "acknowledge"; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const move = (next.moves ?? []).find((row) => row.id === input.moveId);
  if (!move) throw new ValidationError("That Move is no longer available.");
  if (move.state === "done") throw new ValidationError("That Move is already done.");
  if (input.response === "acknowledge") {
    move.acknowledgedByMemberIds = [...new Set([...move.acknowledgedByMemberIds, input.memberId])];
  } else {
    move.state = input.response === "accept" ? "accepted" : input.response === "decline" ? "declined" : "paused";
  }
  move.updatedAt = at;
  const verb = input.response === "acknowledge" ? "acknowledged" : input.response === "accept" ? "accepted" : input.response === "decline" ? "declined" : "paused";
  return commitChapters(household, next, `Move ${verb}`, at);
});

export const completeMove = captureCommand("completeMove", function completeMove(household: Household, input: { memberId: string; moveId: string; evidenceRef?: string; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const move = (next.moves ?? []).find((row) => row.id === input.moveId);
  if (!move) throw new ValidationError("That Move is no longer available.");
  if (move.state === "declined") throw new ValidationError("A declined Move is not completed; offer a new one.");
  if (move.needsAcknowledgment) {
    const required = next.members.filter((m) => m.active).map((m) => m.id);
    const missing = required.filter((id) => !move.acknowledgedByMemberIds.includes(id) && id !== input.memberId);
    if (missing.length) throw new ValidationError("This Move needs both of you to acknowledge it before it is done.");
  }
  move.state = "done";
  move.completedAt = at;
  move.completedByMemberId = input.memberId;
  move.evidenceRef = input.evidenceRef?.slice(0, 120) ?? null;
  move.updatedAt = at;
  // A completed Move earns a quiet acknowledgment. It fades after a day unless kept.
  next.wins = [...(next.wins ?? []), {
    version: 1,
    id: nextId("WIN-", (next.wins ?? []).map((row) => row.id)),
    chapterId: move.chapterId,
    level: "acknowledgment",
    title: move.text,
    evidenceRefs: move.evidenceRef ? [move.evidenceRef] : [],
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

export type CloseChapterInput = { memberId: string; chapterId: string; outcome: ChapterOutcome; carryForward?: string; sitdownId?: string; at?: string };

/** A month ends; it does not pass or fail. "Established" graduates the Chapter's Rituals into Our Rhythm. */
export const closeChapter = captureCommand("closeChapter", function closeChapter(household: Household, input: CloseChapterInput): CommitResult {
  requireMember(household, input.memberId);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const chapter = (next.chapters ?? []).find((row) => row.id === input.chapterId);
  if (!chapter) throw new ValidationError("That Chapter is no longer available.");
  if (chapter.state !== "open") throw new ValidationError("That Chapter is already closed.");
  chapter.state = input.outcome;
  chapter.closedAt = at;
  chapter.closedAtSitdownId = input.sitdownId ?? null;
  chapter.carryForward = (input.carryForward ?? "").trim().slice(0, 2000);
  chapter.updatedAt = at;
  for (const ritual of next.rituals ?? []) {
    if (ritual.chapterId !== chapter.id || ritual.state !== "active") continue;
    if (input.outcome === "established") ritual.state = "graduated";
    else if (input.outcome === "life-changed" || input.outcome === "closed") ritual.state = "retired";
    ritual.updatedAt = at;
  }
  for (const move of next.moves ?? []) {
    if (move.chapterId === chapter.id && (move.state === "offered" || move.state === "accepted")) {
      move.state = "paused";
      move.updatedAt = at;
    }
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
