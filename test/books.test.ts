import { describe, expect, it } from "vitest";
import { catalogHousehold, postEntry, postTransfer, postShift, markDuplicate } from "../src/core/index.ts";
import {
  booksEquation,
  compileHousehold,
  snapshotPnL,
  trialBalance,
} from "../src/core/journal.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { hashBooksSnapshot, ingestBooks, openMemoryBooks } from "../src/ledger/engine.ts";
import { assertReadOnlySelect } from "../src/ledger/queryGuard.ts";
import { booksSqlDump } from "../src/ledger/export.ts";

describe("double-entry books", () => {
  it("posts an expense as a debit to the category and a credit to the card", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-18",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
    });
    const books = compileHousehold(posted.household);
    const entry = books.entries[0];
    expect(entry?.lines).toHaveLength(2);
    expect(entry?.lines.find((line) => line.accountId === "PL-SUB-FOOD-GROCERIES")?.debitCents).toBe(1250);
    expect(entry?.lines.find((line) => line.accountId === "ACC-VISA")?.creditCents).toBe(1250);
    const equation = booksEquation(books);
    expect(equation.holds).toBe(true);
    expect(equation.expenseCents).toBe(1250);
    expect(equation.liabilityCents).toBe(1250);
    expect(equation.netWorthCents).toBe(-1250);
  });

  it("splits ownership across debit lines without breaking the balance", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-18",
      type: "expense",
      amount: "100.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      splits: [
        { party: "MEM-001", amountCents: 6000 },
        { party: "MEM-002", amountCents: 4000 },
      ],
    });
    const entry = compileHousehold(posted.household).entries[0];
    const grocery = entry?.lines.filter((line) => line.accountId === "PL-SUB-FOOD-GROCERIES") ?? [];
    expect(grocery.map((line) => [line.partyId, line.debitCents])).toEqual([
      ["MEM-001", 6000],
      ["MEM-002", 4000],
    ]);
    expect(entry?.lines.find((line) => line.accountId === "ACC-VISA")?.creditCents).toBe(10000);
  });

  it("pays the Visa as Dr liability, Cr chequing — never income or expense", () => {
    const posted = postTransfer(catalogHousehold(), {
      date: "2026-08-18",
      amount: "200.00",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-VISA",
      note: "Visa payment",
    });
    const books = compileHousehold(posted.household);
    expect(books.entries).toHaveLength(1);
    const entry = books.entries[0]!;
    expect(entry.lines.find((line) => line.accountId === "ACC-VISA")?.debitCents).toBe(20000);
    expect(entry.lines.find((line) => line.accountId === "ACC-CHEQUING")?.creditCents).toBe(20000);
    const equation = booksEquation(books);
    expect(equation.incomeCents).toBe(0);
    expect(equation.expenseCents).toBe(0);
    expect(equation.holds).toBe(true);
  });

  it("credits an expense account on a refund", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "40.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Tickets",
    }).household;
    household = postEntry(household, {
      date: "2026-08-19",
      type: "refund",
      amount: "40.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-LIFE-FUN",
      note: "Refund",
      refundOfId: household.transactions[0]?.id,
      confirmDuplicate: true,
    }).household;
    const books = compileHousehold(household);
    const refund = books.entries.find((entry) => entry.memo === "Refund");
    expect(refund?.lines.find((line) => line.accountId === "ACC-VISA")?.debitCents).toBe(4000);
    expect(refund?.lines.find((line) => line.accountId === "PL-SUB-LIFE-FUN")?.creditCents).toBe(4000);
    expect(booksEquation(books).expenseCents).toBe(0);
  });

  it("keeps the demo household on the accounting equation", () => {
    const household = seedDemoHousehold({ today: "2026-08-21" });
    const books = compileHousehold(household);
    const equation = booksEquation(books);
    const snapshot = snapshotPnL(household);
    const trial = trialBalance(books);
    expect(trial.inBalance).toBe(true);
    expect(equation.holds).toBe(true);
    expect(equation.incomeCents).toBe(snapshot.incomeCents);
    expect(equation.expenseCents).toBe(snapshot.expenseCents);
  });

  it("excludes a marked duplicate from recognized books", () => {
    let household = catalogHousehold();
    household = postEntry(household, {
      date: "2026-08-18",
      type: "expense",
      amount: "9.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Coffee",
    }).household;
    household = markDuplicate(household, household.transactions[0]!.id, true).household;
    const equation = booksEquation(compileHousehold(household));
    expect(equation.expenseCents).toBe(0);
    expect(snapshotPnL(household).expenseCents).toBe(0);
  });
});

describe("read-only SQL console", () => {
  it("allows a select and refuses a write even inside a string-looking keyword column", () => {
    expect(assertReadOnlySelect("SELECT code, created_at FROM chart_accounts")).toMatch(/select/i);
    expect(() => assertReadOnlySelect("INSERT INTO journal_lines VALUES (1,0)")).toThrow(/read-only/i);
    expect(() => assertReadOnlySelect("WITH x AS (SELECT 1) INSERT INTO journal_lines SELECT 1, 0")).toThrow(/change the books/i);
    expect(() => assertReadOnlySelect("SELECT 1; DROP TABLE journal_entries")).toThrow(/one statement/i);
    expect(assertReadOnlySelect("SELECT * FROM journal_entries WHERE memo = 'drop table'")).toMatch(/select/i);
  });
});

