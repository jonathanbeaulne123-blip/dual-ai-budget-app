import { describe, expect, it } from "vitest";
import {
  buildSyncPilotDiagnosticBundle,
  copySyncPilotDiagnostic,
  recordSyncPilotTrace,
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
    await recordSyncPilotTrace({
      ...identity,
      phase: "remote-accepted",
      confirmationId: "raw-confirmation-secret",
      revision: 12,
      pendingCount: 0,
      transport: "command-realtime",
      sourceAcceptedAt: "2026-08-31T12:00:00.000Z",
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
    expect(bundle?.latency).toEqual({ sampleCount: 1, p50Ms: 400, p95Ms: 400, maxMs: 400 });
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
    for (let index = 1; index <= 100; index += 1) {
      await recordSyncPilotTrace({
        ...identity,
        phase: "remote-accepted",
        confirmationId: `confirmation-${index}`,
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
    expect(bundle?.latency.p50Ms).toBe(50);
    expect(bundle?.latency.p95Ms).toBe(95);
    expect(bundle?.latency.maxMs).toBe(100);
  });

  it("retains only the newest 500 local trace records", async () => {
    const storage = memoryStorage();
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
});
