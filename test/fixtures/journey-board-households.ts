/**
 * Journey Board model fixtures (T1). Fictional Development data only (Jonathan & Bianca demo kitchen).
 *
 * Built from `seedDemoHousehold({today:"2026-09-28", environment:"development"})` and extended through the real
 * command / capture functions wherever one exists. Constructed literally (and said so below):
 * - Wins' `keptByMemberIds` (the legacy `keepWinAsMemory` command now refuses with UPDATE_REQUIRED; the hearthside
 *   test builds Wins literally the same way);
 * - household `planVersions` / `planReflections` evidence for the home milestones (as test/home-customization.test.ts);
 * - the proposed October plan version (a plan fork; the Plan Studio's proposal flow needs the whole studio);
 * - home awards' `grantedAt`, re-dated to a fixed day because `acceptHome` stamps the real clock's date.
 */
import { addRecurrence, postEntry, postOneRecurrence, reversePostedMoney } from "../../src/core/commands.ts";
import { closeChapter as closeCommand, chapterClosureRevision, openChapter, pendingChapterClosure, reviewChapterClosure, type Win } from "../../src/core/chapters.ts";
import type { DateKey } from "../../src/core/calendar.ts";
import { proposePathEra } from "../../src/core/pathEras.ts";
import type { PlanLine, PlanReflection, PlanVersion } from "../../src/core/planSystem.ts";
import { catalogHousehold, newHouseholdTemplate, seedDemoHousehold } from "../../src/core/seed.ts";
import { acknowledgeTask, completeTask, saveTask } from "../../src/core/tasks.ts";
import type { Household } from "../../src/core/types.ts";
import { commitHearthside, type HearthsideOperation } from "../../src/hearthside/commands.ts";
import { emptyHearthside, type MemoryComposition } from "../../src/hearthside/contracts.ts";
import { commitPersonalLife } from "../../src/hearthside/personalLifeCommands.ts";
import { winAdoptionOperation } from "../../src/hearthside/winMemory.ts";
import { clone, snapRoom, starterHome } from "../../src/home/model.ts";

export const FIXTURE_TODAY = "2026-09-28" as DateKey;
export const BIANCA = "MEM-001";
export const JONATHAN = "MEM-002";

let opSeq = 0;
const opId = (label: string) => `00000000-0000-4000-8000-${String(++opSeq).padStart(4, "0")}${label.length.toString(16).padStart(8, "0")}`;

function hearthside(h: Household, memberId: string, operation: HearthsideOperation): Household {
  return commitHearthside(h, { version: 1, id: opId("hearthside"), scope: { environment: h.environment, householdId: h.householdId, memberId }, operation }).household;
}

function closeChapter(h: Household, input: { memberId: string; chapterId: string; outcome: "still-forming" | "established" | "closed"; at: string }): Household {
  const review = reviewChapterClosure(h, { chapterId: input.chapterId, outcome: input.outcome });
  const proposed = closeCommand(h, { ...input, expectedRevision: review.expectedRevision, reviewDigest: review.reviewDigest }).household;
  const chapter = proposed.chapters!.find(row => row.id === input.chapterId)!, pending = pendingChapterClosure(chapter)!;
  return closeCommand(proposed, { ...input, memberId: input.memberId === BIANCA ? JONATHAN : BIANCA, expectedRevision: chapterClosureRevision(chapter), proposalId: pending.id, digest: pending.digest }).household;
}

/** One side of a two-step Chapter close: proposed by `memberId`, waiting on the other. */
export function proposeChapterClose(h: Household, memberId: string, chapterId: string, at: string): Household {
  const review = reviewChapterClosure(h, { chapterId, outcome: "still-forming" });
  return closeCommand(h, { memberId, chapterId, outcome: "still-forming", expectedRevision: review.expectedRevision, reviewDigest: review.reviewDigest, at }).household;
}

const win = (id: string, title: string, shownAt: string, keptByMemberIds: string[]): Win => ({
  version: 1, id, chapterId: null, level: "shared-win", title, evidenceRefs: [], shownAt, fadedAt: null,
  keptByMemberIds, authoredNote: "", hideAmounts: true, updatedAt: shownAt,
});

const memory = (id: string, title: string, date: string | null): MemoryComposition => ({
  version: 1, id, revision: 1, title, date, experienceId: null, media: [], designs: [], recollections: [], hideAmounts: true, approvals: [], withdrawn: false,
});

