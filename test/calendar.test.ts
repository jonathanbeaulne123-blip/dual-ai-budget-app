import { describe, expect, it } from "vitest";
import { addDays, dateKeyInZone, daysInMonthKey, formatDayLabel, isValidDateKey, lastWeekBounds, monthEndKey, monthStartKey, parseMonthKey, todayKey, weekBounds, weekdaySunday0 } from "../src/core/calendar.ts";
import {
  advanceCadence,
  googleRrule,
  inferRecurrenceKind,
  mergeCalendars,
  nextOnOrAfter,
  normalizeRecurrenceCadence,
  projectCadence,
  shapeCalendar,
  shapeRecurrence,
} from "../src/core/recurrence.ts";
import type { Recurrence } from "../src/core/types.ts";

function recurrence(overrides: Partial<Recurrence> = {}): Recurrence {
  return {
    id: "REC-1",
    cadence: "monthly",
    nextDate: "2026-09-01",
    type: "expense",
    amountCents: 5000,
    accountId: "ACC-VISA",
    transferToAccountId: null,
    goalId: null,
    subcategoryId: "SUB-HOUSING-ELECTRIC",
    note: "Hydro",
    splits: [{ party: "joint", amountCents: 5000 }],
    active: true,
    autoPost: false,
    kind: "bill",
    origin: "manual",
    reminderHoursBefore: 24,
    googleSync: {},
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Toronto calendar", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2024-02-29")).toBe(true);
    expect(isValidDateKey("2000-02-29")).toBe(true);
    expect(isValidDateKey("1900-02-29")).toBe(false);
    expect(isValidDateKey("2100-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(daysInMonthKey("2026-08")).toBe(31);
    expect(monthStartKey("2026-08")).toBe("2026-08-01");
    expect(monthEndKey("2026-08")).toBe("2026-08-31");
    expect(monthEndKey("2024-02")).toBe("2024-02-29");
    expect(monthEndKey("2026-02")).toBe("2026-02-28");
    expect(() => parseMonthKey("2026-13")).toThrow(/YYYY-MM/);
    expect(() => parseMonthKey("2026-00")).toThrow(/YYYY-MM/);
    expect(() => parseMonthKey("26-08")).toThrow(/YYYY-MM/);
  });

  it("computes week bounds from the civil date, not local midnight", () => {
    // 2026-08-21 is a Friday. Sunday-start week is Aug 16–22.
    expect(weekdaySunday0("2026-08-21")).toBe(5);
    expect(weekBounds("2026-08-21")).toEqual({ start: "2026-08-16", end: "2026-08-22" });
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("returns the prior Sunday-start week for weekly-document windows", () => {
    // Friday in Aug 16–22 → previous week Aug 9–15. Sunday itself is still this week.
    expect(lastWeekBounds("2026-08-21")).toEqual({ start: "2026-08-09", end: "2026-08-15" });
    expect(lastWeekBounds("2026-08-16")).toEqual({ start: "2026-08-09", end: "2026-08-15" });
    expect(lastWeekBounds("2026-08-23")).toEqual({ start: "2026-08-16", end: "2026-08-22" });
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
  it("advances weekly, biweekly, monthly, and daily the same way posting does", () => {
    expect(advanceCadence("2026-08-21", "weekly")).toBe("2026-08-28");
    expect(advanceCadence("2026-08-21", "biweekly")).toBe("2026-09-04");
    expect(advanceCadence("2026-08-01", "monthly")).toBe("2026-09-01");
    expect(advanceCadence("2026-08-21", "daily")).toBe("2026-08-22");
    expect(googleRrule("2026-08-21", "weekly")).toBe("RRULE:FREQ=WEEKLY;BYDAY=FR");
    expect(googleRrule("2026-08-21", "biweekly")).toBe("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR");
    expect(googleRrule("2026-08-21", "daily")).toBe("RRULE:FREQ=DAILY");
    expect(googleRrule("2026-09-01", "monthly")).toBe("RRULE:FREQ=MONTHLY;BYMONTHDAY=1");
  });

  it("keeps the existing month-end overflow: Jan 31 becomes a March date", () => {
    // Same Date.UTC(year, month, day) the poster uses. February is too short, so the day spills.
    expect(advanceCadence("2026-01-31", "monthly")).toBe("2026-03-03");
    expect(advanceCadence("2024-01-31", "monthly")).toBe("2024-03-02");
    expect(advanceCadence("2026-08-31", "monthly")).toBe("2026-10-01");
  });

  it("treats unknown cadence text as monthly so a restore cannot invent a new interval", () => {
    expect(normalizeRecurrenceCadence("weekly")).toBe("weekly");
    expect(normalizeRecurrenceCadence("biweekly")).toBe("biweekly");
    expect(normalizeRecurrenceCadence("daily")).toBe("daily");
    expect(normalizeRecurrenceCadence("monthly")).toBe("monthly");
    expect(normalizeRecurrenceCadence("yearly")).toBe("monthly");
    expect(normalizeRecurrenceCadence("WEEKLY")).toBe("monthly");
    expect(normalizeRecurrenceCadence(null)).toBe("monthly");
  });

  it("infers paycheck, subscription, transfer, and bill kinds from the note and type", () => {
    expect(inferRecurrenceKind({ type: "income", note: "Work" })).toBe("paycheck");
    expect(inferRecurrenceKind({ type: "transfer", note: "Rent" })).toBe("other");
    expect(inferRecurrenceKind({ type: "expense", note: "Netflix" })).toBe("subscription");
    expect(inferRecurrenceKind({ type: "expense", note: "Gym", subcategoryName: "Membership" })).toBe("subscription");
    expect(inferRecurrenceKind({ type: "expense", note: "Hydro" })).toBe("bill");
    expect(inferRecurrenceKind({ type: "expense", note: "Groceries" })).toBe("bill");
  });
});

describe("cadence projection", () => {
  it("returns the start date when it is already on or after today", () => {
    expect(nextOnOrAfter("2026-08-21", "weekly", "2026-08-21")).toBe("2026-08-21");
    expect(nextOnOrAfter("2026-08-28", "weekly", "2026-08-21")).toBe("2026-08-28");
  });

  it("catches a stale next-date up to today without posting", () => {
    expect(nextOnOrAfter("2026-08-21", "weekly", "2026-08-22")).toBe("2026-08-28");
    expect(nextOnOrAfter("2026-08-01", "monthly", "2026-10-15")).toBe("2026-11-01");
    expect(nextOnOrAfter("2026-01-31", "monthly", "2026-03-01")).toBe("2026-03-03");
  });

  it("stops after 48 advances, even when the result is still before today", () => {
    // 48 monthly steps from 2020-01-01 land on 2024-01-01, two years short of 2026.
    expect(nextOnOrAfter("2020-01-01", "monthly", "2026-01-01")).toBe("2024-01-01");
    expect(nextOnOrAfter("2026-01-01", "daily", "2026-04-01")).toBe("2026-02-18");
  });

  it("projects occurrences inside a closed window, inclusive of both ends", () => {
    expect(projectCadence("2026-08-01", "weekly", "2026-08-01", "2026-08-31")).toEqual([
      "2026-08-01",
      "2026-08-08",
      "2026-08-15",
      "2026-08-22",
      "2026-08-29",
    ]);
    expect(projectCadence("2026-08-21", "weekly", "2026-09-01", "2026-09-30")).toEqual([
      "2026-09-04",
      "2026-09-11",
      "2026-09-18",
      "2026-09-25",
    ]);
    expect(projectCadence("2026-09-01", "monthly", "2026-08-01", "2026-08-31")).toEqual([]);
    expect(projectCadence("2026-01-31", "monthly", "2026-02-01", "2026-04-30")).toEqual([
      "2026-03-03",
      "2026-04-03",
    ]);
  });

  it("caps a dense window at 24 dates so a daily bill cannot flood the board", () => {
    const dates = projectCadence("2026-08-01", "daily", "2026-08-01", "2026-09-30");
    expect(dates).toHaveLength(24);
    expect(dates[0]).toBe("2026-08-01");
    expect(dates.at(-1)).toBe("2026-08-24");
  });
});

describe("recurrence restore shape", () => {
  it("fills posting defaults and keeps a valid payment history", () => {
    const payment = {
      occurrenceDate: "2026-08-01",
      paymentDate: "2026-08-03",
      amountCents: 4700,
      accountId: "ACC-VISA",
      transactionId: "TXN-1",
      recordedBy: "MEM-001",
    };
    const shaped = shapeRecurrence(
      {
        ...recurrence({ type: "expense", payments: [payment], transferToAccountId: "", goalId: "", createdAt: "" }),
        cadence: "yearly",
        kind: undefined,
        origin: undefined,
        autoPost: undefined,
        active: undefined,
      } as unknown as Recurrence,
      "2026-08-01T12:00:00.000Z",
    );
    expect(shaped.cadence).toBe("monthly");
    expect(shaped.kind).toBe("bill");
    expect(shaped.origin).toBe("manual");
    expect(shaped.autoPost).toBe(false);
    expect(shaped.active).toBe(true);
    expect(shaped.transferToAccountId).toBeNull();
    expect(shaped.goalId).toBeNull();
    expect(shaped.createdAt).toBe("2026-08-01T12:00:00.000Z");
    expect(shaped.payments).toEqual([payment]);
  });

  it("refuses duplicate, zero, or non-integer payment evidence", () => {
    const valid = {
      occurrenceDate: "2026-08-01",
      paymentDate: "2026-08-03",
      amountCents: 4700,
      accountId: "ACC-VISA",
      transactionId: "TXN-1",
      recordedBy: "MEM-001",
    };
    expect(() => shapeRecurrence(recurrence({ payments: { ...valid } as never }), "2026-08-01T00:00:00.000Z")).toThrow(
      "Invalid bill payment history.",
    );
    expect(() => shapeRecurrence(recurrence({ payments: [{ ...valid, amountCents: 0 }] }), "2026-08-01T00:00:00.000Z")).toThrow(
      "Invalid bill payment history.",
    );
    expect(() => shapeRecurrence(recurrence({ payments: [{ ...valid, amountCents: 12.5 }] }), "2026-08-01T00:00:00.000Z")).toThrow(
      "Invalid bill payment history.",
    );
    expect(() => shapeRecurrence(recurrence({ payments: [{ ...valid, occurrenceDate: "2026-08-32" }] }), "2026-08-01T00:00:00.000Z")).toThrow(
      "Invalid bill payment history.",
    );
    expect(() => shapeRecurrence(recurrence({
      payments: [valid, { ...valid, transactionId: "TXN-2" }],
    }), "2026-08-01T00:00:00.000Z")).toThrow("Invalid bill payment history.");
    expect(() => shapeRecurrence(recurrence({ payments: [{ ...valid, accountId: "" }] }), "2026-08-01T00:00:00.000Z")).toThrow(
      "Invalid bill payment history.",
    );
  });

  it("keeps a valid Household Fund default and drops a malformed one instead of inventing funding", () => {
    expect(shapeRecurrence(recurrence({
      fundingDefault: { fundId: "FUND-HH", fundedCents: "full", destinationAccountId: "ACC-VISA" },
    }), "2026-08-01T00:00:00.000Z").fundingDefault).toEqual({
      fundId: "FUND-HH",
      fundedCents: "full",
      destinationAccountId: "ACC-VISA",
    });
    expect(shapeRecurrence(recurrence({
      fundingDefault: { fundId: "FUND-HH", fundedCents: 2500, destinationAccountId: "ACC-VISA", extra: true } as never,
    }), "2026-08-01T00:00:00.000Z").fundingDefault).toEqual({
      fundId: "FUND-HH",
      fundedCents: 2500,
      destinationAccountId: "ACC-VISA",
    });
    expect(shapeRecurrence(recurrence({
      fundingDefault: { fundId: "FUND-HH", fundedCents: 0, destinationAccountId: "ACC-VISA" } as never,
    }), "2026-08-01T00:00:00.000Z").fundingDefault).toBeNull();
    expect(shapeRecurrence(recurrence({
      fundingDefault: { fundId: "FUND-HH", fundedCents: 12.5, destinationAccountId: "ACC-VISA" } as never,
    }), "2026-08-01T00:00:00.000Z").fundingDefault).toBeNull();
    expect(shapeRecurrence(recurrence({
      fundingDefault: { fundId: "FUND-HH", fundedCents: "full" } as never,
    }), "2026-08-01T00:00:00.000Z").fundingDefault).toBeNull();
    expect(shapeRecurrence(recurrence({ fundingDefault: null }), "2026-08-01T00:00:00.000Z").fundingDefault).toBeNull();
  });

  it("preserves income and transfer types and treats any other stored type as an expense", () => {
    expect(shapeRecurrence(recurrence({ type: "income", note: "Pay" }), "2026-08-01T00:00:00.000Z").type).toBe("income");
    expect(shapeRecurrence(recurrence({ type: "transfer" }), "2026-08-01T00:00:00.000Z").type).toBe("transfer");
    expect(shapeRecurrence(recurrence({ type: "refund" as never }), "2026-08-01T00:00:00.000Z").type).toBe("expense");
  });

  it("unions dismissed calendar keys without duplicates", () => {
    expect(shapeCalendar({
      dismissedRhythmKeys: ["b", "a", "a"],
      dismissedNoticeKeys: ["z", "z"],
    })).toEqual({
      dismissedRhythmKeys: ["a", "b"],
      dismissedNoticeKeys: ["z"],
    });
  });

  it("unions two devices' dismissed calendar keys so a sync cannot drop a hide", () => {
    expect(mergeCalendars(undefined, undefined)).toEqual({
      dismissedRhythmKeys: [],
      dismissedNoticeKeys: [],
    });
    expect(mergeCalendars(
      { dismissedRhythmKeys: ["b", "a"], dismissedNoticeKeys: ["n1"] },
      { dismissedRhythmKeys: ["a", "c"], dismissedNoticeKeys: ["n2", "n1"] },
    )).toEqual({
      dismissedRhythmKeys: ["a", "b", "c"],
      dismissedNoticeKeys: ["n1", "n2"],
    });
    expect(mergeCalendars(
      { dismissedRhythmKeys: ["only-left"], dismissedNoticeKeys: [] },
      undefined,
    )).toEqual({
      dismissedRhythmKeys: ["only-left"],
      dismissedNoticeKeys: [],
    });
  });
});
