import { describe, expect, it, vi } from "vitest";
import { cashFlowStatement, catalogHousehold, postEntry, postTransfer, postShift, markDuplicate, monthSummary, reversePostedMoney } from "../src/core/index.ts";
import {
  booksEquation,
  compileHousehold,
  snapshotPnL,
  trialBalance,
} from "../src/core/journal.ts";
import { seedDemoHousehold } from "../src/core/seed.ts";
import { clearStagedHouseholdBooks, getBrowserBooks, hashBooksSnapshot, incrementalBooksEnabled, ingestBooks, ingestHouseholdBooks, inspectBrowserBooks, loadStagedHouseholdBooks, migrateBooks, openMemoryBooks, prewarmStagedHouseholdBooks, resetBrowserBooksForTests, validateHouseholdBooksStaged, wipeStagedBooksForEnvironment } from "../src/ledger/engine.ts";
import { assertReadOnlySelect } from "../src/ledger/queryGuard.ts";
import { booksSqlDump } from "../src/ledger/export.ts";

describe("double-entry books", () => {
  it("does not let an in-flight staged open reappear after an environment wipe", async () => {
    await resetBrowserBooksForTests();
    const household = catalogHousehold();
    household.booksAcceptedHash = await hashBooksSnapshot(household);
    const validating = validateHouseholdBooksStaged(household, { auditHash: household.booksAcceptedHash });
    await wipeStagedBooksForEnvironment(household.environment, [household.householdId]);
    await Promise.allSettled([validating]);

    expect(await loadStagedHouseholdBooks(household.environment, household.householdId)).toBeNull();
    await clearStagedHouseholdBooks(household.environment, household.householdId);
    await resetBrowserBooksForTests();
  }, 30_000);

  it("does not prewarm an older accepted household over a newer ambiguous stage", async () => {
    await resetBrowserBooksForTests();
    const previous = catalogHousehold();
    previous.booksAcceptedHash = await hashBooksSnapshot(previous);
    const posted = postEntry(previous, {
      date: "2026-09-03",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Ambiguous stage",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const candidate = { ...posted.household, revision: previous.revision + 1 };
    candidate.booksAcceptedHash = await hashBooksSnapshot(candidate);
    await validateHouseholdBooksStaged(candidate, { auditHash: candidate.booksAcceptedHash });

    await prewarmStagedHouseholdBooks(previous);

    expect((await loadStagedHouseholdBooks(previous.environment, previous.householdId))?.revision)
      .toBe(candidate.revision);
    await clearStagedHouseholdBooks(previous.environment, previous.householdId);
    await resetBrowserBooksForTests();
  }, 30_000);

  it("validates an online candidate in isolated PGlite without advancing the active replica", async () => {
    await resetBrowserBooksForTests();
    const previous = catalogHousehold();
    previous.booksAcceptedHash = await hashBooksSnapshot(previous);
    await ingestHouseholdBooks(previous, { auditHash: previous.booksAcceptedHash });
    const posted = postEntry(previous, {
      date: "2026-09-03",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Staged only",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const candidate = posted.household;
    candidate.booksAcceptedHash = await hashBooksSnapshot(candidate);

    const staged = await validateHouseholdBooksStaged(candidate, {
      previous,
      auditHash: candidate.booksAcceptedHash,
      incremental: true,
    });

    expect(staged.ok).toBe(true);
    expect((await inspectBrowserBooks(previous, { expectedAuditHash: previous.booksAcceptedHash })).ok).toBe(true);
    expect((await inspectBrowserBooks(candidate, { expectedAuditHash: candidate.booksAcceptedHash })).issue).toBe("projection-mismatch");
    await resetBrowserBooksForTests();
  }, 30_000);
  it("keeps the incremental canary default-off and permanently off in Production", () => {
    vi.stubEnv("VITE_PGLITE_INCREMENTAL_DEV", "");
    expect(incrementalBooksEnabled("development")).toBe(false);
    vi.stubEnv("VITE_PGLITE_INCREMENTAL_DEV", "1");
    expect(incrementalBooksEnabled("development")).toBe(true);
    expect(incrementalBooksEnabled("production")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("forces the full writer path when a Production caller explicitly requests incremental ingest", async () => {
    const base = catalogHousehold();
    let previous = { ...base, environment: "production" as const };
    previous = { ...previous, booksAcceptedHash: await hashBooksSnapshot(previous) };
    const nextDraft = { ...previous, revision: previous.revision + 1, name: "Production stays full" };
    const next = { ...nextDraft, booksAcceptedHash: await hashBooksSnapshot(nextDraft) };
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, previous);
      const status = await ingestBooks(db, next, compileHousehold(next), {
        previous,
        incremental: true,
      });
      expect(status.writeMode).toBe("full");
      expect(status.compactionReason).toBe("production-full-path");
      expect((await db.query<{ environment: string; name: string }>("SELECT environment, name FROM households")).rows)
        .toEqual([{ environment: "production", name: "Production stays full" }]);
    } finally {
      await db.close();
    }
  }, 30_000);
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

  it("keeps the compiled journal aligned when reversing a reversal", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-18",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      confirmDuplicate: true,
    });
    const transactionId = posted.postedIds.find((id) => id.startsWith("TXN-"));
    if (!transactionId) throw new Error("Missing expense row");
    const reversed = reversePostedMoney(posted.household, transactionId, {
      reversalDate: "2026-08-18",
    });
    const reversalId = reversed.household.transactions.find((row) => row.reversalOfId === transactionId)?.id;
    if (!reversalId) throw new Error("Missing reversal row");
    const reinstated = reversePostedMoney(reversed.household, reversalId, {
      reversalDate: "2026-08-18",
    }).household;

    const books = compileHousehold(reinstated);
    const equation = booksEquation(books);
    expect(trialBalance(books).inBalance).toBe(true);
    expect(equation.expenseCents).toBe(1250);
    expect(equation.liabilityCents).toBe(1250);
    expect(snapshotPnL(reinstated).expenseCents).toBe(1250);
    expect(monthSummary(reinstated, "2026-08").expenseActualCents).toBe(1250);
    const reinstatement = books.entries.find((entry) => entry.originTransactionIds.includes(
      reinstated.transactions.find((row) => row.reversalOfId === reversalId)?.id ?? "",
    ));
    expect(reinstatement?.lines.find((line) => line.accountId === "PL-SUB-FOOD-GROCERIES")?.debitCents).toBe(1250);
  });

  it("excludes a reinstatement when an intermediate reversal is marked duplicate", () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-18",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      confirmDuplicate: true,
    });
    const transactionId = posted.postedIds.find((id) => id.startsWith("TXN-"));
    if (!transactionId) throw new Error("Missing expense row");
    const reversed = reversePostedMoney(posted.household, transactionId, {
      reversalDate: "2026-08-18",
    });
    const reversalId = reversed.household.transactions.find((row) => row.reversalOfId === transactionId)?.id;
    if (!reversalId) throw new Error("Missing reversal row");
    const excluded = markDuplicate(reversed.household, reversalId, true).household;
    const reinstated = reversePostedMoney(excluded, reversalId, {
      reversalDate: "2026-08-18",
    }).household;

    const books = compileHousehold(reinstated);
    const equation = booksEquation(books);
    expect(books.entries.filter((entry) => entry.recognized).map((entry) => entry.originTransactionIds))
      .toEqual([[transactionId]]);
    expect(trialBalance(books).inBalance).toBe(true);
    expect(equation.expenseCents).toBe(1250);
    expect(equation.liabilityCents).toBe(1250);
    expect(snapshotPnL(reinstated).expenseCents).toBe(1250);
    expect(monthSummary(reinstated, "2026-08").expenseActualCents).toBe(1250);
    expect(cashFlowStatement(reinstated, "2026-08").cardSpendCents).toBe(1250);
  });

  it("excludes a reversed transfer when either original leg is marked duplicate", () => {
    const transfer = postTransfer(catalogHousehold(), {
      date: "2026-08-18",
      amount: "40.00",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-VISA",
      confirmDuplicate: true,
    });
    const reversed = reversePostedMoney(transfer.household, transfer.postedIds[0]!, {
      reversalDate: "2026-08-18",
    });
    const excluded = markDuplicate(reversed.household, transfer.postedIds[0]!, true).household;
    const books = compileHousehold(excluded);

    expect(books.entries.filter((entry) => entry.recognized)).toEqual([]);
    expect(booksEquation(books)).toMatchObject({
      assetCents: 0,
      liabilityCents: 0,
      netWorthCents: 0,
    });
    expect(cashFlowStatement(excluded, "2026-08").debtPaydownCents).toBe(0);
  });

  it("excludes a transfer reinstatement when an intermediate reversal pair leg is duplicate", () => {
    const transfer = postTransfer(catalogHousehold(), {
      date: "2026-08-18",
      amount: "40.00",
      fromAccountId: "ACC-CHEQUING",
      toAccountId: "ACC-VISA",
      confirmDuplicate: true,
    });
    const reversed = reversePostedMoney(transfer.household, transfer.postedIds[0]!, {
      reversalDate: "2026-08-18",
    });
    const reversal = reversed.household.transactions.find((row) => row.reversalOfId === transfer.postedIds[0]);
    if (!reversal?.transferPairId) throw new Error("Missing transfer reversal pair");
    const excluded = markDuplicate(reversed.household, reversal.transferPairId, true).household;
    const reinstated = reversePostedMoney(excluded, reversal.id, {
      reversalDate: "2026-08-18",
    }).household;
    const books = compileHousehold(reinstated);

    expect(books.entries.filter((entry) => entry.recognized)).toHaveLength(1);
    expect(trialBalance(books).inBalance).toBe(true);
    expect(cashFlowStatement(reinstated, "2026-08").debtPaydownCents).toBe(4000);
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
  it("coalesces concurrent opens for the same environment", async () => {
    await resetBrowserBooksForTests();
    try {
      const [left, right] = await Promise.all([
        getBrowserBooks("development"),
        getBrowserBooks("development"),
      ]);
      expect(left).toBe(right);
    } finally {
      await resetBrowserBooksForTests();
    }
  }, 30_000);

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

  it("applies a same-household delta and matches a clean full rebuild", async () => {
    let previous = catalogHousehold();
    previous = {
      ...previous,
      booksAcceptedHash: await hashBooksSnapshot(previous),
    };
    const posted = postEntry(previous, {
      date: "2026-08-26",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Incremental milk",
    }).household;
    const next = {
      ...posted,
      members: posted.members.map((member) => member.id === "MEM-001" ? { ...member, name: "Jonathan updated" } : member),
      categories: posted.categories.map((category, index) => index === 0 ? { ...category, name: `${category.name} updated` } : category),
      accounts: posted.accounts.map((account) => account.id === "ACC-VISA" ? { ...account, name: "Visa updated" } : account),
      revision: previous.revision + 1,
      lastCommittedAt: "2026-08-26T12:00:00.000Z",
      booksAcceptedHash: await hashBooksSnapshot(posted),
    };
    const incremental = await openMemoryBooks();
    const rebuilt = await openMemoryBooks();
    try {
      await ingestBooks(incremental, previous);
      const status = await ingestBooks(incremental, next, compileHousehold(next), {
        previous,
        previousCompiled: compileHousehold(previous),
        incremental: true,
      });
      await ingestBooks(rebuilt, next);
      expect(status.writeMode).toBe("incremental");
      expect(status.changedRowCount).toBeGreaterThan(0);

      const comparisons = [
        "households", "members", "categories", "chart_accounts", "journal_entries", "journal_lines",
        "source_transactions", "shifts", "goals", "budget_plans", "recurrences", "activity",
        "household_funds", "fund_month_plans", "fund_events", "fund_settlement_allocations",
        "fund_kitty_allocations", "fund_bank_bindings", "fund_private_reconciliations",
      ];
      for (const table of comparisons) {
        const left = await incremental.query(`SELECT * FROM ${table} ORDER BY 1`);
        const right = await rebuilt.query(`SELECT * FROM ${table} ORDER BY 1`);
        expect(left.rows, table).toEqual(right.rows);
      }
      const leftSnapshot = await incremental.query("SELECT household_id, invite_phrase, environment, payload FROM household_snapshots");
      const rightSnapshot = await rebuilt.query("SELECT household_id, invite_phrase, environment, payload FROM household_snapshots");
      expect(leftSnapshot.rows).toEqual(rightSnapshot.rows);
      for (const view of ["v_journal", "v_trial_balance", "v_income_statement", "v_net_worth", "v_catalog", "v_unbalanced_entries"]) {
        const leftViews = await incremental.query(`SELECT * FROM ${view} ORDER BY 1, 2`);
        const rightViews = await rebuilt.query(`SELECT * FROM ${view} ORDER BY 1, 2`);
        expect(leftViews.rows, view).toEqual(rightViews.rows);
      }
      const latest = await incremental.query<{ snapshot_hash: string; revision: number }>(
        "SELECT snapshot_hash, revision FROM audit_revisions ORDER BY revision DESC LIMIT 1",
      );
      expect(latest.rows).toEqual([{ snapshot_hash: await hashBooksSnapshot(next), revision: next.revision }]);
    } finally {
      await incremental.close();
      await rebuilt.close();
    }
  }, 30_000);

  it("re-anchors before posting when accepted metadata advanced beyond the PGlite receipt", async () => {
    let anchored = catalogHousehold();
    anchored = { ...anchored, booksAcceptedHash: await hashBooksSnapshot(anchored) };
    const metadataOnly = {
      ...anchored,
      revision: anchored.revision + 1,
      devices: [{
        id: "device-metadata-gap",
        label: "Kitchen tablet",
        memberId: "MEM-002",
        environment: "development" as const,
        seenAt: "2026-09-01T01:00:00.000Z",
        updatedAt: "2026-09-01T01:00:00.000Z",
        active: true,
      }],
    };
    const postedDraft = postEntry(metadataOnly, {
      date: "2026-09-01",
      type: "expense",
      amount: "200.00",
      accountId: "ACC-CHEQUING",
      subcategoryId: "SUB-HEALTH-DENTAL",
      note: "Metadata re-anchor proof",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const posted = {
      ...postedDraft,
      revision: metadataOnly.revision + 1,
      booksAcceptedHash: await hashBooksSnapshot(postedDraft),
    };
    const incremental = await openMemoryBooks();
    const rebuilt = await openMemoryBooks();
    try {
      await ingestBooks(incremental, anchored);
      const status = await ingestBooks(incremental, posted, compileHousehold(posted), {
        previous: metadataOnly,
        incremental: true,
        auditHash: posted.booksAcceptedHash!,
      });
      await ingestBooks(rebuilt, posted);

      expect(status.writeMode).toBe("full");
      expect(status.compactionReason).toBe("metadata-reanchor");
      expect((await incremental.query("SELECT * FROM households ORDER BY id")).rows)
        .toEqual((await rebuilt.query("SELECT * FROM households ORDER BY id")).rows);
      expect((await incremental.query("SELECT * FROM journal_entries ORDER BY id")).rows)
        .toEqual((await rebuilt.query("SELECT * FROM journal_entries ORDER BY id")).rows);
      expect((await incremental.query("SELECT * FROM journal_lines ORDER BY id")).rows)
        .toEqual((await rebuilt.query("SELECT * FROM journal_lines ORDER BY id")).rows);
      expect((await incremental.query<{ revision: number; snapshot_hash: string }>(
        "SELECT revision, snapshot_hash FROM audit_revisions ORDER BY revision DESC LIMIT 1",
      )).rows).toEqual([{ revision: posted.revision, snapshot_hash: posted.booksAcceptedHash }]);
    } finally {
      await incremental.close();
      await rebuilt.close();
    }
  }, 30_000);

  it("refuses to re-anchor from a previous snapshot older than the PGlite receipt", async () => {
    const base = catalogHousehold();
    const pgliteTipDraft = { ...base, revision: base.revision + 2 };
    const pgliteTip = { ...pgliteTipDraft, booksAcceptedHash: await hashBooksSnapshot(pgliteTipDraft) };
    const stalePrevious = {
      ...pgliteTip,
      revision: pgliteTip.revision - 1,
    };
    const candidate = {
      ...pgliteTip,
      revision: pgliteTip.revision + 1,
      name: "Must remain refused",
    };
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, pgliteTip);
      await expect(ingestBooks(db, candidate, compileHousehold(candidate), {
        previous: stalePrevious,
        incremental: true,
      })).rejects.toThrow(/receipt does not match/i);
      expect((await db.query<{ revision: number; name: string }>("SELECT revision, name FROM households")).rows)
        .toEqual([{ revision: pgliteTip.revision, name: pgliteTip.name }]);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("rolls back partial incremental deletes and refuses a mismatched previous receipt", async () => {
    let previous = postEntry(catalogHousehold(), {
      date: "2026-08-26",
      type: "expense",
      amount: "9.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Keep me",
    }).household;
    previous = { ...previous, booksAcceptedHash: await hashBooksSnapshot(previous) };
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, previous);
      const invalid = {
        ...previous,
        revision: previous.revision + 1,
        timezone: "",
        transactions: [],
      };
      await expect(ingestBooks(db, invalid, compileHousehold(invalid), {
        previous,
        incremental: true,
      })).rejects.toThrow();
      expect((await db.query("SELECT id FROM source_transactions")).rows).toHaveLength(1);
      expect((await db.query<{ snapshot_hash: string }>("SELECT snapshot_hash FROM audit_revisions")).rows)
        .toEqual([{ snapshot_hash: previous.booksAcceptedHash }]);

      await db.query("UPDATE audit_revisions SET snapshot_hash = 'tampered'");
      const next = { ...previous, revision: previous.revision + 1, name: "Changed" };
      await expect(ingestBooks(db, next, compileHousehold(next), {
        previous,
        incremental: true,
      })).rejects.toThrow(/receipt does not match/i);
      expect((await db.query<{ name: string }>("SELECT name FROM households")).rows[0]?.name).toBe(previous.name);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("rolls back completed delta deletes and earlier upserts when a later upsert fails", async () => {
    let previous = postEntry(catalogHousehold(), {
      date: "2026-08-26",
      type: "expense",
      amount: "9.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Update me",
    }).household;
    previous = postEntry(previous, {
      date: "2026-08-27",
      type: "expense",
      amount: "7.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Delete me",
    }).household;
    previous = { ...previous, booksAcceptedHash: await hashBooksSnapshot(previous) };
    const retained = previous.transactions[0]!;
    const nextDraft = {
      ...previous,
      revision: previous.revision + 1,
      name: "Must roll back",
      transactions: [{ ...retained, note: "Trigger the later upsert" }],
    };
    const next = { ...nextDraft, booksAcceptedHash: await hashBooksSnapshot(nextDraft) };
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, previous);
      await db.exec(`
        CREATE FUNCTION hearth_test_fail_source_upsert() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          RAISE EXCEPTION 'forced source upsert failure';
        END;
        $$;
        CREATE TRIGGER hearth_test_fail_source_upsert
          BEFORE INSERT OR UPDATE ON source_transactions
          FOR EACH ROW EXECUTE FUNCTION hearth_test_fail_source_upsert();
      `);

      await expect(ingestBooks(db, next, compileHousehold(next), {
        previous,
        incremental: true,
      })).rejects.toThrow(/forced source upsert failure/i);

      expect((await db.query<{ name: string }>("SELECT name FROM households")).rows)
        .toEqual([{ name: previous.name }]);
      expect((await db.query<{ id: string; note: string }>("SELECT id, note FROM source_transactions ORDER BY id")).rows)
        .toEqual(previous.transactions
          .map((transaction) => ({ id: transaction.id, note: transaction.note }))
          .sort((left, right) => left.id.localeCompare(right.id)));
      expect((await db.query<{ snapshot_hash: string }>("SELECT snapshot_hash FROM audit_revisions")).rows)
        .toEqual([{ snapshot_hash: previous.booksAcceptedHash }]);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("deletes removed journal and source rows through the incremental path", async () => {
    let previous = postEntry(catalogHousehold(), {
      date: "2026-08-26",
      type: "expense",
      amount: "9.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-COFFEE",
      note: "Remove me",
    }).household;
    previous = { ...previous, booksAcceptedHash: await hashBooksSnapshot(previous) };
    const nextDraft = { ...previous, revision: previous.revision + 1, transactions: [] };
    const next = { ...nextDraft, booksAcceptedHash: await hashBooksSnapshot(nextDraft) };
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, previous);
      const status = await ingestBooks(db, next, compileHousehold(next), { previous, incremental: true });
      expect(status.writeMode).toBe("incremental");
      expect((await db.query("SELECT id FROM source_transactions")).rows).toEqual([]);
      expect((await db.query("SELECT id FROM journal_entries")).rows).toEqual([]);
      expect((await db.query("SELECT id FROM journal_lines")).rows).toEqual([]);
      expect((await db.query("SELECT * FROM v_unbalanced_entries")).rows).toEqual([]);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("rejects a delta when any materialized SQL row changed after its receipt", async () => {
    let previous = catalogHousehold();
    previous = { ...previous, booksAcceptedHash: await hashBooksSnapshot(previous) };
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, previous);
      await db.query(
        "INSERT INTO activity (id, household_id, at, action, summary) VALUES ($1,$2,$3,$4,$5)",
        ["ACT-STALE", previous.householdId, "2026-08-26T12:00:00.000Z", "stale", "must not survive"],
      );
      const next = { ...previous, revision: previous.revision + 1, name: "Must reject" };
      await expect(ingestBooks(db, next, compileHousehold(next), {
        previous,
        incremental: true,
      })).rejects.toThrow(/projection changed after its receipt/i);
      expect((await db.query<{ name: string }>("SELECT name FROM households")).rows[0]?.name).toBe(previous.name);
      expect((await db.query("SELECT id FROM activity WHERE id = 'ACT-STALE'")).rows).toHaveLength(1);
      expect((await db.query("SELECT id FROM audit_revisions")).rows).toHaveLength(1);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("forces a full rebuild when a legacy receipt has no projection proof", async () => {
    let previous = catalogHousehold();
    previous = { ...previous, booksAcceptedHash: await hashBooksSnapshot(previous) };
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, previous);
      await db.query("UPDATE audit_revisions SET projection_hash = NULL");
      const next = { ...previous, revision: previous.revision + 1, name: "Re-anchored" };
      const status = await ingestBooks(db, next, compileHousehold(next), {
        previous,
        incremental: true,
      });
      expect(status.writeMode).toBe("full");
      expect(status.compactionReason).toBe("untrusted-previous");
      expect((await db.query<{ projection_hash: string }>("SELECT projection_hash FROM audit_revisions")).rows[0]?.projection_hash).toMatch(/^[a-f0-9]{32}$/);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("re-anchors a pre-v7 reversal projection from the accepted snapshot", async () => {
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-18",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      confirmDuplicate: true,
    });
    const transactionId = posted.postedIds.find((id) => id.startsWith("TXN-"));
    if (!transactionId) throw new Error("Missing expense row");
    const reversed = reversePostedMoney(posted.household, transactionId, { reversalDate: "2026-08-18" });
    const reversalId = reversed.household.transactions.find((row) => row.reversalOfId === transactionId)?.id;
    if (!reversalId) throw new Error("Missing reversal row");
    const reinstatedDraft = reversePostedMoney(reversed.household, reversalId, {
      reversalDate: "2026-08-18",
    }).household;
    const reinstated = {
      ...reinstatedDraft,
      booksAcceptedHash: await hashBooksSnapshot(reinstatedDraft),
    };
    const reinstatementId = reinstated.transactions.find((row) => row.reversalOfId === reversalId)?.id;
    if (!reinstatementId) throw new Error("Missing reinstatement row");
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, reinstated);
      await db.query(
        "UPDATE journal_lines SET debit_cents = credit_cents, credit_cents = debit_cents WHERE entry_id = $1",
        [`JE-${reinstatementId}`],
      );
      await db.query("DELETE FROM schema_migrations WHERE id = 7");

      await migrateBooks(db);
      expect((await db.query<{ projection_hash: string | null }>(
        "SELECT projection_hash FROM audit_revisions ORDER BY revision DESC LIMIT 1",
      )).rows).toEqual([{ projection_hash: null }]);

      const status = await ingestBooks(db, reinstated, compileHousehold(reinstated), {
        previous: reinstated,
        incremental: true,
        auditHash: reinstated.booksAcceptedHash!,
      });
      expect(status.writeMode).toBe("full");
      expect(status.compactionReason).toBe("untrusted-previous");
      expect((await db.query<{ debit_cents: number; credit_cents: number }>(
        "SELECT debit_cents, credit_cents FROM journal_lines WHERE entry_id = $1 AND account_id = $2",
        [`JE-${reinstatementId}`, "PL-SUB-FOOD-GROCERIES"],
      )).rows).toEqual([{ debit_cents: 1250, credit_cents: 0 }]);
      expect((await db.query("SELECT id FROM schema_migrations WHERE id = 7")).rows).toEqual([{ id: 7 }]);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("invalidates a pre-v8 derived projection without deleting the accepted snapshot", async () => {
    const household = catalogHousehold();
    const accepted = { ...household, booksAcceptedHash: await hashBooksSnapshot(household) };
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, accepted);
      const snapshotBefore = (await db.query<{ payload: string }>(
        "SELECT payload FROM household_snapshots WHERE household_id = $1",
        [accepted.householdId],
      )).rows[0]?.payload;
      await db.query("DELETE FROM schema_migrations WHERE id = 8");

      await migrateBooks(db);

      expect((await db.query<{ projection_hash: string | null }>(
        "SELECT projection_hash FROM audit_revisions ORDER BY revision DESC LIMIT 1",
      )).rows).toEqual([{ projection_hash: null }]);
      expect((await db.query<{ payload: string }>(
        "SELECT payload FROM household_snapshots WHERE household_id = $1",
        [accepted.householdId],
      )).rows[0]?.payload).toBe(snapshotBefore);
      expect((await db.query("SELECT id FROM schema_migrations WHERE id = 8")).rows).toEqual([{ id: 8 }]);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("periodically compacts incremental receipts with the full rebuild path", async () => {
    let previous = catalogHousehold();
    previous = { ...previous, booksAcceptedHash: await hashBooksSnapshot(previous) };
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, previous);
      const anchored = await db.query<{ projection_hash: string }>(
        "SELECT projection_hash FROM audit_revisions ORDER BY revision DESC LIMIT 1",
      );
      const projectionHash = anchored.rows[0]!.projection_hash;
      for (let receipt = 2; receipt <= 64; receipt += 1) {
        await db.query(
          "INSERT INTO audit_revisions (id, household_id, revision, at, snapshot_hash, projection_hash, entry_count, debit_cents, credit_cents, in_balance) VALUES ($1,$2,$3,$4,$5,$6,0,0,0,true)",
          [`TEST-${receipt}`, previous.householdId, previous.revision, `2020-01-01T00:00:${String(receipt % 60).padStart(2, "0")}.000Z`, previous.booksAcceptedHash, projectionHash],
        );
      }
      const next = { ...previous, revision: previous.revision + 1, name: "Compacted" };
      const status = await ingestBooks(db, next, compileHousehold(next), {
        previous,
        incremental: true,
      });
      expect(status.writeMode).toBe("full");
      expect(status.compactionReason).toBe("periodic-compaction");
      expect((await db.query("SELECT id FROM audit_revisions")).rows).toHaveLength(1);
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
