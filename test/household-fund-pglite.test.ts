import { describe, expect, it } from "vitest";
import {
  addAccount,
  bindHouseholdFundBackingAccount,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  postEntry,
  proposeHouseholdFundContribution,
  recordHouseholdFundReconciliation,
} from "../src/core/index.ts";
import { hashBooksSnapshot, ingestBooks, migrateBooks, openMemoryBooks } from "../src/ledger/engine.ts";
import { compileHousehold } from "../src/core/journal.ts";

describe("Household Fund PGlite projection", () => {
  it("persists constrained shared events and custodian-only reconciliation facts without creating a chart account", async () => {
    let household = configureHouseholdFund(catalogHousehold(), {
      custodianMemberId: "MEM-001",
      createdBy: "MEM-001",
      openedOn: "2026-09-01",
    }).household;
    const proposal = proposeHouseholdFundContribution(household, {
      memberId: "MEM-002",
      contributorMemberId: "MEM-002",
      amount: "1000",
      date: "2026-09-01",
    });
    household = confirmHouseholdFundContribution(proposal.household, { memberId: "MEM-001", proposalEventId: proposal.postedIds[0]! }).household;
    household = postEntry(household, {
      date: "2026-09-02", type: "expense", amount: "40", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: "MEM-002", visibility: "household", confirmDuplicate: true,
      funding: { fundId: "FUND-HOUSEHOLD", fundedCents: 4000, destinationAccountId: "ACC-VISA" },
    }).household;
    household = addAccount(household, { name: "Private savings", kind: "savings", scope: "personal", ownerMemberId: "MEM-001" }).household;
    const privateSavings = household.accounts.find((row) => row.name === "Private savings")!;
    household = bindHouseholdFundBackingAccount(household, { memberId: "MEM-001", accountId: privateSavings.id }).household;
    household = recordHouseholdFundReconciliation(household, { memberId: "MEM-001", date: "2026-09-07", bankTotal: "3000", personalRemainder: "2000" }).household;

    const db = await openMemoryBooks();
    try {
      expect((await ingestBooks(db, household)).ok).toBe(true);
      expect((await db.query("SELECT id, mode FROM household_funds")).rows).toEqual([{ id: "FUND-HOUSEHOLD", mode: "practice" }]);
      expect((await db.query<{ kind: string }>("SELECT kind FROM fund_events ORDER BY kind")).rows.map((row) => row.kind)).toEqual([
        "contribution-confirmed", "contribution-proposed", "purchase-funded", "reconciliation-recorded",
      ]);
      expect((await db.query("SELECT bank_total_cents, personal_remainder_cents, tied FROM fund_private_reconciliations")).rows).toEqual([
        { bank_total_cents: 300000, personal_remainder_cents: 200000, tied: true },
      ]);
      expect((await db.query("SELECT id FROM chart_accounts WHERE id = 'FUND-HOUSEHOLD'")).rows).toEqual([]);
      expect((await db.query("SELECT scope FROM chart_accounts WHERE bank_account_id = $1", [privateSavings.id])).rows).toEqual([{ scope: "personal" }]);
      expect((await db.query("SELECT id FROM schema_migrations WHERE id >= 3 ORDER BY id")).rows).toEqual([{ id: 3 }, { id: 4 }, { id: 5 }]);

      const previous = { ...household, booksAcceptedHash: await hashBooksSnapshot(household) };
      const proposed = proposeHouseholdFundContribution(previous, {
        memberId: "MEM-002",
        contributorMemberId: "MEM-002",
        amount: "25",
        date: "2026-09-08",
      }).household;
      const nextDraft = { ...proposed, revision: previous.revision + 1 };
      const next = { ...nextDraft, booksAcceptedHash: await hashBooksSnapshot(nextDraft) };
      const status = await ingestBooks(db, next, compileHousehold(next), { previous, incremental: true });
      expect(status.writeMode).toBe("incremental");

      const rebuilt = await openMemoryBooks();
      try {
        await ingestBooks(rebuilt, next);
        for (const table of [
          "household_funds", "fund_month_plans", "fund_events", "fund_settlement_allocations",
          "fund_kitty_allocations", "fund_bank_bindings", "fund_private_reconciliations",
        ]) {
          expect((await db.query(`SELECT * FROM ${table} ORDER BY 1`)).rows, table)
            .toEqual((await rebuilt.query(`SELECT * FROM ${table} ORDER BY 1`)).rows);
        }
      } finally {
        await rebuilt.close();
      }
    } finally {
      await db.close();
    }
  }, 30_000);

  it("upgrades a persisted schema-2 account catalog before adding Fund tables", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = await PGlite.create();
    try {
      await db.exec(`
        CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
        INSERT INTO schema_migrations (id, applied_at) VALUES (1, '2026-08-01T00:00:00.000Z'), (2, '2026-08-02T00:00:00.000Z');
        CREATE TABLE households (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, timezone TEXT NOT NULL, currency TEXT NOT NULL,
          environment TEXT NOT NULL, invite_phrase TEXT NOT NULL, linked BOOLEAN NOT NULL DEFAULT FALSE,
          revision INTEGER NOT NULL DEFAULT 0, last_committed_at TEXT
        );
        CREATE TABLE chart_accounts (
          id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
          code TEXT NOT NULL, name TEXT NOT NULL, account_type TEXT NOT NULL, normal_balance TEXT NOT NULL,
          source TEXT NOT NULL, bank_account_id TEXT, category_id TEXT, owner_member_id TEXT,
          active BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE (household_id, code)
        );
        INSERT INTO households (id,name,timezone,currency,environment,invite_phrase) VALUES ('HH-OLD','Old books','America/Toronto','CAD','development','OLD-PHRASE');
        INSERT INTO chart_accounts (id,household_id,code,name,account_type,normal_balance,source) VALUES ('CA-OLD','HH-OLD','1000','Existing cash','asset','debit','bank');
      `);
      await migrateBooks(db);
      expect((await db.query("SELECT scope FROM chart_accounts WHERE id = 'CA-OLD'")).rows).toEqual([{ scope: "shared" }]);
      expect((await db.query("SELECT id FROM schema_migrations ORDER BY id")).rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
      expect((await db.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_name IN ('household_funds','fund_events','fund_settlement_allocations','fund_private_reconciliations') ORDER BY table_name")).rows.map((row) => row.table_name)).toEqual([
        "fund_events", "fund_private_reconciliations", "fund_settlement_allocations", "household_funds",
      ]);
    } finally {
      await db.close();
    }
  }, 30_000);
});
