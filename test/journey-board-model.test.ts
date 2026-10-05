import { describe, expect, it } from "vitest";
import { addAppointment, postEntry, postOneRecurrence, postVisit } from "../src/core/commands.ts";
import { monthEndKey, monthStartKey, weekBounds, weekdaySunday0, type DateKey } from "../src/core/calendar.ts";
import { monthMemories } from "../src/core/timeMachine.ts";
import type { Household } from "../src/core/types.ts";
import { dayLedger } from "../src/harbour/glass/dayLedger.ts";
import { STATION_IDS, isToCheck, journeyIds, type ActionCall, type JourneyBoard, type Stop } from "../src/journey/contracts.ts";
import { boardToList, deriveJourneyBoard, deriveJourneyBoardWithSummary } from "../src/journey/model/index.ts";
import { calendarDays, readContext } from "../src/journey/model/window.ts";
import { calendarWeight } from "../src/core/calendarWeight.ts";
import { SAMPLE_TODAY, sampleJourneyBoard } from "./fixtures/journey-board-sample.ts";
import { buildMonthBoard } from "../src/core/board.ts";
import { calendarPresentation } from "../src/core/ledgerExperience.ts";
import {
  JONATHAN, FIXTURE_TODAY, BIANCA, busyMonthHousehold, deepFreeze, emptyBoardHousehold, journeyDemoHousehold,
  laggingChapterHousehold, proposeChapterClose, quietMonthHousehold,
} from "./fixtures/journey-board-households.ts";

const demo = journeyDemoHousehold();
const board = deriveJourneyBoard(demo.household, BIANCA, FIXTURE_TODAY);
/** The model's own summary the board was split from (`purse`, `digest`, `toCheck`). */
const summaryOf = (h: Household, member = BIANCA, day: DateKey = FIXTURE_TODAY) => deriveJourneyBoardWithSummary(h, member, day).summary;
const boardSummary = summaryOf(demo.household);
const byId = (b: JourneyBoard, id: string) => b.stops.find(stop => stop.id === id);
const idMap = (b: JourneyBoard) => new Map(b.stops.map(stop => [stop.id, stop.chapterId]));

const ID_SHAPES: Record<Stop["kind"], RegExp[]> = {
  commitment: [/^bill:[^@]+@\d{4}-\d{2}-\d{2}$/, /^bill:item:.+@\d{4}-\d{2}-\d{2}$/],
  income: [/^income:[^@]+@\d{4}-\d{2}-\d{2}$/, /^income:tx:[^@]+$/],
  review: [/^review:\d{4}-\d{2}$/, /^review:week:\d{4}-\d{2}-\d{2}$/],
  plan: [/^plan:goal:.+$/, /^plan:task:.+$/],
  milestone: [/^milestone:[^/]+\/.+$/],
  memory: [/^memory:win:.+$/, /^memory:.+$/],
};
const OPENING_CALLS = new Set<ActionCall["name"]>(["openRecord", "openBillPaid", "openDueReview", "openPlace", "openCampfire", "openWeeklySitdown", "openHomeBook", "openEraPlanner", "openKitty", "openCalendar", "openBooks", "enterHorizon", "back"]);

