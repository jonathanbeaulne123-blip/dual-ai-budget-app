import { describe, expect, it, vi, afterEach } from "vitest";
import { catalogHousehold, postEntry } from "../src/core/index.ts";
import { bundledSupabaseConfig, pushSupabaseHousehold } from "../src/ledger/supabase.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hosted compare-and-swap", () => {
  it("rejects a stale linked write without posting the snapshot", async () => {
    const local = {
      ...postEntry(catalogHousehold(), {
        date: "2026-08-24",
        type: "expense",
        amount: "6.00",
        accountId: "ACC-VISA",
        subcategoryId: "SUB-FOOD-GROCERIES",
        note: "Stale coffee",
        createdBy: "MEM-001",
        confirmDuplicate: true,
      }).household,
      linked: true,
      revision: 5,
      baseRevision: 3,
    };
    const remote = { ...catalogHousehold(), linked: true, revision: 4 };
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`${init?.method || "GET"} ${url}`);
      if (url.includes("households?select=id")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("household_snapshots?")) {
        return new Response(JSON.stringify([{ payload: JSON.stringify(remote) }]), { status: 200 });
      }
      return new Response(null, { status: 201 });
    }));
    const result = await pushSupabaseHousehold(local, bundledSupabaseConfig(), { expectedRevision: 3 });
    expect(result.conflict).toBe(true);
    expect(result.remote?.revision).toBe(4);
    expect(calls.some((call) => call.startsWith("POST household_snapshots"))).toBe(false);
  });
});
