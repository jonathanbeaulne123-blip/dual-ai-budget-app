import { describe, expect, it } from "vitest";
import { acceptHouseholdWrite, catalogHousehold, ensureHouseholdShape, financialAuditHash, householdForAiDisclosure, splitForSync } from "../src/core/index.ts";
import { commandIdentityHash } from "../src/core/commandIdentity.ts";
import {
  FOUNDATION_CHAPTERS,
  celebrationLevel,
  closeChapter,
  completeMove,
  keepWinAsMemory,
  memories,
  mergeRituals,
  nextFoundationChapter,
  nextMove,
  offerMove,
  openChapter,
  openChapterFor,
  ourRhythm,
  recentWin,
  recordRitualHeld,
  recordWin,
  respondToMove,
  ritualReadyToGraduate,
  shapeChapters,
  shapeRituals,
} from "../src/core/chapters.ts";
import { CHAPTER_LESSONS, CURRICULUM_BY_CHAPTER, chapterLesson } from "../src/core/planLearning.ts";
import { PLAN_CURRICULUM } from "../src/core/planSystem.ts";
import { sitdownBrief } from "../src/core/sitdownBrief.ts";
import { parseComfort, DEFAULT_COMFORT } from "../src/theme/comfort.ts";
import { compactedCommandPayload, primaryCommandRef, receiptToCommandRef } from "../src/ledger/continuityCommandLog.ts";
import { applyCommandEventLocally, extractMaterializationFacts, type ContinuityCommandEvent, type ContinuityCommandEventPayload } from "../src/ledger/materializeSnapshotFromEvents.ts";

const ME = "MEM-002";
const PARTNER = "MEM-001";
const AT = "2026-09-12T14:00:00.000Z";