describe("Journey Board model — identity", () => {
  it("builds every id from journeyIds shapes, and every id is unique", () => {
    for (const stop of board.stops) expect(ID_SHAPES[stop.kind].some(shape => shape.test(stop.id)), stop.id).toBe(true);
    const all = [...board.stops.map(s => s.id), ...board.clusters.map(c => c.id), ...board.crossroads.map(c => c.id), ...board.chapters.map(c => c.id), ...board.undatedMemories.map(m => m.id)];
    expect(new Set(all).size).toBe(all.length);
    for (const cluster of board.clusters) expect(cluster.id).toBe(journeyIds.cluster(cluster.date));
    expect(byId(board, journeyIds.bill(demo.ids.waterRecurrenceId, "2026-09-18"))).toBeDefined();
    expect(byId(board, journeyIds.review("2026-08"))).toBeDefined();
    expect(board.crossroads.map(row => row.id)).toEqual(expect.arrayContaining([journeyIds.crossroadsEra(demo.ids.eraRowId), journeyIds.crossroadsHome(BIANCA), journeyIds.crossroadsPlan(demo.ids.proposedPlanId)]));
  });

  it("re-derives identically, and a JSON round-trip of the household changes nothing", () => {
    expect(deriveJourneyBoard(demo.household, BIANCA, FIXTURE_TODAY)).toEqual(board);
    expect(deriveJourneyBoard(JSON.parse(JSON.stringify(demo.household)) as Household, BIANCA, FIXTURE_TODAY)).toEqual(board);
  });

  it("importing the SAME record twice keeps one stop that says so, never a doubled figure (review M3)", () => {
    // Tenant insurance posted through its recurrence, then the same posting imported again (a duplicate).
    const first = postOneRecurrence(demo.household, demo.ids.insuranceRecurrenceId, FIXTURE_TODAY).household;
    const once = deriveJourneyBoard(first, BIANCA, FIXTURE_TODAY);
    const id = journeyIds.bill(demo.ids.insuranceRecurrenceId, "2026-09-18");
    expect(byId(once, id)).toMatchObject({ status: "paid", amountCents: 11800 });
    const again = postEntry(first, { date: "2026-09-18", type: "expense", amount: 118, accountId: "ACC-CHEQUING", subcategoryId: "SUB-HOUSING-GAS", note: "Tenant insurance", source: "recurring", sourceId: demo.ids.insuranceRecurrenceId, confirmDuplicate: true }).household;
    const twice = deriveJourneyBoard(again, BIANCA, FIXTURE_TODAY);
    expect(twice.stops.filter(stop => stop.id === id)).toHaveLength(1);
    const stop = byId(twice, id)!;
    expect(stop).toMatchObject({ kind: "commitment", status: "paid", amountCents: 11800 });
    expect(stop.sourceRefs.filter(ref => ref.kind === "transaction")).toHaveLength(2);
    const row = boardToList(twice).find(r => r.id === id)!;
    expect(row.statusText).toBe("Paid · 2 postings · review in the Books");
    expect(row.amountText).toBe("$118.00 · recorded");
    expect(stop.actions.find(a => a.primary)).toMatchObject({ label: "Review it in the Books", call: { name: "openBooks", ref: { kind: "register" } } });
    // Nothing else moved.
    const after = idMap(twice);
    for (const [other, chapterId] of idMap(once)) expect(after.get(other), other).toBe(chapterId);
  });

  it("keys a Fund contribution on its own Fund event, so removing a neighbour never re-keys it (review MINOR 8)", () => {
    const fund = board.stops.filter((stop): stop is Extract<Stop, { kind: "income" }> => stop.kind === "income" && stop.origin === "fund-confirmed");
    expect(fund.length).toBeGreaterThan(1);
    for (const stop of fund) {
      const event = stop.sourceRefs.find(ref => ref.kind === "fundEvent");
      expect(event, stop.id).toBeDefined();
      expect(stop.id).toBe(journeyIds.income(`fund:${stop.memberId ?? "unknown"}:${event!.id}`, stop.date));
    }
    // A confirmed contribution stands in for the expected Fund stop on its member and date.
    for (const stop of fund) expect(byId(board, journeyIds.income(`fund:${stop.memberId ?? "unknown"}`, stop.date)), stop.id).toBeUndefined();
  });

  it("importing an older record re-keys no other stop and moves no chapter", () => {
    const older = postEntry(demo.household, { date: "2026-06-03", type: "income", amount: 80, accountId: "ACC-CHEQUING", subcategoryId: "SUB-INCOME-WAGES", note: "Imported refund cheque", confirmDuplicate: true });
    const after = idMap(deriveJourneyBoard(older.household, BIANCA, FIXTURE_TODAY));
    for (const [id, chapterId] of idMap(board)) expect(after.get(id), id).toBe(chapterId);
    expect(after.get(journeyIds.incomeRecorded(older.postedIds[0]!))).toBe("2026-06");
  });

  it("correcting a one-off record's date moves that stop only, under the same id", () => {
    const moved = board.stops.find((stop): stop is Extract<Stop, { kind: "income" }> => stop.kind === "income" && stop.origin === "recorded" && stop.date === "2026-09-15")!;
    const txId = moved.id.slice("income:tx:".length);
    const corrected = structuredClone(demo.household);
    corrected.transactions = corrected.transactions.map(tx => tx.id === txId ? { ...tx, date: "2026-09-16" } : tx);
    const next = deriveJourneyBoard(corrected, BIANCA, FIXTURE_TODAY);
    expect(byId(next, moved.id)?.date).toBe("2026-09-16");
    const after = idMap(next);
    for (const [id, chapterId] of idMap(board)) expect(after.get(id), id).toBe(chapterId);
  });
});

