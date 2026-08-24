import { describe, expect, it, vi, afterEach } from "vitest";
import {
  acceptHouseholdWrite,
  catalogHousehold,
  compileHousehold,
  emptyHousehold,
  makeHouseholdExport,
  postEntry,
  runHealthCheck,
  validateHouseholdImport,
  type Household,
  type WriteAdapters,
} from "../src/core/index.ts";
import { booksEquation, trialBalance } from "../src/core/journal.ts";
import { auditOpinion, balanceSheet } from "../src/core/statements.ts";
import { ingestBooks, openMemoryBooks, resetBrowserBooksForTests } from "../src/ledger/engine.ts";
import { bundledSupabaseConfig, pushSupabaseHousehold } from "../src/ledger/supabase.ts";
import { applyHearthPass, makeHearthPass } from "../src/core/pass.ts";
import { unlinkHousehold } from "../src/core/sharing.ts";

function grocery(note: string, amount = "4.00") {
  return {
    date: "2026-08-24" as const,
    type: "expense" as const,
    amount,
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note,
    createdBy: "MEM-001",
    confirmDuplicate: true,
  };
}

function memoryAdapters(options?: {
  ingestOk?: boolean;
  persistOk?: boolean;
  transport?: WriteAdapters["transport"];
}) {
  let persisted: Household | null = null;
  let ingested: Household | null = null;
  let ingestCount = 0;
  const adapters: WriteAdapters = {
    persist: async (household) => {
      if (options?.persistOk === false) throw new Error("disk full");
      persisted = household;
    },
    ingest: async (household) => {
      ingestCount += 1;
      if (options?.ingestOk === false) return { ok: false, error: "PGlite refused the journal." };
      ingested = household;
      return { ok: true };
    },
    restoreIngest: async (household) => {
      ingested = household;
    },
    transport: options?.transport,
  };
  return { adapters, persisted: () => persisted, ingested: () => ingested, ingestCount: () => ingestCount };
}

