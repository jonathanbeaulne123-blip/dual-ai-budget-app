import { describe, expect, it } from "vitest";
import { ingestBooks, openMemoryBooks } from "../src/ledger/engine.ts";
import { probeHostedDatabases } from "../src/ledger/hosts.ts";
import { catalogHousehold, postEntry } from "../src/core/index.ts";

async function bakeSqliteMemory() {
  try {
    const sqlite = await import("node:sqlite");
    const db = new sqlite.DatabaseSync(":memory:");
    db.exec(`
    CREATE TABLE journal_lines (
      debit_cents INTEGER NOT NULL CHECK (debit_cents >= 0),
      credit_cents INTEGER NOT NULL CHECK (credit_cents >= 0),
      CHECK (debit_cents = 0 OR credit_cents = 0),
      CHECK (debit_cents + credit_cents > 0)
    );
  `);
    db.exec("INSERT INTO journal_lines (debit_cents, credit_cents) VALUES (1250, 0), (0, 1250);");
    const row = db.prepare("SELECT SUM(debit_cents) AS debit, SUM(credit_cents) AS credit FROM journal_lines").get() as { debit: number; credit: number };
    db.close();
    return { ok: row.debit === row.credit && row.debit === 1250, debit: row.debit, credit: row.credit };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    if (message.includes("node:sqlite")) return null;
    throw caught;
  }
}

describe("ledger host bakeoff", () => {
  it("balances the same $12.50 grocery posting in PGlite and in node:sqlite", async () => {
    const sqlite = await bakeSqliteMemory();
    if (sqlite) {
      expect(sqlite.ok).toBe(true);
      expect(sqlite.debit).toBe(1250);
    }

    const household = postEntry(catalogHousehold(), {
      date: "2026-08-18",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
    }).household;
    const db = await openMemoryBooks();
    try {
      const status = await ingestBooks(db, household);
      expect(status.ok).toBe(true);
      const version = await db.query<{ v: string }>("SELECT current_setting('server_version') AS v");
      expect(version.rows[0]?.v).toMatch(/^18/);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("treats Cloudflare as a static host and prefers Postgres", async () => {
    const hosts = await probeHostedDatabases();
    const pglite = hosts.find((host) => host.id === "pglite");
    const supabase = hosts.find((host) => host.id === "supabase");
    const cloudflare = hosts.find((host) => host.id === "cloudflare-workers");
    expect(pglite?.ledgerFit).toBe("primary");
    expect(cloudflare?.ledgerFit).toBe("static-host");
    expect(supabase?.ledgerFit).toBe("production-target");
    expect(hosts.some((host) => host.id === "netlify-blobs")).toBe(false);
  });
});