describe("Journey Board model — financial truth", () => {
  it("expected income flips to confirmed under the same id when the recurrence is recorded", () => {
    const id = journeyIds.income(demo.ids.biancaPayRecurrenceId, FIXTURE_TODAY);
    const before = byId(board, id);
    expect(before).toMatchObject({ kind: "income", status: "expected", amountBasis: "scheduled" });
    const recorded = postOneRecurrence(demo.household, demo.ids.biancaPayRecurrenceId, FIXTURE_TODAY).household;
    const next = deriveJourneyBoard(recorded, BIANCA, FIXTURE_TODAY);
    expect(byId(next, id)).toMatchObject({ kind: "income", status: "confirmed", amountBasis: "recorded" });
    expect(next.stops.filter(stop => stop.id === id)).toHaveLength(1);
    const after = idMap(next);
    for (const [other, chapterId] of idMap(board)) expect(after.get(other), other).toBe(chapterId);
    // The earlier recurring post (Sep 5) is confirmed; its next occurrence (Oct 5) is still only expected.
    expect(byId(board, journeyIds.income(demo.ids.freelancePayRecurrenceId, "2026-09-05"))).toMatchObject({ status: "confirmed" });
    expect(byId(board, journeyIds.income(demo.ids.freelancePayRecurrenceId, "2026-10-05"))).toMatchObject({ status: "expected" });
  });

  it("never shows a future stop as paid or confirmed", () => {
    for (const stop of board.stops.filter(stop => stop.relation === "future")) {
      if (stop.kind === "commitment") expect(stop.status, stop.id).not.toBe("paid");
      if (stop.kind === "income") expect(stop.status, stop.id).toBe("expected");
    }
  });

  it("never marks an unrecorded past bill paid: paid needs a recorded transaction", () => {
    const txIds = new Set(demo.household.transactions.map(tx => tx.id));
    for (const stop of board.stops) {
      if (stop.kind !== "commitment") continue;
      const refs = stop.sourceRefs.filter(ref => ref.kind === "transaction");
      if (stop.status === "paid") { expect(refs.length, stop.id).toBeGreaterThan(0); for (const ref of refs) expect(txIds.has(ref.id)).toBe(true); }
      else expect(refs, stop.id).toEqual([]);
      if (stop.relation === "past" && stop.status !== "paid") expect(["overdue", "needs-review"]).toContain(stop.status);
    }
    expect(byId(board, journeyIds.bill(demo.ids.insuranceRecurrenceId, "2026-09-18"))).toMatchObject({ status: "overdue", amountBasis: "scheduled" });
    expect(byId(board, journeyIds.bill(demo.ids.waterRecurrenceId, "2026-09-18"))).toMatchObject({ status: "paid", amountBasis: "recorded", amountCents: 6400 });
  });

  it("a corrected recurring receipt needs review; it is never paid and never merely overdue", () => {
    const stop = byId(board, journeyIds.bill(demo.ids.streamingRecurrenceId, "2026-09-10"));
    expect(stop).toMatchObject({ kind: "commitment", status: "needs-review" });
    expect(boardSummary.attention[0]?.stopId).toBe(stop!.id);
    expect(board.chapters.find(c => c.id === "2026-09")!.unresolved.commitmentsNeedingReview).toBe(1);
  });

  it("set aside never co-occurs with paid", () => {
    const aside = board.stops.filter((stop): stop is Extract<Stop, { kind: "commitment" }> => stop.kind === "commitment" && stop.setAside !== null);
    expect(aside.length).toBeGreaterThan(0);
    for (const stop of aside) {
      expect(stop.status).not.toBe("paid");
      expect(boardToList(board).find(row => row.id === stop.id)!.statusText).toMatch(/not paid|not recorded|needs review/);
    }
    for (const stop of board.stops) if (stop.kind === "commitment" && stop.status === "paid") expect(stop.setAside).toBeNull();
  });

  it("records expected recurring pay through the reviewed recurrence path, and only when it is due (review M1)", () => {
    const due = byId(board, journeyIds.income(demo.ids.biancaPayRecurrenceId, FIXTURE_TODAY))!;
    expect(due).toMatchObject({ kind: "income", status: "expected" });
    expect(due.actions[0]).toMatchObject({ label: "Review and record…", primary: true, call: { name: "openDueReview", recurrenceId: demo.ids.biancaPayRecurrenceId } });
    // A pay day still ahead cannot be recorded yet: the Calendar, never a plain income entry.
    const ahead = byId(board, journeyIds.income(demo.ids.freelancePayRecurrenceId, "2026-10-05"))!;
    expect(ahead).toMatchObject({ kind: "income", status: "expected" });
    expect(ahead.actions.map(a => a.call.name)).toEqual(["openCalendar"]);
    for (const stop of board.stops) if (stop.kind === "income" && stop.sourceRefs.some(ref => ref.kind === "recurrence")) {
      expect(stop.actions.some(a => a.call.name === "openRecord"), stop.id).toBe(false);
    }
  });

  it("keeps expected income out of attention and counts it separately", () => {
    const september = board.chapters.find(c => c.id === "2026-09")!;
    const u = september.unresolved;
    expect(u.attention).toBe(u.overdueCommitments + u.commitmentsNeedingReview + u.chapterCloseDue);
    expect(boardSummary.attention.every(item => !item.id.includes("income:"))).toBe(true);
  });

  it("offers only callbacks that open a surface; Mark paid only when Bill paid can take that occurrence", () => {
    const recurrences = new Map(demo.household.recurrences.map(row => [row.id, row]));
    for (const stop of board.stops) for (const act of stop.actions) {
      expect(OPENING_CALLS.has(act.call.name)).toBe(true);
      expect(act.id.startsWith(`${stop.id}#`)).toBe(true);
      if (act.call.name === "openBillPaid") expect(stop).toMatchObject({ kind: "commitment", recurrenceId: act.call.recurrenceId });
      // Bill paid lists only due bills (review MINOR 2): the recurrence's next occurrence, on or before today.
      if (act.call.name === "openBillPaid" && stop.kind === "commitment") {
        expect(["due-today", "overdue"]).toContain(stop.status);
        expect(recurrences.get(act.call.recurrenceId)?.nextDate, stop.id).toBe(stop.date);
      }
      // No stop hands the App a prefill it ignores (review M1).
      if (act.call.name === "openRecord") expect(act.call.prefill, stop.id).toBeUndefined();
    }
    // An upcoming bill offers the bill jars first and no "Mark paid…" until its day.
    const upcoming = byId(board, journeyIds.bill(demo.ids.insuranceRecurrenceId, "2026-10-18"))!;
    expect(upcoming).toMatchObject({ kind: "commitment", status: "upcoming" });
    expect(upcoming.actions.map(a => [a.label, a.primary === true])).toEqual([["Open the bill jars", true], ["Open the Calendar", false]]);
    for (const row of board.crossroads) expect(["openEraPlanner", "openHomeBook", "openPlace"]).toContain(row.confirm.call.name);
  });
});

