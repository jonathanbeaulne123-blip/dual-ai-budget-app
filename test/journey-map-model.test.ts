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
import { addAppointment, addRecurrence, postEntry, postTransfer, reversePostedMoney } from "../src/core/commands.ts";
import {
  boardToList, booksActualsBetween, chapterStatusText, deriveJourneyBoard, deriveJourneyBoardWithSummary, directionOf, listView, MAP_WORDS, mondayOf,
  mapMoney, openPlaceWords, signedMoney,
} from "../src/journey/model/index.ts";
import { formatCadGrouped } from "../src/core/money.ts";
import { purseOf } from "../src/journey/model/purse.ts";
import { yearOf } from "../src/journey/model/year.ts";
import { amountText } from "../src/journey/model/words.ts";
import { BIANCA, deepFreeze, journeyDemoHousehold, laggingChapterHousehold, proposeChapterClose } from "./fixtures/journey-board-households.ts";

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

  it("toCheck is exactly the demo's 8 overdue commitments, in date order, and agrees with the status words and the chapter counts", () => {
    expect(board.toCheck).toEqual(overdueIds);
    // Independent of `isToCheck`: the words every row prints, and the chapters' own unresolved counts.
    const byWords = boardToList(board).filter(row => row.level === "stop" && /^(Overdue · not recorded|Payment status needs review)/.test(row.statusText)).map(row => row.id);
    expect(board.toCheck).toEqual(byWords);
    expect(board.toCheck).toHaveLength(board.chapters.reduce((n, c) => n + c.unresolved.overdueCommitments + c.unresolved.commitmentsNeedingReview, 0));
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
    expect(purse.expectedToday).toEqual([{ stopId: "income:unknown@2026-09-28", label: "Bianca pay", amountCents: null, note: null }]);
    expect(purse.everyday).toEqual(boardSummary.everyday);
  });
});

describe("Horizon Clock model — purse and pay words (trust M3)", () => {
  it("expected pay says \"not recorded on its schedule\", never \"not in yet\"", () => {
    expect(MAP_WORDS.purse.expectedToday("Bianca pay")).toBe("Bianca pay expected today · not recorded on its schedule");
    expect(MAP_WORDS.purse.expectedToday("x")).not.toMatch(/not in yet/);
  });

  it("the demo twin: a Bianca pay is already recorded today, so the expected one says check the Books — both stay, nothing de-duplicated", () => {
    const confirmed = board.stops.filter(s => s.kind === "income" && s.status === "confirmed" && s.date === TODAY && !isFundStop(s));
    expect(confirmed.map(s => s.label)).toEqual(["Bianca pay"]);
    const expected = board.purse.expectedToday[0]!;
    expect(expected.note).toBe(MAP_WORDS.purse.alreadyRecorded);
    expect(MAP_WORDS.purse.alreadyRecorded).toBe("A pay is already recorded today · check the Books before recording this one");
    // Both stops stand (ruling 8); the expected stop's row carries the same words for its sheet and the list.
    expect(stop(expected.stopId)).toMatchObject({ kind: "income", status: "expected" });
    const rows = boardToList(board);
    expect(rows.find(r => r.id === expected.stopId)!.note).toBe(MAP_WORDS.purse.alreadyRecorded);
    expect(rows.find(r => r.id === confirmed[0]!.id)!.note).toBeNull();
    const week = listView(household, board, { level: "week" }).groups.flatMap(g => g.rows);
    expect(week.find(r => r.id === expected.stopId)!.note).toBe(MAP_WORDS.purse.alreadyRecorded);
    // Fund estimates are not pay: no note, and never in the purse.
    for (const row of rows) if (row.id.startsWith("income:fund:")) expect(row.note).toBeNull();
  });

  it("with no pay recorded that day, the expected pay carries no note", () => {
    const pay = stop(board.purse.expectedToday[0]!.stopId);
    const alone = purseOf(boardSummary.everyday, [pay], TODAY);
    expect(alone.expectedToday[0]!.note).toBeNull();
  });
});

