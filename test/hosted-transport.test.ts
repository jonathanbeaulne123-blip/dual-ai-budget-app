import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  catalogHousehold,
  emptyHousehold,
  applyHearthPass,
  makeHearthPass,
  postEntry,
  seedDemoHousehold,
} from "../src/core/index.ts";
import {
  bundledSupabaseConfig,
  pushSupabaseHousehold,
  hostedTransportAllowed,
} from "../src/ledger/supabase.ts";
import {
  getBrowserBooks,
  ingestHouseholdBooks,
  inspectBrowserBooks,
  resetBrowserBooksForTests,
} from "../src/ledger/engine.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("D-110 local-first sharing", () => {
  it("forbids transport unless linked is exactly true", () => {
    expect(hostedTransportAllowed(emptyHousehold())).toBe(false);
    expect(hostedTransportAllowed(catalogHousehold())).toBe(false);
    expect(hostedTransportAllowed(seedDemoHousehold())).toBe(false);
    expect(hostedTransportAllowed({ linked: true })).toBe(true);
  });

  it("D-143: linked alone does not publish without continuity identity or legacy opt-in", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const config = bundledSupabaseConfig();
    const linked = { ...catalogHousehold(), linked: true as const };
    const skipped = await pushSupabaseHousehold(linked, config);
    expect(skipped.skipped).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("D-143: explicit legacyLinkedPublish still reaches Development transport", async () => {
    const linked = { ...catalogHousehold(), linked: true as const };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("households?select=id") || url.includes("household_snapshots?")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("rpc/publish_household_snapshot") || url.includes("rpc/hearth_create_household")) {
        return new Response(JSON.stringify({
          code: "PGRST202",
          message: "Could not find the function",
        }), { status: 404 });
      }
      if ((init?.method || "GET") === "POST") {
        return new Response(null, { status: 201 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));
    const result = await pushSupabaseHousehold(linked, bundledSupabaseConfig(), { legacyLinkedPublish: true });
    expect(result.skipped).toBe(false);
    expect(result.schema).toBe(true);
  });

  it("does not treat a Hearth Pass household as linked transport", () => {
    const pass = makeHearthPass(catalogHousehold());
    const joined = applyHearthPass(null, pass);
    expect(joined.linked).toBe(false);
    expect(hostedTransportAllowed(joined)).toBe(false);
  });

  it("makes zero household REST calls for demo, empty, unlinked, and Pass households", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const config = bundledSupabaseConfig();
    const demo = catalogHousehold();
    const empty = emptyHousehold("development");
    const fromPass = applyHearthPass(null, makeHearthPass(demo));
    const unlinked = { ...demo, linked: false };
    for (const household of [demo, empty, fromPass, unlinked, seedDemoHousehold()]) {
      const result = await pushSupabaseHousehold(household, config);
      expect(result.skipped).toBe(true);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ingests local books without fetching and without writing linked true", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await resetBrowserBooksForTests();
    const household = catalogHousehold();
    expect(household.linked).toBe(false);
    await ingestHouseholdBooks(household);
    expect(household.linked).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("detects different financial facts even when the journal entry count matches", async () => {
    await resetBrowserBooksForTests();
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    await ingestHouseholdBooks(posted);
    expect((await inspectBrowserBooks(posted)).ok).toBe(true);
    const transaction = posted.transactions.at(-1)!;
    const changed = {
      ...posted,
      transactions: posted.transactions.map((row) =>
        row.id === transaction.id
          ? {
              ...row,
              amountCents: transaction.amountCents + 1,
              splits: row.splits.map((split, index) =>
                index === row.splits.length - 1 ? { ...split, amountCents: split.amountCents + 1 } : split,
              ),
            }
          : row,
      ),
    };
    const inspection = await inspectBrowserBooks(changed);
    expect(inspection.ok).toBe(false);
    expect(inspection.issue, inspection.message).toBe("projection-mismatch");
    expect(inspection.entryCount).toBe(posted.transactions.length);
  });

  it("detects a changed non-journal SQL row against the v4 projection receipt", async () => {
    await resetBrowserBooksForTests();
    const household = catalogHousehold();
    await ingestHouseholdBooks(household);
    const db = await getBrowserBooks("development");
    await db.query(
      "INSERT INTO activity (id, household_id, at, action, summary) VALUES ($1,$2,$3,$4,$5)",
      ["ACT-TAMPER", household.householdId, "2026-08-30T12:00:00.000Z", "tamper", "extra row"],
    );
    const inspection = await inspectBrowserBooks(household);
    expect(inspection.ok).toBe(false);
    expect(inspection.issue, inspection.message).toBe("projection-mismatch");
  });

  it("marks a legacy receipt without projection proof for Startup P1 repair", async () => {
    await resetBrowserBooksForTests();
    const household = catalogHousehold();
    await ingestHouseholdBooks(household);
    const db = await getBrowserBooks("development");
    await db.query("UPDATE audit_revisions SET projection_hash = NULL");
    const inspection = await inspectBrowserBooks(household);
    expect(inspection.ok).toBe(false);
    expect(inspection.issue, inspection.message).toBe("incomplete-migration");
  });

  it("reuses the latest matching financial receipt for a metadata-only revision", async () => {
    await resetBrowserBooksForTests();
    const accepted = catalogHousehold();
    await ingestHouseholdBooks(accepted);
    const metadataOnly = {
      ...accepted,
      revision: accepted.revision + 1,
      devices: [{
        id: "device-startup-p1",
        label: "Kitchen tablet",
        memberId: "MEM-002",
        environment: "development" as const,
        seenAt: "2026-08-30T12:00:00.000Z",
        updatedAt: "2026-08-30T12:00:00.000Z",
        active: true,
      }],
    };

    const inspection = await inspectBrowserBooks(metadataOnly);
    expect(inspection.ok, inspection.message).toBe(true);
    expect(inspection.entryCount).toBe(accepted.transactions.length);
  });

  it("acceptHouseholdWrite verifies PGlite against the canonical financial hash; entry count alone never accepts", async () => {
    await resetBrowserBooksForTests();
    const { acceptHouseholdWrite } = await import("../src/core/commandRuntime.ts");
    const { financialAuditHash } = await import("../src/core/commandIdentity.ts");
    const { hashBooksSnapshot } = await import("../src/ledger/engine.ts");
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    const accepted = await acceptHouseholdWrite({
      previous: null,
      candidate: posted,
      confirmationId: "CONF-PULL-ACCEPT-1",
      commandKind: "continuity-pull",
      postedIds: [],
      adapters: {
        persist: async () => undefined,
        ingest: async (household) => {
          const { status } = await ingestHouseholdBooks(household);
          return { ok: status.ok, error: status.error };
        },
        verifyBooks: async (household) => {
          const inspection = await inspectBrowserBooks(household);
          return { ok: inspection.ok, error: inspection.ok ? undefined : inspection.message };
        },
      },
    });
    expect(accepted.ok).toBe(true);
    const canonical = await financialAuditHash(accepted.household);
    expect(accepted.household.booksAcceptedHash).toBe(canonical);
    expect(await hashBooksSnapshot(accepted.household)).toBe(canonical);
    expect((await inspectBrowserBooks(accepted.household)).ok).toBe(true);

    const transaction = accepted.household.transactions.at(-1)!;
    const mutated = {
      ...accepted.household,
      transactions: accepted.household.transactions.map((row) =>
        row.id === transaction.id
          ? {
              ...row,
              amountCents: transaction.amountCents + 100,
              splits: row.splits.map((split, index) =>
                index === row.splits.length - 1 ? { ...split, amountCents: split.amountCents + 100 } : split,
              ),
            }
          : row,
      ),
    };
    expect(mutated.transactions.length).toBe(accepted.household.transactions.length);
    expect(await financialAuditHash(mutated)).not.toBe(canonical);
    const inspection = await inspectBrowserBooks(mutated);
    expect(inspection.ok).toBe(false);
    expect(inspection.issue, inspection.message).toBe("projection-mismatch");
    expect(inspection.entryCount).toBe(accepted.household.transactions.length);
  });

  it("keeps boot on inspect/ingest, not the deprecated combined sync", () => {
    const app = readFileSync(fileURLToPath(new URL("../src/App.tsx", import.meta.url)), "utf8");
    const engine = readFileSync(fileURLToPath(new URL("../src/ledger/engine.ts", import.meta.url)), "utf8");
    expect(app).toContain("inspectBrowserBooks");
    expect(app).toContain("ingestHouseholdBooks");
    expect(app).toContain("commandKind: \"boot-reconcile\"");
    expect(app).not.toContain("saveHousehold(reconciled)");
    expect(app).not.toContain("syncHouseholdBooks");
    expect(engine).not.toMatch(/pushSupabaseHousehold\(\{\s*\.\.\.household,\s*linked:\s*true\s*\}\)/);
    expect(engine).toContain("if (!hostedTransportAllowed(household))");
  });
});
