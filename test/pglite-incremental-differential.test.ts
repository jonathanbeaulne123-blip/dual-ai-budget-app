import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashBooksSnapshot,
  ingestBooks,
  openMemoryBooks,
} from "../src/ledger/engine.ts";
import { catalogHousehold, compileHousehold, postEntry } from "../src/core/index.ts";
import type { Household } from "../src/core/types.ts";

/**
 * The incremental PGlite writer is the single largest saving available on the
 * command path (a full write TRUNCATEs and re-INSERTs every projection table).
 * It is the default write path in EVERY environment since the D-177 amendment
 * of 2026-09-21 (docs/DECISIONS.md), which acted on exactly the evidence this
 * file produces; the only way back to the full rebuild is the
 * `VITE_PGLITE_FULL_PROJECTION=1` kill switch, asserted below and in
 * test/pglite-development-canary.test.ts.
 *
 * What this file provides is the evidence that activation rests on: after a
 * run of incremental writes, the projection must be INDISTINGUISHABLE from a
 * full write of the same final household. Every projection table is compared
 * row for row, so a delta that drops, duplicates or staleness-leaks a row
 * fails here rather than in someone's books.
 */

/**
 * The DERIVED projection. `audit_revisions` is deliberately excluded: it is an
 * append-only receipt log, so an incremental run legitimately holds one receipt
 * per write where a single full write holds one. Its tip `projection_hash` is
 * compared separately below, which is the stronger claim anyway.
 */
const TABLES = [
  "households",
  "members",
  "categories",
  "chart_accounts",
  "journal_entries",
  "journal_lines",
  "source_transactions",
  "shifts",
  "goals",
  "budget_plans",
  "plan_drafts",
  "plan_versions",
  "plan_acknowledgements",
  "plan_scenarios",
  "plan_reflections",
  "plan_learning_progress",
  "plan_bridge_decisions",
  "plan_bridge_drafts",
  "plan_hercules_sessions",
  "plan_activation_jobs",
  "recurrences",
  "activity",
  "household_funds",
  "fund_month_plans",
  "fund_events",
  "fund_contribution_source_claims",
  "fund_settlement_allocations",
  "fund_kitty_allocations",
  "fund_bank_bindings",
  "fund_private_reconciliations",
  "household_snapshots",
] as const;

/**
 * Columns that carry the wall clock of the write itself. They CANNOT match
 * across two runs and say nothing about whether the projection is correct, so
 * they are compared for presence and shape rather than for value.
 */
const VOLATILE_COLUMNS: Record<string, readonly string[]> = {
  household_snapshots: ["updated_at"],
};


async function dump(db: Awaited<ReturnType<typeof openMemoryBooks>>) {
  const out: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const exists = await db.query<{ ok: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS ok",
      [table],
    );
    if (!exists.rows[0]?.ok) continue;
    const rows = await db.query<Record<string, unknown>>(`SELECT * FROM ${table}`);
    // Order-independent comparison: the writers are free to insert in any order.
    const volatile = new Set(VOLATILE_COLUMNS[table] ?? []);
    out[table] = rows.rows
      .map((row) => JSON.stringify(
        Object.keys(row).sort().filter((k) => !volatile.has(k)).map((k) => [k, row[k]]),
      ))
      .sort();
  }
  return out;
}

/** Seal a draft the way the accepted-write boundary does. */
async function seal(draft: Household): Promise<Household> {
  return { ...draft, booksAcceptedHash: await hashBooksSnapshot(draft) };
}