describe("Horizon Clock model — words FIX-B prints (A10, trust minors 2–4)", () => {
  it("signedMoney reads the sign from the value", () => {
    expect(signedMoney(210_000)).toBe("+$2,100.00");
    expect(signedMoney(-1_200)).toBe("−$12.00");
    expect(signedMoney(0)).toBe("$0.00");
    expect(signedMoney(-0)).toBe("$0.00");
  });

  it("every map figure prints Hearth's grouped CAD (the Books' and panels' \"$4,716.80\"), never \"$4716.80\"", () => {
    expect(formatCadGrouped(471_680)).toBe("$4,716.80");
    expect(formatCadGrouped(-12_345_678)).toBe("-$123,456.78");
    expect(formatCadGrouped(99_999)).toBe("$999.99");
    expect(mapMoney(185_000)).toBe("$1,850.00");
    expect(signedMoney(-1_000_000)).toBe("−$10,000.00");
    // Model amount words on the board carry the same grouping wherever a figure has four or more digits.
    const words = boardToList(board).map((r) => r.amountText).filter(Boolean);
    expect(words.some((w) => /\$\d{1,3}(,\d{3})+\.\d{2}/.test(w))).toBe(true);
    expect(words.filter((w) => /\$\d{4,}/.test(w))).toEqual([]);
  });

  it("names the place an Open action opens", () => {
    expect(openPlaceWords("plan-studio")).toBe("Open the kitchen table");
    expect(openPlaceWords("cellar-bills")).toBe("Open the bill jars");
    expect(openPlaceWords("some-room")).toBe("Open the some room");
  });

  it("a chapter's needs are separate words, never one summed number", () => {
    expect(MAP_WORDS.chapterNeeds(5, true)).toBe("5 to check · Chapter close due");
    expect(MAP_WORDS.chapterNeeds(5, false)).toBe("5 to check");
    expect(MAP_WORDS.chapterNeeds(0, true)).toBe("Chapter close due");
    expect(MAP_WORDS.chapterNeeds(0, false)).toBe("");
    const sep = board.chapters.find(c => c.id === "2026-09")!;
    expect(chapterStatusText(sep)).toBe("This month · No Chapter kept · 5 to check");
    const lagging = laggingChapterHousehold();
    const next = deriveJourneyBoard(lagging.household, BIANCA, TODAY);
    const aug = next.chapters.find(c => c.id === "2026-08")!;
    expect(aug.unresolved.chapterCloseDue).toBe(1);
    expect(chapterStatusText(aug)).toMatch(/ · \d+ to check · Chapter close due$/);
    expect(chapterStatusText(aug)).not.toMatch(/need/);
  });

  it("the Year caption, the flat Key, the purse gloss and \"Setting aside next\"", () => {
    expect(MAP_WORDS.yearCaption).toBe("Each stack = bills on the map that month · ring = $1,000 · not all spending");
    expect(MAP_WORDS.flatKey).toBe("No stacks in this view: one disc per day — solid = recorded, dashed = not recorded, mint in, gold out");
    expect(MAP_WORDS.purseGloss).toBe("money here now");
    expect(MAP_WORDS.settingAsideNext).toBe("Setting aside next");
    // Winter reserve is a standing move into a Build jar: the digest says so (A11).
    expect(board.digest.nextIsSettingAside).toBe(true);
    expect(stop(board.digest.nextLeavingStopId!)).toMatchObject({ kind: "commitment", setAside: "build" });
  });
});

