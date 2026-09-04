import { describe, expect, it } from "vitest";
import { createDemoRandom, seedStressHousehold, weekdaySunday0 } from "../src/core/index.ts";

const TODAY = "2026-08-29" as const;

function tipRate(shifts: ReturnType<typeof seedStressHousehold>["shifts"]): number {
  const hours = shifts.reduce((sum, row) => sum + row.hours, 0);
  return hours ? shifts.reduce((sum, row) => sum + row.netTipsCents, 0) / hours : 0;
}

describe("Demo Suite shift generation", () => {
  it("uses independent deterministic streams", () => {
    const shiftA = createDemoRandom(42, "shifts");
    const shiftB = createDemoRandom(42, "shifts");
    const appointments = createDemoRandom(42, "appointments-and-claims");
    const first = Array.from({ length: 8 }, () => shiftA());
    expect(Array.from({ length: 8 }, () => shiftB())).toEqual(first);
    expect(Array.from({ length: 8 }, () => appointments())).not.toEqual(first);
  });

  it("keeps useful but non-perfect covariate signal across a seed matrix", () => {
    const households = [17, 90210, 429496].map((seed) => seedStressHousehold({ today: TODAY, seed, environment: "development" }));
    const all = households.flatMap((row) => row.shifts);
    const weekend = all.filter((row) => [5, 6].includes(weekdaySunday0(row.date)));
    const midweek = all.filter((row) => [1, 2, 3].includes(weekdaySunday0(row.date)));
    const adverse = all.filter((row) => /raining|snowy/i.test(row.note ?? ""));
    const clearish = all.filter((row) => /sunny|humid|clear/i.test(row.note ?? ""));
    expect(tipRate(weekend)).toBeGreaterThan(tipRate(midweek));
    expect(tipRate(clearish)).toBeGreaterThan(tipRate(adverse));
    expect(new Set(households.map((row) => row.shifts.length)).size).toBeGreaterThan(1);
    expect(all.some((row) => weekdaySunday0(row.date) <= 3 && row.netTipsCents > tipRate(weekend) * row.hours)).toBe(true);
    expect(all.some((row) => [5, 6].includes(weekdaySunday0(row.date)) && row.netTipsCents < tipRate(midweek) * row.hours)).toBe(true);
  }, 180_000);
});