function reviewedPlan(monthKey: string): { version: PlanVersion; reflection: PlanReflection } {
  const id = `PLAN-fixture-${monthKey}`;
  return {
    version: { id, scope: "household", monthKey, sequence: 1, lines: [{ id: `line-${monthKey}` } as PlanLine], assumptions: [], reason: "Fixture plan", digest: "fixture", state: "active", createdBy: BIANCA, createdAt: `${monthKey}-01T12:00:00.000Z`, activatedAt: `${monthKey}-01T12:00:00.000Z` },
    reflection: { id: `REVIEW-fixture-${monthKey}`, scope: "household", planVersionId: id, monthKey, outcomes: [], memberNotes: [], reviewedByMemberIds: [BIANCA, JONATHAN], createdAt: `${monthKey}-28T12:00:00.000Z`, updatedAt: `${monthKey}-28T12:00:00.000Z` },
  };
}

const planLine = (id: string, label: string, amountCents: number): PlanLine => ({ id, lens: "protect", kind: "obligation", labelSnapshot: label, amountCents, cadence: "monthly", assumptionIds: [], createdBy: BIANCA } as PlanLine);

export type JourneyFixtureIds = {
  waterRecurrenceId: string;
  insuranceRecurrenceId: string;
  streamingRecurrenceId: string;
  freelancePayRecurrenceId: string;
  biancaPayRecurrenceId: string;
  augustChapterId: string;
  septemberChapterId: string;
  hearthsideMemoryId: string;
  halfKeptMemoryId: string;
  winBothId: string;
  winOneId: string;
  adoptedWinId: string;
  eraRowId: string;
  taskOpenId: string;
  taskDoneId: string;
  proposedPlanId: string;
};