describe("Horizon Clock model — every attention item lands in exactly one place (trust M1)", () => {
  /** The demo plus: a needs-review bill today, a needs-review bill after this week, and a visit carried from August to today. */
  function amended() {
    let h = journeyDemoHousehold().household;
    const recurrence = (note: string, nextDate: string) => {
      const before = new Set(h.recurrences.map(r => r.id));
      h = addRecurrence(h, { cadence: "monthly", nextDate, type: "expense", amount: 40, accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", note, kind: "subscription" }).household;
      return h.recurrences.find(r => !before.has(r.id))!.id;
    };
    const corrected = (note: string, date: string) => {
      const id = recurrence(note, date);
      const posted = postEntry(h, { date, type: "expense", amount: 40, accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", note, source: "recurring", sourceId: id, confirmDuplicate: true });
      h = reversePostedMoney(posted.household, posted.postedIds[0]!, { reversalDate: TODAY }).household;
      return id;
    };
    const todayId = corrected("Gym", TODAY);
    const laterId = corrected("Music", "2026-10-10");
    h = addAppointment(h, { title: "Dentist", kind: "dentist", nextDate: "2026-08-25", cadence: { kind: "monthly", interval: 6 }, typicalCost: 140, typicalRecovery: 0, subcategoryId: "SUB-HOUSING-GAS", accountId: "ACC-CHEQUING" }).household;
    return { h, todayId, laterId, appointmentId: h.appointments.at(-1)!.id };
  }
  const fx = amended();
  const { board: b, summary } = deriveJourneyBoardWithSummary(fx.h, BIANCA, TODAY);
  const find = (pick: (s: Stop) => boolean) => { const found = b.stops.filter(pick); expect(found).toHaveLength(1); return found[0]!; };

  it("the three fixtures are \"to check\": needs-review today, needs-review after this week, the visit carried to today", () => {
    // Monthly: only the corrected occurrence needs review; the others stay upcoming.
    const today = find(s => s.kind === "commitment" && s.recurrenceId === fx.todayId && s.date === TODAY);
    const later = find(s => s.kind === "commitment" && s.recurrenceId === fx.laterId && s.date === "2026-10-10");
    const visit = find(s => s.kind === "commitment" && s.id.startsWith(`bill:item:${fx.appointmentId}@`) && s.status !== "upcoming");
    expect(today).toMatchObject({ status: "needs-review", relation: "today", date: TODAY });
    expect(later).toMatchObject({ status: "needs-review", relation: "future", date: "2026-10-10" });
    expect(visit).toMatchObject({ status: "overdue" });
    for (const s of [today, later, visit]) expect(b.toCheck, s.id).toContain(s.id);
  });

  it("chip, bubble, Week, Year, list \"Needs you\" and the checklist all agree", () => {
    const n = b.toCheck.length;
    expect(b.digest.toCheckIds).toEqual(b.toCheck);
    // Week: the pile plus the week's own to-check stops is every to-check stop, each once.
    const inWeek = b.week.days.flatMap(d => d.stopIds).filter(id => b.toCheck.includes(id));
    expect([...b.week.pileStopIds, ...inWeek].sort()).toEqual([...b.toCheck].sort());
    expect(new Set([...b.week.pileStopIds, ...inWeek]).size).toBe(n);
    // Year: the minis' counts sum to the chip.
    expect(b.year.reduce((sum, row) => sum + row.toCheck, 0)).toBe(n);
    // List: "Needs you" over the year lists exactly these; Week's list too.
    const year = listView(fx.h, b, { level: "year" });
    expect(year.groups[0]).toMatchObject({ kind: "needs-you", label: `Needs you · ${n}` });
    expect(year.groups[0]!.rows.map(r => r.id)).toEqual(b.toCheck);
    expect(year.strip!.needsYou).toBe(n);
    const week = listView(fx.h, b, { level: "week" });
    expect(week.groups[0]!.rows.map(r => r.id).sort()).toEqual([...b.toCheck].sort());
    // Nothing in the week's "This week" section repeats a to-check stop.
    for (const id of b.digest.weekStopIds) expect(b.toCheck).not.toContain(id);
  });

  it("EVERY summary.attention item lands in exactly one of toCheck / weekStopIds / waitingOnYou / chapter", () => {
    expect(summary.attention.length).toBeGreaterThan(b.toCheck.length - 1);
    const waiting = new Set(b.digest.waitingOnYou.map(item => item.id));
    const chapter = new Set(b.digest.chapter.map(item => item.id));
    for (const item of summary.attention) {
      const homes = [
        item.stopId !== null && b.toCheck.includes(item.stopId),
        item.stopId !== null && b.digest.weekStopIds.includes(item.stopId),
        waiting.has(item.id),
        chapter.has(item.id),
      ].filter(Boolean).length;
      expect(homes, item.words).toBe(1);
    }
    // And the lagging-chapter household (close due + readNeeds) partitions the same way.
    const lag = deriveJourneyBoardWithSummary(laggingChapterHousehold().household, BIANCA, TODAY);
    for (const item of lag.summary.attention) {
      const homes = [
        item.stopId !== null && lag.board.toCheck.includes(item.stopId),
        item.stopId !== null && lag.board.digest.weekStopIds.includes(item.stopId),
        lag.board.digest.waitingOnYou.some(w => w.id === item.id),
        lag.board.digest.chapter.some(c => c.id === item.id),
      ].filter(Boolean).length;
      expect(homes, item.words).toBe(1);
    }
  });

  it("the next leaving stop is never a to-check one", () => {
    if (b.digest.nextLeavingStopId) expect(b.toCheck).not.toContain(b.digest.nextLeavingStopId);
  });
});

describe("Horizon Clock model — transfers and kept chapters (trust minors 9, 12)", () => {
  it("a Fund move and a card paydown inside the week leave the strip's In and Out unchanged", () => {
    const before = listView(household, board, { level: "week" }).strip!;
    let h = postTransfer(household, { date: "2026-09-29", amount: 250, fromAccountId: "ACC-CHEQUING", toAccountId: "ACC-SAVINGS", note: "To the Fund account", createdBy: BIANCA, visibility: "household", confirmDuplicate: true }).household;
    h = postTransfer(h, { date: "2026-09-30", amount: 400, fromAccountId: "ACC-CHEQUING", toAccountId: "ACC-VISA", note: "Card paydown", createdBy: BIANCA, visibility: "household", confirmDuplicate: true }).household;
    expect(h.transactions.length).toBeGreaterThan(household.transactions.length);
    const after = listView(h, deriveJourneyBoard(h, JONATHAN, TODAY), { level: "week" }).strip!;
    expect(after.inBooksCents).toBe(before.inBooksCents);
    expect(after.outBooksCents).toBe(before.outBooksCents);
  });

  it("kept means a closed Chapter: a close proposed and waiting on the partner is not kept", () => {
    const lag = laggingChapterHousehold();
    const open = deriveJourneyBoard(lag.household, BIANCA, TODAY).year.find(r => r.chapterId === "2026-08")!;
    expect(open.kept).toBe(false);
    const proposed = proposeChapterClose(lag.household, BIANCA, lag.augustChapterId, "2026-09-27T12:00:00.000Z");
    const pendingBoard = deriveJourneyBoard(proposed, BIANCA, TODAY);
    const aug = pendingBoard.chapters.find(c => c.id === "2026-08")!;
    expect(aug.record.recordState).toBe("open");
    expect(pendingBoard.year.find(r => r.chapterId === "2026-08")!.kept).toBe(false);
    // The fixture household with a CLOSED August keeps it.
    const closed = deriveJourneyBoard(journeyDemoHousehold().household, BIANCA, TODAY).year.find(r => r.chapterId === "2026-08")!;
    expect(closed.kept).toBe(true);
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

  it("Codex P2: a month with only ordinary purchases and a refund keeps its In / Out in the Books (no map stops)", () => {
    // February has no stops on the map. A grocery purchase and a refund are Books actuals, never Journey stops.
    let h = household;
    h = postEntry(h, { date: "2026-02-10", type: "expense", amount: 64.2, accountId: "ACC-CHEQUING", subcategoryId: "SUB-FOOD-GROCERIES", note: "Groceries", confirmDuplicate: true }).household;
    const bought = postEntry(h, { date: "2026-02-14", type: "expense", amount: 30, accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", note: "Movie", confirmDuplicate: true });
    h = reversePostedMoney(bought.household, bought.postedIds[0]!, { reversalDate: "2026-02-20" }).household;
    const b = deriveJourneyBoard(h, JONATHAN, TODAY);
    expect(b.stops.filter(s => s.chapterId === "2026-02")).toEqual([]);
    const feb = listView(h, b, { level: "month", chapterId: "2026-02" });
    const summary = monthSummary(booksPresentationFloor(h, JONATHAN, "household"), "2026-02");
    expect(summary.expenseActualCents).not.toBe(0);
    // The strip stands with the Books' own figures; the map's honest "nothing on the map" note stays.
    expect(feb.strip).toMatchObject({ inBooksCents: summary.incomeActualCents, outBooksCents: summary.expenseActualCents, toFundCents: 0, stillToComeOutCents: 0, stillToComeInCents: 0, needsYou: 0 });
    expect(feb.groups).toEqual([]);
    expect(feb.emptyText).toBe(MAP_WORDS.emptyMonth);
  });
});
