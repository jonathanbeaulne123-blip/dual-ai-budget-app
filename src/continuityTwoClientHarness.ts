/**
 * T1-S5 two-client sync proof harness (D-149).
 *
 * Simulates disposable Development households for partner visibility latency
 * and fault scenarios without Playwright or real household data.
 */

import { reconcileHouseholdSnapshots } from "./api.ts";
import {
  createContinuityCoordinator,
  shouldIgnoreInboundSnapshot,
  type ContinuityCoordinator,
} from "./continuityCoordinator.ts";
import {
  createMemoryContinuityStore,
  flushContinuityOutbox,
  setContinuityStore,
  transportHouseholdWithOutbox,
  type ContinuityIdentity,
} from "./continuity.ts";
import { unresolvedConflicts } from "./core/conflict.ts";
import { markSynchronized } from "./core/sharing.ts";
import { financialAuditHash } from "./core/commandIdentity.ts";
import { catalogHousehold, linkGoogleIdentity, postEntry } from "./core/index.ts";
import type { Household } from "./core/types.ts";
import {
  createMemoryHostedCas,
  type MemoryHostedCas,
  type SnapshotCasRequest,
} from "./ledger/snapshotCas.ts";
import { decodeJsonPayload } from "./ledger/snapshotPayload.ts";
import { pushSupabaseHousehold } from "./ledger/supabase.ts";

export const T1_S5_LATENCY_TARGET_MS = 500;
export const T1_S5_SAMPLE_COUNT = 10;

export type PartnerVisibilitySample = {
  sample: number;
  note: string;
  latencyMs: number;
  hostedRevision: number;
};

export type PartnerVisibilityEvidence = {
  recordedAt: string;
  network: string;
  targetP95Ms: number;
  sampleCount: number;
  samples: PartnerVisibilitySample[];
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  pass: boolean;
};

export function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const index = Math.ceil((p / 100) * sortedAsc.length) - 1;
  return sortedAsc[Math.max(0, Math.min(sortedAsc.length - 1, index))] ?? 0;
}

export function summarizePartnerVisibility(samples: PartnerVisibilitySample[]): PartnerVisibilityEvidence {
  const latencies = samples.map((row) => row.latencyMs).sort((left, right) => left - right);
  const p95 = percentile(latencies, 95);
  return {
    recordedAt: new Date().toISOString(),
    network: "in-memory Vitest harness (no WAN; simulates Realtime signal → coordinator pull)",
    targetP95Ms: T1_S5_LATENCY_TARGET_MS,
    sampleCount: samples.length,
    samples,
    p50Ms: percentile(latencies, 50),
    p95Ms: p95,
    maxMs: latencies.at(-1) ?? 0,
    pass: p95 <= T1_S5_LATENCY_TARGET_MS,
  };
}

const DEFAULT_CONFIG = { url: "https://t1-s5.harness.supabase.co", key: "sb_publishable_t1_s5" };

export const HARNESS_IDENTITY_A: ContinuityIdentity = {
  email: "jonathan.harness@example.com",
  subject: "google-sub-jonathan-harness",
};
export const HARNESS_IDENTITY_B: ContinuityIdentity = {
  email: "bianca.harness@example.com",
  subject: "google-sub-bianca-harness",
};

async function casRequest(household: Household, expectedRevision: number): Promise<SnapshotCasRequest> {
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
    payload: JSON.stringify(household),
    snapshotHash: await financialAuditHash(household),
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Wire fetch to an in-memory hosted CAS (migration 002 semantics). */
export function stubFetchAgainstHostedCas(host: MemoryHostedCas) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("households?select=id")) return response([]);
    if (url.includes("rpc/publish_household_snapshot")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const result = await host.publish({
        householdId: String(body.p_household_id),
        expectedRevision: Number(body.p_expected_revision),
        revision: Number(body.p_revision),
        environment: String(body.p_environment),
        name: String(body.p_name),
        timezone: String(body.p_timezone),
        currency: String(body.p_currency),
        invitePhrase: String(body.p_invite_phrase),
        linked: Boolean(body.p_linked),
        lastCommittedAt: String(body.p_last_committed_at ?? ""),
        payload: String(body.p_payload),
        snapshotHash: String(body.p_snapshot_hash),
      });
      if (result.ok) {
        return response({
          ok: true,
          conflict: false,
          duplicate: result.duplicate === true,
          revision: result.revision,
        });
      }
      return response({
        ok: false,
        conflict: true,
        reason: result.reason,
        remote_revision: result.remoteRevision,
        remote_payload: result.remotePayload,
      });
    }
    if (url.includes("continuity_memberships?") || url.includes("continuity_personal_snapshots?")) {
      return response({ code: "PGRST205", message: "missing" }, 404);
    }
    throw new Error(`Unexpected harness request: ${url}`);
  };
}

