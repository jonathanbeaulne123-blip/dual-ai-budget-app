import { describe, expect, it } from "vitest";
import {
  HOUSEHOLD_FUND_ID,
  acceptHouseholdWrite,
  addGoal,
  addRecurrence,
  askAlternatives,
  askBooks,
  catalogHousehold,
  configureHouseholdFund,
  householdAsk,
  moveAskGoalClaimToNextMonth,
  postEntry,
  seedDemoHousehold,
} from "../src/core/index.ts";
import { booksIdbName, ingestBooks, openMemoryBooks } from "../src/ledger/engine.ts";

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

  it("persists an Ask goal date move with no transaction or journal entry", async () => {
    const fund = configureHouseholdFund(catalogHousehold(), {
      custodianMemberId: "MEM-001",
      openedOn: "2026-09-01",
      createdBy: "MEM-001",
    });
    const bill = addRecurrence(fund.household, {
      cadence: "monthly",
      nextDate: "2026-09-20",
      type: "expense",
      amount: "40",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-HOUSING-ELECTRIC",
      note: "Phone",
      fundingDefault: { fundId: HOUSEHOLD_FUND_ID, fundedCents: "full", destinationAccountId: "ACC-VISA" },
    });
    const goal = addGoal(bill.household, {
      name: "Halifax",
      target: "300",
      shared: true,
      ownerMemberId: "MEM-001",
    });
    const standing = addRecurrence(goal.household, {
      cadence: "monthly",
      nextDate: "2026-09-30",
      type: "transfer",
      amount: "300",
      accountId: "ACC-CHEQUING",
      transferToAccountId: "ACC-GOALS",
      goalId: goal.postedIds[0]!,
      note: "Standing · jar · Halifax",
    });
    const previous = standing.household;
    const alternative = askAlternatives(householdAsk(previous, "2026-09-12"))[0]!;
    const committed = moveAskGoalClaimToNextMonth(previous, {
      today: "2026-09-12",
      memberId: "MEM-002",
      goalId: alternative.goalId,
      recurrenceId: alternative.recurrenceId,
      claimDate: alternative.claimDate,
    });
    const db = await openMemoryBooks();
    let persisted = false;
    try {
      const accepted = await acceptHouseholdWrite({
        previous,
        candidate: committed.household,
        confirmationId: "confirm-halifax-pglite",
        postedIds: committed.postedIds,
        commandKind: committed.undo.commandKind,
        adapters: {
          ingest: (household, artifact) => {
            if (!artifact) throw new Error("Expected accepted books artifact");
            return ingestBooks(db, household, artifact.compiled, { previous: artifact.previous });
          },
          persist: async () => { persisted = true; },
        },
      });
      expect(accepted.ok).toBe(true);
      expect(persisted).toBe(true);
      expect((await db.query<{ id: string; next_date: string }>(
        "SELECT id, next_date FROM recurrences WHERE id = $1",
        [alternative.recurrenceId],
      )).rows).toEqual([{ id: alternative.recurrenceId, next_date: "2026-10-30" }]);
      expect((await db.query("SELECT id FROM source_transactions")).rows).toEqual([]);
      expect((await db.query("SELECT id FROM journal_entries")).rows).toEqual([]);
    } finally {
      await db.close();
    }
  }, 30_000);
});
