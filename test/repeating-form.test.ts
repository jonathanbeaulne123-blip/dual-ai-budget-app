import { describe, expect, it } from "vitest";
import {
  addRecurrence,
  catalogHousehold,
  postOneRecurrence,
  updateRecurrence,
} from "../src/core/index.ts";
import { advanceCadence, googleRrule, inferRecurrenceKind } from "../src/core/recurrence.ts";

const today = "2026-08-25";

describe("repeating form commands", () => {
  it("adds a manual expense recurrence without posting", () => {
    const household = catalogHousehold();
    const beforeCount = household.transactions.length;
    const result = addRecurrence(household, {
      cadence: "monthly",
      nextDate: "2026-09-01",
      type: "expense",
      amount: "95",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-PHONE",
      note: "Phone",
      origin: "manual",
    });
    expect(result.household.recurrences.some((item) => item.note === "Phone" && item.amountCents === 9500)).toBe(true);
    expect(result.household.transactions).toHaveLength(beforeCount);
    expect(result.postedIds[0]).toMatch(/^REC-/);
  });

  it("supports daily cadence advance and google rrule", () => {
    expect(advanceCadence("2026-08-25", "daily")).toBe("2026-08-26");
    expect(googleRrule("2026-08-25", "daily")).toBe("RRULE:FREQ=DAILY");
  });

  it("updates an existing recurrence in place", () => {
    let household = addRecurrence(catalogHousehold(), {
      cadence: "weekly",
      nextDate: today,
      type: "expense",
      amount: "40",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Coffee run",
    }).household;
    const id = household.recurrences.find((item) => item.note === "Coffee run")!.id;
    household = updateRecurrence(household, {
      id,
      cadence: "biweekly",
      nextDate: "2026-09-01",
      type: "expense",
      amount: "55",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Coffee run",
      kind: "subscription",
    }).household;
    const item = household.recurrences.find((row) => row.id === id)!;
    expect(item.amountCents).toBe(5500);
    expect(item.cadence).toBe("biweekly");
    expect(item.kind).toBe("subscription");
    expect(item.nextDate).toBe("2026-09-01");
  });

  it("can create then post the first occurrence when Confirm opts in", () => {
    const created = addRecurrence(catalogHousehold(), {
      cadence: "monthly",
      nextDate: today,
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Daily treat",
      kind: "subscription",
    });
    const id = created.postedIds[0]!;
    const posted = postOneRecurrence(created.household, id, today, { allowNotDue: true });
    expect(posted.household.transactions.some((tx) => tx.note === "Daily treat" && tx.amountCents === 1250)).toBe(true);
    const item = posted.household.recurrences.find((row) => row.id === id)!;
    expect(item.nextDate).toBe(advanceCadence(today, "monthly"));
  });

  it("posts a not-yet-due occurrence only when allowNotDue is set", () => {
    const created = addRecurrence(catalogHousehold(), {
      cadence: "monthly",
      nextDate: "2026-09-15",
      type: "income",
      amount: "900",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-INCOME-WAGES",
      note: "Tips",
    });
    const id = created.postedIds[0]!;
    expect(() => postOneRecurrence(created.household, id, today)).toThrow(/not due/);
    const posted = postOneRecurrence(created.household, id, today, { allowNotDue: true });
    expect(posted.household.transactions.some((tx) => tx.type === "income" && tx.note === "Tips")).toBe(true);
  });

  it("creates transfer standing orders and funds a jar when posted", () => {
    const household = catalogHousehold();
    const goal = household.goals.find((item) => item.status !== "retired");
    const created = addRecurrence(household, {
      cadence: "monthly",
      nextDate: today,
      type: "transfer",
      amount: "50",
      accountId: "ACC-CHEQUING",
      transferToAccountId: "ACC-GOALS",
      goalId: goal?.id ?? null,
      note: "Jar drip",
    });
    const id = created.postedIds[0]!;
    const item = created.household.recurrences.find((row) => row.id === id)!;
    expect(item.type).toBe("transfer");
    expect(item.transferToAccountId).toBe("ACC-GOALS");
    const posted = postOneRecurrence(created.household, id, today, { allowNotDue: true });
    expect(posted.household.transactions.some((tx) => tx.type === "transfer")).toBe(true);
  });

  it("infers kind and lets an explicit kind win", () => {
    expect(inferRecurrenceKind({ type: "expense", note: "Netflix" })).toBe("subscription");
    expect(inferRecurrenceKind({ type: "income", note: "Work" })).toBe("paycheck");
    const created = addRecurrence(catalogHousehold(), {
      cadence: "monthly",
      nextDate: today,
      type: "expense",
      amount: "10",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Netflix",
      kind: "other",
    });
    expect(created.household.recurrences.find((row) => row.note === "Netflix")?.kind).toBe("other");
  });
});