/** The substantial-history demo board: every stop kind, a cluster, three crossroads kinds. */
export function journeyDemoHousehold(): { household: Household; ids: JourneyFixtureIds } {
  let h = seedDemoHousehold({ today: FIXTURE_TODAY, environment: "development" });
  const biancaPayRecurrenceId = h.recurrences.find(row => row.note === "Bianca pay" && row.type === "income")!.id;

  // Two bills on one date (Sep 18): Water is recorded (paid), Tenant insurance is not (overdue).
  const newRecurrence = (input: Parameters<typeof addRecurrence>[1]): string => {
    const before = new Set(h.recurrences.map(row => row.id));
    h = addRecurrence(h, input).household;
    return h.recurrences.find(row => !before.has(row.id))!.id;
  };
  const waterRecurrenceId = newRecurrence({ cadence: "monthly", nextDate: "2026-09-18", type: "expense", amount: 64, accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-GAS", note: "Water", kind: "bill" });
  const insuranceRecurrenceId = newRecurrence({ cadence: "monthly", nextDate: "2026-09-18", type: "expense", amount: 118, accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-GAS", note: "Tenant insurance", kind: "bill" });
  h = postOneRecurrence(h, waterRecurrenceId, FIXTURE_TODAY).household;

  // A recurring-sourced income post (Sep 5 confirmed; Oct 5 expected).
  const freelancePayRecurrenceId = newRecurrence({ cadence: "monthly", nextDate: "2026-09-05", type: "income", amount: 1500, accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-WAGES", note: "Freelance pay" });
  h = postOneRecurrence(h, freelancePayRecurrenceId, FIXTURE_TODAY).household;

  // Needs review: a recurring receipt recorded, then corrected (reversed); the occurrence stays on the Calendar.
  const streamingRecurrenceId = newRecurrence({ cadence: "monthly", nextDate: "2026-09-10", type: "expense", amount: 17.99, accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", note: "Streaming", kind: "subscription" });
  const streamingPost = postEntry(h, { date: "2026-09-10", type: "expense", amount: 17.99, accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", note: "Streaming", source: "recurring", sourceId: streamingRecurrenceId, confirmDuplicate: true });
  h = reversePostedMoney(streamingPost.household, streamingPost.postedIds[0]!, { reversalDate: FIXTURE_TODAY }).household;

  // Chapters: August opened and closed at a Sitdown in September; September open.
  h = openChapter(h, { memberId: BIANCA, custom: { title: "Make rent boring", meaning: "Rent leaves on time without a scramble." }, intendedMonth: "2026-08", at: "2026-08-02T14:00:00.000Z" }).household;
  const augustChapterId = h.chapters!.at(-1)!.id;
  h = closeChapter(h, { memberId: BIANCA, chapterId: augustChapterId, outcome: "still-forming", at: "2026-09-06T15:00:00.000Z" });
  h = openChapter(h, { memberId: JONATHAN, custom: { title: "Breathing room", meaning: "A little set aside every payday." }, intendedMonth: "2026-09", at: "2026-09-06T15:05:00.000Z" }).household;
  const septemberChapterId = h.chapters!.at(-1)!.id;

  // Memories: one kept by both; one kept by Bianca only (never on the board).
  h = { ...h, hearthside: h.hearthside ?? emptyHearthside() };
  const hearthsideMemoryId = "MEMORY-fixture-lake";
  h = hearthside(h, BIANCA, { kind: "memory.compose", expectedRevision: 0, value: memory(hearthsideMemoryId, "Swim at the lake", "2026-08-16") });
  h = hearthside(h, BIANCA, { kind: "memory.keep", expectedRevision: 1, id: hearthsideMemoryId });
  h = hearthside(h, JONATHAN, { kind: "memory.keep", expectedRevision: 1, id: hearthsideMemoryId });
  const halfKeptMemoryId = "MEMORY-fixture-half";
  h = hearthside(h, BIANCA, { kind: "memory.compose", expectedRevision: 0, value: memory(halfKeptMemoryId, "Only one of us kept this", "2026-09-12") });
  h = hearthside(h, BIANCA, { kind: "memory.keep", expectedRevision: 1, id: halfKeptMemoryId });

  // Wins (literal keptBy, see header): kept by both; kept by one; kept by both AND adopted as a hearthside memory.
  const winBothId = "WIN-fixture-both", winOneId = "WIN-fixture-one", adoptedWinId = "WIN-fixture-adopted";
  h = { ...h, wins: [...(h.wins ?? []),
    win(winBothId, "Rent left on time", "2026-09-01T16:00:00.000Z", [BIANCA, JONATHAN]),
    win(winOneId, "Kept by one of us", "2026-09-03T16:00:00.000Z", [BIANCA]),
    win(adoptedWinId, "The quiet Sunday", "2026-07-12T16:00:00.000Z", [BIANCA, JONATHAN]),
  ] };
  const adoption = winAdoptionOperation(h, h.wins!.find(row => row.id === adoptedWinId)!);
  h = hearthside(h, BIANCA, adoption);
  h = hearthside(h, BIANCA, { kind: "memory.keep", expectedRevision: 1, id: adoption.memoryId });
  h = hearthside(h, JONATHAN, { kind: "memory.keep", expectedRevision: 1, id: adoption.memoryId });

  // An era suggestion by Bianca, waiting on Jonathan.
  h = proposePathEra(h, { memberId: BIANCA, spec: { order: 1, name: "The flat years", finishLine: "Three calm months in a row", from: "2026-09", by: "2027-06", home: "flat", finish: { kind: "survive", months: 3 }, plans: [] }, at: "2026-09-20T12:00:00.000Z" }).household;
  const eraRowId = (h.pathWorld as { id: string; kind: string }[]).find(row => row.kind === "era")!.id;

  // Home: two reviewed periods unlock four families at the first save; the saved blueprint holds a locked room.
  const june = reviewedPlan("2026-06"), july = reviewedPlan("2026-07");
  h = { ...h, planVersions: [...(h.planVersions ?? []), june.version, july.version], planReflections: [...(h.planReflections ?? []), june.reflection, july.reflection] };
  const home = starterHome();
  home.future = clone(home.layout);
  home.future.rooms.push(snapRoom(home.future, "library", "future-study"));
  home.future.rooms.push(snapRoom(home.future, "greenhouse", "future-greenhouse"));
  h = commitPersonalLife(h, { version: 1, id: opId("home"), scope: { environment: h.environment, householdId: h.householdId, memberId: BIANCA }, operation: { kind: "home.save", expectedRevision: 0, value: { layout: home.layout, future: home.future, pinned: home.pinned, arrangements: home.arrangements } } }).household;
  h = { ...h, personalLife: { ...h.personalLife!, home: { ...h.personalLife!.home!, awards: h.personalLife!.home!.awards.map(award => ({ ...award, grantedAt: "2026-09-14" })) } } };
  // A third reviewed period after the save: two more families are ready to record at the next save.
  const august = reviewedPlan("2026-08");
  h = { ...h, planVersions: [...h.planVersions!, august.version], planReflections: [...h.planReflections!, august.reflection] };

  // A proposed October plan (a plan fork) against no active October plan.
  const proposedPlanId = "PLAN-fixture-2026-10-proposed";
  h = { ...h, planVersions: [...h.planVersions!, { id: proposedPlanId, scope: "household", monthKey: "2026-10", sequence: 1, lines: [planLine("line-oct-rent", "Rent", 185000), planLine("line-oct-ferry", "Ferry to Newfoundland", 42000)], assumptions: [], reason: "Make room for the October trip", digest: "fixture", state: "proposed", createdBy: JONATHAN, createdAt: "2026-09-26T12:00:00.000Z" }] };

  // Planning steps: one open (Oct 3), one done (Sep 9, completed Sep 9).
  const taskBase = { visibility: "household" as const, notes: "", listId: null, parentId: null, dueDate: null, repeat: "none" as const, cue: "none" as const, assigneeId: null, backupId: null, chapterId: null, planReference: null, moneyLink: null, expectedAmountCents: null, deleted: false };
  const taskOpenId = "TASK-fixture-ferry", taskDoneId = "TASK-fixture-quotes";
  h = saveTask(h, { memberId: BIANCA, id: taskOpenId, expectedRevision: 0, task: { ...taskBase, title: "Book the ferry", doDate: "2026-10-03" } }).household;
  h = saveTask(h, { memberId: JONATHAN, id: taskDoneId, expectedRevision: 0, task: { ...taskBase, title: "Get two insurance quotes", doDate: "2026-09-09", assigneeId: JONATHAN } }).household;
  h = acknowledgeTask(h, { memberId: JONATHAN, id: taskDoneId, expectedRevision: h.tasks!.find(row => row.id === taskDoneId)!.revision }).household;
  h = completeTask(h, { memberId: JONATHAN, id: taskDoneId, expectedRevision: h.tasks!.find(row => row.id === taskDoneId)!.revision, completedAt: "2026-09-09T18:00:00.000Z" }).household;

  return { household: h, ids: { waterRecurrenceId, insuranceRecurrenceId, streamingRecurrenceId, freelancePayRecurrenceId, biancaPayRecurrenceId, augustChapterId, septemberChapterId, hearthsideMemoryId, halfKeptMemoryId, winBothId, winOneId, adoptedWinId, eraRowId, taskOpenId, taskDoneId, proposedPlanId } };
}

/** August's Chapter still open on Sep 28 (a Sitdown has not closed it yet). */
export function laggingChapterHousehold(): { household: Household; augustChapterId: string } {
  let h = seedDemoHousehold({ today: FIXTURE_TODAY, environment: "development" });
  h = openChapter(h, { memberId: BIANCA, custom: { title: "Make rent boring", meaning: "Rent leaves on time." }, intendedMonth: "2026-08", at: "2026-08-02T14:00:00.000Z" }).household;
  return { household: h, augustChapterId: h.chapters!.at(-1)!.id };
}

/** A quiet month: accounts and one bill next month, nothing in September. */
export function quietMonthHousehold(): Household {
  return addRecurrence(catalogHousehold("development"), { cadence: "monthly", nextDate: "2026-10-01", type: "expense", amount: 1850, accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-RENT", note: "Rent", kind: "bill" }).household;
}

/** A month with many commitments: the demo board plus twelve September bills (several sharing a date). */
export function busyMonthHousehold(base: Household = journeyDemoHousehold().household): { household: Household; busyRecurrenceIds: string[] } {
  let h = base;
  const days = ["2026-09-02", "2026-09-02", "2026-09-04", "2026-09-11", "2026-09-11", "2026-09-11", "2026-09-19", "2026-09-24", "2026-09-29", "2026-09-29", "2026-09-30", "2026-09-30"];
  const ids: string[] = [];
  days.forEach((nextDate, index) => {
    const before = new Set(h.recurrences.map(row => row.id));
    h = addRecurrence(h, { cadence: "monthly", nextDate, type: "expense", amount: 20 + index, accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", note: `Busy bill ${index + 1}`, kind: "bill" }).household;
    ids.push(h.recurrences.find(row => !before.has(row.id))!.id);
  });
  return { household: h, busyRecurrenceIds: ids };
}

/** A brand-new household: the honest empty board. */
export function emptyBoardHousehold(): Household {
  return newHouseholdTemplate("development");
}

/** Deep-freeze a household so a derivation that mutates its input throws. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value as object)) deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return value;
}
