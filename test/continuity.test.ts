import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryContinuityStore,
  clearContinuityOutboxForHousehold,
  discoverContinuityMemberships,
  enqueueContinuitySnapshot,
  flushContinuityOutbox,
  listContinuityOutbox,
  setContinuityStore,
  transportHouseholdWithOutbox,
} from "../src/continuity.ts";
import { catalogHousehold, linkGoogleIdentity, personalReplicaForMember, postEntry } from "../src/core/index.ts";
import type { Household } from "../src/core/types.ts";
import { pushSupabaseHousehold } from "../src/ledger/supabase.ts";

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
  vi.unstubAllEnvs();
});

describe("Google-account continuity", () => {
  it("discovers every exact Development membership and ignores malformed or unrelated rows", async () => {
    const first = googleHousehold();
    const second = { ...googleHousehold(), householdId: "HH-SECOND", name: "Second household" };
    const unrelated = googleHousehold("someone-else", "someone@example.com");
    const fetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).includes("continuity_memberships?")) {
        return response({ code: "PGRST205", message: "continuity_memberships is not in the schema cache" }, 404);
      }
      return response([
        { payload: JSON.stringify(first), updated_at: "2026-08-24T14:00:00.000Z" },
        { payload: "{", updated_at: "2026-08-24T13:00:00.000Z" },
        { payload: JSON.stringify(unrelated), updated_at: "2026-08-24T12:00:00.000Z" },
        { payload: JSON.stringify(second), updated_at: "2026-08-24T11:00:00.000Z" },
      ]);
    });
    vi.stubGlobal("fetch", fetch);

    const found = await discoverContinuityMemberships(identity, "development", config);
    expect(found.map((item) => item.household.householdId)).toEqual([first.householdId, "HH-SECOND"]);
    expect(found.every((item) => item.memberId === "MEM-001")).toBe(true);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("environment=eq.development");
  });

  it("does not let a matching email override a different populated Google subject", async () => {
    const wrongSubject = googleHousehold("different-google-subject", identity.email);
    const fetch = vi.fn(async (input: RequestInfo | URL) => String(input).includes("continuity_memberships?")
      ? response({ code: "PGRST205", message: "continuity_memberships is not in the schema cache" }, 404)
      : response([{ payload: JSON.stringify(wrongSubject) }]));
    vi.stubGlobal("fetch", fetch);
    await expect(discoverContinuityMemberships(identity, "development", config)).resolves.toEqual([]);
  });

  it("does not bulk-scan Production snapshots; membership miss returns empty", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("continuity_memberships?")) {
        return response({ code: "PGRST205", message: "continuity_memberships is not in the schema cache" }, 404);
      }
      return response([]);
    });
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("VITE_PRODUCTION_CONTINUITY", "1");
    await expect(discoverContinuityMemberships(identity, "production", config)).resolves.toEqual([]);
    expect(fetch.mock.calls.some(([input]) => String(input).includes("household_snapshots?"))).toBe(false);
  });

  it("keeps Production discovery off when the continuity flag is unset", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("VITE_PRODUCTION_CONTINUITY", "");
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
      if (url.includes("rpc/publish_household_snapshot")) {
        return response({
          code: "PGRST202",
          message: "Could not find the function public.publish_household_snapshot",
        }, 404);
      }
      if (url.includes("household_snapshots?household_id")) return response([]);
      if (url.includes("continuity_memberships?select=household_id")) {
        return response({ code: "PGRST205", message: "continuity_memberships is not in the schema cache" }, 404);
      }
      return response(null, 201);
    }));
    const replayed = await flushContinuityOutbox({ environment: "development", identity, config, force: true });
    expect(replayed).toEqual({ synchronized: 1, pending: 0, deferred: 0, conflicts: [] });
    expect(listContinuityOutbox("development")).toEqual([]);
    expect(methods.filter((method) => method === "POST")).toHaveLength(3);

    const again = await flushContinuityOutbox({ environment: "development", identity, config, force: true });
    expect(again).toEqual({ synchronized: 0, pending: 0, deferred: 0, conflicts: [] });
    expect(methods.filter((method) => method === "POST")).toHaveLength(3);
  });

  it("blocks automatic replay on a stale revision and keeps both sides available", async () => {
    setContinuityStore(createMemoryContinuityStore());
    const household = { ...googleHousehold(), revision: 4, baseRevision: 3 };
    const remote = { ...googleHousehold(), revision: 5, baseRevision: 5 };
    const fetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/publish_household_snapshot")) {
        return response({
          code: "PGRST202",
          message: "Could not find the function public.publish_household_snapshot",
        }, 404);
      }
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
    const snapshotPosts = fetch.mock.calls.filter(([input, init]) => (
      init?.method === "POST" && String(input).includes("household_snapshots?on_conflict")
    ));
    expect(snapshotPosts).toHaveLength(0);
  });

  it("uses server-side membership discovery and overlays the member's hosted personal replica", async () => {
    const shared = googleHousehold();
    const posted = postEntry(shared, {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Personal cloud milk",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const personal = personalReplicaForMember(posted, "MEM-001");
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("continuity_memberships?")) {
        return response([{
          household_id: posted.householdId,
          member_id: "MEM-001",
          google_subject: identity.subject,
          google_email: identity.email,
        }]);
      }
      if (url.includes("continuity_personal_snapshots?")) {
        return response([{ payload: JSON.stringify(personal) }]);
      }
      if (url.includes("household_snapshots?")) return response([{ payload: JSON.stringify(shared) }]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    const found = await discoverContinuityMemberships(identity, "development", config);
    expect(found).toHaveLength(1);
    expect(found[0]?.memberId).toBe("MEM-001");
    expect(found[0]?.household.transactions.some((item) => item.note === "Personal cloud milk")).toBe(true);
    expect(fetch.mock.calls.some(([input]) => String(input).includes("select=payload,updated_at"))).toBe(false);
  });

  it("publishes membership and only the signed-in member's personal scope before the household snapshot", async () => {
    let household = googleHousehold();
    household = postEntry(household, {
      date: "2026-08-24",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Jonathan private",
      createdBy: "MEM-001",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    household = postEntry(household, {
      date: "2026-08-25",
      type: "expense",
      amount: "5.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Partner private",
      createdBy: "MEM-002",
      visibility: "personal",
      confirmDuplicate: true,
    }).household;
    const calls: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.includes("households?select=id")) return response([]);
      if (url.includes("rpc/publish_household_snapshot")) {
        return response({
          code: "PGRST202",
          message: "Could not find the function public.publish_household_snapshot",
        }, 404);
      }
      if (url.includes("household_snapshots?household_id")) return response([]);
      if (url.includes("continuity_memberships?select=household_id")) return response([]);
      return response(null, 201);
    }));

    const pushed = await pushSupabaseHousehold(household, config, {
      expectedRevision: 0,
      continuityIdentity: identity,
    });
    expect(pushed.schema).toBe(true);
    const membership = calls.find((item) => item.url.includes("continuity_memberships?on_conflict"));
    const personalCall = calls.find((item) => item.url.includes("continuity_personal_snapshots?on_conflict"));
    const snapshotIndex = calls.findIndex((item) => item.url.includes("household_snapshots?on_conflict"));
    const personalIndex = calls.findIndex((item) => item.url.includes("continuity_personal_snapshots?on_conflict"));
    expect(membership?.body).toMatchObject({ member_id: "MEM-001", google_subject: identity.subject });
    const payload = JSON.parse(String((personalCall?.body as { payload?: string })?.payload)) as { transactions: Array<{ note: string }> };
    expect(payload.transactions.map((item) => item.note)).toContain("Jonathan private");
    expect(payload.transactions.map((item) => item.note)).not.toContain("Partner private");
    expect(personalIndex).toBeGreaterThan(-1);
    expect(snapshotIndex).toBeGreaterThan(personalIndex);
  });
});

describe("Sign out continuity wipe", () => {
  it("drops only the cleared household from the outbox", () => {
    setContinuityStore(createMemoryContinuityStore());
    const keep = googleHousehold();
    const drop = { ...googleHousehold(), householdId: "HH-DROP", name: "Drop me" };
    enqueueContinuitySnapshot({
      identity,
      household: keep,
      expectedRevision: 0,
      confirmationId: "keep-1",
    });
    enqueueContinuitySnapshot({
      identity,
      household: drop,
      expectedRevision: 0,
      confirmationId: "drop-1",
    });
    expect(listContinuityOutbox("development")).toHaveLength(2);
    expect(clearContinuityOutboxForHousehold("development", "HH-DROP")).toBe(1);
    const left = listContinuityOutbox("development");
    expect(left).toHaveLength(1);
    expect(left[0]?.householdId).toBe(keep.householdId);
  });
});
