/**
 * Horizon Clock — the Journey Map model (L1): the v2 board (`week`, `year`, `toCheck`, `purse`, `digest`),
 * `directionOf`, `listView` and the words, held against the demo household (fictional Development data:
 * `seedDemoHousehold({today:"2026-09-28"})`, viewed by Jonathan, MEM-002).
 */
import { describe, expect, it } from "vitest";
import { monthSummary } from "../src/core/budget.ts";
import { addDays, monthEndKey, monthStartKey, type DateKey } from "../src/core/calendar.ts";
import { booksPresentationFloor } from "../src/core/ledgerExperience.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";
import type { Household } from "../src/core/types.ts";
import {
  isFundStop, isToCheck, ringsFor, type JourneyBoard, type ListScope, type Stop,
} from "../src/journey/contracts.ts";
import {
  boardToList, booksActualsBetween, deriveJourneyBoard, deriveJourneyBoardWithSummary, directionOf, listView, MAP_WORDS, mondayOf,
} from "../src/journey/model/index.ts";
import { purseOf } from "../src/journey/model/purse.ts";
import { yearOf } from "../src/journey/model/year.ts";
import { amountText } from "../src/journey/model/words.ts";
import { deepFreeze } from "./fixtures/journey-board-households.ts";

const TODAY = "2026-09-28" as DateKey;
const JONATHAN = "MEM-002";
const household = seedDemoHousehold({ today: TODAY });
const { board, summary: boardSummary } = deriveJourneyBoardWithSummary(household, JONATHAN, TODAY);
const stopById = new Map(board.stops.map(stop => [stop.id, stop]));
const stop = (id: string) => stopById.get(id)!;
const known = (s: Stop) => (s.amountCents === null || s.amountCents === undefined || s.amountBasis === "unknown" ? null : s.amountCents);
const recorded = (s: Stop) => (s.kind === "commitment" && s.status === "paid") || (s.kind === "income" && s.status === "confirmed");

/** The demo's eight commitments whose date passed unrecorded, by label and date (the ids carry seeded recurrence ids). */
const OVERDUE_DEMO: [string, DateKey][] = [
  ["Groceries · planned", "2026-06-15"], ["Groceries · planned", "2026-07-15"], ["Groceries · planned", "2026-08-15"],
  ["Groceries · planned", "2026-09-15"], ["Internet", "2026-09-20"], ["Gas", "2026-09-22"], ["Phone", "2026-09-25"],
  ["Vet · Marmalade", "2026-09-26"],
];
const overdueIds = OVERDUE_DEMO.map(([label, date]) => {
  const found = board.stops.filter(s => s.kind === "commitment" && s.label === label && s.date === date);
  expect(found, `${label} ${date}`).toHaveLength(1);
  return found[0]!.id;
});

/** A copy of a stop with no known figure (unknown is never zero). */
const unknownCopy = (s: Stop, id: string): Stop => ({ ...s, id, amountCents: null, amountBasis: "unknown" } as Stop);

describe("Horizon Clock model — the v2 board", () => {
  it("is a v2 board: every Horizon Clock field present", () => {
    expect(board.version).toBe(2);
    for (const key of ["week", "year", "toCheck", "purse", "digest"] as const) expect(board[key]).toBeDefined();
    expect(board.year.map(row => row.chapterId)).toEqual(board.chapters.map(chapter => chapter.id));
  });

  it("is deterministic and pure: same input → equal board and lists; a deep-frozen household and board are never mutated", () => {
    const frozen = deepFreeze(structuredClone(household)) as Household;
    const before = JSON.stringify(frozen);
    const again = deriveJourneyBoard(frozen, JONATHAN, TODAY);
    expect(again).toEqual(board);
    expect(deriveJourneyBoard(JSON.parse(JSON.stringify(household)) as Household, JONATHAN, TODAY)).toEqual(board);
    deepFreeze(again);
    const scopes: ListScope[] = [{ level: "week" }, { level: "month", chapterId: "2026-09" }, { level: "year" }];
    for (const scope of scopes) {
      const first = listView(frozen, again, scope);
      expect(listView(frozen, again, scope)).toEqual(first);
      expect(listView(household, board, scope)).toEqual(first);
    }
    expect(JSON.stringify(frozen)).toBe(before);
  });
});

