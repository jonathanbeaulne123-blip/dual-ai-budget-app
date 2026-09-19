import { describe, expect, it } from "vitest";
import { appendPlanSitdownTurn, catalogHousehold, splitForSync, type Household } from "../src/core/index.ts";
import { acknowledgeRitualChange, chapterClosureRevision, closeChapter, openChapter, openChapterFor, pendingChapterClosure, pendingRitualReview, prepareRitualOccurrence, recordRitualHeld, reviewChapterClosure, ritualAgreementRevision } from "../src/core/chapters.ts";
import { hasChapterMonthData } from "../src/core/chapters.ts";
import { chapterTask } from "../src/core/chapterTasks.ts";
import { acknowledgeTask } from "../src/core/tasks.ts";
import { HERCULES_READ_TOOL_CATALOG } from "../src/core/herculesTools.ts";
import { pathMonths } from "../src/core/pathSignals.ts";
import { capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";
import { clientFundModelVersion } from "../src/ledgerSync/fundModelStamp.ts";
import { cellarV3Enabled } from "../src/queen/cellarV3Flag.ts";
import { planStudioV3Enabled } from "../src/plan-v3/flag.ts";
import { defaultFundSnapshotSource, planStudioFundSnapshot } from "../src/plan-v3/model.ts";

/**
 * D-282 (review M1, M3): with every v3 flag off, the branch behaves as `main` did.
 * Fictional books only.
 */
const ALEX = "MEM-001";
const AUG = "2026-08-03T14:00:00.000Z";

async function olderPhone(before: Household, after: Household, drop: string[] = ["chapterVersion", "fundModelVersion"], set: Record<string, unknown> = {}, memberId = ALEX) {
  const one = splitForSync(before, ALEX), two = splitForSync(before, "MEM-002");
  const state: AuthorityState = { sequence: before.revision, shared: one.shared, personal: new Map([[ALEX, one.personal], ["MEM-002", two.personal]]) };
  const scope: Scope = { environment: before.environment, householdId: before.householdId, memberId, subject: "fictional", role: "owner", expires: Date.now() + 60000, aclEpoch: 1 };
  const command = await commandFromCapture(capturedIntent(after)!, scope, crypto.randomUUID());
  // A build from before this branch sends neither stamp (or, with `drop`, whichever stamps it lacks).
  const older = { ...Object.fromEntries(Object.entries(command).filter(([key]) => !drop.includes(key))), ...set };
  return prepareCommand(state, older as typeof command, scope, () => {});
}

function reviewedClose(before: Household, memberId = ALEX) {
  const chapter = openChapterFor(before)!;
  const input = { memberId, chapterId: chapter.id, outcome: "closed" as const };
  const review = reviewChapterClosure(before, input);
  const proposed = closeChapter(structuredClone(before), { ...input, expectedRevision: review.expectedRevision, reviewDigest: review.reviewDigest }).household;
  const refreshed = openChapterFor(proposed)!;
  const pending = pendingChapterClosure(refreshed)!;
  const closed = closeChapter(structuredClone(proposed), { ...input, memberId: "MEM-002", expectedRevision: chapterClosureRevision(refreshed), proposalId: pending.id, digest: pending.digest }).household;
  return { proposed, closed };
}

function preparedRitualBase(before: Household, onDate: "2026-08-05") {
  let prepared = before;
  let ritual = prepared.rituals![0]!;
  const pending = pendingRitualReview(ritual);
  if (pending) {
    prepared = acknowledgeRitualChange(prepared, { memberId: "MEM-002", ritualId: ritual.id, expectedRevision: ritualAgreementRevision(ritual), proposalId: pending.id, digest: pending.digest, at: AUG }).household;
    ritual = prepared.rituals!.find(row => row.id === ritual.id)!;
  }
  prepared = prepareRitualOccurrence(prepared, { memberId: ALEX, ritualId: ritual.id, expectedRevision: ritualAgreementRevision(ritual), onDate, at: AUG }).household;
  let task = chapterTask(prepared, { kind: "ritual-occurrence", sourceId: ritual.id, onDate })!;
  if (!task.acknowledgedBy.includes(ALEX)) prepared = acknowledgeTask(prepared, { memberId: ALEX, id: task.id, expectedRevision: task.revision }).household;
  task = prepared.tasks!.find(row => row.id === task.id)!;
  return { prepared, ritualId: ritual.id, expectedTaskRevision: task.revision };
}

describe("flags off = main behaviour", () => {
  it("every v3 flag is off here", () => {
    expect(planStudioV3Enabled()).toBe(false);
    expect(cellarV3Enabled()).toBe(false);
    expect(clientFundModelVersion()).toBe(1);
    expect(defaultFundSnapshotSource()).toBe(planStudioFundSnapshot);
  });

  it("opening and closing a Chapter writes no month", () => {
    const opened = openChapter(catalogHousehold(), { memberId: ALEX, foundationId: "see-our-shared-life", at: AUG }).household;
    expect(openChapterFor(opened)!.intendedMonth).toBeUndefined();
    const { closed } = reviewedClose(opened);
    expect(hasChapterMonthData(closed)).toBe(false);
  });

  it("an older phone's Chapter writes are still accepted — no new stamp refuses them", async () => {
    const start = catalogHousehold();
    const opened = openChapter(structuredClone(start), { memberId: ALEX, foundationId: "see-our-shared-life", at: AUG }).household;
    await expect(olderPhone(start, opened)).resolves.toBeTruthy();
    const base = openChapter(catalogHousehold(), { memberId: ALEX, foundationId: "see-our-shared-life", at: AUG }).household;
    const { proposed, closed } = reviewedClose(structuredClone(base));
    // Each replay is exactly the one captured command against its actual pre-command state.
    await expect(olderPhone(base, proposed)).resolves.toBeTruthy();
    await expect(olderPhone(proposed, closed, undefined, {}, "MEM-002")).resolves.toBeTruthy();
  });

  it("Hercules's Plan tool text is main's", () => {
    const text = Object.fromEntries(HERCULES_READ_TOOL_CATALOG.map((row) => [row.name, row.description]));
    expect(text.plan_overview).toBe("Read the visible accepted or proposed Plan version and its Protect, Prepare, Build, and Everyday totals.");
    expect(text.plan_coverage).toBe("Read coverage across Protect, Prepare, Build, and Everyday without treating intentions as payments.");
  });

  it("Our Path counts Sitdowns as main did: a closed check-in session is not a Sitdown on an unsorted island", () => {
    let h = openChapter(catalogHousehold(), { memberId: ALEX, foundationId: "see-our-shared-life", at: "2026-06-03T14:00:00.000Z" }).household;
    const before = pathMonths(h, "2026-09-20");
    h = appendPlanSitdownTurn(h, { sitDownSessionId: "SITDOWN-FICTIONAL", monthKey: "2026-09", planDraftId: "PLAN-2026-09", memberId: ALEX, text: "Fictional.", checkpoint: { stage: 7 } }).household;
    h = { ...h, planHerculesSessions: h.planHerculesSessions!.map((row) => ({ ...row, state: "closed" as const })) };
    const after = pathMonths(h, "2026-09-20");
    expect(after.map((row) => [row.key, row.scores.together, row.scores.firsts, row.umbrellas])).toEqual(before.map((row) => [row.key, row.scores.together, row.scores.firsts, row.umbrellas]));
    expect(after.every((row) => row.umbrellas === undefined && !row.tags.includes("umbrella-slots"))).toBe(true);
  });
});

describe("flags off: the household shape is main's (D-282, Our Story byte-identity)", () => {
  it("adds no fundModelRows key to a household, or to either envelope, the money model never touched", async () => {
    const { ensureHouseholdShape } = await import("../src/core/sync.ts");
    const h = ensureHouseholdShape(catalogHousehold());
    expect("fundModelRows" in h).toBe(false);
    const { shared, personal } = splitForSync(h, ALEX);
    expect("fundModelRows" in shared).toBe(false);
    expect("fundModelRows" in personal).toBe(false);
    // A list that was emptied still overwrites the old one.
    const emptied = ensureHouseholdShape({ ...h, fundModelRows: [] });
    expect(emptied.fundModelRows).toEqual([]);
  });
});

describe("the version guards compose with main's journey (#497)", () => {
  const era = { order: 1, name: "Moving in", finishLine: "Settle in", from: "2026-07", by: null, home: "flat" as const, finish: { kind: "agree" as const }, plans: [], crossedOn: null };
  it("a household with eras but no money model refuses only a client without pathEraVersion", async () => {
    const { proposePathEra } = await import("../src/core/pathEras.ts");
    let base = openChapter(catalogHousehold(), { memberId: ALEX, foundationId: "see-our-shared-life", at: AUG }).household;
    base = proposePathEra(base, { memberId: ALEX, spec: era, at: AUG }).household;
    const ready = preparedRitualBase(base, "2026-08-05");
    base = ready.prepared;
    const write = () => recordRitualHeld(structuredClone(base), { memberId: ALEX, ritualId: ready.ritualId, onDate: "2026-08-05", expectedTaskRevision: ready.expectedTaskRevision, at: AUG }).household;
    // Missing our stamps is fine here…
    await expect(olderPhone(base, write())).resolves.toBeTruthy();
    // …missing main's era stamp is not.
    await expect(olderPhone(base, write(), ["pathEraVersion"])).rejects.toThrow(/journey/);
  });
  it("a sorted household without eras refuses only a client without fundModelVersion 2", async () => {
    const { migrateFundModel } = await import("../src/core/fundModelCommands.ts");
    let base = openChapter(catalogHousehold(), { memberId: ALEX, foundationId: "see-our-shared-life", at: AUG }).household;
    base = migrateFundModel(base, { memberId: ALEX }).household;
    const ready = preparedRitualBase(base, "2026-08-05");
    base = ready.prepared;
    const write = () => recordRitualHeld(structuredClone(base), { memberId: ALEX, ritualId: ready.ritualId, onDate: "2026-08-05", expectedTaskRevision: ready.expectedTaskRevision, at: AUG }).household;
    // A money-model build (fundModelVersion 2) from before the journey is fine here…
    await expect(olderPhone(base, write(), ["pathEraVersion"], { fundModelVersion: 2 })).resolves.toBeTruthy();
    // …a build without the money model is not.
    await expect(olderPhone(base, write(), ["fundModelVersion"])).rejects.toThrow(/how money is sorted/);
  });
});
