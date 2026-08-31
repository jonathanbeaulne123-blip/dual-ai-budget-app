import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptHouseholdWrite,
  catalogHousehold,
  linkGoogleIdentity,
  type Household,
  type WriteAdapters,
} from "../src/core/index.ts";
import {
  clearPendingAuthInvite,
  loadPendingAuthInvite,
  savePendingAuthInvite,
} from "../src/core/authInvite.ts";
import { discoverContinuityMemberships } from "../src/continuity.ts";
import { ingestBooks, openMemoryBooks, resetBrowserBooksForTests } from "../src/ledger/engine.ts";
import { redeemHouseholdInvite } from "../src/ledger/householdInvites.ts";
import type { SupabaseConfig } from "../src/ledger/supabase.ts";

const HEX64 = "b".repeat(64);
const partnerIdentity = { email: "partner@gmail.com", subject: "google-sub-partner" };
const ownerIdentity = { email: "owner@gmail.com", subject: "google-sub-owner" };

const authConfig: SupabaseConfig = {
  url: "https://invite-discovery.example.supabase.co",
  key: "sb_publishable_test",
  accessToken: "jwt-partner",
  authUserId: "auth-partner",
};

function response(body: unknown, status = 200): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Owner-linked household; partner seat has no google.links row yet (pre-invite snapshot). */
function partnerInviteHousehold(): Household {
  let household = catalogHousehold();
  household = {
    ...household,
    householdId: "HH-PARTNER-INVITE",
    inviteCode: "cedar-lantern-maple",
  };
  household = linkGoogleIdentity(household, {
    memberId: "MEM-001",
    email: ownerIdentity.email,
    subject: ownerIdentity.subject,
    displayName: "Bianca",
    grantedScopes: ["openid", "email"],
  }).household;
  return household;
}

type MockState = {
  memberships: Array<{
    environment: string;
    household_id: string;
    member_id: string;
    google_subject: string;
    google_email: string;
    auth_user_id: string;
    role: string;
    active: boolean;
  }>;
  snapshot: Household;
  redeemCount: number;
};

function mockInviteDiscoveryFetch(state: MockState) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;

    if (url.includes("/rpc/hearth_redeem_invite")) {
      state.redeemCount += 1;
      const duplicate = state.memberships.some((row) => (
        row.household_id === "HH-PARTNER-INVITE"
        && row.member_id === "MEM-002"
        && row.auth_user_id === "auth-partner"
      ));
      if (!duplicate) {
        state.memberships.push({
          environment: "development",
          household_id: "HH-PARTNER-INVITE",
          member_id: "MEM-002",
          google_subject: partnerIdentity.subject,
          google_email: partnerIdentity.email,
          auth_user_id: "auth-partner",
          role: "member",
          active: true,
        });
      }
      return response({
        ok: true,
        duplicate,
        role: "member",
        member_id: "MEM-002",
        household_id: "HH-PARTNER-INVITE",
        environment: "development",
      });
    }

    if (url.includes("continuity_memberships?") && method === "GET") {
      const envMatch = url.match(/environment=eq\.([^&]+)/)?.[1];
      const authMatch = url.match(/auth_user_id=eq\.([^&]+)/)?.[1];
      const rows = state.memberships.filter((row) => (
        (!envMatch || row.environment === decodeURIComponent(envMatch))
        && (!authMatch || row.auth_user_id === decodeURIComponent(authMatch))
        && row.active
      ));
      return response(rows.map((row) => ({
        household_id: row.household_id,
        member_id: row.member_id,
        google_subject: row.google_subject,
        google_email: row.google_email,
        auth_user_id: row.auth_user_id,
        role: row.role,
      })));
    }

    if (url.includes("household_snapshots?") && method === "GET") {
      const householdMatch = url.includes("HH-PARTNER-INVITE") || url.includes("household_id=eq.");
      const envMatch = url.includes("environment=eq.development");
      if (householdMatch && envMatch) {
        return response([{ payload: JSON.stringify(state.snapshot) }]);
      }
      return response([]);
    }

    if (url.includes("continuity_personal_snapshots?")) {
      return response([]);
    }

    if (body && url.includes("/rpc/")) {
      return response({ ok: false, reason: "unexpected-rpc" });
    }

    return response(null, 404);
  });
}

