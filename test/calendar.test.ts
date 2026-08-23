import { describe, expect, it } from "vitest";
import { addDays, dateKeyInZone, daysInMonthKey, formatDayLabel, isValidDateKey, todayKey, weekBounds, weekdaySunday0 } from "../src/core/calendar.ts";
import { advanceCadence, googleRrule } from "../src/core/recurrence.ts";

describe("Toronto calendar", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2024-02-29")).toBe(true);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(daysInMonthKey("2026-08")).toBe(31);
  });

  it("computes week bounds from the civil date, not local midnight", () => {
    // 2026-08-21 is a Friday. Sunday-start week is Aug 16–22.
    expect(weekdaySunday0("2026-08-21")).toBe(5);
    expect(weekBounds("2026-08-21")).toEqual({ start: "2026-08-16", end: "2026-08-22" });
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("formats a late-evening UTC instant as the Toronto calendar date", () => {
    const key = dateKeyInZone(new Date("2026-08-22T03:30:00Z"));
    expect(key).toBe("2026-08-21");
    expect(todayKey(new Date("2026-08-21T16:00:00Z"))).toBe("2026-08-21");
  });

  it("labels a civil day without using the runtime zone", () => {
    expect(formatDayLabel("2026-08-21")).toBe("Aug 21");
    expect(formatDayLabel("2026-08-23")).toBe("Aug 23");
  });
});

describe("cadence math", () => {
  it("advances weekly, biweekly, and monthly the same way posting does", () => {
    expect(advanceCadence("2026-08-21", "weekly")).toBe("2026-08-28");
    expect(advanceCadence("2026-08-21", "biweekly")).toBe("2026-09-04");
    expect(advanceCadence("2026-08-01", "monthly")).toBe("2026-09-01");
    expect(googleRrule("2026-08-21", "biweekly")).toBe("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR");
  });
});
