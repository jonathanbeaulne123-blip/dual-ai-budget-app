import { describe, expect, it } from "vitest";
import { addRecurrence, askBooks, catalogHousehold, postEntry, seedDemoHousehold } from "../src/core/index.ts";
import { booksIdbName } from "../src/ledger/engine.ts";

describe("ask the books", () => {
  it("answers groceries, balance, and due bills without requiring SQL", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "42.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "No Frills",
      confirmDuplicate: true,
    }).household;
    household = addRecurrence(household, {
      cadence: "monthly",
      nextDate: "2026-08-21",
      type: "expense",
      amount: "90",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Hydro",
    }).household;

    const groceries = askBooks(household, "how much did we spend on groceries this month?", "2026-08-21");
    expect(groceries.kind).toBe("answer");
    expect(groceries.sentence).toMatch(/\$42\.50/);

    const due = askBooks(household, "what bills are due?", "2026-08-21");
    expect(due.sentence).toMatch(/Hydro|repeating/);
    expect(due.sentence).toMatch(/\$90\.00/);
    expect(due.rows[0]).toMatchObject({ label: "Total due", value: "$90.00" });
    expect(due.rows.some((row) => /Hydro/.test(row.label))).toBe(true);

    const exactComplaint = askBooks(household, "how much are my bills", "2026-08-21");
    expect(exactComplaint.kind).toBe("answer");
    expect(exactComplaint.sentence).toMatch(/\$90\.00/);
    expect(exactComplaint.sentence).not.toMatch(/Ask a number/i);

    const chequing = askBooks(household, "how much is in chequing?", "2026-08-21");
    expect(chequing.kind).toBe("answer");
    expect(chequing.rows[0]?.label).toMatch(/chequing/i);
  });

  it("answers health and this-week vs last-week on the demo kitchen", () => {
    const household = seedDemoHousehold({ today: "2026-08-21", environment: "development" });
    const health = askBooks(household, "are we alright?", "2026-08-21");
    expect(health.kind).toBe("answer");
    expect(health.sentence.length).toBeGreaterThan(10);

    const week = askBooks(household, "this week vs last week", "2026-08-21");
    expect(week.rows.map((row) => row.label)).toEqual(["This week", "Last week"]);
  });

  it("offers help instead of inventing a write", () => {
    const help = askBooks(catalogHousehold(), "drop table journal_entries", "2026-08-21");
    expect(help.kind).toBe("help");
  });

  it("refuses leftover CAD on Personal and parks Shared leftover in Kitty Banks", () => {
    const household = seedDemoHousehold({ today: "2026-08-21", environment: "development" });
    const memberId = household.members[0]!.id;
    const shared = askBooks(household, "Leftover?", "2026-08-21", { memberId, view: "household" });
    expect(shared.kind).toBe("answer");
    expect(shared.sentence).toMatch(/leftover/i);
    expect(shared.rows.some((row) => row.label === "Leftover" && /\$/.test(row.value))).toBe(true);
    expect(shared.rows.some((row) => row.label === "Parks in" && /Kitty Banks/i.test(row.value))).toBe(true);
    expect(shared.rows.some((row) => /Goals savings/i.test(row.value))).toBe(false);

    const personal = askBooks(household, "Leftover?", "2026-08-21", { memberId, view: "personal" });
    expect(personal.sentence).toMatch(/Shared/);
    expect(personal.sentence).not.toMatch(/\$\d/);
    expect(personal.rows.every((row) => !/\$/.test(row.value))).toBe(true);
    expect(askBooks(household, "safe to assign", "2026-08-21", { memberId, view: "personal" }).sentence).not.toMatch(/\$\d/);
  });
});

describe("books storage names", () => {
  it("keeps Development and Production journals on separate IndexedDB names", () => {
    expect(booksIdbName("development")).toBe("idb://hearth-books-development");
    expect(booksIdbName("production")).toBe("idb://hearth-books-production");
  });
});
