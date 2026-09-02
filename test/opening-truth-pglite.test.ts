import { describe, expect, it } from "vitest";
import { catalogHousehold, postOpeningBalances } from "../src/core/index.ts";
import { ingestBooks, migrateBooks, openMemoryBooks } from "../src/ledger/engine.ts";

describe("opening truth PGlite projection", () => {
  it("ingests opening source rows and their balanced Opening equity journals", async () => {
    const base = catalogHousehold("development");
    base.transactions = [];
    base.shifts = [];
    const opened = postOpeningBalances(base, {
      asOfDate: "2026-09-01",
      createdBy: "MEM-001",
      confirmationId: "OPEN-PGLITE",
      lines: [
        { accountId: "ACC-CHEQUING", amountCents: 3000_00 },
        { accountId: "ACC-SAVINGS", amountCents: 5000_00 },
        { accountId: "ACC-VISA", amountCents: 400_00 },
      ],
    }).household;
    const db = await openMemoryBooks();
    try {
      const status = await ingestBooks(db, opened);
      expect(status).toMatchObject({ ok: true, entryCount: 3, inBalance: true, equationHolds: true });
      expect((await db.query<{ type: string; count: number }>("SELECT type, count(*)::bigint AS count FROM source_transactions GROUP BY type")).rows).toEqual([{ type: "opening", count: 3 }]);
      expect((await db.query("SELECT id, account_type, normal_balance FROM chart_accounts WHERE id = 'EQ-OPENING'")).rows).toEqual([
        { id: "EQ-OPENING", account_type: "equity", normal_balance: "credit" },
      ]);
      expect((await db.query<{ debit: number; credit: number }>("SELECT sum(debit_cents)::bigint AS debit, sum(credit_cents)::bigint AS credit FROM journal_lines")).rows).toEqual([
        { debit: 840000, credit: 840000 },
      ]);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("upgrades a persisted schema-3 type constraint without resetting books", async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = await PGlite.create();
    try {
      await db.exec(`
        CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
        INSERT INTO schema_migrations (id, applied_at) VALUES
          (1, '2026-08-01T00:00:00.000Z'),
          (2, '2026-08-02T00:00:00.000Z'),
          (3, '2026-08-03T00:00:00.000Z');
        CREATE TABLE source_transactions (
          id TEXT PRIMARY KEY,
          household_id TEXT NOT NULL,
          date_key TEXT NOT NULL,
          type TEXT NOT NULL CONSTRAINT source_transactions_type_check CHECK (type IN ('expense', 'income', 'transfer', 'refund'))
        );
      `);
      await migrateBooks(db);
      await db.query("INSERT INTO source_transactions (id, household_id, date_key, type) VALUES ('TXN-OPEN', 'HH-OLD', '2026-09-01', 'opening')");
      expect((await db.query("SELECT type FROM source_transactions WHERE id = 'TXN-OPEN'")).rows).toEqual([{ type: "opening" }]);
      expect((await db.query("SELECT id FROM schema_migrations ORDER BY id")).rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }]);
    } finally {
      await db.close();
    }
  }, 30_000);
});
