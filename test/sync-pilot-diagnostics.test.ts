import { describe, expect, it } from "vitest";
import {
  buildSyncPilotDiagnosticBundle,
  copySyncPilotDiagnostic,
  recordSyncPilotTrace,
  startSyncPilotLatencyRun,
  syncPilotDiagnosticsEnabled,
} from "../src/syncPilotDiagnostics.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

const identity = {
  environment: "development" as const,
  householdId: "raw-household-secret",
  memberId: "MEM-001",
  deviceId: "raw-device-secret",
};

async function startRun(
  storage: ReturnType<typeof memoryStorage>,
  at = "2026-08-31T11:59:59.000Z",
  seed = "test-run",
) {
  return startSyncPilotLatencyRun("development", {
    flag: "1",
    storage,
    now: () => new Date(at),
    randomId: () => seed,
  });
}

describe("Development sync pilot diagnostics", () => {
  it("fails closed outside Development or without the explicit build flag", async () => {
    const storage = memoryStorage();
    expect(syncPilotDiagnosticsEnabled("production", "1")).toBe(false);
    expect(syncPilotDiagnosticsEnabled("development", "0")).toBe(false);
    expect(await recordSyncPilotTrace({ ...identity, phase: "local-accepted" }, { flag: "0", storage })).toBeNull();
    expect(await recordSyncPilotTrace({ ...identity, environment: "production", phase: "local-accepted" }, { flag: "1", storage })).toBeNull();
  });

  it("copies hashes and timing without raw identifiers or ledger facts", async () => {
    const storage = memoryStorage();
    const now = () => new Date("2026-08-31T12:00:00.400Z");
    await startRun(storage);
    await recordSyncPilotTrace({
      ...identity,
      phase: "remote-accepted",
      confirmationId: "raw-confirmation-secret",
      revision: 12,
      pendingCount: 0,
      transport: "command-realtime",
      ledgerScope: "shared",
      painted: true,
      sourceAcceptedAt: "2026-08-31T12:00:00.000Z",
      cloudAcceptedAt: "2026-08-31T12:00:00.100Z",
      receiverApplyMs: 75,
    }, { flag: "1", storage, now });
    let copied = "";
    const bundle = await copySyncPilotDiagnostic({
      ...identity,
      revision: 12,
      pendingCount: 0,
      syncState: "synced",
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      freshnessMode: "live",
    }, {
      flag: "1",
      storage,
      now,
      writeText: async (value) => { copied = value; },
    });
    expect(bundle?.latency).toEqual({ sampleCount: 1, invalidClockSampleCount: 0, p50Ms: 400, p95Ms: 400, maxMs: 400 });
    expect(bundle?.cloudToPaintLatency).toEqual({ sampleCount: 1, p50Ms: 300, p95Ms: 300, maxMs: 300 });
    expect(bundle?.receiverApplyLatency).toEqual({ sampleCount: 1, p50Ms: 75, p95Ms: 75, maxMs: 75 });
    expect(bundle?.measurement).toMatchObject({
      candidateEventCount: 1,
      qualifyingEventCount: 1,
      unpaintedEventCount: 0,
      painted: true,
      paintWitness: "double animation frame; hidden-tab fallback excluded",
      endToEndClockSkewWitnessRequired: true,
    });
    expect(bundle?.activeRun?.runHash).toHaveLength(16);
    expect(bundle?.traces[0]?.householdHash).toHaveLength(16);
    expect(copied).not.toContain(identity.householdId);
    expect(copied).not.toContain(identity.deviceId);
    expect(copied).not.toContain("raw-confirmation-secret");
    expect(copied).not.toMatch(/amount|merchant|email|token|note/i);
  });

  it("rejects forged or stale localStorage rows instead of copying extra fields", async () => {
    const storage = memoryStorage();
    storage.setItem("hearth:sync-pilot-trace:v1:development", JSON.stringify([{
      version: 1,
      recordedAt: "2026-08-31T12:00:00.000Z",
      phase: "remote-accepted",
      householdHash: "0123456789abcdef",
      memberHash: "0123456789abcdef",
      deviceHash: "0123456789abcdef",
      confirmationHash: null,
      revision: 1,
      pendingCount: 0,
      transport: "command-realtime",
      latencyMs: 20,
      rawHouseholdId: "HH-RAW-SECRET",
      amountCents: 12345,
      note: "private note",
      email: "private@example.com",
      token: "secret-token",
    }, {
      version: 1,
      recordedAt: "2026-08-31T12:00:00.000Z",
      phase: "invented-phase",
    }]));
    let copied = "";
    const bundle = await copySyncPilotDiagnostic({
      ...identity,
      revision: 1,
      pendingCount: 0,
      syncState: "synced",
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      freshnessMode: "live",
    }, {
      flag: "1",
      storage,
      writeText: async (value) => { copied = value; },
    });
    expect(bundle?.traces).toEqual([]);
    expect(copied).not.toMatch(/HH-RAW-SECRET|12345|private note|private@example\.com|secret-token|invented-phase/);
  });

  it("reports nearest-rank p95 across a 100-event receiving sample", async () => {
    const storage = memoryStorage();
    await startRun(storage);
    for (let index = 1; index <= 100; index += 1) {
      await recordSyncPilotTrace({
        ...identity,
        phase: "remote-accepted",
        confirmationId: `confirmation-${index}`,
        transport: "command-realtime",
        ledgerScope: "shared",
        painted: true,
        sourceAcceptedAt: "2026-08-31T12:00:00.000Z",
      }, {
        flag: "1",
        storage,
        now: () => new Date(Date.parse("2026-08-31T12:00:00.000Z") + index),
      });
    }
    const bundle = await buildSyncPilotDiagnosticBundle({
      ...identity,
      revision: 100,
      pendingCount: 0,
      syncState: "synced",
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      freshnessMode: "live",
    }, { flag: "1", storage, now: () => new Date("2026-08-31T12:05:00.000Z") });
    expect(bundle?.latency.sampleCount).toBe(100);
    expect(bundle?.latency.invalidClockSampleCount).toBe(0);
    expect(bundle?.measurement.candidateEventCount).toBe(100);
    expect(bundle?.measurement.qualifyingEventCount).toBe(100);
    expect(bundle?.measurement.unpaintedEventCount).toBe(0);
    expect(bundle?.latency.p50Ms).toBe(50);
    expect(bundle?.latency.p95Ms).toBe(95);
    expect(bundle?.latency.maxMs).toBe(100);
  });

  it("excludes other households, Personal events, conflicts, and fallback transport from the Shared latency cohort", async () => {
    const storage = memoryStorage();
    await startRun(storage);
    const sample = {
      ...identity,
      confirmationId: "qualifying",
      transport: "command-realtime" as const,
      ledgerScope: "shared" as const,
      painted: true,
      sourceAcceptedAt: "2026-08-31T12:00:00.000Z",
    };
    await recordSyncPilotTrace({ ...sample, phase: "remote-accepted" }, {
      flag: "1", storage, now: () => new Date("2026-08-31T12:00:00.100Z"),
    });
    await recordSyncPilotTrace({ ...sample, phase: "remote-accepted", ledgerScope: "personal" }, {
      flag: "1", storage, now: () => new Date("2026-08-31T12:00:00.900Z"),
    });
    await recordSyncPilotTrace({ ...sample, phase: "conflict" }, {
      flag: "1", storage, now: () => new Date("2026-08-31T12:00:00.800Z"),
    });
    await recordSyncPilotTrace({ ...sample, phase: "remote-accepted", transport: "poll" }, {
      flag: "1", storage, now: () => new Date("2026-08-31T12:00:00.700Z"),
    });
    await recordSyncPilotTrace({ ...sample, phase: "remote-accepted", householdId: "different-household" }, {
      flag: "1", storage, now: () => new Date("2026-08-31T12:00:00.600Z"),
    });
    const bundle = await buildSyncPilotDiagnosticBundle({
      ...identity,
      revision: 1,
      pendingCount: 0,
      syncState: "synced",
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      freshnessMode: "live",
    }, { flag: "1", storage });
    expect(bundle?.latency).toEqual({ sampleCount: 1, invalidClockSampleCount: 0, p50Ms: 100, p95Ms: 100, maxMs: 100 });
    expect(bundle?.traces).toHaveLength(4);
    expect(bundle?.traces.every((row) => row.householdHash === bundle.state.householdHash)).toBe(true);
  });

  it("excludes hidden-tab fallback completion from the painted latency cohort", async () => {
    const storage = memoryStorage();
    await startRun(storage);
    await recordSyncPilotTrace({
      ...identity,
      phase: "remote-accepted",
      confirmationId: "fallback-not-painted",
      transport: "command-realtime",
      ledgerScope: "shared",
      painted: false,
      paintStatus: "hidden-fallback",
      sourceAcceptedAt: "2026-08-31T12:00:00.000Z",
    }, {
      flag: "1",
      storage,
      now: () => new Date("2026-08-31T12:00:00.100Z"),
    });
    const bundle = await buildSyncPilotDiagnosticBundle({
      ...identity,
      revision: 1,
      pendingCount: 0,
      syncState: "synced",
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      freshnessMode: "live",
    }, { flag: "1", storage });
    expect(bundle?.traces).toHaveLength(1);
    expect(bundle?.measurement.candidateEventCount).toBe(1);
    expect(bundle?.measurement.unpaintedEventCount).toBe(1);
    expect(bundle?.latency.sampleCount).toBe(0);
  });

  it("retains only the newest 500 local trace records", async () => {
    const storage = memoryStorage();
    await startRun(storage);
    for (let index = 1; index <= 505; index += 1) {
      await recordSyncPilotTrace({
        ...identity,
        phase: "outbox-enqueued",
        revision: index,
        pendingCount: 1,
        transport: "outbox",
      }, {
        flag: "1",
        storage,
        now: () => new Date(Date.parse("2026-08-31T12:00:00.000Z") + index),
      });
    }
    const bundle = await buildSyncPilotDiagnosticBundle({
      ...identity,
      revision: 505,
      pendingCount: 1,
      syncState: "syncing",
      realtimeStatus: "CHANNEL_ERROR",
      offline: false,
      freshnessMode: "poll",
    }, { flag: "1", storage });
    expect(bundle?.traces).toHaveLength(500);
    expect(bundle?.traces[0]?.revision).toBe(6);
    expect(bundle?.traces.at(-1)?.revision).toBe(505);
  });

  it("retains privacy-safe Realtime lifecycle evidence", async () => {
    const storage = memoryStorage();
    await startRun(storage);
    for (const phase of ["realtime-disconnected", "realtime-reconnect", "realtime-subscribed"] as const) {
      await recordSyncPilotTrace({
        ...identity,
        phase,
        revision: 12,
        transport: "command-realtime",
      }, { flag: "1", storage });
    }
    const bundle = await buildSyncPilotDiagnosticBundle({
      ...identity,
      revision: 12,
      pendingCount: 0,
      syncState: "synced",
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      freshnessMode: "live",
    }, { flag: "1", storage });
    expect(bundle?.traces.map((row) => row.phase)).toEqual([
      "realtime-disconnected",
      "realtime-reconnect",
      "realtime-subscribed",
    ]);
  });

  it("starts a clean run and excludes earlier qualifying rows from every percentile", async () => {
    const storage = memoryStorage();
    await recordSyncPilotTrace({
      ...identity,
      phase: "remote-accepted",
      confirmationId: "old-run",
      transport: "command-realtime",
      ledgerScope: "shared",
      painted: true,
      sourceAcceptedAt: "2026-08-31T12:00:00.000Z",
    }, {
      flag: "1",
      storage,
      now: () => new Date("2026-08-31T12:00:00.900Z"),
    });
    const run = await startRun(storage, "2026-08-31T12:01:00.000Z", "fresh-run");
    await recordSyncPilotTrace({
      ...identity,
      phase: "remote-accepted",
      confirmationId: "fresh-run",
      transport: "command-realtime",
      ledgerScope: "shared",
      painted: true,
      sourceAcceptedAt: "2026-08-31T12:01:00.000Z",
    }, {
      flag: "1",
      storage,
      now: () => new Date("2026-08-31T12:01:00.100Z"),
    });
    const bundle = await buildSyncPilotDiagnosticBundle({
      ...identity,
      revision: 2,
      pendingCount: 0,
      syncState: "synced",
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      freshnessMode: "live",
    }, { flag: "1", storage });
    expect(bundle?.activeRun).toEqual(run);
    expect(bundle?.traces).toHaveLength(1);
    expect(bundle?.latency).toEqual({
      sampleCount: 1,
      invalidClockSampleCount: 0,
      p50Ms: 100,
      p95Ms: 100,
      maxMs: 100,
    });
  });

  it("counts negative cross-phone clock samples instead of silently dropping them", async () => {
    const storage = memoryStorage();
    await startRun(storage);
    await recordSyncPilotTrace({
      ...identity,
      phase: "remote-accepted",
      confirmationId: "negative-skew",
      transport: "command-realtime",
      ledgerScope: "shared",
      painted: true,
      sourceAcceptedAt: "2026-08-31T12:00:01.000Z",
    }, {
      flag: "1",
      storage,
      now: () => new Date("2026-08-31T12:00:00.900Z"),
    });
    const bundle = await buildSyncPilotDiagnosticBundle({
      ...identity,
      revision: 1,
      pendingCount: 0,
      syncState: "synced",
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      freshnessMode: "live",
    }, { flag: "1", storage });
    expect(bundle?.measurement.qualifyingEventCount).toBe(1);
    expect(bundle?.measurement.candidateEventCount).toBe(1);
    expect(bundle?.measurement.unpaintedEventCount).toBe(0);
    expect(bundle?.latency).toEqual({
      sampleCount: 0,
      invalidClockSampleCount: 1,
      p50Ms: null,
      p95Ms: null,
      maxMs: null,
    });
  });

  it("retains only an allowlisted command fallback reason", async () => {
    const storage = memoryStorage();
    await startRun(storage);
    await recordSyncPilotTrace({
      ...identity,
      phase: "poll-fallback",
      revision: 19,
      transport: "poll",
      fallbackReason: "revision-gap",
    }, { flag: "1", storage });
    await recordSyncPilotTrace({
      ...identity,
      phase: "poll-fallback",
      revision: 20,
      transport: "poll",
      fallbackReason: "raw private explanation",
    }, { flag: "1", storage });

    const bundle = await buildSyncPilotDiagnosticBundle({
      ...identity,
      revision: 20,
      pendingCount: 0,
      syncState: "syncing",
      realtimeStatus: "SUBSCRIBED",
      offline: false,
      freshnessMode: "live",
    }, { flag: "1", storage });

    expect(bundle?.traces.map((row) => row.fallbackReason)).toEqual(["revision-gap", null]);
    expect(JSON.stringify(bundle)).not.toContain("raw private explanation");
  });
});
