import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ASK_ROUTES_HEADER_COPY,
  ROUTE_MAX_DAYS,
  ROUTE_MAX_SHIFTS,
  addDays,
  askRouteCopy,
  askRoutes,
  observeTipShifts,
  seedDemoHousehold,
  weekdayCadenceMap,
  type Household,
} from "../src/core/index.ts";

const JONATHAN = "MEM-002";
const TODAY = "2026-08-21";

function householdWithPostedShifts(count: number, netTipsCents?: number): Household {
  const household = seedDemoHousehold({ today: TODAY, environment: "development" });
  const observations = observeTipShifts(household, JONATHAN).slice(-count);
  const kept = new Set(observations.map((row) => row.shiftId));
  return {
    ...household,
    shifts: household.shifts
      .filter((shift) => shift.memberId !== JONATHAN || kept.has(shift.id))
      .map((shift) => kept.has(shift.id) && netTipsCents != null
        ? { ...shift, shiftBible: { ...shift.shiftBible!, netTipsCents } }
        : shift),
  };
}

function householdWithDailyCadence(): Household {
  const household = householdWithPostedShifts(14, 12_000);
  let index = 0;
  return {
    ...household,
    shifts: household.shifts.map((shift) => shift.memberId === JONATHAN
      ? { ...shift, date: addDays("2026-06-01", index++) }
      : shift),
  };
}

describe("Ask routes", () => {
  it("turns twelve posted shifts and a $340 Ask into the fewest-hour safe route", () => {
    const household = householdWithPostedShifts(12, 12_000);
    const before = structuredClone(household);
    const result = askRoutes(household, {
      askCents: 34_000,
      memberId: JONATHAN,
      from: "2026-08-22",
      to: "2026-09-20",
    });

    expect(observeTipShifts(household, JONATHAN)).toHaveLength(12);
    expect(result.kind).toBe("routes");
    if (result.kind !== "routes") throw new Error("Expected routes");
    expect(result.routes.length).toBeGreaterThan(0);
    expect(result.routes).toHaveLength(ROUTE_MAX_SHIFTS);
    expect(result.routes[0]!.clearsAtSafe).toBe(true);
    expect(result.routes[0]!.safeCents).toBeGreaterThanOrEqual(34_000);
    const clearing = result.routes.filter((route) => route.clearsAtSafe);
    expect(result.routes[0]!.hours).toBe(Math.min(...clearing.map((route) => route.hours)));
    expect(result.routes.some((route) => !route.clearsAtSafe && route.shortfallCents > 0)).toBe(true);
    expect(result.routes.every((route) => route.shifts.length <= ROUTE_MAX_SHIFTS)).toBe(true);
    expect(household).toEqual(before);
  });

  it("refuses with exact copy after only three posted shifts", () => {
    const result = askRoutes(householdWithPostedShifts(3), {
      askCents: 34_000,
      memberId: JONATHAN,
      from: "2026-08-22",
      to: "2026-09-20",
    });

    expect(result).toEqual({
      kind: "not-enough-data",
      askCents: 34_000,
      watchedShifts: 3,
      copy: "I've only watched 3 of your shifts. Ask me again in a few weeks — I'd be guessing.",
    });
  });

  it("uses only weekdays actually present in the member's posted cadence", () => {
    const household = householdWithPostedShifts(12);
    const cadenceWeekdays = new Set(weekdayCadenceMap(household, JONATHAN).keys());
    const result = askRoutes(household, {
      askCents: 34_000,
      memberId: JONATHAN,
      from: "2026-08-22",
      to: "2026-09-20",
    });

    expect(result.kind).toBe("routes");
    if (result.kind !== "routes") throw new Error("Expected routes");
    expect(result.routes.flatMap((route) => route.shifts).every((shift) => cadenceWeekdays.has(shift.weekday))).toBe(true);
    expect(cadenceWeekdays.has(1)).toBe(false);
    expect(result.routes.flatMap((route) => route.shifts).some((shift) => shift.weekday === 1)).toBe(false);
  });

  it("keeps exact status copy on the safe floor and expected cents as a whisker", () => {
    const clear = {
      shifts: [],
      hours: 0,
      safeCents: 36_000,
      expectedCents: 52_000,
      clearsAtSafe: true,
      shortfallCents: 0,
      ceiling: { kind: "none" as const },
    };
    const short = { ...clear, safeCents: 31_000, clearsAtSafe: false, shortfallCents: 3_000 };

    expect(ASK_ROUTES_HEADER_COPY).toBe("bars are your safe number · whiskers reach the good night");
    expect(askRouteCopy(clear, 34_000)).toBe("clears · $20.00 spare");
    expect(askRouteCopy(short, 34_000)).toBe("short $30.00");
  });

  it("returns no work route for a covered Ask and rejects unsafe inputs", () => {
    const household = householdWithPostedShifts(12);
    expect(askRoutes(household, {
      askCents: 0,
      memberId: JONATHAN,
      from: "2026-08-22",
      to: "2026-09-20",
    })).toEqual({ kind: "routes", askCents: 0, routes: [], watchedShifts: 12 });
    expect(() => askRoutes(household, {
      askCents: -1,
      memberId: JONATHAN,
      from: "2026-08-22",
      to: "2026-09-20",
    })).toThrow(/nonnegative safe integer/i);
    expect(() => askRoutes(household, {
      askCents: 1,
      memberId: JONATHAN,
      from: "2026-09-20",
      to: "2026-08-22",
    })).toThrow(/end date/i);
  });

  it("keeps the worst-case monthly daily-cadence search bounded", () => {
    const household = householdWithDailyCadence();
    expect(new Set(observeTipShifts(household, JONATHAN).map((row) => row.weekday))).toHaveLength(7);
    expect(ROUTE_MAX_DAYS).toBe(31);
    const started = performance.now();
    const result = askRoutes(household, {
      askCents: 34_000,
      memberId: JONATHAN,
      from: "2026-08-22",
      to: "2026-09-21",
    });

    expect(performance.now() - started).toBeLessThan(500);
    expect(result.kind).toBe("routes");
    if (result.kind !== "routes") throw new Error("Expected routes");
    expect(result.routes.length).toBeLessThanOrEqual(ROUTE_MAX_SHIFTS);
    expect(() => askRoutes(household, {
      askCents: 34_000,
      memberId: JONATHAN,
      from: "2026-08-22",
      to: "2026-09-22",
    })).toThrow(/cannot exceed 31 days/i);
  });

  it("contains no imperative work language, writer, or expected-cents headline", () => {
    const source = readFileSync(new URL("../src/core/askRoutes.ts", import.meta.url), "utf8");
    const copyStart = source.indexOf("export function askRouteCopy");
    const projectorStart = source.indexOf("export function askRoutes");
    const copySource = source.slice(copyStart, projectorStart);

    expect(source).not.toMatch(/you should work|pick up|need to work/i);
    expect(source).not.toMatch(/postEntry|confirmShift|proposeShift|calendar suggestion|\.pushCalendar/i);
    expect(copySource).not.toContain("expectedCents");
    expect(copySource).toContain("route.safeCents");
  });
});
