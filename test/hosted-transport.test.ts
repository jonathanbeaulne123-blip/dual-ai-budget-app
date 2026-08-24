import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { catalogHousehold, emptyHousehold, postEntry, seedDemoHousehold } from "../src/core/index.ts";
import { applyHearthPass, makeHearthPass } from "../src/core/pass.ts";
import {
  bundledSupabaseConfig,
  hostedTransportAllowed,
  pushSupabaseHousehold,
} from "../src/ledger/supabase.ts";
import { ingestHouseholdBooks, resetBrowserBooksForTests, syncHouseholdBooks } from "../src/ledger/engine.ts";

const live = bundledSupabaseConfig();

function stubFetch() {
  const fetch = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetBrowserBooksForTests();
});

describe("hosted snapshot transport is opt-in (D-110)", () => {
  it("forbids transport unless linked is exactly true", () => {
    expect(hostedTransportAllowed(emptyHousehold())).toBe(false);
    expect(hostedTransportAllowed(catalogHousehold())).toBe(false);
    expect(hostedTransportAllowed(seedDemoHousehold())).toBe(false);
    expect(hostedTransportAllowed({ linked: true })).toBe(true);
  });

  it("skips push of an unlinked household without fetching, even with bundled live config", async () => {
    const fetch = stubFetch();
    const result = await pushSupabaseHousehold(catalogHousehold(), live);
    expect(result.schema).toBe(false);
    expect(result.error).toMatch(/not linked/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ingests catalog and a money commit without fetching", async () => {
    const fetch = stubFetch();
    const posted = postEntry(catalogHousehold(), {
      date: "2026-08-21",
      type: "expense",
      amount: "12.50",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    expect(emptyHousehold().linked).toBe(false);
    expect(seedDemoHousehold().linked).toBe(false);
    for (const household of [catalogHousehold(), posted]) {
      resetBrowserBooksForTests();
      const result = await syncHouseholdBooks(household, { config: live });
      expect(result.status.hosted?.mode).toBe("local");
      expect(household.linked).toBe(false);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps ingest and publish as separate paths: boot uses ingest only", () => {
    const app = readFileSync(fileURLToPath(new URL("../src/App.tsx", import.meta.url)), "utf8");
    const engine = readFileSync(fileURLToPath(new URL("../src/ledger/engine.ts", import.meta.url)), "utf8");
    expect(app).toContain("ingestHouseholdBooks");
    expect(app).not.toContain("syncHouseholdBooks");
    expect(engine).not.toMatch(/pushSupabaseHousehold\(\{\s*\.\.\.household,\s*linked:\s*true\s*\}\)/);
    expect(engine).toContain("if (!hostedTransportAllowed(household))");
  });

  it("does not mark a Hearth Pass join as hosted", () => {
    const pass = makeHearthPass(catalogHousehold());
    const joined = applyHearthPass(null, pass, "MEM-001");
    expect(joined.linked).toBe(false);
    expect(hostedTransportAllowed(joined)).toBe(false);
  });

  it("createSharedHousehold opts the envelope in before the only publish path", () => {
    const api = readFileSync(fileURLToPath(new URL("../src/api.ts", import.meta.url)), "utf8");
    expect(api).toMatch(/createSharedHousehold[\s\S]*linked: true[\s\S]*pushSupabaseHousehold\(outgoing\)/);
    expect(api).toMatch(/pushSharedHousehold[\s\S]*linked: true[\s\S]*pushSupabaseHousehold\(outgoing\)/);
  });

  it("linked sync uses the caller mode and performs one publish after ingest", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method || "GET") === "GET" && url.includes("households?select=id")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetch);
    const household = { ...catalogHousehold(), linked: true };
    const result = await syncHouseholdBooks(household, { config: live });
    expect(result.status.hosted?.mode).toBe("published");
    const posts = fetch.mock.calls.filter((call) => String(call[1]?.method || "GET") === "POST");
    expect(posts).toHaveLength(2);
  });

  it("local ingest never writes linked true onto the household", async () => {
    const household = catalogHousehold();
    expect(household.linked).toBe(false);
    await ingestHouseholdBooks(household);
    expect(household.linked).toBe(false);
  });
});