/** Mirrors App.tsx redeem + discover match without mounting the full kitchen. */
async function redeemAndDiscover(token: string, config: SupabaseConfig) {
  const redeemed = await redeemHouseholdInvite({ environment: "development", inviteToken: token, config });
  if (!redeemed.ok) return { redeemed, found: [], match: undefined };
  const found = await discoverContinuityMemberships(partnerIdentity, redeemed.environment, config);
  const match = found.find((row) => row.household.householdId === redeemed.householdId)
    ?? (redeemed.memberId ? found.find((row) => row.memberId === redeemed.memberId) : undefined);
  return { redeemed, found, match };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await resetBrowserBooksForTests();
});

describe("Auth QR invite discovery contract", () => {
  it("discovers the invited household when snapshot google.links lag behind redeem", async () => {
    const snapshot = partnerInviteHousehold();
    expect(snapshot.google.links.some((link) => link.memberId === "MEM-002")).toBe(false);

    const state: MockState = { memberships: [], snapshot, redeemCount: 0 };
    vi.stubGlobal("fetch", mockInviteDiscoveryFetch(state));

    const { redeemed, match } = await redeemAndDiscover(HEX64, authConfig);
    expect(redeemed).toMatchObject({
      ok: true,
      duplicate: false,
      householdId: "HH-PARTNER-INVITE",
      memberId: "MEM-002",
      environment: "development",
    });
    expect(match).toBeDefined();
    expect(match?.memberId).toBe("MEM-002");
    expect(match?.household.householdId).toBe("HH-PARTNER-INVITE");
    expect(match?.household.google.links.find((link) => link.memberId === "MEM-002")).toMatchObject({
      subject: partnerIdentity.subject,
      email: partnerIdentity.email,
      active: true,
    });
  });

  it("treats duplicate QR redemption as idempotent and still discovers immediately", async () => {
    const state: MockState = { memberships: [], snapshot: partnerInviteHousehold(), redeemCount: 0 };
    vi.stubGlobal("fetch", mockInviteDiscoveryFetch(state));

    const first = await redeemAndDiscover(HEX64, authConfig);
    const second = await redeemAndDiscover(HEX64, authConfig);

    expect(first.redeemed).toMatchObject({ ok: true, duplicate: false });
    expect(second.redeemed).toMatchObject({ ok: true, duplicate: true });
    expect(state.redeemCount).toBe(2);
    expect(second.match?.household.householdId).toBe("HH-PARTNER-INVITE");
    expect(second.match?.memberId).toBe("MEM-002");
  });

  it("clears a retained pending invite once discovery succeeds (no Continue-with-Google loop)", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });

    const state: MockState = { memberships: [], snapshot: partnerInviteHousehold(), redeemCount: 0 };
    vi.stubGlobal("fetch", mockInviteDiscoveryFetch(state));

    savePendingAuthInvite({ token: HEX64, environment: "development" });
    expect(loadPendingAuthInvite()?.token).toBe(HEX64);

    const { match } = await redeemAndDiscover(HEX64, authConfig);
    expect(match).toBeDefined();
    if (match) {
      clearPendingAuthInvite();
    }
    expect(loadPendingAuthInvite()).toBeNull();
  });

  it("accepts discovered books through PGlite when membership is authoritative", async () => {
    const snapshot = partnerInviteHousehold();
    const state: MockState = {
      memberships: [{
        environment: "development",
        household_id: snapshot.householdId,
        member_id: "MEM-002",
        google_subject: partnerIdentity.subject,
        google_email: partnerIdentity.email,
        auth_user_id: "auth-partner",
        role: "member",
        active: true,
      }],
      snapshot,
      redeemCount: 0,
    };
    vi.stubGlobal("fetch", mockInviteDiscoveryFetch(state));

    const found = await discoverContinuityMemberships(partnerIdentity, "development", authConfig);
    expect(found).toHaveLength(1);

    const db = await openMemoryBooks();
    const adapters: WriteAdapters = {
      persist: async () => {},
      ingest: async (household) => {
        const status = await ingestBooks(db, household);
        return { ok: status.ok, error: status.error };
      },
      restoreIngest: async () => {},
    };

    const outcome = await acceptHouseholdWrite({
      previous: null,
      candidate: found[0]!.household,
      confirmationId: "discover-partner-invite",
      commandKind: "google-discovery",
      postedIds: [],
      adapters,
    });
    expect(outcome.ok).toBe(true);
  });

  it("rejects wrong Google account, environment, and member bindings", async () => {
    const snapshot = partnerInviteHousehold();
    const wrongEnvSnapshot = { ...snapshot, environment: "production" as const };
    const wrongMemberSnapshot = {
      ...snapshot,
      members: snapshot.members.map((member) => (
        member.id === "MEM-002" ? { ...member, active: false } : member
      )),
    };

    const baseMembership = {
      environment: "development",
      household_id: "HH-PARTNER-INVITE",
      member_id: "MEM-002",
      google_subject: partnerIdentity.subject,
      google_email: partnerIdentity.email,
      auth_user_id: "auth-partner",
      role: "member",
      active: true,
    };

    vi.stubGlobal("fetch", mockInviteDiscoveryFetch({
      memberships: [baseMembership],
      snapshot,
      redeemCount: 0,
    }));
    await expect(discoverContinuityMemberships(
      { email: partnerIdentity.email, subject: "google-sub-wrong" },
      "development",
      authConfig,
    )).resolves.toEqual([]);

    vi.stubGlobal("fetch", mockInviteDiscoveryFetch({
      memberships: [{ ...baseMembership, auth_user_id: "auth-someone-else" }],
      snapshot,
      redeemCount: 0,
    }));
    await expect(discoverContinuityMemberships(partnerIdentity, "development", authConfig)).resolves.toEqual([]);

    vi.stubGlobal("fetch", mockInviteDiscoveryFetch({
      memberships: [baseMembership],
      snapshot: wrongEnvSnapshot,
      redeemCount: 0,
    }));
    await expect(discoverContinuityMemberships(partnerIdentity, "development", authConfig)).resolves.toEqual([]);

    vi.stubGlobal("fetch", mockInviteDiscoveryFetch({
      memberships: [baseMembership],
      snapshot: wrongMemberSnapshot,
      redeemCount: 0,
    }));
    await expect(discoverContinuityMemberships(partnerIdentity, "development", authConfig)).resolves.toEqual([]);
  });

  it("keeps generic snapshot scan requiring google.links when membership table is missing", async () => {
    const linked = linkGoogleIdentity(partnerInviteHousehold(), {
      memberId: "MEM-002",
      email: partnerIdentity.email,
      subject: partnerIdentity.subject,
      displayName: "Jonathan",
      grantedScopes: ["openid", "email"],
    }).household;
    const unlinked = partnerInviteHousehold();

    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("continuity_memberships?")) {
        return response({ code: "PGRST205", message: "continuity_memberships is not in the schema cache" }, 404);
      }
      return response([
        { payload: JSON.stringify(unlinked), updated_at: "2026-08-26T12:00:00.000Z" },
        { payload: JSON.stringify(linked), updated_at: "2026-08-26T11:00:00.000Z" },
      ]);
    });
    vi.stubGlobal("fetch", fetch);

    const found = await discoverContinuityMemberships(partnerIdentity, "development", {
      url: authConfig.url,
      key: authConfig.key,
    });
    expect(found.map((item) => item.household.householdId)).toEqual(["HH-PARTNER-INVITE"]);
    expect(found[0]?.memberId).toBe("MEM-002");
  });
});
