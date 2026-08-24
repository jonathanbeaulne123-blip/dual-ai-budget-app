import { describe, expect, it, vi, afterEach } from "vitest";
import { catalogHousehold, emptyHousehold, applyHearthPass, makeHearthPass } from "../src/core/index.ts";
import { bundledSupabaseConfig, pushSupabaseHousehold, hostedTransportAllowed } from "../src/ledger/supabase.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("D-110 local-first sharing", () => {
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
    for (const household of [demo, empty, fromPass, unlinked]) {
      const result = await pushSupabaseHousehold(household, config);
      expect(result.skipped).toBe(true);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