function bumpLocalRevision(household: Household): Household {
  const base = household.baseRevision ?? 0;
  const tip = household.revision ?? 0;
  return {
    ...household,
    revision: Math.max(tip, base) + 1,
    baseRevision: base,
    linked: true,
  };
}

function seedSharedHousehold(): { clientA: Household; clientB: Household } {
  const base = catalogHousehold();
  const clientA = linkGoogleIdentity(base, {
    memberId: "MEM-001",
    email: HARNESS_IDENTITY_A.email,
    subject: HARNESS_IDENTITY_A.subject,
    displayName: "Jonathan",
    grantedScopes: ["openid", "email"],
  }).household;
  const clientB = linkGoogleIdentity(base, {
    memberId: "MEM-002",
    email: HARNESS_IDENTITY_B.email,
    subject: HARNESS_IDENTITY_B.subject,
    displayName: "Bianca",
    grantedScopes: ["openid", "email"],
  }).household;
  return {
    clientA: { ...clientA, revision: 0, baseRevision: 0, linked: true },
    clientB: { ...clientB, revision: 0, baseRevision: 0, linked: true },
  };
}

export type TwoClientSyncHarness = {
  host: MemoryHostedCas;
  config: typeof DEFAULT_CONFIG;
  identityA: ContinuityIdentity;
  identityB: ContinuityIdentity;
  coordinatorB: ContinuityCoordinator;
  getClientA: () => Household;
  getClientB: () => Household;
  postSharedFromA: (note: string, amount?: string) => Promise<{ revision: number; postedAtMs: number }>;
  pullRemoteHosted: () => Promise<Household | null>;
  applyRealtimePullOnB: (input: {
    note: string;
    startedAtMs: number;
    memberId?: string;
  }) => Promise<{ visible: boolean; latencyMs: number }>;
  measurePartnerVisibility: (sample: number, note: string) => Promise<PartnerVisibilitySample>;
};

export function createTwoClientSyncHarness(): TwoClientSyncHarness {
  const host = createMemoryHostedCas();
  const coordinatorB = createContinuityCoordinator();
  const seeded = seedSharedHousehold();
  let clientA = seeded.clientA;
  let clientB = seeded.clientB;

  async function pullRemoteHosted(): Promise<Household | null> {
    const payload = host.get(clientA.householdId).snapshot?.payload;
    if (!payload) return null;
    return (await decodeJsonPayload(String(payload))) as Household;
  }

  async function postSharedFromA(note: string, amount = "4.00") {
    const postedAtMs = Date.now();
    clientA = bumpLocalRevision(postEntry(clientA, {
      date: "2026-08-26",
      type: "expense",
      amount,
      accountId: "ACC-VISA",
      subcategoryId: "SUB-FOOD-GROCERIES",
      note,
      createdBy: "MEM-001",
      confirmDuplicate: true,
    }).household);
    const pushed = await pushSupabaseHousehold(clientA, DEFAULT_CONFIG, {
      expectedRevision: clientA.baseRevision ?? 0,
      continuityIdentity: HARNESS_IDENTITY_A,
    });
    if (pushed.conflict) {
      throw new Error(`Harness A push conflict: ${pushed.error ?? "unknown"}`);
    }
    clientA = markSynchronized(clientA);
    return { revision: clientA.revision, postedAtMs };
  }

  async function applyRealtimePullOnB(input: {
    note: string;
    startedAtMs: number;
    memberId?: string;
  }) {
    const memberId = input.memberId ?? "MEM-002";
    return coordinatorB.run("realtime", async () => {
      const remote = await pullRemoteHosted();
      if (!remote) {
        return { visible: false, latencyMs: Date.now() - input.startedAtMs };
      }
      const hasOpenConflict = unresolvedConflicts(clientB).length > 0;
      if (shouldIgnoreInboundSnapshot({
        remoteRevision: remote.revision ?? 0,
        localTipRevision: clientB.revision ?? 0,
        hasOpenConflict,
      })) {
        return {
          visible: (clientB.transactions ?? []).some((row) => row.note === input.note),
          latencyMs: Date.now() - input.startedAtMs,
        };
      }
      const remoteRevision = remote.revision ?? 0;
      if (
        remoteRevision > (clientB.baseRevision ?? 0)
        && coordinatorB.shouldDedupePull(clientB.householdId, remoteRevision)
      ) {
        return {
          visible: (clientB.transactions ?? []).some((row) => row.note === input.note),
          latencyMs: Date.now() - input.startedAtMs,
        };
      }
      if (remoteRevision > (clientB.baseRevision ?? 0)) {
        coordinatorB.recordPull(clientB.householdId, remoteRevision);
          if (!coordinatorB.shouldSkipAccept(clientB.householdId, remoteRevision)) {
          clientB = await reconcileHouseholdSnapshots(clientB, remote, memberId);
          coordinatorB.recordAccept(clientB.householdId, remoteRevision);
        }
      }
      return {
        visible: (clientB.transactions ?? []).some((row) => row.note === input.note),
        latencyMs: Date.now() - input.startedAtMs,
      };
    });
  }

  return {
    host,
    config: DEFAULT_CONFIG,
    identityA: HARNESS_IDENTITY_A,
    identityB: HARNESS_IDENTITY_B,
    coordinatorB,
    getClientA: () => clientA,
    getClientB: () => clientB,
    postSharedFromA,
    pullRemoteHosted,
    applyRealtimePullOnB,
    async measurePartnerVisibility(sample, note) {
      const { revision, postedAtMs } = await postSharedFromA(note);
      const result = await applyRealtimePullOnB({ note, startedAtMs: postedAtMs });
      if (!result.visible) {
        throw new Error(`Partner B did not see "${note}" after A posted rev ${revision}`);
      }
      return {
        sample,
        note,
        latencyMs: result.latencyMs,
        hostedRevision: revision,
      };
    },
  };
}

