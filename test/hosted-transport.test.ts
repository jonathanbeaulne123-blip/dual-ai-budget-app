import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  catalogHousehold,
  emptyHousehold,
  applyHearthPass,
  makeHearthPass,
  seedDemoHousehold,
} from "../src/core/index.ts";
import {
  bundledSupabaseConfig,
  pushSupabaseHousehold,
  hostedTransportAllowed,
} from "../src/ledger/supabase.ts";
import { ingestHouseholdBooks, resetBrowserBooksForTests } from "../src/ledger/engine.ts";

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

  it("keeps boot on inspect/ingest, not the deprecated combined sync", () => {
    const app = readFileSync(fileURLToPath(new URL("../src/App.tsx", import.meta.url)), "utf8");
    const engine = readFileSync(fileURLToPath(new URL("../src/ledger/engine.ts", import.meta.url)), "utf8");
    expect(app).toContain("inspectBrowserBooks");
    expect(app).toContain("ingestHouseholdBooks");
    expect(app).not.toContain("syncHouseholdBooks");
    expect(engine).not.toMatch(/pushSupabaseHousehold\(\{\s*\.\.\.household,\s*linked:\s*true\s*\}\)/);
    expect(engine).toContain("if (!hostedTransportAllowed(household))");
  });
});
