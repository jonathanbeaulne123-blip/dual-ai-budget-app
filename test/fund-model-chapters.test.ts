import { describe, expect, it } from "vitest";
import { catalogHousehold, splitForSync, assembleHousehold } from "../src/core/index.ts";
import { addRitual, chapterMonth, chapterMonths, chapterReminder, closeChapter, closeChapterAtSitdown, openChapter, openChapterFor, shapeChapters } from "../src/core/chapters.ts";
import { evaluatePlanDrift, type PlanVersion } from "../src/core/planSystem.ts";
import { capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";
import { ALEX, SAM, migrated } from "./fixtures/fund-model.ts";

const AUG = "2026-08-03T14:00:00.000Z";
function august() {
  let h = openChapter(catalogHousehold(), { memberId: ALEX, foundationId: "see-our-shared-life", at: AUG }).household;
  const chapter = openChapterFor(h)!;
  h = addRitual(h, { memberId: ALEX, chapterId: chapter.id, title: "Friday look", cue: "weekly", doneDefinition: "We looked" }).household;
  return { h, chapter: openChapterFor(h)! };
}

describe("Chapters are calendar months (slice 8)", () => {
  it("gives a new Chapter its Toronto month and reads legacy Chapters as the month they opened", () => {
    const { chapter } = august();
    expect(chapter.intendedMonth).toBe("2026-08");
    const late = openChapter(catalogHousehold(), { memberId: ALEX, foundationId: "see-our-shared-life", at: "2026-09-01T02:00:00.000Z" }).household;
    expect(openChapterFor(late)!.intendedMonth).toBe("2026-08");
    const { intendedMonth: _drop, ...legacy } = chapter;
    expect(chapterMonth(legacy)).toBe("2026-08");
    expect(shapeChapters([{ ...chapter, intendedMonth: "2026-13" }])[0]!.intendedMonth).toBeUndefined();
    expect(shapeChapters([chapter])[0]!.intendedMonth).toBe("2026-08");
  });
  it("never closes by itself and reminds (one nudge a day) until the Sitdown closes it", () => {
    const { h } = august();
    expect(chapterReminder(h, { today: "2026-08-31" })).toBeNull();
    const september = chapterReminder(h, { today: "2026-09-02" })!;
    expect(september).toMatchObject({ intendedMonth: "2026-08", monthsOpenPast: 1, nudge: true });
    expect(september.message).toMatch(/still open from August/);
    expect(chapterReminder(h, { today: "2026-09-02", lastNudgedOn: "2026-09-02" })!.nudge).toBe(false);
    expect(chapterReminder(h, { today: "2026-09-03", lastNudgedOn: "2026-09-02" })!.nudge).toBe(true);
    expect(chapterReminder(h, { today: "2026-10-20" })!.monthsOpenPast).toBe(2);
    expect(openChapterFor(h)!.state).toBe("open");
    expect(() => openChapter(h, { memberId: SAM, foundationId: "make-rent-boring" })).toThrow(/Close the current Chapter/);
  });
  it("closes at the Sitdown with the chosen outcome and opens the next Chapter for the Sitdown's month in one command", () => {
    const { h, chapter } = august();
    const result = closeChapterAtSitdown(h, { memberId: SAM, chapterId: chapter.id, outcome: "still-forming", carryForward: "Keep Fridays", today: "2026-10-04", sitdownId: "SIT-1", at: "2026-10-04T15:00:00.000Z" });
    const after = result.household;
    expect(after.chapters!.find((row) => row.id === chapter.id)).toMatchObject({ state: "still-forming", closedAtSitdownId: "SIT-1" });
    expect(after.rituals!.every((row) => row.state === "active")).toBe(true);
    const next = openChapterFor(after)!;
    // "Still forming" carries the same foundation Chapter forward into October.
    expect(next).toMatchObject({ intendedMonth: "2026-10", foundationId: "see-our-shared-life", openedAtSitdownId: "SIT-1" });
    expect(next.id).not.toBe(chapter.id);
    expect(result.postedIds).toEqual([]);
    expect(capturedIntent(after)!.steps.map((row) => row.kind)).toEqual(["openChapter", "addRitual", "closeChapterAtSitdown"]);
    expect(chapterMonths(after, "2026-07", "2026-11")).toEqual([
      { month: "2026-07", chapterId: null, kind: "none" },
      { month: "2026-08", chapterId: chapter.id, kind: "own" },
      { month: "2026-09", chapterId: chapter.id, kind: "still-open" },
      { month: "2026-10", chapterId: next.id, kind: "own" },
      { month: "2026-11", chapterId: next.id, kind: "still-open" },
    ]);
    const retired = closeChapterAtSitdown(h, { memberId: SAM, chapterId: chapter.id, outcome: "life-changed", today: "2026-09-04", next: { custom: { title: "Moving flat", meaning: "A new place" } } }).household;
    expect(retired.rituals!.every((row) => row.state === "retired")).toBe(true);
    expect(openChapterFor(retired)).toMatchObject({ title: "Moving flat", intendedMonth: "2026-09" });
    expect(closeChapter(h, { memberId: SAM, chapterId: chapter.id, outcome: "closed" }).household.chapters!.filter((row) => row.state === "open")).toHaveLength(0);
  });
  it("keeps the month through sync and flags a Chapter still open in the household plan drift once sorted", () => {
    let { h } = august();
    const back = assembleHousehold(splitForSync(h, ALEX).shared, splitForSync(h, ALEX).personal, { linked: true });
    expect(openChapterFor(back)!.intendedMonth).toBe("2026-08");
    const version: PlanVersion = { id: "PV-1", scope: "household", monthKey: "2026-09", sequence: 1, lines: [], assumptions: [], reason: "Fictional", digest: "d", state: "active", createdBy: ALEX, createdAt: "2026-09-01T00:00:00.000Z" };
    expect(evaluatePlanDrift(h, version, "2026-09-28").map((row) => row.rule)).not.toContain("chapter-still-open");
    h = migrated(h);
    const findings = evaluatePlanDrift(h, version, "2026-09-28");
    expect(findings.find((row) => row.rule === "chapter-still-open")).toMatchObject({ severity: "gentle" });
    expect(findings.find((row) => row.rule === "sitdown-upcoming")!.explanation).toMatch(/still open from August/);
  });
  it("refuses Chapter writes from a client that would drop the month", async () => {
    const { h } = august();
    const one = splitForSync(h, ALEX), two = splitForSync(h, SAM);
    const state: AuthorityState = { sequence: h.revision, shared: one.shared, personal: new Map([[ALEX, one.personal], [SAM, two.personal]]) };
    const scope: Scope = { environment: h.environment, householdId: h.householdId, memberId: ALEX, subject: "fictional", role: "owner", expires: Date.now() + 60000, aclEpoch: 1 };
    const clean = structuredClone(h);
    const command = await commandFromCapture(capturedIntent(closeChapter(clean, { memberId: ALEX, chapterId: openChapterFor(h)!.id, outcome: "closed" }).household)!, scope, crypto.randomUUID());
    expect(command.chapterVersion).toBe(1);
    const { chapterVersion: _old, ...older } = command;
    await expect(prepareCommand(state, older, scope, () => {})).rejects.toThrow("CLIENT_RELOAD_REQUIRED");
    await expect(prepareCommand(state, command, scope, () => {})).resolves.toBeTruthy();
  });
});
