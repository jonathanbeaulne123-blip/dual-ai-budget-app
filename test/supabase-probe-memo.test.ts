import { afterEach, describe, expect, it, vi } from "vitest";
import { probeSupabase, resetSupabaseProbeMemo } from "../src/ledger/supabase.ts";

const config = { url: "https://tykhocwacaxwquhynkok.supabase.co", key: "sb_publishable_test" };

afterEach(() => {
  vi.unstubAllGlobals();
  resetSupabaseProbeMemo();
});

/**
 * probeSupabase used to run before every command, costing one round trip per
 * money action. Only the healthy answer is memoised; every unhealthy answer
 * must keep re-probing so a migrating project or an expired token recovers.
 */
describe("supabase probe memo", () => {
  const okFetch = () => vi.fn(async () => new Response(JSON.stringify([{ id: "H-1" }]), { status: 200 }));

  it("probes the network once for repeated healthy calls", async () => {
    const fetch = okFetch();
    vi.stubGlobal("fetch", fetch);
    const first = await probeSupabase(config);
    const second = await probeSupabase(config);
    const third = await probeSupabase(config);
    expect(first.schema).toBe(true);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("re-probes a different session's token rather than reusing the answer", async () => {
    const fetch = okFetch();
    vi.stubGlobal("fetch", fetch);
    await probeSupabase(config);
    await probeSupabase({ ...config, accessToken: "jwt-bianca" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("never memoises an auth rejection", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ message: "JWT expired" }), { status: 401 }));
    vi.stubGlobal("fetch", fetch);
    expect((await probeSupabase(config)).schema).toBe(false);
    expect((await probeSupabase(config)).schema).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("never memoises a missing table, and recovers once the migration lands", async () => {
    const missing = vi.fn(async () => new Response(
      JSON.stringify({ code: "PGRST205", message: "Could not find the table 'public.households' in the schema cache" }),
      { status: 404 },
    ));
    vi.stubGlobal("fetch", missing);
    expect((await probeSupabase(config)).schema).toBe(false);
    expect((await probeSupabase(config)).schema).toBe(false);
    expect(missing).toHaveBeenCalledTimes(2);

    // Migration applied: the next probe must see the healthy project.
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", okFetch());
    expect((await probeSupabase(config)).schema).toBe(true);
  });

  it("never memoises a transport failure", async () => {
    const boom = vi.fn(async () => { throw new Error("network down"); });
    vi.stubGlobal("fetch", boom);
    expect((await probeSupabase(config)).reachable).toBe(false);
    expect((await probeSupabase(config)).reachable).toBe(false);
    expect(boom).toHaveBeenCalledTimes(2);
  });
});