describe("Horizon Clock model — direction and \"to check\"", () => {
  it("directionOf: income in, commitment out, everything else none (a goal's target is never money moving)", () => {
    for (const s of board.stops) {
      expect(directionOf(s), s.id).toBe(s.kind === "income" ? "in" : s.kind === "commitment" ? "out" : "none");
      if (s.amountBasis === "target") expect(directionOf(s)).toBe("none");
    }
    expect(board.stops.some(s => s.kind === "plan" && s.planKind === "goal")).toBe(true);
  });

  it("toCheck is exactly the demo's 8 overdue commitments, in date order, and is isToCheck over every stop", () => {
    expect(board.toCheck).toEqual(overdueIds);
    expect(board.toCheck).toEqual(board.stops.filter(isToCheck).map(s => s.id));
    for (const id of board.toCheck) expect(stop(id)).toMatchObject({ kind: "commitment", relation: "past", status: "overdue" });
    // The model's summary's overdue attention names the same stops (nothing that used to be visible disappears).
    expect(boardSummary.attention.filter(item => item.stopId && stop(item.stopId).kind === "commitment").map(item => item.stopId)).toEqual(board.toCheck);
    expect(board.year.reduce((n, row) => n + row.toCheck, 0)).toBe(8);
    expect(board.digest.toCheckIds).toEqual(board.toCheck);
  });

  it("an upcoming or due commitment is never to check; set aside is not paid and not to check before its date", () => {
    const reserve = board.stops.find(s => s.kind === "commitment" && s.label.includes("Winter reserve") && s.date === "2026-09-30")!;
    expect(reserve).toMatchObject({ status: "upcoming", setAside: "build" });
    expect(board.toCheck).not.toContain(reserve.id);
    expect(boardToList(board).find(row => row.id === reserve.id)).toMatchObject({ statusText: "Set aside in Build · not paid", toCheck: false, direction: "out" });
  });

  it("expected income is never to check, even after its date passes unrecorded (D60)", () => {
    const tomorrow = addDays(TODAY, 1);
    const later = deriveJourneyBoard(household, JONATHAN, tomorrow);
    const passed = later.stops.filter(s => s.kind === "income" && s.status === "expected" && s.relation === "past");
    expect(passed.length).toBeGreaterThan(0);
    for (const s of [...board.stops, ...later.stops]) if (s.kind === "income") expect(later.toCheck.includes(s.id) || board.toCheck.includes(s.id), s.id).toBe(false);
    for (const row of boardToList(later)) if (row.direction === "in") expect(row.toCheck).toBe(false);
  });

  it("list rows carry direction and toCheck, and the stop's own actions", () => {
    const rows = boardToList(board);
    for (const row of rows.filter(r => r.level === "stop")) {
      const s = stopById.get(row.id) ?? board.undatedMemories.find(m => m.id === row.id)!;
      expect(row.direction, row.id).toBe(directionOf(s));
      expect(row.toCheck, row.id).toBe(isToCheck(s));
      expect(row.actions).toBe(s.actions);
    }
    for (const row of rows.filter(r => r.level !== "stop")) expect(row).toMatchObject({ direction: "none", toCheck: false });
  });
});

