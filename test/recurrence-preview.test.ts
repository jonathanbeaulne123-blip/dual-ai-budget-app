// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  addRecurrence,
  catalogHousehold,
  dismissDuePreview,
  duePreviewDismissed,
  duePreviewSummary,
  dueRecurrencePreview,
} from "../src/core/index.ts";

const today = "2026-08-24";

function addExpense(household: ReturnType<typeof catalogHousehold>, nextDate: string, note: string, amount: string) {
  return addRecurrence(household, {
    cadence: "monthly",
    nextDate,
    type: "expense",
    amount,
    accountId: "ACC-CHEQUING",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note,
  }).household;
}

describe("due-on-open recurrence preview", () => {
  beforeEach(() => localStorage.clear());

  it("projects only active due rows in deterministic date order without writing money", () => {
    let household = catalogHousehold();
    household = addExpense(household, today, "Hydro", "40.25");
    household = addExpense(household, "2026-08-20", "", "12.00");
    household = addExpense(household, "2026-08-25", "Future", "9.00");
    household = addExpense(household, "2026-08-19", "Paused", "8.00");
    household.recurrences.at(-1)!.active = false;

    const before = JSON.stringify(household);
    const rows = dueRecurrencePreview(household, today);

    expect(rows.map((row) => row.title)).toEqual(["Groceries", "Hydro"]);
    expect(rows.map((row) => row.nextDate)).toEqual(["2026-08-20", today]);
    expect(rows.map((row) => row.summary)).toEqual(["Groceries · $12.00", "Hydro · $40.25"]);
    expect(household.transactions).toHaveLength(0);
    expect(JSON.stringify(household)).toBe(before);
  });

  it("describes reminders as non-writes and handles an empty projection", () => {
    let household = catalogHousehold();
    household = addExpense(household, today, "Internet", "75");
    const rows = dueRecurrencePreview(household, today);

    expect(duePreviewSummary(rows)).toBe("Internet · $75.00 is due. This reminder is not a ledger write.");
    expect(duePreviewSummary([])).toBe("");
  });

  it("dismisses only the selected environment, household, and Toronto day", () => {
    dismissDuePreview("development", "HH-ONE", today);

    expect(duePreviewDismissed("development", "HH-ONE", today)).toBe(true);
    expect(duePreviewDismissed("development", "HH-TWO", today)).toBe(false);
    expect(duePreviewDismissed("production", "HH-ONE", today)).toBe(false);
    expect(duePreviewDismissed("development", "HH-ONE", "2026-08-25")).toBe(false);
  });
});