describe("Journey Board model — board shape", () => {
  it("clusters two or more stops on one date into exactly one cluster", () => {
    const dates = new Map<string, number>();
    for (const stop of board.stops) dates.set(stop.date, (dates.get(stop.date) ?? 0) + 1);
    for (const [date, count] of dates) expect(board.clusters.filter(c => c.date === date)).toHaveLength(count >= 2 ? 1 : 0);
    const sept18 = board.clusters.find(c => c.date === "2026-09-18")!;
    expect(sept18.stopIds.slice(0, 2)).toEqual([journeyIds.bill(demo.ids.insuranceRecurrenceId, "2026-09-18"), journeyIds.bill(demo.ids.waterRecurrenceId, "2026-09-18")]);
    const cell = board.chapters.find(c => c.id === "2026-09")!.days.find(d => d.date === "2026-09-18")!;
    expect(cell.clusterId).toBe(sept18.id);
    expect([...cell.stopIds].sort()).toEqual([...sept18.stopIds].sort());
  });

  it("lays out one lap: ≤ 12 chapters, consecutive months, one distinct station each, every day of each month", () => {
    expect(board.chapters.length).toBeLessThanOrEqual(12);
    expect(board.chapters.map(c => c.id)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);
    expect(new Set(board.chapters.map(c => c.stationId)).size).toBe(board.chapters.length);
    for (const chapter of board.chapters) {
      expect(chapter.stationId).toBe(STATION_IDS[Number(chapter.id.slice(5, 7)) - 1]);
      expect(chapter.days[0]!.date).toBe(monthStartKey(chapter.id));
      expect(chapter.days.at(-1)!.date).toBe(monthEndKey(chapter.id));
      expect(chapter.state).toBe(chapter.id < "2026-09" ? "past" : chapter.id === "2026-09" ? "open" : "upcoming");
    }
    expect(board.window).toEqual({ from: "2026-01", to: "2026-12" });
    expect(deriveJourneyBoard(demo.household, BIANCA, FIXTURE_TODAY, { pastMonths: 20, aheadMonths: 3 }).chapters).toHaveLength(12);
    const stops = board.stops;
    for (let i = 1; i < stops.length; i += 1) expect(stops[i - 1]!.date <= stops[i]!.date).toBe(true);
  });

  it("anchors the piece on today's month, apart from any selection", () => {
    expect(board.piece).toEqual({ anchorChapterId: "2026-09", atStationId: "sep", atDate: FIXTURE_TODAY, waitingChapterId: null });
    expect(board.currentChapterId).toBe("2026-09");
  });

  it("reads Chapters as months: August closed at a Sitdown, September open, reviews at the station", () => {
    expect(byId(board, "review:2026-08")).toMatchObject({ status: "closed", date: "2026-08-31", placeRef: { kind: "station", id: "aug" } });
    expect(byId(board, "review:2026-09")).toMatchObject({ status: "open", date: "2026-09-30" });
    const august = board.chapters.find(c => c.id === "2026-08")!;
    expect(august.record).toMatchObject({ kind: "own", recordState: "still-forming", chapterRecordId: demo.ids.augustChapterId });
    expect(august.traces.map(t => t.kind)).toEqual(expect.arrayContaining(["chapter-closed", "plan-reviewed", "memory-kept"]));
    expect(board.chapters.find(c => c.id === "2026-09")!.traces.map(t => t.kind)).toEqual(expect.arrayContaining(["task-done", "memory-kept", "milestone"]));
  });

  it("a lagging open Chapter is close-due, waits the piece's hint, and never blocks today", () => {
    const lagging = laggingChapterHousehold();
    const next = deriveJourneyBoard(lagging.household, BIANCA, FIXTURE_TODAY);
    expect(next.piece).toMatchObject({ anchorChapterId: "2026-09", waitingChapterId: "2026-08" });
    expect(byId(next, "review:2026-08")).toMatchObject({ status: "close-due" });
    expect(next.chapters.find(c => c.id === "2026-08")!.unresolved.chapterCloseDue).toBe(1);
    expect(next.chapters.find(c => c.id === "2026-09")!.record.kind).toBe("still-open");
    expect(summaryOf(lagging.household).attention.some(item => item.stopId === "review:2026-08")).toBe(true);
    const proposed = proposeChapterClose(lagging.household, BIANCA, lagging.augustChapterId, "2026-09-27T12:00:00.000Z");
    expect(byId(deriveJourneyBoard(proposed, BIANCA, FIXTURE_TODAY), "review:2026-08")).toMatchObject({ status: "waiting-on-partner" });
    expect(byId(deriveJourneyBoard(proposed, JONATHAN, FIXTURE_TODAY), "review:2026-08")).toMatchObject({ status: "waiting-on-you" });
  });

  it("shows weekly Sitdowns for this month only", () => {
    const weekly = board.stops.filter(stop => stop.kind === "review" && stop.reviewKind === "weekly-sitdown");
    expect(weekly.map(stop => stop.date)).toEqual(["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]);
    expect(weekly.every(stop => stop.kind === "review" && stop.reviewKind === "weekly-sitdown" && stop.id === journeyIds.weeklyReview(stop.weekStart))).toBe(true);
  });

  it("places goals on their arrival date: fully backed is not bought", () => {
    const goal = board.stops.find(stop => stop.kind === "plan" && stop.planKind === "goal")!;
    expect(goal).toMatchObject({ date: "2026-11-01", status: "backing", amountBasis: "target", placeRef: { kind: "kittyPlaza" } });
    const task = byId(board, journeyIds.planTask(demo.ids.taskDoneId));
    expect(task).toMatchObject({ status: "done" });
    expect(board.stops.some(stop => stop.kind === "memory" && stop.sourceRefs.some(ref => ref.kind === "task"))).toBe(false);
  });
});

describe("Journey Board model — an appointment occurrence keeps its stop id once posted (PR #567 review)", () => {
  const withVisit = (nextDate: string) => {
    const h = addAppointment(demo.household, { title: "Dentist", kind: "dentist", nextDate, cadence: { kind: "monthly", interval: 6 }, typicalCost: 140, typicalRecovery: 0, subcategoryId: "SUB-HOUSING-GAS", accountId: "ACC-CHEQUING" }).household;
    return { h, appointmentId: h.appointments.at(-1)!.id };
  };
  const visitStops = (b: JourneyBoard, appointmentId: string) => b.stops.filter(stop => stop.kind === "commitment" && stop.id.startsWith(`bill:item:${appointmentId}@`));
  for (const [what, nextDate] of [["overdue this month", "2026-09-20"], ["carried from last month", "2026-08-25"], ["due today", FIXTURE_TODAY]] as const) {
    it(`${what}: posted today ("the full cost posts today"), the SAME stop turns Paid`, () => {
      const { h, appointmentId } = withVisit(nextDate);
      const before = visitStops(deriveJourneyBoard(h, BIANCA, FIXTURE_TODAY), appointmentId);
      expect(before, "one unpaid occurrence").toHaveLength(1);
      expect(before[0]).toMatchObject({ status: nextDate < FIXTURE_TODAY ? "overdue" : "due-today" });
      const posted = postVisit(h, { date: FIXTURE_TODAY, amount: 140, appointmentId, accountId: "ACC-CHEQUING", expectedRecovery: 0, confirmDuplicate: true, createdBy: BIANCA }).household;
      const after = visitStops(deriveJourneyBoard(posted, BIANCA, FIXTURE_TODAY), appointmentId);
      expect(after.map(stop => stop.id)).toEqual([before[0]!.id]);
      expect(after[0]).toMatchObject({ status: "paid", date: FIXTURE_TODAY, amountCents: 14_000 });
    });
  }
  it("an upcoming visit keeps its own day in its id", () => {
    const { h, appointmentId } = withVisit("2026-10-02");
    expect(visitStops(deriveJourneyBoard(h, BIANCA, FIXTURE_TODAY), appointmentId).map(stop => stop.id)).toEqual([journeyIds.billItem(appointmentId, "2026-10-02")]);
  });
});

describe("Journey Board model — memories, milestones, crossroads", () => {
  it("keeps only what every member kept: never a Win kept by one, never an auto-derived month memory", () => {
    const memories = board.stops.filter(stop => stop.kind === "memory");
    const ids = memories.map(stop => stop.id);
    expect(ids).toHaveLength(3);
    expect(ids).toEqual(expect.arrayContaining([journeyIds.memory(demo.ids.hearthsideMemoryId), journeyIds.memoryWin(demo.ids.winBothId), expect.stringMatching(/^memory:win-memory-[0-9a-f]{64}$/)]));
    expect(memories.find(stop => stop.id.startsWith("memory:win-memory-"))).toMatchObject({ date: "2026-07-12", memoryKind: "hearthside" });
    expect(byId(board, journeyIds.memoryWin(demo.ids.winOneId))).toBeUndefined();
    expect(byId(board, journeyIds.memoryWin(demo.ids.adoptedWinId))).toBeUndefined();
    expect(byId(board, journeyIds.memory(demo.ids.halfKeptMemoryId))).toBeUndefined();
    const derived = board.chapters.flatMap(chapter => monthMemories(demo.household, chapter.id)).filter(row => row.kind !== "win");
    for (const row of derived) expect(memories.some(stop => stop.label === row.title), row.title).toBe(false);
  });

  it("keeps a shared Win on the board while its adopted memory waits on a member, or after it is withdrawn (PR #567 review)", () => {
    const winStop = journeyIds.memoryWin(demo.ids.adoptedWinId);
    const adoptedStop = (b: JourneyBoard) => b.stops.find(stop => stop.id.startsWith("memory:win-memory-"));
    const withAdopted = (change: (memory: NonNullable<Household["hearthside"]>["memories"][number]) => typeof memory): Household => {
      const h = structuredClone(demo.household);
      h.hearthside!.memories = h.hearthside!.memories.map(memory => memory.id.startsWith("win-memory-") ? change(memory) : memory);
      return h;
    };
    // Kept by everyone: the adopted memory speaks for the Win (one stop, not two).
    expect(adoptedStop(board)).toBeDefined();
    expect(byId(board, winStop)).toBeUndefined();
    // Adoption waiting on the other member: the Win stays, the half-kept memory does not show.
    const waiting = deriveJourneyBoard(withAdopted(memory => ({ ...memory, approvals: memory.approvals.filter(a => a.memberId === BIANCA) })), BIANCA, FIXTURE_TODAY);
    expect(adoptedStop(waiting)).toBeUndefined();
    expect(byId(waiting, winStop)).toMatchObject({ kind: "memory", memoryKind: "win", date: "2026-07-12", status: "kept-by-everyone" });
    // Withdrawn: the Win is still kept by everyone, so it stays.
    const withdrawn = deriveJourneyBoard(withAdopted(memory => ({ ...memory, withdrawn: true })), BIANCA, FIXTURE_TODAY);
    expect(adoptedStop(withdrawn)).toBeUndefined();
    expect(byId(withdrawn, winStop)).toMatchObject({ kind: "memory", memoryKind: "win" });
  });

  it("shows the viewer's own milestones without granting any; a partner's stay private", () => {
    const granted = board.stops.filter(stop => stop.kind === "milestone" && stop.status === "granted").map(stop => stop.id).sort();
    expect(granted).toEqual(["established", "gallery", "hosting", "reading"].map(id => journeyIds.milestone(BIANCA, id)));
    const ready = board.stops.filter(stop => stop.kind === "milestone" && stop.status === "ready-to-record");
    expect(ready.map(stop => stop.id).sort()).toEqual(["garden", "workshop"].map(id => journeyIds.milestone(BIANCA, id)));
    expect(ready.every(stop => stop.date === FIXTURE_TODAY)).toBe(true);
    expect(demo.household.personalLife!.home!.awards).toHaveLength(4);
    expect(board.homes).toEqual([{ memberId: BIANCA, plotId: "plot.terraces.1", layout: demo.household.personalLife!.home!.layout }]);
    const partner = deriveJourneyBoard(demo.household, JONATHAN, FIXTURE_TODAY);
    expect(partner.stops.some(stop => stop.kind === "milestone")).toBe(false);
    expect(partner.homes).toEqual([]);
    expect(partner.crossroads.some(row => row.kind === "homeBlueprint")).toBe(false);
  });

  it("offers only real choices, previewed from existing records, confirmed in their own surface", () => {
    const era = board.crossroads.find(row => row.kind === "eraProposal")!;
    expect(era.waitingOn).toEqual([JONATHAN]);
    expect(era.alternatives.filter(alt => alt.isCurrent)).toHaveLength(1);
    expect(era.confirm.call).toEqual({ name: "openEraPlanner", eraId: demo.ids.eraRowId });
    const home = board.crossroads.find(row => row.kind === "homeBlueprint")!;
    const future = home.alternatives.find(alt => !alt.isCurrent)!.preview;
    expect(future).toMatchObject({ kind: "home", lockedFamilies: ["garden"], roomsRemoved: [] });
    expect(future.kind === "home" && future.roomsAdded.length).toBe(2);
    expect(home.confirm.call).toEqual({ name: "openHomeBook", memberId: BIANCA });
    const plan = board.crossroads.find(row => row.kind === "planFork")!;
    expect(plan).toMatchObject({ chapterId: "2026-10", date: "2026-10-01" });
    expect(plan.alternatives.find(alt => !alt.isCurrent)!.preview).toEqual({ kind: "plan", added: [{ label: "Rent", amountCents: 185000 }, { label: "Ferry to Newfoundland", amountCents: 42000 }], removed: [], changed: [] });
    expect(board.chapters.find(c => c.id === "2026-10")!.crossroadsIds).toEqual([plan.id]);
  });
});

describe("Journey Board model — list equivalent", () => {
  it("lists every stop and crossroads id once, with exactly the stop's actions", () => {
    const rows = boardToList(board);
    const stopRows = rows.filter(row => row.level === "stop");
    expect(stopRows.map(row => row.id).sort()).toEqual([...board.stops, ...board.undatedMemories].map(stop => stop.id).sort());
    for (const stop of board.stops) expect(stopRows.find(row => row.id === stop.id)!.actions).toEqual(stop.actions);
    expect(rows.filter(row => row.level === "crossroads").map(row => row.id).sort()).toEqual(board.crossroads.map(row => row.id).sort());
    for (const row of rows.filter(row => row.level === "crossroads")) expect(row.actions[0]!.call).toEqual(board.crossroads.find(c => c.id === row.id)!.confirm.call);
    expect(rows.filter(row => row.level === "cluster").map(row => row.id)).toEqual(board.clusters.map(c => c.id));
    expect(rows.filter(row => row.level === "chapter").map(row => row.id)).toEqual([...board.olderChapters.map(c => c.id), ...board.chapters.map(c => c.id)]);
    const dated = rows.filter(row => row.level !== "chapter" && row.date !== null).map(row => row.date!);
    expect(dated).toEqual([...dated].sort());
    expect(rows.find(row => row.id === journeyIds.bill(demo.ids.insuranceRecurrenceId, "2026-09-18"))).toMatchObject({ kindLabel: "Bill", amountText: "$118.00 · scheduled", statusText: "Overdue · not recorded", depth: 2 });
    expect(rows.find(row => row.id === journeyIds.bill(demo.ids.waterRecurrenceId, "2026-09-18"))).toMatchObject({ statusText: "Paid · recorded Fri 18 Sep" });
  });
});

describe("Journey Board model — households", () => {
  it("names the board's standing limits in its list footer (review MINOR 4 / MINOR 5)", () => {
    expect(board.limitations).toEqual(expect.arrayContaining([
      "The island on the board is always drawn in summer; Horizon follows the real season.",
      "The yacht and the boats are not shown on the board: they are kept on this device, inside Horizon.",
      "“Open the Calendar” opens the Calendar on this month, not on the stop’s day.",
      "The Campfire opens on the Chapter that is still open, not on a month chosen on the board.",
    ]));
  });

  it("gives a new household an honest empty board with setup actions only", () => {
    const empty = deriveJourneyBoard(emptyBoardHousehold(), BIANCA, FIXTURE_TODAY);
    expect(empty.empty).toBe(true);
    expect(empty.stops).toEqual([]);
    expect(empty.crossroads).toEqual([]);
    expect(empty.clusters).toEqual([]);
    expect(empty.undatedMemories).toEqual([]);
    expect(empty.olderChapters).toEqual([]);
    expect(empty.homes).toEqual([]);
    expect(empty.chapters).toHaveLength(12);
    expect(empty.chapters.every(c => c.stopIds.length === 0 && c.traces.length === 0 && c.unresolved.attention === 0)).toBe(true);
    const emptySummary = summaryOf(emptyBoardHousehold());
    expect(emptySummary.quickActions.some(a => a.call.name === "openRecord")).toBe(false);
    expect(emptySummary.quickActions.map(a => a.call.name)).toEqual(["openBooks", "openPlace", "openCalendar"]);
    expect(emptySummary.next).toEqual([]);
    expect(boardToList(empty).filter(row => row.level !== "chapter")).toEqual([]);
  });

  it("keeps a quiet month quiet and still points at what is next", () => {
    const quiet = deriveJourneyBoard(quietMonthHousehold(), BIANCA, FIXTURE_TODAY);
    expect(quiet.empty).toBe(false);
    expect(quiet.chapters.find(c => c.id === "2026-09")!.stopIds).toEqual([]);
    const quietSummary = summaryOf(quietMonthHousehold());
    expect(quietSummary.next[0]).toMatch(/^bill:.+@2026-10-01$/);
    expect(quietSummary.quickActions[0]!.call).toEqual({ name: "openRecord", mode: "expense" });
  });

  it("keeps a busy month legible: every bill one stop, shared dates clustered, ids unchanged elsewhere", () => {
    const busy = busyMonthHousehold(demo.household);
    const next = deriveJourneyBoard(busy.household, BIANCA, FIXTURE_TODAY);
    for (const id of busy.busyRecurrenceIds) expect(next.stops.filter(stop => stop.kind === "commitment" && stop.recurrenceId === id && stop.chapterId === "2026-09")).toHaveLength(1);
    expect(next.clusters.find(c => c.date === "2026-09-11")!.stopIds.filter(id => busy.busyRecurrenceIds.some(r => id.includes(r)))).toHaveLength(3);
    const after = idMap(next);
    for (const [id, chapterId] of idMap(board)) expect(after.get(id), id).toBe(chapterId);
  });

  it("never mutates its input (deep-frozen household)", () => {
    const frozen = deepFreeze(structuredClone(demo.household));
    const before = JSON.stringify(frozen);
    expect(deriveJourneyBoard(frozen, BIANCA, FIXTURE_TODAY)).toEqual(board);
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it("reads the months outside the day ledger's direct range exactly as the day ledger does", () => {
    const h = demo.household;
    const ctx = readContext(h, BIANCA, FIXTURE_TODAY);
    const presented = calendarPresentation(h, BIANCA, "household");
    const pots = new Map<string, "prepare" | "build">();
    for (const day of ctx.days.values()) for (const slip of day.slips) if (slip.recurrenceId && slip.pot) pots.set(slip.recurrenceId, slip.pot);
    for (const month of ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]) {
      const ledger = dayLedger({ household: h, memberId: BIANCA, space: "ours", today: FIXTURE_TODAY, from: monthStartKey(month), to: monthEndKey(month) });
      const replica = calendarDays(h, month, FIXTURE_TODAY, calendarWeight(presented, buildMonthBoard(presented, month, FIXTURE_TODAY), FIXTURE_TODAY), pots, ctx.sitdownWeekday, true);
      const shape = (days: typeof replica) => days.map(d => ({ date: d.date, coins: d.coins, slips: d.slips, pennants: d.pennants, flagstone: d.flagstone, sitdown: d.sitdown, station: d.station, relation: d.relation }));
      expect(shape(replica), month).toEqual(shape(ledger.days));
    }
  });

  it("derives the demo household in under 400 ms (warm median on this machine; not a phone budget — review M2)", () => {
    deriveJourneyBoard(demo.household, BIANCA, FIXTURE_TODAY);
    // The median of 5 warm runs, with headroom for a loaded gate (4 workers measured ~215 ms best-of-3).
    const runs: number[] = [];
    for (let i = 0; i < 5; i += 1) { const t = performance.now(); deriveJourneyBoard(demo.household, BIANCA, FIXTURE_TODAY); runs.push(performance.now() - t); }
    const median = [...runs].sort((a, b) => a - b)[2]!;
    console.info(`[journey-board-model] deriveJourneyBoard(demo) warm median: ${median.toFixed(1)} ms (runs ${runs.map(ms => ms.toFixed(1)).join(" / ")})`);
    expect(median).toBeLessThan(400);
  });
});

describe("Journey Board model — Horizon Clock v2 fields on the fixture households", () => {
  it("is a v2 board; to check = overdue + needs-review commitments (a corrected receipt counts; it is never paid)", () => {
    expect(board.version).toBe(2);
    const needsReview = byId(board, journeyIds.bill(demo.ids.streamingRecurrenceId, "2026-09-10"))!;
    expect(board.toCheck).toContain(needsReview.id);
    // Independent of `isToCheck`: the summary's own attention commitments (the old list) are exactly the chip's set.
    const attention = boardSummary.attention.filter(item => item.stopId !== null && byId(board, item.stopId)?.kind === "commitment").map(item => item.stopId!);
    expect([...board.toCheck].sort()).toEqual([...attention].sort());
    for (const id of board.toCheck) expect(["overdue", "needs-review"]).toContain((byId(board, id) as Extract<Stop, { kind: "commitment" }>).status);
    expect(board.stops.filter(stop => !board.toCheck.includes(stop.id)).some(isToCheck)).toBe(false);
    const counted = board.chapters.reduce((n, c) => n + c.unresolved.overdueCommitments + c.unresolved.commitmentsNeedingReview, 0);
    expect(board.toCheck).toHaveLength(counted);
    for (const row of boardToList(board).filter(r => r.level === "stop")) expect(row.toCheck).toBe(board.toCheck.includes(row.id));
  });

  it("the digest splits the summary's attention: Chapter items, readNeeds waiting on you, and to-check — nothing lost", () => {
    const lagging = laggingChapterHousehold();
    const { board: next, summary } = deriveJourneyBoardWithSummary(lagging.household, BIANCA, FIXTURE_TODAY);
    expect(next.digest.chapter.map(item => item.stopId)).toEqual(["review:2026-08"]);
    const commitments = summary.attention.filter(item => item.stopId !== null && byId(next, item.stopId)!.kind === "commitment").map(item => item.stopId);
    expect(new Set(commitments)).toEqual(new Set(next.toCheck));
    expect(next.digest.waitingOnYou).toEqual(summary.attention.filter(item => item.stopId === null));
    expect(next.digest.chapter.length + next.digest.waitingOnYou.length + commitments.length).toBe(summary.attention.length);
  });

  it("a new household's v2 board is honestly empty", () => {
    const empty = deriveJourneyBoard(emptyBoardHousehold(), BIANCA, FIXTURE_TODAY);
    expect(empty).toMatchObject({ version: 2, toCheck: [], purse: { expectedToday: [] }, digest: { weekStopIds: [], nextLeavingStopId: null, nextIsSettingAside: false, toCheckIds: [] } });
    expect(empty.week.days.every(day => day.size === "stone" || day.size === "today")).toBe(true);
    expect(empty.year.every(row => row.outRecordedCents + row.outOpenCents + row.inRecordedCents + row.inOpenCents === 0)).toBe(true);
  });
});

describe("Journey Board model — kinds × statuses the fixture exercises", () => {
  it("covers every stop kind and the statuses the brief names", () => {
    const seen = new Set(board.stops.map(stop => `${stop.kind}:${"reviewKind" in stop ? stop.reviewKind + ":" : ""}${"planKind" in stop ? stop.planKind + ":" : ""}${stop.status}`));
    for (const key of ["commitment:overdue", "commitment:paid", "commitment:upcoming", "commitment:needs-review", "income:expected", "income:confirmed", "review:chapter-close:closed", "review:chapter-close:open", "review:weekly-sitdown:scheduled", "plan:goal:backing", "plan:task:open", "plan:task:done", "milestone:granted", "milestone:ready-to-record", "memory:kept-by-everyone"]) expect(seen, key).toContain(key);
    const today = deriveJourneyBoard(demo.household, BIANCA, "2026-09-18" as DateKey);
    expect(byId(today, journeyIds.bill(demo.ids.insuranceRecurrenceId, "2026-09-18"))).toMatchObject({ status: "due-today", relation: "today" });
  });
});

describe("the hand-written sample board follows the model's contracts (PR #567 review)", () => {
  const sample = sampleJourneyBoard();
  it("keys weekly Sitdowns on weekBounds' week start (a Sunday), as the model does", () => {
    const weekly = sample.stops.filter(stop => stop.kind === "review" && stop.reviewKind === "weekly-sitdown");
    expect(weekly.length).toBeGreaterThan(0);
    for (const stop of weekly) {
      if (stop.kind !== "review" || stop.reviewKind !== "weekly-sitdown") continue;
      expect(weekBounds(stop.weekStart).start).toBe(stop.weekStart);
      expect(stop.id).toBe(journeyIds.weeklyReview(stop.weekStart));
    }
    // The model agrees on a real board.
    for (const stop of board.stops) if (stop.kind === "review" && stop.reviewKind === "weekly-sitdown") expect(weekdaySunday0(stop.weekStart)).toBe(0);
  });
  it("lays the flagstone on Sundays, as the model's chapters do", () => {
    for (const chapter of [...sample.chapters, ...board.chapters]) for (const day of chapter.days) expect(day.flagstone, `${chapter.id} ${day.date}`).toBe(weekdaySunday0(day.date) === 0);
  });
  it("never sends recurring income, or any stop, through a prefilled plain entry; an upcoming chapter close opens the Calendar", () => {
    const calls = (stop: Stop) => stop.actions.map(a => a.call);
    for (const stop of sample.stops) {
      expect(calls(stop).some(call => call.name === "openRecord" && "prefill" in call && call.prefill), stop.id).toBe(false);
      if (stop.kind === "income" && stop.status === "expected" && stop.sourceRefs.some(ref => ref.kind === "recurrence")) {
        expect(calls(stop).some(call => call.name === "openRecord"), stop.id).toBe(false);
        if (stop.date <= SAMPLE_TODAY) expect(stop.actions.find(a => a.primary)?.call).toMatchObject({ name: "openDueReview" });
      }
      if (stop.kind === "review" && stop.reviewKind === "chapter-close" && stop.status === "upcoming") expect(stop.actions.find(a => a.primary)?.call.name, stop.id).toBe("openCalendar");
      if (stop.kind === "commitment" && stop.date > SAMPLE_TODAY) expect(calls(stop).some(call => call.name === "openBillPaid"), stop.id).toBe(false);
    }
  });
  it("gives memory stops the model's ids, source refs and open actions (hearthside → its own memory; Win → our memories)", () => {
    // One contract, checked on the sample and on the model's real board: a hearthside memory cites exactly one
    // `hearthsideMemory` ref and opens `memory/<raw id>`; a Win cites exactly one `win` ref and opens the memories
    // place with no object.
    const check = (stops: readonly Stop[], where: string) => {
      const seen = { hearthside: 0, win: 0 };
      for (const stop of stops) {
        if (stop.kind !== "memory") continue;
        seen[stop.memoryKind] += 1;
        expect(stop.sourceRefs, `${where} ${stop.id}`).toHaveLength(1);
        const ref = stop.sourceRefs[0]!;
        expect(stop.actions, `${where} ${stop.id}`).toHaveLength(1);
        const primary = stop.actions[0]!;
        expect(primary.primary, `${where} ${stop.id}`).toBe(true);
        if (stop.memoryKind === "hearthside") {
          expect(ref.kind, `${where} ${stop.id}`).toBe("hearthsideMemory");
          if (ref.kind !== "hearthsideMemory") continue;
          expect(stop.id).toBe(journeyIds.memory(ref.id));
          expect(primary.label).toBe("Open the memory");
          expect(primary.call).toEqual({ name: "openPlace", target: "memories", object: `memory/${ref.id}` });
        } else {
          expect(ref.kind, `${where} ${stop.id}`).toBe("win");
          if (ref.kind !== "win") continue;
          expect(stop.id).toBe(journeyIds.memoryWin(ref.id));
          expect(primary.label).toBe("Open our memories");
          expect(primary.call).toEqual({ name: "openPlace", target: "memories" });
        }
      }
      return seen;
    };
    const sampleSeen = check([...sample.stops, ...sample.undatedMemories], "sample");
    expect(sampleSeen.hearthside).toBeGreaterThan(0);
    expect(sampleSeen.win).toBeGreaterThan(0);
    const boardSeen = check([...board.stops, ...board.undatedMemories], "model");
    expect(boardSeen.hearthside + boardSeen.win).toBeGreaterThan(0);
  });
});