describe("trust-foundation proof matrix", () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetBrowserBooksForTests();
  });

  it("1. posts a balanced command exactly once into PGlite", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Milk"));
    const db = await openMemoryBooks();
    const store = memoryAdapters({
      transport: async () => ({ ok: true }),
    });
    store.adapters.ingest = async (household) => {
      const status = await ingestBooks(db, household);
      return { ok: status.ok, error: status.error };
    };
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "proof-milk",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.postedExactlyOnce).toBe(true);
    const compiled = compileHousehold(outcome.household);
    expect(trialBalance(compiled).inBalance).toBe(true);
    expect(booksEquation(compiled).holds).toBe(true);
  });

  it("2-5. invalid, unbalanced, ingest, and persist failures change nothing", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Bread"));
    const invalid = await acceptHouseholdWrite({
      previous,
      candidate: { ...previous, environment: "production" },
      confirmationId: "proof-invalid",
      adapters: memoryAdapters().adapters,
    });
    expect(invalid.postedNothing).toBe(true);
    expect(invalid.ok).toBe(false);

    const last = posted.household.transactions.at(-1)!;
    const skewed = {
      ...posted.household,
      transactions: posted.household.transactions.map((row) =>
        row.id === last.id ? { ...row, amountCents: last.amountCents + 1 } : row,
      ),
    };
    const unbalancedStore = memoryAdapters();
    const unbalanced = await acceptHouseholdWrite({
      previous,
      candidate: skewed,
      confirmationId: "proof-unbalanced",
      postedIds: posted.postedIds,
      adapters: unbalancedStore.adapters,
    });
    expect(unbalanced.postedNothing).toBe(true);
    expect(unbalancedStore.persisted()).toBeNull();
    expect(unbalancedStore.ingested()).toBeNull();

    const ingestFail = memoryAdapters({ ingestOk: false });
    const ingestOutcome = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "proof-ingest",
      postedIds: posted.postedIds,
      adapters: ingestFail.adapters,
    });
    expect(ingestOutcome.postedNothing).toBe(true);
    expect(ingestFail.persisted()).toBeNull();

    const persistFail = memoryAdapters({ persistOk: false });
    const persistOutcome = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "proof-persist",
      postedIds: posted.postedIds,
      adapters: persistFail.adapters,
    });
    expect(persistOutcome.postedNothing).toBe(true);
    expect(persistFail.ingested()?.revision).toBe(previous.revision);
  });

  it("6-7. repeated Confirm and retry after interruption post once", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Butter"));
    const store = memoryAdapters();
    const first = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "proof-butter",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    const second = await acceptHouseholdWrite({
      previous: first.household,
      candidate: posted.household,
      confirmationId: "proof-butter",
      postedIds: posted.postedIds,
      adapters: store.adapters,
    });
    expect(second.duplicateOfReceiptId).toBe("proof-butter");
    expect(first.household.commandReceipts.filter((row) => row.confirmationId === "proof-butter")).toHaveLength(1);

    const interrupted = memoryAdapters({ ingestOk: false });
    const failed = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "proof-retry",
      postedIds: posted.postedIds,
      adapters: interrupted.adapters,
    });
    expect(failed.postedNothing).toBe(true);
    const retryStore = memoryAdapters();
    const retried = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "proof-retry",
      postedIds: posted.postedIds,
      adapters: retryStore.adapters,
    });
    expect(retried.postedExactlyOnce).toBe(true);
    expect(retryStore.ingestCount()).toBe(1);
  });

  it("8-9. rejected commands and unlinked/demo/empty/Pass households never call household REST", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const previous = { ...catalogHousehold(), linked: true };
    const posted = postEntry(previous, grocery("No publish"));
    const broken = {
      ...posted.household,
      linked: true,
      transactions: posted.household.transactions.map((row, index) =>
        index === posted.household.transactions.length - 1 ? { ...row, amountCents: 1 } : row,
      ),
    };
    let published = 0;
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: broken,
      confirmationId: "proof-no-publish",
      postedIds: posted.postedIds,
      adapters: memoryAdapters({
        transport: async () => {
          published += 1;
          return { ok: true };
        },
      }).adapters,
    });
    expect(outcome.ok).toBe(false);
    expect(published).toBe(0);

    const config = bundledSupabaseConfig();
    const demo = catalogHousehold();
    const empty = emptyHousehold("development");
    const pass = applyHearthPass(null, makeHearthPass(demo));
    const unlinked = unlinkHousehold({ ...previous, linked: true });
    for (const household of [demo, empty, pass, unlinked]) {
      const result = await pushSupabaseHousehold(household, config);
      expect(result.skipped).toBe(true);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("10. stale shared writes become visible conflicts", async () => {
    const previous = { ...catalogHousehold(), linked: true, revision: 3, baseRevision: 3 };
    const posted = postEntry(previous, grocery("Coffee"));
    const remote = { ...previous, revision: 4, lastCommittedAt: "2026-08-24T12:00:00.000Z" };
    const outcome = await acceptHouseholdWrite({
      previous,
      candidate: { ...posted.household, linked: true },
      confirmationId: "proof-conflict",
      postedIds: posted.postedIds,
      adapters: memoryAdapters({
        transport: async () => ({
          ok: false,
          errorClass: "conflict-detected",
          remote,
          message: "Another phone posted a newer household snapshot. Nothing was overwritten.",
        }),
      }).adapters,
    });
    expect(outcome.kind).toBe("conflict-needs-attention");
    expect(outcome.household.conflicts.some((row) => !row.resolved)).toBe(true);
    expect(outcome.household.conflicts[0]?.localSnapshot).toBeTruthy();
    expect(outcome.household.conflicts[0]?.remoteSnapshot).toBeTruthy();
  });

  it("11-12. Development/Production stay separate and Health/statements follow accepted books", async () => {
    const development = catalogHousehold("development");
    const posted = postEntry(development, grocery("Tea"));
    const outcome = await acceptHouseholdWrite({
      previous: development,
      candidate: { ...posted.household, environment: "production" },
      confirmationId: "proof-env",
      postedIds: posted.postedIds,
      adapters: memoryAdapters().adapters,
    });
    expect(outcome.postedNothing).toBe(true);

    const accepted = await acceptHouseholdWrite({
      previous: development,
      candidate: posted.household,
      confirmationId: "proof-health",
      postedIds: posted.postedIds,
      adapters: memoryAdapters().adapters,
    });
    const compiled = compileHousehold(accepted.household);
    expect(trialBalance(compiled).inBalance).toBe(true);
    expect(booksEquation(compiled).holds).toBe(true);
    expect(balanceSheet(accepted.household).holds).toBe(true);
    expect(auditOpinion(accepted.household).trialInBalance).toBe(true);
    expect(runHealthCheck(accepted.household).some((finding) => finding.section === "Books")).toBe(false);
  });

  it("13-14. import/export round-trips accounting meaning without household credentials", async () => {
    const previous = catalogHousehold();
    const posted = postEntry(previous, grocery("Export milk"));
    const accepted = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "proof-export",
      postedIds: posted.postedIds,
      adapters: memoryAdapters().adapters,
    });
    const file = await makeHouseholdExport(accepted.household);
    const raw = JSON.stringify(file);
    expect(raw).not.toMatch(/sb_secret|DATABASE_URL|service_role/i);
    const imported = await validateHouseholdImport(raw, "development", { confirm: true });
    expect(imported.household.transactions.map((row) => row.note)).toEqual(
      accepted.household.transactions.map((row) => row.note),
    );
    expect(booksEquation(compileHousehold(imported.household)).holds).toBe(true);
    await expect(validateHouseholdImport(raw, "development", { confirm: false })).rejects.toThrow(/Confirm/);
    await expect(validateHouseholdImport(raw, "production", { confirm: true })).rejects.toThrow(/production/);
  });
});
