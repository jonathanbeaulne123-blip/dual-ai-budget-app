import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryContinuityStore,
  discoverContinuityMemberships,
  enqueueContinuitySnapshot,
  flushContinuityOutbox,
  listContinuityOutbox,
  setContinuityStore,
  transportHouseholdWithOutbox,
} from "../src/continuity.ts";
import { catalogHousehold, linkGoogleIdentity, postEntry } from "../src/core/index.ts";
import type { Household } from "../src/core/types.ts";

const config = { url: "https://continuity.example.supabase.co", key: "sb_publishable_test" };
const identity = { email: "jonathan@example.com", subject: "google-sub-jonathan" };

function googleHousehold(subject = identity.subject, email = identity.email): Household {
  return linkGoogleIdentity(catalogHousehold(), {
    memberId: "MEM-001",
    email,
    subject,
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
}

function response(body: unknown, status = 200): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  setContinuityStore(null);
  vi.unstubAllGlobals();
});

describe("Google-account continuity", () => {
  it("discovers every exact Development membership and ignores malformed or unrelated rows", async () => {
    const first = googleHousehold();
    const second = { ...googleHousehold(), householdId: "HH-SECOND", name: "Second household" };
    const unrelated = googleHousehold("someone-else", "someone@example.com");
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response([
      { payload: JSON.stringify(first), updated_at: "2026-08-24T14:00:00.000Z" },
      { payload: "{", updated_at: "2026-08-24T13:00:00.000Z" },
      { payload: JSON.stringify(unrelated), updated_at: "2026-08-24T12:00:00.000Z" },
      { payload: JSON.stringify(second), updated_at: "2026-08-24T11:00:00.000Z" },
    ]));
    vi.stubGlobal("fetch", fetch);

    const found = await discoverContinuityMemberships(identity, "development", config);
    expect(found.map((item) => item.household.householdId)).toEqual([first.householdId, "HH-SECOND"]);
    expect(found.every((item) => item.memberId === "MEM-001")).toBe(true);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("environment=eq.development");
  });

  it("does not let a matching email override a different populated Google subject", async () => {
    const wrongSubject = googleHousehold("different-google-subject", identity.email);
    const fetch = vi.fn(async () => response([{ payload: JSON.stringify(wrongSubject) }]));
    vi.stubGlobal("fetch", fetch);
    await expect(discoverContinuityMemberships(identity, "development", config)).resolves.toEqual([]);
  });

  it("does not scan Production before the Auth/RLS cutover", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(discoverContinuityMemberships(identity, "production", config)).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("compacts offline writes into one durable snapshot while preserving the earliest cloud base", () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = googleHousehold();
    const first = enqueueContinuitySnapshot({
      household,
      identity,
      expectedRevision: 3,
      confirmationId: "confirm-first",
    });
    const posted = postEntry(household, {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Offline milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const second = enqueueContinuitySnapshot({
      household: { ...posted.household, revision: 5 },
      identity,
      expectedRevision: 4,
      confirmationId: "confirm-second",
    });

    expect(first.id).toBe(second.id);
    expect(listContinuityOutbox("development")).toHaveLength(1);
    expect(second.expectedRevision).toBe(3);
    expect(second.confirmationIds).toEqual(["confirm-first", "confirm-second"]);
    expect(second.snapshot.transactions.some((row) => row.note === "Offline milk")).toBe(true);
    expect(JSON.stringify(second)).not.toMatch(/accessToken|Bearer /i);
  });

  it("keeps an offline write queued, then replays it exactly once after reconnection", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 2, baseRevision: 1 };
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const pending = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 1,
      confirmationId: "confirm-offline",
      config,
    });
    expect(pending.ok).toBe(false);
    expect(listContinuityOutbox("development")).toHaveLength(1);

    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      const url = String(input);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("household_snapshots?household_id")) return response([]);
      return response(null, 201);
    }));
    const replayed = await flushContinuityOutbox({ environment: "development", identity, config });
    expect(replayed).toEqual({ synchronized: 1, pending: 0, conflicts: [] });
    expect(listContinuityOutbox("development")).toEqual([]);
    expect(methods.filter((method) => method === "POST")).toHaveLength(2);

    const again = await flushContinuityOutbox({ environment: "development", identity, config });
    expect(again).toEqual({ synchronized: 0, pending: 0, conflicts: [] });
    expect(methods.filter((method) => method === "POST")).toHaveLength(2);
  });

  it("blocks automatic replay on a stale revision and keeps both sides available", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 4, baseRevision: 3 };
    const remote = { ...googleHousehold(), revision: 5, baseRevision: 5 };
    const fetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("household_snapshots?household_id")) {
        return response([{ payload: JSON.stringify(remote) }]);
      }
      return response(null, 201);
    });
    vi.stubGlobal("fetch", fetch);

    const result = await transportHouseholdWithOutbox({
      household,
      identity,
      expectedRevision: 3,
      confirmationId: "confirm-stale",
      config,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a conflict.");
    expect(result.errorClass).toBe("conflict-detected");
    expect(result.remote?.revision).toBe(5);
    expect(listContinuityOutbox("development")[0]?.blockedByConflict).toBe(true);
    expect(fetch.mock.calls.every(([, init]) => !init || init.method !== "POST")).toBe(true);
  });
});
