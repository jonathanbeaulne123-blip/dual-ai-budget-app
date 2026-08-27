import { mkdirSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTwoClientSyncHarness,
  HARNESS_IDENTITY_A,
  replayOfflineOutboxFromA,
  runPartnerVisibilitySamples,
  stubFetchAgainstContinuityCas,
  stubFetchAgainstHostedCas,
  summarizePartnerVisibility,
  T1_S5_LATENCY_TARGET_MS,
  T1_S5_SAMPLE_COUNT,
  pushStaleFromA,
} from "../src/continuityTwoClientHarness.ts";
import { listContinuityOutbox, setContinuityStore } from "../src/continuity.ts";
import { decodeJsonPayload } from "../src/ledger/snapshotPayload.ts";
import type { Household } from "../src/core/types.ts";

const EVIDENCE_PATH = "/opt/cursor/artifacts/t1-s5-latency-evidence.json";

afterEach(() => {
  setContinuityStore(null);
  vi.unstubAllGlobals();
});

describe("T1-S5 two-client partner visibility (Tier 1 gate G4)", () => {
  it(`measures ${T1_S5_SAMPLE_COUNT} samples with p95 ≤ ${T1_S5_LATENCY_TARGET_MS} ms`, async () => {
    const harness = createTwoClientSyncHarness();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(harness.host));

    const evidence = await runPartnerVisibilitySamples(harness, T1_S5_SAMPLE_COUNT);
    mkdirSync("/opt/cursor/artifacts", { recursive: true });
    writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

    expect(evidence.sampleCount).toBe(T1_S5_SAMPLE_COUNT);
    expect(evidence.pass).toBe(true);
    expect(evidence.p95Ms).toBeLessThanOrEqual(T1_S5_LATENCY_TARGET_MS);
    for (const sample of evidence.samples) {
      expect(sample.latencyMs).toBeLessThan(T1_S5_LATENCY_TARGET_MS);
      expect(harness.getClientB().transactions.some((row) => row.note === sample.note)).toBe(true);
    }
  });

  it("summarizePartnerVisibility computes p95 from sorted latencies", () => {
    const evidence = summarizePartnerVisibility([
      { sample: 1, note: "a", latencyMs: 10, hostedRevision: 1 },
      { sample: 2, note: "b", latencyMs: 20, hostedRevision: 2 },
      { sample: 3, note: "c", latencyMs: 600, hostedRevision: 3 },
    ]);
    expect(evidence.p95Ms).toBe(600);
    expect(evidence.pass).toBe(false);
  });
});

describe("T1-S5 fault harness", () => {
  it("converges offline A outbox after reconnect without erasing local acceptance", async () => {
    const harness = createTwoClientSyncHarness();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(harness.host));
    await replayOfflineOutboxFromA(harness, "Offline harness milk");
    const remote = await decodeJsonPayload(
      String(harness.host.shared.get(harness.getClientA().householdId).snapshot?.payload),
    ) as Household;
    expect(remote.transactions.some((row) => row.note === "Offline harness milk")).toBe(true);
  });

  it("surfaces stale CAS conflict without overwriting hosted books", async () => {
    const harness = createTwoClientSyncHarness();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(harness.host));

    await harness.postSharedFromA("Cloud anchor", "5.00");
    const stale = await pushStaleFromA(harness, "Stale harness toast");
    expect(stale.ok).toBe(false);
    expect(listContinuityOutbox("development")[0]?.blockedByConflict).toBe(true);

    const remote = await decodeJsonPayload(
      String(harness.host.shared.get(harness.getClientA().householdId).snapshot?.payload),
    ) as Household;
    expect(remote.transactions.some((row) => row.note === "Cloud anchor")).toBe(true);
    expect(remote.transactions.some((row) => row.note === "Stale harness toast")).toBe(false);
  });

  it("treats duplicate Realtime delivery as idempotent on B", async () => {
    const harness = createTwoClientSyncHarness();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(harness.host));

    const note = "Duplicate signal milk";
    const { postedAtMs } = await harness.postSharedFromA(note, "6.00");

    const results = await Promise.all([
      harness.applyRealtimePullOnB({ note, startedAtMs: postedAtMs }),
      harness.applyRealtimePullOnB({ note, startedAtMs: postedAtMs }),
      harness.applyRealtimePullOnB({ note, startedAtMs: postedAtMs }),
    ]);

    expect(results.some((row) => row.visible)).toBe(true);
    const matches = harness.getClientB().transactions.filter((row) => row.note === note);
    expect(matches).toHaveLength(1);
  });

  it("serializes concurrent Realtime pulls on B without duplicate rows", async () => {
    const harness = createTwoClientSyncHarness();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(harness.host));

    const note = "Concurrent pull milk";
    const { postedAtMs, revision } = await harness.postSharedFromA(note, "7.00");

    await Promise.all([
      harness.applyRealtimePullOnB({ note, startedAtMs: postedAtMs }),
      harness.applyRealtimePullOnB({ note, startedAtMs: postedAtMs }),
    ]);

    expect(harness.getClientB().revision).toBeGreaterThanOrEqual(revision);
    expect(harness.getClientB().transactions.filter((row) => row.note === note)).toHaveLength(1);
  });
});

describe("T1-S5 G6 Migration 012 path", () => {
  it("uses publish_continuity_snapshot on Auth harness push, not legacy CAS", async () => {
    const harness = createTwoClientSyncHarness();
    const tracker = { calls: [] as string[] };
    vi.stubGlobal("fetch", stubFetchAgainstContinuityCas(harness.host, tracker));

    await harness.postSharedFromA("012 RPC proof milk", "3.25");

    expect(tracker.calls.some((url) => url.includes("rpc/publish_continuity_snapshot"))).toBe(true);
    expect(tracker.calls.some((url) => url.includes("rpc/publish_household_snapshot"))).toBe(false);
    expect(harness.host.getPersonal("development", harness.getClientA().householdId, "MEM-001")).toBeTruthy();
  });
});

describe("T1-S5 cross-tier matrix rows (deterministic)", () => {
  it("A posts shared while B open — visible through harness pull path", async () => {
    const harness = createTwoClientSyncHarness();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(harness.host));
    const sample = await harness.measurePartnerVisibility(1, "Matrix row milk");
    expect(sample.latencyMs).toBeLessThanOrEqual(T1_S5_LATENCY_TARGET_MS);
  });

  it("wrong-path stale writer keeps identity A outbox queued", async () => {
    const harness = createTwoClientSyncHarness();
    vi.stubGlobal("fetch", stubFetchAgainstHostedCas(harness.host));
    await harness.postSharedFromA("Identity anchor", "1.00");
    const stale = await pushStaleFromA(harness, "Wrong writer");
    expect(stale.ok).toBe(false);
    expect(listContinuityOutbox("development")[0]?.identity.email).toBe(HARNESS_IDENTITY_A.email);
  });
});