describe("Chapter system — objects (Vision v2 §5)", () => {
  it("opens a foundation Chapter with its primary Ritual and first Move, one at a time", async () => {
    const household = catalogHousehold();
    const before = await financialAuditHash(household);
    const opened = openChapter(household, { memberId: ME, foundationId: "see-our-shared-life", at: AT });
    expect(opened.postedIds).toEqual([]);
    const chapter = openChapterFor(opened.household)!;
    expect(chapter.title).toBe("See Our Shared Life");
    expect(chapter.lessonId).toBe("shared-operating-system");
    expect(opened.household.rituals).toHaveLength(1);
    expect(opened.household.rituals![0]!.backupMemberId).toBe(PARTNER);
    expect(nextMove(opened.household, ME)?.text).toBe("Sign the Charter together and name who holds the Fund.");
    expect(() => openChapter(opened.household, { memberId: ME, foundationId: "make-rent-boring" })).toThrow(/Close the current Chapter/);
    // Non-money: the financial identity of the books is unchanged.
    expect(await financialAuditHash(opened.household)).toBe(before);
  });

  it("a Ritual holds as evidence, never as a streak, and graduates only when the couple chooses", () => {
    let h = openChapter(catalogHousehold(), { memberId: ME, foundationId: "make-rent-boring", at: AT }).household;
    const ritual = h.rituals![0]!;
    for (const day of ["2026-09-01", "2026-09-15", "2026-09-15", "2026-10-01"]) h = recordRitualHeld(h, { memberId: ME, ritualId: ritual.id, onDate: day }).household;
    const held = h.rituals![0]!;
    expect(held.heldOn).toEqual(["2026-09-01", "2026-09-15", "2026-10-01"]);
    expect(ritualReadyToGraduate(held)).toBe(true);
    expect(held.state).toBe("active");
    expect(ourRhythm(h)).toHaveLength(0);
  });

  it("a Move that needs both acknowledgments is not done until both have acknowledged", () => {
    let h = openChapter(catalogHousehold(), { memberId: ME, foundationId: "share-the-mental-load", at: AT }).household;
    const chapter = openChapterFor(h)!;
    h = offerMove(h, { memberId: ME, chapterId: chapter.id, text: "Jonathan owns hydro; Bianca knows where the account lives", needsAcknowledgment: true }).household;
    const move = h.moves!.find((row) => row.text.startsWith("Jonathan owns"))!;
    expect(move.acknowledgedByMemberIds).toEqual([ME]);
    expect(() => completeMove(h, { memberId: ME, moveId: move.id })).toThrow(/both of you/);
    h = respondToMove(h, { memberId: PARTNER, moveId: move.id, response: "acknowledge" }).household;
    h = completeMove(h, { memberId: ME, moveId: move.id, at: AT }).household;
    expect(h.moves!.find((row) => row.id === move.id)!.state).toBe("done");
    const win = recentWin(h, AT)!;
    expect(win.level).toBe("acknowledgment");
    expect(win.fadedAt).not.toBeNull();
  });

  it("closing as established graduates Rituals into Our Rhythm and records a graduation Win; a Memory needs both partners", () => {
    let h = openChapter(catalogHousehold(), { memberId: ME, foundationId: "build-breathing-room", at: AT }).household;
    const chapter = openChapterFor(h)!;
    h = closeChapter(h, { memberId: ME, chapterId: chapter.id, outcome: "established", carryForward: "Keep the buffer payday habit", at: AT }).household;
    expect(openChapterFor(h)).toBeNull();
    expect(ourRhythm(h)).toHaveLength(1);
    const graduation = h.wins!.find((row) => row.level === "graduation")!;
    expect(graduation.fadedAt).toBeNull();
    h = keepWinAsMemory(h, { memberId: ME, winId: graduation.id, authoredNote: "Our first buffer." }).household;
    expect(memories(h)).toHaveLength(0);
    h = keepWinAsMemory(h, { memberId: PARTNER, winId: graduation.id }).household;
    expect(memories(h)).toHaveLength(1);
    expect(memories(h)[0]!.hideAmounts).toBe(true);
    expect(nextFoundationChapter(h)?.id).toBe("see-our-shared-life");
  });

  it("a month ends; it does not pass or fail — life-changed retires Rituals and pauses open Moves", () => {
    let h = openChapter(catalogHousehold(), { memberId: ME, foundationId: "make-room-for-joy", at: AT }).household;
    const chapter = openChapterFor(h)!;
    h = closeChapter(h, { memberId: ME, chapterId: chapter.id, outcome: "life-changed", at: AT }).household;
    expect(h.rituals![0]!.state).toBe("retired");
    expect(h.moves!.every((row) => row.state === "paused")).toBe(true);
    expect(h.wins ?? []).toHaveLength(0);
  });

  it("a First or graduation needs evidence; routine acknowledgments cannot become Memories", () => {
    const h = catalogHousehold();
    expect(() => recordWin(h, { memberId: ME, level: "first", title: "First rent together" })).toThrow(/evidence/);
    const withWin = recordWin(h, { memberId: ME, level: "acknowledgment", title: "Paid hydro", at: AT }).household;
    expect(() => keepWinAsMemory(withWin, { memberId: ME, winId: withWin.wins![0]!.id })).toThrow(/fade/);
  });

  it("the celebration ladder reverses under pressure", () => {
    expect(celebrationLevel({ kind: "move" })).toBe("acknowledgment");
    expect(celebrationLevel({ kind: "ritual-held", holdCount: 3 })).toBe("shared-win");
    expect(celebrationLevel({ kind: "first" })).toBe("first");
    expect(celebrationLevel({ kind: "chapter-graduation" })).toBe("graduation");
    expect(celebrationLevel({ kind: "first", underPressure: true })).toBeNull();
  });

  it("shapes fail closed and merges union evidence", () => {
    expect(shapeChapters([{ version: 2, id: "x" }, null, { version: 1, id: "CHAP-1", title: "T", openedByMemberId: ME }])).toHaveLength(1);
    expect(shapeRituals([{ version: 1, id: "RIT-1", chapterId: "CHAP-1", title: "R", ownerMemberId: ME, cue: "nope", heldOn: ["2026-09-01", "bad"] }])[0]).toMatchObject({ cue: "custom", heldOn: ["2026-09-01"] });
    const a = shapeRituals([{ version: 1, id: "RIT-1", chapterId: "C", title: "R", ownerMemberId: ME, heldOn: ["2026-09-01"], updatedAt: "2026-09-01T00:00:00.000Z" }]);
    const b = shapeRituals([{ version: 1, id: "RIT-1", chapterId: "C", title: "R", ownerMemberId: ME, heldOn: ["2026-09-08"], updatedAt: "2026-09-08T00:00:00.000Z" }]);
    expect(mergeRituals(a, b)[0]!.heldOn).toEqual(["2026-09-01", "2026-09-08"]);
  });

  it("lives in the Shared envelope, survives shaping, and never reaches Hercules disclosure", () => {
    const h = openChapter(catalogHousehold(), { memberId: ME, foundationId: "see-our-shared-life", at: AT }).household;
    const shaped = ensureHouseholdShape(h);
    expect(shaped.chapters).toHaveLength(1);
    const split = splitForSync(shaped, ME);
    expect(split.shared.chapters).toHaveLength(1);
    expect(split.shared.rituals).toHaveLength(1);
    const disclosed = householdForAiDisclosure(shaped, ME, { view: "household" });
    expect(disclosed.chapters ?? []).toHaveLength(0);
  });

  it("binds Chapter changes into command identity and replays direct and compacted Ledger sync v2 events", async () => {
    const base = catalogHousehold();
    const opened = openChapter(base, { memberId: ME, foundationId: "make-rent-boring", at: AT });
    expect(await commandIdentityHash(base, opened.household, [])).not.toBe(
      await commandIdentityHash(base, base, []),
    );
    const first = await acceptHouseholdWrite({
      previous: base,
      candidate: opened.household,
      confirmationId: "chapter-open",
      commandKind: "updateChapters",
      postedIds: [],
      actingMemberId: ME,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    expect(first.ok).toBe(true);
    const firstReceipt = first.household.commandReceipts?.find((row) => row.confirmationId === "chapter-open")!;
    expect(firstReceipt.materializationHash).toMatch(/^[a-f0-9]{64}$/);
    const firstRef = receiptToCommandRef({ household: first.household, receipt: firstReceipt, baseRevision: base.revision });
    const event = (id: string, previousRevision: number, resultRevision: number, ref: typeof firstRef, household = first.household): ContinuityCommandEvent => ({
      id,
      environment: household.environment,
      household_id: household.householdId,
      member_id: ME,
      idempotency_key: ref.confirmationId,
      confirmation_id: ref.confirmationId,
      identity_hash: ref.identityHash,
      base_revision: previousRevision,
      result_revision: resultRevision,
      ledger_scope: ref.ledgerScope,
      command_type: ref.commandType,
      payload_json: {
        ...ref.commandPayload,
        materializationFacts: extractMaterializationFacts(household, ref.commandPayload.postedIds, {
          acceptedAt: ref.commandPayload.acceptedAt,
          ledgerScope: ref.ledgerScope,
          memberId: ME,
          commandKind: ref.commandType,
        }),
      },
      created_at: ref.commandPayload.acceptedAt,
    });
    const direct = await applyCommandEventLocally({
      local: base,
      event: event("evt-chapter-open", base.revision, first.household.revision, firstRef),
      memberId: ME,
    });
    expect(direct.ok).toBe(true);
    if (!direct.ok) throw new Error(direct.reason);
    expect(direct.household.chapters).toEqual(first.household.chapters);
    expect(direct.household.rituals).toEqual(first.household.rituals);
    expect(direct.household.moves).toEqual(first.household.moves);
    const missingFacts = event("evt-chapter-missing", base.revision, first.household.revision, firstRef);
    missingFacts.payload_json.materializationFacts = {};
    expect(await applyCommandEventLocally({ local: base, event: missingFacts, memberId: ME }))
      .toEqual({ ok: false, reason: "chapter-materialization-invalid", fallback: true });

    const ritual = first.household.rituals![0]!;
    const held = recordRitualHeld(first.household, {
      memberId: ME,
      ritualId: ritual.id,
      onDate: "2026-09-12",
      at: "2026-09-12T15:00:00.000Z",
    });
    const second = await acceptHouseholdWrite({
      previous: first.household,
      candidate: held.household,
      confirmationId: "chapter-held",
      commandKind: "updateChapters",
      postedIds: [],
      actingMemberId: ME,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    const secondReceipt = second.household.commandReceipts?.find((row) => row.confirmationId === "chapter-held")!;
    const secondRef = receiptToCommandRef({ household: second.household, receipt: secondReceipt, baseRevision: first.household.revision });
    const compacted = await compactedCommandPayload(
      { confirmationIds: [firstRef.confirmationId, secondRef.confirmationId], commandRefs: [firstRef, secondRef] },
      primaryCommandRef([firstRef, secondRef]),
      second.household,
      ME,
    );
    const compactedReplay = await applyCommandEventLocally({
      local: base,
      event: {
        ...event("evt-chapter-compacted", base.revision, second.household.revision, secondRef, second.household),
        payload_json: compacted as ContinuityCommandEventPayload,
      },
      memberId: ME,
    });
    if (!compactedReplay.ok) throw new Error(compactedReplay.reason);
    expect(compactedReplay.ok).toBe(true);
    expect(compactedReplay.household.chapters).toEqual(second.household.chapters);
    expect(compactedReplay.household.rituals).toEqual(second.household.rituals);

    const brokenReference = structuredClone(event("evt-chapter-reference", base.revision, first.household.revision, firstRef));
    brokenReference.payload_json.materializationFacts!.moves![0]!.chapterId = "CHAP-MISSING";
    expect(await applyCommandEventLocally({ local: base, event: brokenReference, memberId: ME }))
      .toEqual({ ok: false, reason: "chapter-materialization-invalid", fallback: true });

    const tampered = structuredClone(event("evt-chapter-tampered", base.revision, first.household.revision, firstRef));
    tampered.payload_json.materializationFacts!.chapters![0]!.title = "Tampered";
    expect(await applyCommandEventLocally({ local: base, event: tampered, memberId: ME }))
      .toEqual({ ok: false, reason: "materialization-hash-mismatch", fallback: true });
  });
});

describe("Lessons and the Sitdown brief", () => {
  it("every foundation Chapter has a lesson with a couple skill and a Canadian review date", () => {
    for (const chapter of FOUNDATION_CHAPTERS) {
      const lesson = chapterLesson(chapter.lessonId);
      expect(lesson, chapter.id).not.toBeNull();
      expect(lesson!.coupleSkill.length).toBeGreaterThan(10);
      expect(lesson!.jurisdiction).toBe("Canada");
    }
    expect(Object.keys(CHAPTER_LESSONS)).toHaveLength(7);
  });

  it("re-keys the twelve-module curriculum so no module is orphaned", () => {
    const covered = new Set(Object.values(CURRICULUM_BY_CHAPTER).flat());
    for (const [id] of PLAN_CURRICULUM) expect(covered.has(id), id).toBe(true);
  });

  it("the brief reads only shared-scope evidence and names what needs both", () => {
    const h = openChapter(catalogHousehold(), { memberId: ME, foundationId: "see-our-shared-life", at: AT }).household;
    const before = JSON.stringify(h);
    const brief = sitdownBrief(h, { memberId: ME, today: "2026-09-12" });
    expect(JSON.stringify(h)).toBe(before);
    expect(brief.chapter?.title).toBe("See Our Shared Life");
    expect(typeof brief.underPressure).toBe("boolean");
    for (const item of [...brief.changed, ...brief.settled, ...brief.needsBoth]) expect(item.text).not.toMatch(/owes|behind|failed us|score/i);
  });
});

describe("Comfort controls", () => {
  it("parses defensively and defaults sound off", () => {
    expect(parseComfort(null)).toEqual(DEFAULT_COMFORT);
    expect(parseComfort({ quiet: true, celebration: "soft", motion: "reduced", haptics: false, sound: true })).toEqual({ quiet: true, celebration: "soft", motion: "reduced", haptics: false, sound: true });
    expect(parseComfort({ celebration: "loud" }).celebration).toBe("full");
  });
});
