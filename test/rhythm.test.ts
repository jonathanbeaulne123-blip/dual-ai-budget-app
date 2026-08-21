import { describe, expect, it } from "vitest";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { catalogHousehold } from "../src/core/seed.ts";
import { addRecurrence, adoptRhythm, dismissRhythm, postEntry, postOneRecurrence, skipOccurrence } from "../src/core/commands.ts";
import { detectRhythms } from "../src/core/rhythm.ts";
import { buildMonthBoard } from "../src/core/board.ts";
import { weekdaySunday0 } from "../src/core/calendar.ts";
import { ensureHouseholdShape } from "../src/core/sync.ts";
import { jointSplit } from "../src/core/splits.ts";
import type { Recurrence } from "../src/core/types.ts";

const TODAY = "2026-08-21";

describe("ledger rhythm detection", () => {
  it("spots hydro, phones, and Spotify on the demo kitchen without treating groceries as a bill", () => {
    const household = seedDemoHousehold({ today: TODAY });
    const snapshot = household.transactions.length;
    const rhythms = detectRhythms(household, TODAY);
    const names = rhythms.filter((item) => item.status === "suggested").map((item) => item.note.toLowerCase());
    expect(names.some((name) => name.includes("hydro"))).toBe(true);
    expect(names.some((name) => name.includes("phone"))).toBe(true);
    expect(names.some((name) => name.includes("spotify"))).toBe(true);
    expect(names.some((name) => name.includes("frills") || name.includes("grocery") || name.includes("coffee"))).toBe(false);
    expect(household.transactions).toHaveLength(snapshot);
  });

  it("marks rent as already tracked and Spotify as a subscription", () => {
    const household = seedDemoHousehold({ today: TODAY });
    const rhythms = detectRhythms(household, TODAY);
    const rent = rhythms.find((item) => item.note.toLowerCase() === "rent");
    const spotify = rhythms.find((item) => item.note.toLowerCase() === "spotify");
    const phones = rhythms.find((item) => item.note.toLowerCase().includes("phone"));
    expect(rent?.status).toBe("tracked");
    expect(spotify?.kind).toBe("subscription");
    expect(spotify?.cadence).toBe("monthly");
    expect(phones?.kind).toBe("subscription");
    expect(phones?.amountCents).toBe(9500);
  });

  it("adopts a detected bill through addRecurrence and does not post money", () => {
    const household = seedDemoHousehold({ today: TODAY });
    const before = household.transactions.length;
    const phones = detectRhythms(household, TODAY).find((item) => item.note.toLowerCase().includes("phone") && item.status === "suggested");
    expect(phones).toBeTruthy();
    const adopted = adoptRhythm(household, phones!.key, TODAY);
    expect(adopted.household.transactions).toHaveLength(before);
    expect(adopted.household.recurrences.some((item) => item.note.toLowerCase().includes("phone") && item.origin === "detected")).toBe(true);
    const again = detectRhythms(adopted.household, TODAY).find((item) => item.key === phones!.key);
    expect(again?.status).toBe("tracked");
  });

  it("hides a dismissed rhythm until it is adopted", () => {
    const household = seedDemoHousehold({ today: TODAY });
    const hydro = detectRhythms(household, TODAY).find((item) => item.note.toLowerCase() === "hydro");
    expect(hydro?.status).toBe("suggested");
    const hidden = dismissRhythm(household, hydro!.key);
    expect(detectRhythms(hidden.household, TODAY).find((item) => item.key === hydro!.key)?.status).toBe("dismissed");
  });

  it("skips an occurrence without posting, and mark-paid uses postEntry", () => {
    const household = seedDemoHousehold({ today: TODAY });
    const due = household.recurrences.find((item) => item.active && item.nextDate <= TODAY);
    expect(due).toBeTruthy();
    const skipped = skipOccurrence(household, due!.id);
    expect(skipped.household.transactions).toHaveLength(household.transactions.length);
    expect(skipped.household.recurrences.find((item) => item.id === due!.id)?.nextDate).not.toBe(due!.nextDate);

    const posted = postOneRecurrence(household, due!.id, TODAY);
    expect(posted.household.transactions.length).toBe(household.transactions.length + 1);
    const row = posted.household.transactions.find((tx) => tx.id === posted.postedIds[0]);
    expect(row?.source).toBe("recurring");
    expect(row?.sourceId).toBe(due!.id);
    expect(row?.amountCents).toBe(due!.amountCents);
  });

  it("refuses to post a future recurrence", () => {
    const household = addRecurrence(catalogHousehold(), {
      cadence: "monthly",
      nextDate: "2026-09-01",
      type: "expense",
      amount: 10,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-HOUSING-RENT",
      note: "Future rent",
    }).household;
    expect(() => postOneRecurrence(household, household.recurrences[0]!.id, TODAY)).toThrow(/not due yet/);
    expect(household.transactions).toHaveLength(0);
  });

  it("does not invent a rhythm from two coffee purchases", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: "2026-07-08",
      type: "expense",
      amount: 6.5,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Coffee",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: "2026-08-08",
      type: "expense",
      amount: 7.25,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Coffee",
      confirmDuplicate: true,
    }).household;
    expect(detectRhythms(household, TODAY).filter((item) => item.subcategoryId === "SUB-FOOD-COFFEE")).toEqual([]);
  });
});

describe("month board", () => {
  it("starts August 2026 weeks on Sunday and paints due pay", () => {
    const household = seedDemoHousehold({ today: TODAY });
    const board = buildMonthBoard(household, "2026-08", TODAY);
    expect(weekdaySunday0(board.days[0]!.date)).toBe(0);
    expect(board.days.find((day) => day.date === "2026-08-01")?.inMonth).toBe(true);
    expect(board.dueCount).toBeGreaterThan(0);
    expect(board.upcoming.length).toBeGreaterThan(0);
    expect(board.rhythms.some((item) => item.status === "suggested")).toBe(true);
  });
});

describe("old snapshots", () => {
  it("fills calendar and recurrence fields on load", () => {
    const household = catalogHousehold();
    const legacy = {
      id: "REC-OLD",
      cadence: "monthly" as const,
      nextDate: "2026-09-01",
      type: "expense" as const,
      amountCents: 185000,
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-HOUSING-RENT",
      note: "Rent",
      splits: jointSplit(185000),
      active: true,
      autoPost: false,
    };
    household.recurrences.push(legacy as Recurrence);
    const shaped = ensureHouseholdShape(household);
    expect(shaped.calendar.dismissedRhythmKeys).toEqual([]);
    expect(shaped.recurrences[0]?.kind).toBe("bill");
    expect(shaped.recurrences[0]?.googleSync).toEqual({});
    expect(shaped.recurrences[0]?.reminderHoursBefore).toBe(24);
  });
});
