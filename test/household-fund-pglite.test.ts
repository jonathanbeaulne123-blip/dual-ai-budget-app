import { describe, expect, it } from "vitest";
import {
  addAccount,
  bindHouseholdFundBackingAccount,
  catalogHousehold,
  configureHouseholdFund,
  confirmHouseholdFundContribution,
  holdHouseholdFundContribution,
  postEntry,
  proposeHouseholdFundContribution,
  recordHouseholdFundReconciliation,
} from "../src/core/index.ts";
import { hashBooksSnapshot, ingestBooks, migrateBooks, openMemoryBooks } from "../src/ledger/engine.ts";
import { compileHousehold } from "../src/core/journal.ts";
import { BOOKS_SCHEMA } from "../src/ledger/schema.ts";

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
    household = holdHouseholdFundContribution(proposal.household, {
      memberId: "MEM-001",
      proposalEventId: proposal.postedIds[0]!,
      note: "Check the rent total first.",
      date: "2026-09-01",
    }).household;
    household = confirmHouseholdFundContribution(household, { memberId: "MEM-001", proposalEventId: proposal.postedIds[0]! }).household;
    household = postEntry(household, {
      date: "2026-09-02", type: "expense", amount: "40", accountId: "ACC-VISA", subcategoryId: "SUB-FOOD-GROCERIES",
      createdBy: "MEM-001", visibility: "household", confirmDuplicate: true,
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
        "contribution-confirmed", "contribution-held", "contribution-proposed", "purchase-funded", "reconciliation-recorded",
      ]);
      expect((await db.query("SELECT bank_total_cents, personal_remainder_cents, tied FROM fund_private_reconciliations")).rows).toEqual([
        { bank_total_cents: 300000, personal_remainder_cents: 200000, tied: true },
      ]);
      expect((await db.query("SELECT id FROM chart_accounts WHERE id = 'FUND-HOUSEHOLD'")).rows).toEqual([]);
      expect((await db.query("SELECT scope FROM chart_accounts WHERE bank_account_id = $1", [privateSavings.id])).rows).toEqual([{ scope: "personal" }]);
      expect((await db.query("SELECT id FROM schema_migrations WHERE id >= 3 ORDER BY id")).rows).toEqual([{ id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }, { id: 8 }]);

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
      expect((await db.query("SELECT id FROM schema_migrations ORDER BY id")).rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }, { id: 8 }]);
      expect((await db.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_name IN ('household_funds','fund_events','fund_settlement_allocations','fund_private_reconciliations') ORDER BY table_name")).rows.map((row) => row.table_name)).toEqual([
        "fund_events", "fund_private_reconciliations", "fund_settlement_allocations", "household_funds",
      ]);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("upgrades a persisted schema-5 Fund constraint before writing a Hold", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = await PGlite.create();
    const schemaFive = BOOKS_SCHEMA.replace(
      "'contribution-proposed','contribution-held','contribution-hold-released','contribution-withdrawn','contribution-confirmed'",
      "'contribution-proposed','contribution-confirmed'",
    );
    try {
      await db.exec(schemaFive);
      await db.exec(`
        INSERT INTO schema_migrations (id, applied_at) VALUES
          (1, '2026-08-01T00:00:00.000Z'),
          (2, '2026-08-02T00:00:00.000Z'),
          (3, '2026-08-03T00:00:00.000Z'),
          (4, '2026-08-04T00:00:00.000Z'),
          (5, '2026-08-05T00:00:00.000Z');
        INSERT INTO households (id,name,timezone,currency,environment,invite_phrase)
          VALUES ('HH-HELD-V5','Held migration','America/Toronto','CAD','development','HELD-V5');
        INSERT INTO household_funds (id,household_id,name,custodian_member_id,mode,opened_on,created_at,updated_at)
          VALUES ('FUND-HOUSEHOLD','HH-HELD-V5','Hearth Household Fund','MEM-001','practice','2026-09-01','2026-09-01T12:00:00.000Z','2026-09-01T12:00:00.000Z');
        INSERT INTO fund_events (
          id,household_id,fund_id,kind,amount_cents,date_key,created_by,confirmed_by_member_id,
          contributor_member_id,destination_account_id,related_event_id,related_transaction_ids,
          evidence_digests,reconciliation_tied,note,created_at,updated_at
        ) VALUES (
          'FUND-EVT-PROPOSAL','HH-HELD-V5','FUND-HOUSEHOLD','contribution-proposed',31000,'2026-09-01','MEM-002',NULL,
          'MEM-002',NULL,NULL,'[]','[]',NULL,'','2026-09-01T12:00:00.000Z','2026-09-01T12:00:00.000Z'
        );
      `);

      await migrateBooks(db);
      await db.exec(`
        INSERT INTO fund_events (
          id,household_id,fund_id,kind,amount_cents,date_key,created_by,confirmed_by_member_id,
          contributor_member_id,destination_account_id,related_event_id,related_transaction_ids,
          evidence_digests,reconciliation_tied,note,created_at,updated_at
        ) VALUES (
          'FUND-EVT-HOLD','HH-HELD-V5','FUND-HOUSEHOLD','contribution-held',31000,'2026-09-02','MEM-001',NULL,
          'MEM-002',NULL,'FUND-EVT-PROPOSAL','[]','[]',NULL,'Check the rent total first.','2026-09-02T12:00:00.000Z','2026-09-02T12:00:00.000Z'
        );
      `);
      expect((await db.query("SELECT id, kind, note FROM fund_events WHERE id = 'FUND-EVT-HOLD'")).rows)
        .toEqual([{ id: "FUND-EVT-HOLD", kind: "contribution-held", note: "Check the rent total first." }]);
      expect((await db.query("SELECT id FROM schema_migrations ORDER BY id")).rows)
        .toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }, { id: 8 }]);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("appends equity to a persisted net-worth view without discarding accepted journal rows", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = await PGlite.create();
    const legacyBooksSchema = BOOKS_SCHEMA
      .replace(/^\s*SUM\(CASE WHEN account_type = 'equity' THEN -net_cents ELSE 0 END\) AS equity_cents,?\r?\n/m, "")
      .replace(/AS net_income_cents,\r?\n/, "AS net_income_cents\n")
      .replace("'expense', 'income', 'transfer', 'refund', 'opening'", "'expense', 'income', 'transfer', 'refund'");
    try {
      expect(legacyBooksSchema).not.toContain("AS equity_cents");
      await db.exec(legacyBooksSchema);
      await db.exec(`
        INSERT INTO schema_migrations (id, applied_at) VALUES
          (1, '2026-08-01T00:00:00.000Z'),
          (2, '2026-08-02T00:00:00.000Z'),
          (3, '2026-08-03T00:00:00.000Z'),
          (4, '2026-08-04T00:00:00.000Z');
        INSERT INTO households (id,name,timezone,currency,environment,invite_phrase)
          VALUES ('HH-LEGACY-VIEW','Existing books','America/Toronto','CAD','development','LEGACY-VIEW');
        INSERT INTO chart_accounts (id,household_id,code,name,account_type,normal_balance,source)
          VALUES
            ('CA-LEGACY-CASH','HH-LEGACY-VIEW','1000','Existing cash','asset','debit','bank'),
            ('CA-LEGACY-EQUITY','HH-LEGACY-VIEW','3000','Opening equity','equity','credit','equity');
        INSERT INTO journal_entries (id,household_id,date_key,memo,source,visibility,created_by)
          VALUES ('JE-LEGACY','HH-LEGACY-VIEW','2026-08-01','Existing opening','opening','household','MEM-001');
        INSERT INTO journal_lines (id,household_id,entry_id,line_no,account_id,debit_cents,credit_cents,party_id)
          VALUES
            ('JL-LEGACY-1','HH-LEGACY-VIEW','JE-LEGACY',1,'CA-LEGACY-CASH',12345,0,'MEM-001'),
            ('JL-LEGACY-2','HH-LEGACY-VIEW','JE-LEGACY',2,'CA-LEGACY-EQUITY',0,12345,'MEM-001');
      `);

      const beforeColumns = await db.query<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'v_net_worth'
        ORDER BY ordinal_position
      `);
      expect(beforeColumns.rows.map((row) => row.column_name)).toEqual([
        "household_id", "asset_cents", "liability_cents", "income_cents", "expense_cents",
        "net_worth_cents", "net_income_cents",
      ]);

      await migrateBooks(db);

      const afterColumns = await db.query<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'v_net_worth'
        ORDER BY ordinal_position
      `);
      expect(afterColumns.rows.map((row) => row.column_name)).toEqual([
        "household_id", "asset_cents", "liability_cents", "income_cents", "expense_cents",
        "net_worth_cents", "net_income_cents", "equity_cents",
      ]);
      expect((await db.query("SELECT id, name FROM households WHERE id = 'HH-LEGACY-VIEW'")).rows)
        .toEqual([{ id: "HH-LEGACY-VIEW", name: "Existing books" }]);
      expect((await db.query("SELECT id FROM journal_lines WHERE entry_id = 'JE-LEGACY' ORDER BY line_no")).rows)
        .toEqual([{ id: "JL-LEGACY-1" }, { id: "JL-LEGACY-2" }]);
      const equation = await db.query<{ net_worth_cents: number; net_income_cents: number; equity_cents: number }>(
        "SELECT net_worth_cents, net_income_cents, equity_cents FROM v_net_worth WHERE household_id = 'HH-LEGACY-VIEW'",
      );
      expect(equation.rows.map((row) => ({
        net_worth_cents: Number(row.net_worth_cents),
        net_income_cents: Number(row.net_income_cents),
        equity_cents: Number(row.equity_cents),
      }))).toEqual([{ net_worth_cents: 12345, net_income_cents: 0, equity_cents: 12345 }]);
      expect((await db.query("SELECT id FROM schema_migrations ORDER BY id")).rows)
        .toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }, { id: 8 }]);
    } finally {
      await db.close();
    }
  }, 30_000);
});