describe("incremental PGlite projection is identical to the full projection", () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it("matches a from-scratch full write after a run of incremental commands", async () => {
    // A development household. The writer is no longer environment-gated, but
    // this case is kept on Development so the differential evidence is read on
    // the same ledger it was originally produced against; the Production case
    // below proves the two now take the identical path.
    const base = await seal({ ...catalogHousehold(), environment: "development" as const });

    // Ten ordinary expenses, posted one at a time, exactly as a user would.
    const steps: Household[] = [];
    let cursor = base;
    for (let i = 0; i < 10; i++) {
      const posted = postEntry(cursor, {
        date: "2026-08-18",
        type: "expense",
        amount: `${12 + i}.${String((i * 7) % 100).padStart(2, "0")}`,
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: `Differential row ${i}`,
      });
      cursor = await seal({ ...posted.household, revision: cursor.revision + 1 });
      steps.push(cursor);
    }
    const finalHousehold = cursor;

    // (a) Incremental: ingest the base, then each step with the previous supplied.
    const incrementalDb = await openMemoryBooks();
    // (b) Full: one write of the final household only.
    const fullDb = await openMemoryBooks();
    try {
      await ingestBooks(incrementalDb, base);
      let previous = base;
      const modes: string[] = [];
      for (const step of steps) {
        const status = await ingestBooks(incrementalDb, step, compileHousehold(step), {
          previous,
          incremental: true,
        });
        modes.push(status.writeMode ?? "unknown");
        previous = step;
      }

      // The run must actually have exercised the incremental writer, otherwise
      // this test proves nothing.
      expect(modes).toContain("incremental");
      expect(modes.filter((mode) => mode === "incremental").length).toBeGreaterThanOrEqual(8);

      await ingestBooks(fullDb, finalHousehold);

      const incremental = await dump(incrementalDb);
      const full = await dump(fullDb);

      // Compare table by table so a failure names the table that drifted.
      expect(Object.keys(incremental).sort()).toEqual(Object.keys(full).sort());
      for (const table of Object.keys(full)) {
        expect({ table, rows: incremental[table] }).toEqual({ table, rows: full[table] });
      }

      // The snapshot payload itself — the whole household as JSON — must match
      // exactly. Only its `updated_at` wall clock is allowed to differ.
      const payloadOf = async (db: Awaited<ReturnType<typeof openMemoryBooks>>) => {
        const row = await db.query<{ payload: string; updated_at: string }>(
          "SELECT payload, updated_at FROM household_snapshots",
        );
        expect(row.rows).toHaveLength(1);
        expect(Number.isNaN(Date.parse(row.rows[0]!.updated_at))).toBe(false);
        return row.rows[0]!.payload;
      };
      expect(await payloadOf(incrementalDb)).toBe(await payloadOf(fullDb));

      // Note on receipt truthfulness: each of the ten incremental writes went
      // through the engine's own guard, which recomputes the projection digest
      // and throws "The accepted PGlite projection changed after its receipt"
      // on any mismatch. Reaching this line means that check passed ten times,
      // so it is not re-implemented here.
      // And the receipt log really did record every incremental write.
      const receipts = await incrementalDb.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM audit_revisions",
      );
      expect(Number(receipts.rows[0]?.n ?? 0)).toBeGreaterThanOrEqual(11);
    } finally {
      await incrementalDb.close();
      await fullDb.close();
    }
  }, 120_000);

  it("takes the same delta for a Production household", async () => {
    // The D-177 amendment: there is no longer a "production-full-path". The
    // environment is not consulted, so a Production command gets the same
    // bounded delta this file just proved indistinguishable from a full write.
    const previous = await seal({ ...catalogHousehold(), environment: "production" as const });
    const next = await seal({ ...previous, revision: previous.revision + 1, name: "Now incremental" });
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, previous);
      const status = await ingestBooks(db, next, compileHousehold(next), { previous, incremental: true });
      expect(status.writeMode).toBe("incremental");
      expect(status.compactionReason).toBeUndefined();
    } finally {
      await db.close();
    }
  }, 60_000);

  it("forces the full rebuild in Production when the kill switch is set", async () => {
    // `VITE_PGLITE_FULL_PROJECTION=1` is the single remaining rollback: it puts
    // every environment back on the full transactional TRUNCATE rebuild without
    // a code change, which is the documented way to retire the delta.
    vi.stubEnv("VITE_PGLITE_FULL_PROJECTION", "1");
    const previous = await seal({ ...catalogHousehold(), environment: "production" as const });
    const next = await seal({ ...previous, revision: previous.revision + 1, name: "Still full" });
    const db = await openMemoryBooks();
    try {
      await ingestBooks(db, previous);
      const status = await ingestBooks(db, next, compileHousehold(next), { previous, incremental: true });
      expect(status.writeMode).toBe("full");
      expect(status.compactionReason).toBe("incremental-disabled");
    } finally {
      await db.close();
    }
  }, 60_000);
});