export async function runPartnerVisibilitySamples(
  harness: TwoClientSyncHarness,
  count = T1_S5_SAMPLE_COUNT,
): Promise<PartnerVisibilityEvidence> {
  const samples: PartnerVisibilitySample[] = [];
  for (let index = 0; index < count; index += 1) {
    samples.push(await harness.measurePartnerVisibility(index + 1, `Harness milk ${index + 1}`));
  }
  return summarizePartnerVisibility(samples);
}

export async function pushStaleFromA(
  harness: TwoClientSyncHarness,
  note: string,
): Promise<{ ok: false; errorClass: "conflict-detected" } | { ok: true }> {
  setContinuityStore(createMemoryContinuityStore());
  let local = harness.getClientA();
  local = bumpLocalRevision(postEntry(local, {
    date: "2026-08-26",
    type: "expense",
    amount: "2.00",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note,
    createdBy: "MEM-001",
    confirmDuplicate: true,
  }).household);
  const hostedRevision = harness.host.get(local.householdId).household?.revision ?? 0;
  const result = await transportHouseholdWithOutbox({
    household: local,
    identity: HARNESS_IDENTITY_A,
    expectedRevision: hostedRevision - 1,
    confirmationId: `stale-${note}`,
    config: DEFAULT_CONFIG,
  });
  if (result.ok) return { ok: true };
  return { ok: false, errorClass: "conflict-detected" };
}

export async function replayOfflineOutboxFromA(
  harness: TwoClientSyncHarness,
  note: string,
): Promise<void> {
  setContinuityStore(createMemoryContinuityStore());
  let local = harness.getClientA();
  local = bumpLocalRevision(postEntry(local, {
    date: "2026-08-26",
    type: "expense",
    amount: "3.50",
    accountId: "ACC-VISA",
    subcategoryId: "SUB-FOOD-GROCERIES",
    note,
    createdBy: "MEM-001",
    confirmDuplicate: true,
  }).household);
  local = { ...local, revision: 1, baseRevision: 0 };

  const offlineFetch = async () => {
    throw new Error("offline");
  };
  globalThis.fetch = offlineFetch as typeof fetch;
  const pending = await transportHouseholdWithOutbox({
    household: local,
    identity: HARNESS_IDENTITY_A,
    expectedRevision: 0,
    confirmationId: `offline-${note}`,
    config: DEFAULT_CONFIG,
  });
  if (pending.ok) throw new Error("expected offline pending");

  globalThis.fetch = stubFetchAgainstHostedCas(harness.host) as typeof fetch;
  const flushed = await flushContinuityOutbox({
    environment: "development",
    identity: HARNESS_IDENTITY_A,
    config: DEFAULT_CONFIG,
    force: true,
  });
  if (flushed.synchronized !== 1) {
    throw new Error(`expected offline flush sync, got ${JSON.stringify(flushed)}`);
  }
}

export { casRequest };
