import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/calendar.ts";
import { monthForecast } from "../src/core/timeMachine.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";
import type { Household } from "../src/core/types.ts";
import { readRail } from "../src/harbour/desk/leavingModel.ts";
import { dayName, longDay } from "../src/harbour/glass/copy.ts";
import { dayLedger, dayMarkers, leavingNext, readChapterGate, readCoveredTo, stripLedger, stripRange } from "../src/harbour/glass/dayLedger.ts";

/**
 * The day ledger (Tool Atlas §3.5, §4.1; CONTRACT rule 19): one pure read of
 * each civil day, built only from the Calendar's own pipeline, the Fund's
 * pay ticks, the Charter, the open Chapter and the Fund horizon. Fictional
 * demo data only (`seedDemoHousehold`).
 */
const today = "2026-09-25";
const household = seedDemoHousehold({ today });
const memberId = household.members[0]!.id;
const ours = stripLedger({ household, memberId, space: "ours", today });
const day = (date: string) => ours.days.find(row => row.date === date)!;

describe("stripLedger — the band's range", () => {
  it("covers the whole month and runs on through the next seven days", () => {
    expect(stripRange("2026-09", today)).toEqual({ from: "2026-09-01", to: "2026-10-01" });
    expect(stripRange("2026-09", "2026-09-10")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(stripRange("2026-08", today)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(ours.monthKey).toBe("2026-09");
    expect(ours.days.map(row => row.date)[0]).toBe("2026-09-01");
    expect(ours.days.at(-1)!.date).toBe("2026-10-01");
    expect(ours.weekFrom).toBe(today);
    expect(ours.weekTo).toBe("2026-10-01");
    expect(ours.days.filter(row => row.inWeek).map(row => row.date)).toEqual([0, 1, 2, 3, 4, 5, 6].map(n => addDays(today, n)));
  });

  it("marks past, today and future, the week's flagstones and the month's station", () => {
    expect(day("2026-09-24").relation).toBe("past");
    expect(day(today).relation).toBe("today");
    expect(day("2026-09-26").relation).toBe("future");
    expect(ours.days.filter(row => row.flagstone).map(row => row.date)).toEqual(["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"]);
    expect(ours.days.filter(row => row.station).map(row => row.date)).toEqual(["2026-09-30"]);
  });
});

describe("dayLedger — what each day holds", () => {
  it("draws the Calendar's own posted entries as coins, and the Desk's rail agrees coin for coin", () => {
    const rail = readRail(household, memberId, "household", today)!;
    for (const railDay of rail.days) {
      const posted = railDay.items.filter(item => item.kind.startsWith("posted")).map(item => item.id.replace(/^posted:/, ""));
      expect(day(railDay.date).coins.map(coin => coin.id), railDay.date).toEqual([...new Set(posted)]);
    }
    expect(day(today).coins.length).toBeGreaterThan(0);
    for (const coin of ours.days.flatMap(row => row.coins)) expect(coin.amountCents).toBeGreaterThanOrEqual(0);
  });

  it("stands each unpaid bill on its day as a slip — name, amount, pot and recurrence — and flags the ones gone past", () => {
    const phone = day(today).slips.find(slip => slip.name === "Phone")!;
    expect(phone).toMatchObject({ name: "Phone", amountCents: 11_000, overdue: false });
    expect(phone.recurrenceId).toMatch(/^REC-/);
    const vet = day("2026-09-26").slips.find(slip => slip.name === "Vet · Marmalade")!;
    expect(vet.amountCents).toBe(21_500);
    for (const slip of ours.days.flatMap(row => row.slips)) expect(["prepare", "build", null]).toContain(slip.pot);
    const past = ours.days.filter(row => row.relation === "past").flatMap(row => row.slips);
    expect(past.length).toBeGreaterThan(0);
    expect(past.every(slip => slip.overdue)).toBe(true);
    expect(ours.days.filter(row => row.relation !== "past").flatMap(row => row.slips).some(slip => slip.overdue)).toBe(false);
  });

  it("flies a pennant on payday, never twice for the same day", () => {
    expect(day(today).pennants.map(pennant => pennant.name)).toEqual(["Bianca pay"]);
    expect(day(today).pennants[0]!.amountCents).toBe(210_000);
    for (const row of ours.days) expect(new Set(row.pennants.map(pennant => pennant.id)).size).toBe(row.pennants.length);
  });

  it("sets two chairs on the Charter's weekly Sitdown, in Ours only", () => {
    expect(household.charter?.cadence).toBe("weekly");
    expect(ours.sitdownWeekday).toBe(household.charter!.cadenceWeekday);
    expect(day("2026-09-27").sitdown).toBe(true);
    expect(ours.days.filter(row => row.sitdown).every(row => row.weekday === household.charter!.cadenceWeekday)).toBe(true);
    const mine = stripLedger({ household, memberId, space: "mine", today });
    expect(mine.days.some(row => row.sitdown)).toBe(false);
    expect(mine.sitdownWeekday).toBeNull();
    expect(mine.chapterClose).toBeNull();
    expect(mine.coveredTo).toBeNull();
  });

  it("puts the Chapter's station gate on the Chapter month's last day: due, overdue, or waiting on this reader", () => {
    const chapter = (month: string, extra: object = {}) => ({ version: 1, id: "CH-1", foundationId: null, title: "See our shared life", meaning: "m", betterFeelsLike: "b", lessonId: "l", openedAt: `${month}-02T12:00:00Z`, openedByMemberId: memberId, openedAtSitdownId: null, closedAt: null, closedAtSitdownId: null, state: "open", carryForward: "", intendedMonth: month, updatedAt: `${month}-02T12:00:00Z`, ...extra });
    const withChapter = (month: string) => ({ ...household, chapters: [chapter(month)] }) as unknown as Household;
    expect(readChapterGate(household, memberId, today)).toBeNull();
    expect(readChapterGate(withChapter("2026-09"), memberId, today)).toEqual({ monthKey: "2026-09", date: "2026-09-30", state: "due" });
    expect(readChapterGate(withChapter("2026-08"), memberId, today)).toEqual({ monthKey: "2026-08", date: "2026-08-31", state: "overdue" });
    const gated = stripLedger({ household: withChapter("2026-09"), memberId, space: "ours", today });
    expect(gated.days.filter(row => row.gate).map(row => row.date)).toEqual(["2026-09-30"]);
    expect(dayMarkers(gated.days.find(row => row.date === "2026-09-30")!)).toContain("gate");
  });

  it("reads Covered to only off the Fund horizon, and says nothing when the horizon refuses", () => {
    const forecast = monthForecast(household, today, 1);
    const covered = readCoveredTo(household, today);
    if (forecast.kind === "forecast" && forecast.coveredThrough) expect(covered?.date).toBe(forecast.coveredThrough);
    else expect(covered).toBeNull();
    expect(ours.coveredTo).toEqual(covered);
    expect(readCoveredTo({ ...household, householdFund: null } as unknown as Household, today)).toBeNull();
  });

  it("knows nothing for a member the ledger does not know, and never throws", () => {
    const stranger = dayLedger({ household, memberId: "not-a-member", space: "ours", today, from: "2026-09-01", to: "2026-09-30" });
    expect(stranger.days).toHaveLength(30);
    expect(stranger.days.every(row => !row.coins.length && !row.slips.length && !row.pennants.length && !row.sitdown && !row.gate)).toBe(true);
    expect(stranger.coveredTo).toBeNull();
  });

  it("is pure: the same inputs give the same ledger, and the household is not touched", () => {
    const before = JSON.stringify(household);
    const again = stripLedger({ household, memberId, space: "ours", today });
    expect(again).toEqual(ours);
    expect(JSON.stringify(household)).toBe(before);
    // A range given backwards is read forwards; a range is capped.
    const backwards = dayLedger({ household, memberId, space: "ours", today, from: "2026-09-30", to: "2026-09-01" });
    expect(backwards.days[0]!.date).toBe("2026-09-01");
    expect(dayLedger({ household, memberId, space: "ours", today, from: "2026-01-01", to: "2026-12-31" }).days.length).toBeLessThanOrEqual(93);
  });
});

describe("leavingNext and the day's words", () => {
  it("reads Leaving next off the same slips the strip draws, with the rest of the week counted", () => {
    const next = leavingNext(ours)!;
    const ahead = ours.days.filter(row => row.date >= today).flatMap(row => row.slips.map(slip => ({ slip, date: row.date })));
    expect(next.slip).toBe(ahead[0]!.slip);
    expect(next.date).toBe(today);
    expect(next.slip.name).toBe("Phone");
    expect(next.moreThisWeek).toBe(ahead.slice(1).filter(row => row.date <= ours.weekTo).length);
    expect(next.moreThisWeek).toBeGreaterThanOrEqual(1);
    expect(leavingNext({ ...ours, days: ours.days.map(row => ({ ...row, slips: [] })) })).toBeNull();
  });

  it("names each stone by its date and every marker in words (A25)", () => {
    expect(longDay("2026-09-27")).toBe("Sunday 27 September");
    expect(dayName(day("2026-09-26"))).toBe("Saturday 26 September: Vet · Marmalade bill, $215.00, leaving");
    const todayName = dayName(day(today));
    expect(todayName).toMatch(/^Today, Friday 25 September: /);
    expect(todayName).toContain("Phone bill, $110.00, leaving");
    expect(todayName).toContain("Bianca pay, $2100.00, payday");
    expect(todayName).toMatch(/\d+ posted entr(y|ies)$/);
    expect(dayName(day("2026-09-27"))).toMatch(/^Sunday 27 September: the weekly Sitdown/);
    expect(dayName(day("2026-09-29"))).toBe("Tuesday 29 September: nothing dated");
  });
});

describe("the day ledger's fence", () => {
  const glass = join(process.cwd(), "src", "harbour", "glass");
  const files = readdirSync(glass).filter(name => /\.(ts|tsx)$/.test(name));
  const importsOf = (source: string) => [...source.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)].map(m => m[1]!);

  it("dayLedger.ts imports nothing from src/core/commands.ts, and no glass file does (A12)", () => {
    expect(importsOf(readFileSync(join(glass, "dayLedger.ts"), "utf8")).filter(s => /commands(\.ts)?$/.test(s))).toEqual([]);
    const offences = files.flatMap(name => importsOf(readFileSync(join(glass, name), "utf8")).filter(s => /\/core\/commands(\.ts)?$|\/core\/index(\.ts)?$|kitchenCommand|\/ledger\/|supabase|\/App(\.tsx)?$/.test(s)).map(s => `${name} → ${s}`));
    expect(offences).toEqual([]);
  });

  it("touches no storage, no network and no environment flag", () => {
    const offences = files.filter(name => /localStorage|sessionStorage|indexedDB|\bfetch\(|import\.meta\.env/.test(readFileSync(join(glass, name), "utf8")));
    expect(offences).toEqual([]);
  });
});
