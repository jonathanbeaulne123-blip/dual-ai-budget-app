import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acceptHouseholdWrite,
  catalogHousehold,
  linkGoogleIdentity,
  personalReplicaForMember,
  postEntry,
} from "../src/core/index.ts";
import { receiptToCommandRef } from "../src/ledger/continuityCommandLog.ts";
import { extractMaterializationFacts } from "../src/ledger/materializeSnapshotFromEvents.ts";
import {
  bundledSupabaseConfig,
  pullConsistentMemberReplicaById,
  pullHouseholdSnapshotById,
} from "../src/ledger/supabase.ts";

const identity = { email: "jonathan@example.com", subject: "google-sub-jonathan" };
const authConfig = {
  ...bundledSupabaseConfig(),
  authUserId: "auth-user-jonathan",
  accessToken: "jwt-test-token",
};

function googleHousehold() {
  return linkGoogleIdentity(catalogHousehold(), {
    memberId: "MEM-001",
    email: identity.email,
    subject: identity.subject,
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("T2-S3 command-log pull path", () => {
  it("materializes from continuity_command_events when hash matches snapshot tip", async () => {
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    let previous = googleHousehold();
    const posted = postEntry(previous, {
      date: "2026-08-24",
      type: "expense",
      amount: "6.25",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Pull path milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const accepted = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "pull-materialize",
      postedIds: posted.postedIds,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    const tip = accepted.household;
    const receipt = tip.commandReceipts?.[0]!;
    const ref = receiptToCommandRef({ household: tip, receipt, baseRevision: 0 });
    const payload = {
      ...ref.commandPayload,
      materializationFacts: extractMaterializationFacts(tip, receipt.postedIds),
    };
    const hostedEvents = [{
      id: "evt-pull",
      environment: tip.environment,
      household_id: tip.householdId,
      member_id: "MEM-001",
      idempotency_key: "pull-materialize",
      confirmation_id: "pull-materialize",
      identity_hash: receipt.identityHash,
      base_revision: 0,
      result_revision: tip.revision,
      ledger_scope: "shared",
      command_type: "postEntry",
      payload_json: payload,
      created_at: "2026-08-26T12:00:00.000Z",
    }];

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("continuity_command_events")) {
        return new Response(JSON.stringify(hostedEvents), { status: 200 });
      }
      if (url.includes("household_snapshots")) {
        return new Response(JSON.stringify([{ payload: tip }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }));

    const pulled = await pullHouseholdSnapshotById(
      tip.householdId,
      tip.environment,
      authConfig,
      identity,
    );
    expect(pulled?.transactions).toHaveLength(1);
    expect(pulled?.transactions[0]?.note).toBe("Pull path milk");
    expect(pulled?.revision).toBe(tip.revision);
  });

  it("materializes a consistent member replica with its resolved member id", async () => {
    vi.stubEnv("VITE_CONTINUITY_COMMAND_LOG", "1");
    const previous = googleHousehold();
    const posted = postEntry(previous, {
      date: "2026-08-24",
      type: "expense",
      amount: "6.25",
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note: "Consistent pull milk",
      createdBy: "MEM-001",
      confirmDuplicate: true,
    });
    const accepted = await acceptHouseholdWrite({
      previous,
      candidate: posted.household,
      confirmationId: "consistent-pull-materialize",
      postedIds: posted.postedIds,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    const tip = accepted.household;
    const receipt = tip.commandReceipts?.[0]!;
    const ref = receiptToCommandRef({ household: tip, receipt, baseRevision: previous.revision });
    const hostedEvents = [{
      id: "evt-consistent-pull",
      environment: tip.environment,
      household_id: tip.householdId,
      member_id: "MEM-001",
      idempotency_key: receipt.confirmationId,
      confirmation_id: receipt.confirmationId,
      identity_hash: receipt.identityHash,
      base_revision: previous.revision,
      result_revision: tip.revision,
      ledger_scope: "shared",
      command_type: ref.commandType,
      payload_json: {
        ...ref.commandPayload,
        materializationFacts: extractMaterializationFacts(tip, receipt.postedIds),
      },
      created_at: receipt.acceptedAt,
    }];
    const personal = personalReplicaForMember(tip, "MEM-001");
    let commandEventReads = 0;

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("continuity_memberships?")) {
        return new Response(JSON.stringify([{
          household_id: tip.householdId,
          member_id: "MEM-001",
          google_subject: identity.subject,
          google_email: identity.email,
          auth_user_id: authConfig.authUserId,
          role: "owner",
        }]), { status: 200 });
      }
      if (url.includes("continuity_command_events")) {
        commandEventReads += 1;
        return new Response(JSON.stringify(hostedEvents), { status: 200 });
      }
      if (url.includes("continuity_personal_snapshots?")) {
        return new Response(JSON.stringify([{ revision: tip.revision, payload: personal }]), { status: 200 });
      }
      if (url.includes("household_snapshots?")) {
        return new Response(JSON.stringify([{ payload: tip }]), { status: 200 });
      }
      throw new Error(`Unexpected request: ${url}`);
    }));

    const pulled = await pullConsistentMemberReplicaById({
      householdId: tip.householdId,
      memberId: "MEM-001",
      environment: tip.environment,
      config: authConfig,
      identity,
    });

    expect(commandEventReads).toBeGreaterThan(0);
    expect(pulled?.shared.transactions[0]?.note).toBe("Consistent pull milk");
    expect(pulled?.revision).toBe(tip.revision);
  });
});