describe("Postgres books engine", () => {
  it("ingests a household into PGlite and the SQL trial balance matches the compiler", async () => {
    const household = postEntry(catalogHousehold(), {
      date: "2026-08-18",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
    }).household;
    const compiled = compileHousehold(household);
    const db = await openMemoryBooks();
    try {
      const status = await ingestBooks(db, household, compiled);
      expect(status.ok).toBe(true);
      expect(status.postgresVersion).toMatch(/^18/);
      const unbalanced = await db.query("SELECT * FROM v_unbalanced_entries");
      expect(unbalanced.rows).toEqual([]);
      const visa = await db.query<{ debit_cents: number; credit_cents: number }>(
        "SELECT debit_cents, credit_cents FROM v_trial_balance WHERE account_id = $1",
        ["ACC-VISA"],
      );
      expect(Number(visa.rows[0]?.credit_cents)).toBe(1250);
      const dump = booksSqlDump(compiled);
      expect(dump).toContain("BEGIN;");
      expect(dump).toContain("journal_entries");
    } finally {
      await db.close();
    }
  }, 30_000);

  it("posts a shift with possibly tiny tips without breaking SQL constraints", async () => {
    const posted = postShift(catalogHousehold(), {
      date: "2026-08-18",
      memberId: "MEM-002",
      accountId: "ACC-CASH",
      sales: "1000.00",
      cashTips: "50.00",
      ccTips: "100.00",
      hours: "4.00",
    
      customersServed: 40,
      staffingCount: 4,
      eventTag: "regular",
    });
    const db = await openMemoryBooks();
    try {
      const status = await ingestBooks(db, posted.household);
      expect(status.ok).toBe(true);
      const pnl = await db.query<{ amount_cents: number; name: string }>(
        "SELECT name, amount_cents FROM v_income_statement WHERE household_id = $1 ORDER BY name",
        [posted.household.householdId],
      );
      expect(pnl.rows.some((row) => row.name === "Wages")).toBe(true);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("replaces the active PGlite books across an A to B to A replica switch", async () => {
    const first = { ...catalogHousehold(), householdId: "HH-FIRST", name: "First household" };
    const second = { ...catalogHousehold(), householdId: "HH-SECOND", name: "Second household" };
    const db = await openMemoryBooks();
    try {
      expect((await ingestBooks(db, first)).ok).toBe(true);
      expect((await ingestBooks(db, second)).ok).toBe(true);
      const households = await db.query<{ id: string }>("SELECT id FROM households ORDER BY id");
      const members = await db.query<{ household_id: string }>("SELECT household_id FROM members");
      expect(households.rows).toEqual([{ id: "HH-SECOND" }]);
      expect(members.rows.length).toBe(second.members.length);
      expect(members.rows.every((row) => row.household_id === "HH-SECOND")).toBe(true);

      expect((await ingestBooks(db, first)).ok).toBe(true);
      const returned = await db.query<{ id: string }>("SELECT id FROM households ORDER BY id");
      const revisions = await db.query<{ household_id: string }>("SELECT household_id FROM audit_revisions");
      expect(returned.rows).toEqual([{ id: "HH-FIRST" }]);
      expect(revisions.rows).toEqual([{ household_id: "HH-FIRST" }]);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("rolls back the active projection when a replacement fails after truncation", async () => {
    const accepted = postEntry(
      { ...catalogHousehold(), householdId: "HH-ACCEPTED", name: "Accepted household" },
      {
        date: "2026-08-26",
        type: "expense",
        amount: "12.50",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: "Rollback proof",
      },
    ).household;
    const rejected = { ...catalogHousehold(), householdId: "HH-REJECTED", timezone: "" };
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, accepted);
      await expect(ingestBooks(db, rejected)).rejects.toThrow();

      const households = await db.query<{ id: string }>("SELECT id FROM households ORDER BY id");
      const journal = await db.query<{ household_id: string }>("SELECT household_id FROM journal_entries");
      const audit = await db.query<{ snapshot_hash: string }>("SELECT snapshot_hash FROM audit_revisions");
      expect(households.rows).toEqual([{ id: "HH-ACCEPTED" }]);
      expect(journal.rows).toEqual([{ household_id: "HH-ACCEPTED" }]);
      expect(audit.rows).toEqual([{ snapshot_hash: await hashBooksSnapshot(accepted) }]);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("releases the previous large snapshot file when opening a new household", async () => {
    let seed = 0x12345678;
    const bytes = new Uint8Array(4 * 1024 * 1024);
    for (let index = 0; index < bytes.length; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      bytes[index] = 32 + (seed % 95);
    }
    const large = {
      ...catalogHousehold(),
      householdId: "HH-LARGE",
      name: "Large household",
      activity: [{
        id: "ACT-LARGE",
        at: "2026-08-26T12:00:00.000Z",
        action: "Regression padding",
        summary: new TextDecoder().decode(bytes),
        updatedAt: "2026-08-26T12:00:00.000Z",
      }],
    };
    const fresh = { ...catalogHousehold(), householdId: "HH-FRESH", name: "Fresh household" };
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, large);
      const first = await db.query<{ bytes: number }>(
        "SELECT pg_total_relation_size('household_snapshots')::float8 AS bytes",
      );
      await ingestBooks(db, fresh);
      const final = await db.query<{ bytes: number }>(
        "SELECT pg_total_relation_size('household_snapshots')::float8 AS bytes",
      );

      expect(Number(first.rows[0]?.bytes)).toBeGreaterThan(4 * 1024 * 1024);
      expect(Number(final.rows[0]?.bytes)).toBeLessThan(Number(first.rows[0]?.bytes) / 4);
    } finally {
      await db.close();
    }
  }, 30_000);
});
