import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addRecurrence,
  catalogHousehold,
  dismissDuePreview,
  duePreviewDismissed,
  duePreviewSummary,
  dueRecurrencePreview,
} from "../src/core/index.ts";

const today = "2026-08-21";

describe("due recurrence preview on open", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });
  });

  it("lists active recurrences due on or before today", () => {
    let household = catalogHousehold();
    expect(dueRecurrencePreview(household, today)).toEqual([]);

    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: today,
      type: "expense",
      amount: 95,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-RENT",
      note: "Hydro",
    }).household;

    const rows = dueRecurrencePreview(household, today);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Hydro");
    expect(rows[0]?.summary).toMatch(/\$95\.00/);
    expect(duePreviewSummary(rows)).toMatch(/Hydro/);
    expect(duePreviewSummary(rows)).toMatch(/Confirm still posts/);
  });

  it("dismisses the kettle whistle for the rest of the Toronto day", () => {
    dismissDuePreview("development", today);
    expect(duePreviewDismissed("development", today)).toBe(true);
    expect(duePreviewDismissed("production", today)).toBe(false);
  });
});