describe("Horizon Clock model — week", () => {
  it("runs Monday 28 Sep to Sunday 4 Oct; the pile is the to-check ids; sizes are today / money / stone", () => {
    expect(board.week.from).toBe("2026-09-28");
    expect(board.week.to).toBe("2026-10-04");
    expect(board.week.days.map(day => day.date)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(board.week.days.map(day => day.relation)).toEqual(["today", "future", "future", "future", "future", "future", "future"]);
    expect(board.week.days.map(day => day.size)).toEqual(["today", "stone", "money", "money", "stone", "stone", "stone"]);
    expect(board.week.pileStopIds).toEqual(board.toCheck);
    for (const day of board.week.days) {
      expect(day.stopIds).toEqual(board.stops.filter(s => s.date === day.date).map(s => s.id));
      if (day.size === "money") expect(day.stopIds.some(id => directionOf(stop(id)) !== "none")).toBe(true);
      if (day.size === "stone") expect(day.stopIds.every(id => directionOf(stop(id)) === "none")).toBe(true);
    }
    // Nothing shows twice: a piled stop is never also on a tile.
    const onTiles = new Set(board.week.days.flatMap(day => day.stopIds));
    for (const id of board.week.pileStopIds) expect(onTiles.has(id)).toBe(false);
  });

  it("anchors to the Monday of the current week, whatever day today is (rulings 7, 13)", () => {
    expect(mondayOf("2026-09-28")).toBe("2026-09-28");
    expect(mondayOf("2026-10-01")).toBe("2026-09-28");
    expect(mondayOf("2026-10-04")).toBe("2026-09-28");
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    const sunday = deriveJourneyBoard(household, JONATHAN, "2026-10-04");
    expect(sunday.week).toMatchObject({ from: "2026-09-28", to: "2026-10-04" });
    expect(sunday.week.days.at(-1)).toMatchObject({ relation: "today", size: "today" });
    // A to-check stop inside the week stays on its own day; only earlier ones are piled.
    for (const id of sunday.toCheck) expect(sunday.week.pileStopIds.includes(id)).toBe(stopFrom(sunday, id).date < "2026-09-28");
  });

  it("the digest: this week's unresolved stops (not the to-check ones), the next leaving commitment", () => {
    const next = stop(board.digest.nextLeavingStopId!);
    expect(next).toMatchObject({ kind: "commitment", date: "2026-09-30" });
    expect(next.label).toContain("Winter reserve");
    for (const id of board.digest.weekStopIds) {
      const s = stop(id);
      expect(s.date >= board.week.from && s.date <= board.week.to).toBe(true);
      expect(isToCheck(s)).toBe(false);
      expect(recorded(s)).toBe(false);
    }
    expect(board.digest.weekStopIds).toEqual(expect.arrayContaining([next.id]));
    expect(board.digest.chapter).toEqual([]);
  });
});

function stopFrom(b: JourneyBoard, id: string): Stop { return b.stops.find(s => s.id === id)!; }

describe("Horizon Clock model — year", () => {
  it("each chapter's figures equal its stops' sums: recorded and open apart, Fund out of In, unknown counted", () => {
    for (const row of board.year) {
      const mine = board.stops.filter(s => s.chapterId === row.chapterId);
      const sum = (pick: (s: Stop) => boolean) => mine.filter(pick).reduce((n, s) => n + (known(s) ?? 0), 0);
      expect(row.outRecordedCents, row.chapterId).toBe(sum(s => s.kind === "commitment" && recorded(s)));
      expect(row.outOpenCents, row.chapterId).toBe(sum(s => s.kind === "commitment" && !recorded(s)));
      expect(row.inRecordedCents, row.chapterId).toBe(sum(s => s.kind === "income" && !isFundStop(s) && recorded(s)));
      expect(row.inOpenCents, row.chapterId).toBe(sum(s => s.kind === "income" && !isFundStop(s) && !recorded(s)));
      expect(row.unknownAmounts).toBe(mine.filter(s => directionOf(s) !== "none" && known(s) === null).length);
      expect(row.toCheck).toBe(mine.filter(isToCheck).length);
    }
    const sep = board.year.find(row => row.chapterId === "2026-09")!;
    // Two recorded Bianca pays; the four recorded Fund contributions ($2,495.00) are NOT in In.
    expect(sep.inRecordedCents).toBe(420_000);
    expect(board.stops.filter(s => s.chapterId === "2026-09" && isFundStop(s) && recorded(s)).reduce((n, s) => n + s.amountCents!, 0)).toBe(249_500);
    expect(sep).toMatchObject({ toCheck: 5, kept: false });
  });

  it("an unknown amount adds nothing and draws no stack (never $0)", () => {
    const base = board.stops.find(s => s.kind === "commitment" && s.chapterId === "2026-10")!;
    const stops = [...board.stops, unknownCopy(base, "bill:unknown@2026-10-09")];
    const before = board.year.find(row => row.chapterId === "2026-10")!;
    const after = yearOf(board.chapters, stops).find(row => row.chapterId === "2026-10")!;
    expect(after).toEqual({ ...before, unknownAmounts: before.unknownAmounts + 1 });
    const unknown = unknownCopy(base, "bill:unknown@2026-10-09");
    expect(ringsFor(unknown.amountCents, "month")).toBeNull();
    expect(ringsFor(unknown.amountCents, "year")).toBeNull();
    expect(amountText(unknown)).toBe("Unknown amount");
    expect(ringsFor(0, "month")).toEqual({ rings: 0, drawnRings: 0, capped: false });
  });
});

describe("Horizon Clock model — purse", () => {
  it("prints Everyday and today's expected pay apart; nothing sums them; Fund estimates are not pay", () => {
    expect(board.purse.everyday).toEqual(boardSummary.everyday);
    expect(board.purse.everyday).toEqual({ cents: 0, figure: "$0.00" });
    expect(board.purse.expectedToday).toHaveLength(1);
    const pay = board.purse.expectedToday[0]!;
    expect(pay).toMatchObject({ label: "Bianca pay", amountCents: 210_000 });
    expect(stop(pay.stopId)).toMatchObject({ kind: "income", status: "expected", date: TODAY });
    expect(board.purse.everyday!.cents).not.toBe(210_000);
    expect(Object.keys(board.purse).sort()).toEqual(["everyday", "expectedToday"]);
    // The recorded Bianca pay of today is confirmed, so not "expected today"; the Fund's estimates are never pay.
    for (const row of board.purse.expectedToday) expect(isFundStop(stop(row.stopId))).toBe(false);
    expect(board.stops.some(s => s.date === TODAY && isFundStop(s))).toBe(true);
  });

  it("keeps an unknown expected pay unknown (null, not $0) and still apart from Everyday", () => {
    const pay = stop(board.purse.expectedToday[0]!.stopId);
    const purse = purseOf(boardSummary.everyday, [unknownCopy(pay, "income:unknown@2026-09-28")], TODAY);
    expect(purse.expectedToday).toEqual([{ stopId: "income:unknown@2026-09-28", label: "Bianca pay", amountCents: null }]);
    expect(purse.everyday).toEqual(boardSummary.everyday);
  });
});

describe("Horizon Clock model — listView", () => {
  const books = booksPresentationFloor(household, JONATHAN, "household");

  it("Week: title, the pile first, all seven days in order with empty days said, strip from Books + stops", () => {
    const view = listView(household, board, { level: "week" });
    expect(view.title).toBe("This week · Mon 28 Sep – Sun 4 Oct");
    expect(view.groups[0]).toMatchObject({ kind: "needs-you", label: "Needs you · 8 pinned to Mon" });
    expect(view.groups[0]!.rows.map(row => row.id)).toEqual(board.toCheck);
    for (const row of view.groups[0]!.rows) expect(row).toMatchObject({ toCheck: true, direction: "out" });
    const days = view.groups.slice(1);
    expect(days.map(g => g.date)).toEqual(board.week.days.map(d => d.date));
    expect(days[0]).toMatchObject({ label: "Today · Mon 28 Sep", today: true });
    expect(days[1]).toMatchObject({ label: "Tue 29 Sep", today: false, rows: [], emptyText: MAP_WORDS.nothingOnThisDay });
    for (const group of days) expect(group.rows.map(r => r.id)).toEqual(board.week.days.find(d => d.date === group.date)!.stopIds);
    // Every row runs exactly the map's actions.
    for (const group of view.groups) for (const row of group.rows) expect(row.actions).toBe(stop(row.id).actions);

    const strip = view.strip!;
    const actuals = booksActualsBetween(books, "2026-09-28", "2026-10-04");
    expect(strip.inBooksCents).toBe(actuals.inCents);
    expect(strip.outBooksCents).toBe(actuals.outCents);
    // Still to come: Winter reserve $300 + Rent $1,850 out; Bianca pay $2,100 expected in; the Fund's estimates apart.
    expect(strip.stillToComeOutCents).toBe(30_000 + 185_000);
    expect(strip.stillToComeInCents).toBe(210_000);
    expect(strip.stillToComeEstimateCents).toBe(98_000 + 22_500);
    expect(strip.stillToComeUnknown).toBe(0);
    expect(strip.toFundCents).toBe(0);
    expect(strip.needsYou).toBe(8);
    expect(view.limitations).toEqual(board.limitations);
  });

  it("Month: In/Out are the Books' own monthSummary; Fund is its own figure, never in In; still to come from today on", () => {
    const view = listView(household, board, { level: "month", chapterId: "2026-09" });
    expect(view.title).toBe("September 2026");
    const summary = monthSummary(books, "2026-09");
    const strip = view.strip!;
    expect(strip.inBooksCents).toBe(summary.incomeActualCents);
    expect(strip.outBooksCents).toBe(summary.expenseActualCents);
    const fund = board.stops.filter(s => s.chapterId === "2026-09" && isFundStop(s) && recorded(s));
    expect(strip.toFundCents).toBe(fund.reduce((n, s) => n + s.amountCents!, 0));
    expect(strip.toFundCents).toBe(249_500);
    // Fund contributions are Fund events, not Books income: In is exactly the Books' income, nothing added.
    expect(strip.inBooksCents).not.toBe(summary.incomeActualCents + strip.toFundCents);
    const future = board.stops.filter(s => s.chapterId === "2026-09" && s.date >= TODAY && !recorded(s));
    expect(strip.stillToComeOutCents).toBe(future.filter(s => s.kind === "commitment" && s.amountBasis === "scheduled").reduce((n, s) => n + s.amountCents!, 0));
    expect(strip.stillToComeInCents).toBe(future.filter(s => s.kind === "income" && !isFundStop(s) && s.amountBasis === "scheduled").reduce((n, s) => n + s.amountCents!, 0));
    expect(strip.stillToComeEstimateCents).toBe(future.filter(s => s.amountBasis === "estimate").reduce((n, s) => n + s.amountCents!, 0));
    expect(strip.needsYou).toBe(5);
    expect(view.groups[0]).toMatchObject({ kind: "needs-you", label: "Needs you · 5" });
    // Every stop in the month is listed exactly once; day groups are in date order and never repeat a to-check stop.
    const listed = view.groups.flatMap(g => g.rows.map(r => r.id));
    expect([...listed].sort()).toEqual(board.stops.filter(s => s.chapterId === "2026-09").map(s => s.id).sort());
    const dates = view.groups.filter(g => g.kind === "day").map(g => g.date!);
    expect(dates).toEqual([...dates].sort());
    expect(view.groups.find(g => g.today)?.label).toBe("Today · Mon 28 Sep");
  });

  it("an unknown amount is counted, never summed as $0", () => {
    const base = board.stops.find(s => s.kind === "commitment" && s.date === "2026-10-01")!;
    const withUnknown = { ...board, stops: [...board.stops, unknownCopy(base, "bill:unknown@2026-10-02")].sort((a, b) => a.date.localeCompare(b.date)) };
    const before = listView(household, board, { level: "month", chapterId: "2026-10" }).strip!;
    const after = listView(household, withUnknown, { level: "month", chapterId: "2026-10" }).strip!;
    expect(after).toEqual({ ...before, stillToComeUnknown: before.stillToComeUnknown + 1 });
    const row = listView(household, withUnknown, { level: "month", chapterId: "2026-10" }).groups.flatMap(g => g.rows).find(r => r.id === "bill:unknown@2026-10-02")!;
    expect(row.amountText).toBe("Unknown amount");
  });

  it("Books actuals: a part-month read sums to the Books' monthSummary exactly, and a transfer is never In or Out", () => {
    for (const month of ["2026-08", "2026-09"]) {
      const whole = monthSummary(books, month);
      const first = booksActualsBetween(books, monthStartKey(month), `${month}-15`);
      const second = booksActualsBetween(books, `${month}-16`, monthEndKey(month));
      expect(first.inCents + second.inCents).toBe(whole.incomeActualCents);
      expect(first.outCents + second.outCents).toBe(whole.expenseActualCents);
    }
    const days = Array.from({ length: 30 }, (_, i) => addDays("2026-09-01", i));
    const byDay = days.map(day => booksActualsBetween(books, day, day));
    expect(byDay.reduce((n, d) => n + d.inCents, 0)).toBe(monthSummary(books, "2026-09").incomeActualCents);
    expect(byDay.reduce((n, d) => n + d.outCents, 0)).toBe(monthSummary(books, "2026-09").expenseActualCents);
  });

  it("Year: one group per chapter (older first, undated last), the to-check group first; an empty month says so", () => {
    const view = listView(household, board, { level: "year" });
    expect(view.title).toBe("January 2026 – December 2026");
    expect(view.groups[0]).toMatchObject({ kind: "needs-you", label: "Needs you · 8" });
    const chapters = view.groups.filter(g => g.kind === "chapter");
    expect(chapters.map(g => g.id)).toEqual([...board.olderChapters, ...board.chapters].map(c => `chapter:${c.id}`));
    expect(chapters.find(g => g.id === "chapter:2026-02")).toMatchObject({ rows: [], emptyText: MAP_WORDS.nothingOnTheMap });
    expect(chapters.find(g => g.id === "chapter:2026-09")!.today).toBe(true);
    const listed = view.groups.flatMap(g => g.rows.filter(r => r.level === "stop").map(r => r.id));
    expect([...listed].sort()).toEqual([...board.stops, ...board.undatedMemories].map(s => s.id).sort());
    expect(view.strip!.needsYou).toBe(8);

    const feb = listView(household, board, { level: "month", chapterId: "2026-02" });
    expect(feb).toMatchObject({ title: "February 2026", strip: null, groups: [], emptyText: MAP_WORDS.emptyMonth });
  });
});
