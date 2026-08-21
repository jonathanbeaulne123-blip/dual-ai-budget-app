import { describe, expect, it, vi, afterEach } from "vitest";
import { isMissingTable, probeSupabase, pullSupabaseHousehold, pushSupabaseHousehold } from "../src/ledger/supabase.ts";
import { catalogHousehold } from "../src/core/index.ts";

const config = { url: "https://tykhocwacaxwquhynkok.supabase.co", key: "sb_publishable_test" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Supabase hosted books", () => {
  it("treats a missing table as reachable project without schema", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ code: "PGRST205", message: "Could not find the table 'public.households' in the schema cache" }),
      { status: 404 },
    )));
    const probe = await probeSupabase(config);
    expect(probe.reachable).toBe(true);
    expect(probe.schema).toBe(false);
    expect(probe.project).toBe("tykhocwacaxwquhynkok");
    expect(isMissingTable({ code: "PGRST205" })).toBe(true);
  });

  it("pulls a household snapshot by invite phrase", async () => {
    const household = catalogHousehold();
    household.inviteCode = "cedar-lantern-maple";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("invite_phrase=eq.cedar-lantern-maple");
      return new Response(JSON.stringify([{ payload: JSON.stringify(household) }]), { status: 200 });
    }));
    const pulled = await pullSupabaseHousehold("Cedar Lantern Maple", config);
    expect(pulled?.inviteCode).toBe("cedar-lantern-maple");
    expect(pulled?.linked).toBe(true);
  });

  it("replaces the household then writes a snapshot", async () => {
    const household = catalogHousehold();
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method || "GET"} ${url.replace("https://tykhocwacaxwquhynkok.supabase.co/rest/v1/", "")}`);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    }));
    const result = await pushSupabaseHousehold(household, config);
    expect(result.schema).toBe(true);
    expect(calls.some((call) => call.startsWith("DELETE households"))).toBe(true);
    expect(calls.some((call) => call.startsWith("POST household_snapshots"))).toBe(true);
  });
});
