import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogHousehold, linkGoogleIdentity, postEntry } from "../src/core/index.ts";
import { personalReplicaForMember } from "../src/core/sync.ts";
import { financialAuditHash } from "../src/core/commandIdentity.ts";
import {
  applyPublishContinuitySnapshotCas,
  createMemoryContinuityCas,
  stubFetchAgainstContinuityCas,
  type ContinuityCasRequest,
} from "../src/ledger/continuityCasHarness.ts";
import { encodePersonalEnvelopePayload, encodeSharedSnapshotPayload } from "../src/ledger/snapshotPayload.ts";
import { householdCloudProjection, pushSupabaseHousehold } from "../src/ledger/supabase.ts";

const identity = { email: "jonathan.harness@example.com", subject: "google-sub-jonathan-harness" };
const authConfig = {
  url: "https://cas.harness.supabase.co",
  key: "sb_publishable_cas_harness",
  authUserId: "auth-user-harness",
  accessToken: "jwt-harness-token",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function harnessHousehold() {
  const base = linkGoogleIdentity(catalogHousehold(), {
    memberId: "MEM-001",
    email: identity.email,
    subject: identity.subject,
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
  return { ...base, linked: true, revision: 1, baseRevision: 0 };
}

async function continuityRequest(
  household: Awaited<ReturnType<typeof harnessHousehold>>,
  expectedRevision: number,
): Promise<ContinuityCasRequest> {
  const cloud = householdCloudProjection(household, "MEM-001");
  return {
    householdId: household.householdId,
    expectedRevision,
    revision: household.revision,
    environment: household.environment,
    name: household.name,
    timezone: household.timezone,
    currency: household.currency,
    invitePhrase: household.inviteCode,
    linked: true,
    lastCommittedAt: household.lastCommittedAt ?? "",
    payload: await encodeSharedSnapshotPayload(cloud),
    snapshotHash: await financialAuditHash(cloud),
    memberId: "MEM-001",
    personalPayload: await encodePersonalEnvelopePayload(personalReplicaForMember(household, "MEM-001")),
  };
}

describe("Migration 012 continuity CAS harness", () => {
  it("creates shared + personal atomically on first publish", async () => {
    const host = createMemoryContinuityCas();
    const household = await harnessHousehold();
    const request = await continuityRequest(household, 0);

    const created = await host.createHousehold(request);
    expect(created.ok).toBe(true);

    const published = await host.publishContinuity({ ...request, expectedRevision: household.revision });
    expect(published.ok).toBe(true);

    const store = host.get(household.householdId);
    expect(store.shared.household?.revision).toBe(1);
    expect(host.getPersonal("development", household.householdId, "MEM-001")?.revision).toBe(1);
  });

  it("refuses invalid personal envelope before advancing shared revision", async () => {
    const host = createMemoryContinuityCas();
    const household = await harnessHousehold();
    const request = await continuityRequest(household, 0);
    await host.createHousehold(request);

    const badPersonal = JSON.stringify({ kind: "personal", memberId: "MEM-999", transactions: [] });
    const rejected = await host.publishContinuity({
      ...request,
      expectedRevision: 1,
      revision: 2,
      personalPayload: badPersonal,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.reason).toBe("invalid-personal-payload");
    expect(host.shared.get(household.householdId).household?.revision).toBe(1);
  });

  it("applyPublishContinuitySnapshotCas keeps personal when duplicate shared ack matches", () => {
    const now = new Date().toISOString();
    const store = {
      shared: {
        household: {
          id: "HH-1",
          name: "Demo",
          timezone: "America/Toronto",
          currency: "CAD",
          environment: "development",
          invitePhrase: "demo",
          linked: true,
          revision: 1,
          lastCommittedAt: now,
        },
        snapshot: {
          householdId: "HH-1",
          invitePhrase: "demo",
          environment: "development",
          payload: "{}",
          updatedAt: now,
          revision: 1,
          snapshotHash: "hash-1",
        },
      },
      personalByMember: new Map(),
    };
    const request: ContinuityCasRequest = {
      householdId: "HH-1",
      expectedRevision: 1,
      revision: 1,
      environment: "development",
      name: "Demo",
      timezone: "America/Toronto",
      currency: "CAD",
      invitePhrase: "demo",
      linked: true,
      lastCommittedAt: now,
      payload: "{}",
      snapshotHash: "hash-1",
      memberId: "MEM-001",
      personalPayload: JSON.stringify({ kind: "personal", memberId: "MEM-001", transactions: [] }),
    };
    const applied = applyPublishContinuitySnapshotCas(store, request, now);
    expect(applied.result.ok).toBe(true);
    if (applied.result.ok) expect(applied.result.duplicate).toBe(true);
    expect(applied.store.personalByMember.get("MEM-001")?.memberId).toBe("MEM-001");
  });
});

describe("stubFetchAgainstContinuityCas (T1-S5 / G6)", () => {
  it("routes Auth push through publish_continuity_snapshot, not legacy CAS", async () => {
    const host = createMemoryContinuityCas();
    const tracker = { calls: [] as string[] };
    vi.stubGlobal("fetch", stubFetchAgainstContinuityCas(host, tracker));

    let household = await harnessHousehold();
    household = postEntry(household, {
      date: "2026-08-26",
      type: "expense",
      amount: "4.00",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "012 harness milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household;
    household = { ...household, revision: 1, baseRevision: 0 };

    const result = await pushSupabaseHousehold(household, authConfig, {
      expectedRevision: 0,
      continuityIdentity: identity,
    });

    expect(result.skipped).toBe(false);
    expect(result.usedCasRpc).toBe(true);
    expect(tracker.calls.some((url) => url.includes("rpc/publish_continuity_snapshot"))).toBe(true);
    expect(tracker.calls.some((url) => url.includes("rpc/publish_household_snapshot"))).toBe(false);
    expect(host.shared.get(household.householdId).snapshot?.payload).toBeTruthy();
    expect(host.getPersonal("development", household.householdId, "MEM-001")).toBeTruthy();
  });
});
