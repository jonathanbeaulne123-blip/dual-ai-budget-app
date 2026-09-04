import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  evaluateSyncDailyProof,
  summarizeSyncSamples,
  SYNC_DAILY_PROOF_MIN_SAMPLES,
  type ScopedSyncSample,
  type SyncClockCalibration,
  type SyncDailyProofInput,
  type SyncProofScope,
} from "../src/syncDailyProof.ts";

const RELEASE_SHA = "a".repeat(40);
const HOUSEHOLD_HASH = "b".repeat(16);
const MEMBER_A = "c".repeat(16);
const MEMBER_B = "d".repeat(16);
const DEVICE_A = "e".repeat(16);
const DEVICE_B = "f".repeat(16);
const AUDIT_HASH = "1".repeat(64);
const BASE_TIME = Date.parse("2026-09-04T14:00:00.000Z");
const temporaryDirectories: string[] = [];

const scope: SyncProofScope = {
  environment: "development",
  releaseSha: RELEASE_SHA,
  householdId: HOUSEHOLD_HASH,
  participants: [
    { memberId: MEMBER_A, deviceId: DEVICE_A },
    { memberId: MEMBER_B, deviceId: DEVICE_B },
  ],
};

const calibrations: SyncClockCalibration[] = [
  { deviceId: DEVICE_A, measuredAt: "2026-09-04T13:59:30.000Z", offsetMs: 0, uncertaintyMs: 0, source: "authenticated-cloud-clock" },
  { deviceId: DEVICE_A, measuredAt: "2026-09-04T14:19:30.000Z", offsetMs: 0, uncertaintyMs: 0, source: "authenticated-cloud-clock" },
  { deviceId: DEVICE_B, measuredAt: "2026-09-04T13:59:30.000Z", offsetMs: 0, uncertaintyMs: 0, source: "authenticated-cloud-clock" },
  { deviceId: DEVICE_B, measuredAt: "2026-09-04T14:19:30.000Z", offsetMs: 0, uncertaintyMs: 0, source: "authenticated-cloud-clock" },
];

function instant(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

function sample(index: number, latencyMs = 200, overrides: Partial<ScopedSyncSample> = {}): ScopedSyncSample {
  const senderAccepted = BASE_TIME + index * 10_000;
  const fromA = index % 2 === 1;
  return {
    commandId: index.toString(16).padStart(16, "0"),
    environment: "development",
    releaseSha: RELEASE_SHA,
    householdId: HOUSEHOLD_HASH,
    senderMemberId: fromA ? MEMBER_A : MEMBER_B,
    receiverMemberId: fromA ? MEMBER_B : MEMBER_A,
    senderDeviceId: fromA ? DEVICE_A : DEVICE_B,
    receiverDeviceId: fromA ? DEVICE_B : DEVICE_A,
    senderAcceptedAt: instant(senderAccepted),
    cloudAckAt: instant(senderAccepted + Math.min(50, latencyMs)),
    receiverVisibleAt: instant(senderAccepted + latencyMs),
    transport: "realtime-command",
    duplicateCount: 0,
    receiverRevision: 100 + index,
    receiverAuditHash: AUDIT_HASH,
    activeUiVisible: true,
    ...overrides,
  };
}

function samples(count = SYNC_DAILY_PROOF_MIN_SAMPLES): ScopedSyncSample[] {
  return Array.from({ length: count }, (_, offset) => sample(offset + 1, offset + 1));
}

function proofInput(evidenceSource: SyncDailyProofInput["evidenceSource"] = "synthetic-contract-test"): SyncDailyProofInput {
  const rows = samples(SYNC_DAILY_PROOF_MIN_SAMPLES + 1);
  rows[0] = sample(1, 900, {
    senderAcceptedAt: "2026-09-04T14:00:09.100Z",
    cloudAckAt: "2026-09-04T14:00:09.200Z",
    receiverVisibleAt: "2026-09-04T14:00:10.000Z",
  });
  rows[98] = sample(99, 300);
  rows[98] = { ...rows[98]!, cloudAckAt: "2026-09-04T14:16:30.200Z" };
  rows[100] = sample(101, 3_500, { transport: "poll" });
  return {
    kind: "hearth-sync-daily-proof-input",
    version: 1,
    evidenceSource,
    releaseDeployedAt: "2026-09-04T13:59:00.000Z",
    collectedAt: "2026-09-04T14:20:00.000Z",
    ...scope,
    clockCalibrations: calibrations.map((calibration) => ({ ...calibration })),
    samples: rows,
    recovery: {
      reconnect: {
        commandId: rows[0]!.commandId,
        closedAt: "2026-09-04T14:00:09.000Z",
        authenticatedAt: "2026-09-04T14:00:09.500Z",
        caughtUpAt: "2026-09-04T14:00:10.000Z",
        statusBefore: "CLOSED",
        statusAfter: "SUBSCRIBED",
        matchingIdentity: true,
      },
      pollRecovery: {
        commandId: rows[100]!.commandId,
        realtimeRefusedAt: "2026-09-04T14:16:50.000Z",
        pollAcceptedAt: "2026-09-04T14:16:53.500Z",
        realtimeRecoveredAt: "2026-09-04T14:16:54.000Z",
        statusBefore: "CHANNEL_ERROR",
        statusAfter: "SUBSCRIBED",
        duplicateCount: 0,
      },
      relaunch: {
        commandId: rows[98]!.commandId,
        enqueuedAt: "2026-09-04T14:16:30.050Z",
        relaunchedAt: "2026-09-04T14:16:30.100Z",
        acceptedAt: "2026-09-04T14:16:30.300Z",
        outboxIdentityPreserved: true,
        receiverAcceptanceCount: 1,
        duplicateCount: 0,
      },
    },
  };
}

afterEach(() => {
  while (temporaryDirectories.length) rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
});

describe("Readiness 4 daily sync proof", () => {
  it("computes deterministic nearest-rank timing over 100 fresh samples", () => {
    const summary = summarizeSyncSamples(samples(), scope, calibrations);
    expect(summary).toMatchObject({
      count: 100,
      realtimeCount: 100,
      pollCount: 0,
      participantOneToTwoCount: 50,
      participantTwoToOneCount: 50,
      p50Ms: 50,
      p95Ms: 95,
      maxMs: 100,
      realtimeP50Ms: 50,
      realtimeP95Ms: 95,
      realtimeMaxMs: 100,
      duplicates: 0,
      wrongScope: 0,
      revisionGaps: 0,
      invalidSamples: 0,
      clockCalibrationPass: true,
      pass: true,
    });
  });

  it("refuses clock disorder, duplicate commands, revision gaps, and wrong scope", () => {
    const clockRows = samples();
    clockRows[0] = sample(1, 100, {
      cloudAckAt: "2026-09-04T14:00:01.300Z",
      receiverVisibleAt: "2026-09-04T14:00:01.200Z",
    });
    expect(summarizeSyncSamples(clockRows, scope, calibrations)).toMatchObject({ invalidSamples: 1, pass: false });

    const duplicateRows = samples();
    duplicateRows[1] = { ...duplicateRows[1]!, commandId: duplicateRows[0]!.commandId };
    expect(summarizeSyncSamples(duplicateRows, scope, calibrations)).toMatchObject({ duplicates: 1, pass: false });

    const gapRows = samples();
    gapRows[50] = { ...gapRows[50]!, receiverRevision: gapRows[50]!.receiverRevision + 1 };
    expect(summarizeSyncSamples(gapRows, scope, calibrations)).toMatchObject({ revisionGaps: 2, pass: false });

    const wrongScopeRows = samples();
    wrongScopeRows[0] = { ...wrongScopeRows[0]!, householdId: "9".repeat(16) };
    expect(summarizeSyncSamples(wrongScopeRows, scope, calibrations)).toMatchObject({ wrongScope: 1, pass: false });

    const wrongDeviceRows = samples();
    wrongDeviceRows[0] = { ...wrongDeviceRows[0]!, senderDeviceId: DEVICE_B, receiverDeviceId: DEVICE_A };
    expect(summarizeSyncSamples(wrongDeviceRows, scope, calibrations)).toMatchObject({ wrongScope: 1, pass: false });
  });

  it("requires 50 fresh Realtime samples in each participant direction", () => {
    const oneWay = samples().map((row) => ({
      ...row,
      senderMemberId: MEMBER_A,
      receiverMemberId: MEMBER_B,
      senderDeviceId: DEVICE_A,
      receiverDeviceId: DEVICE_B,
    }));
    expect(summarizeSyncSamples(oneWay, scope, calibrations)).toMatchObject({
      participantOneToTwoCount: 100,
      participantTwoToOneCount: 0,
      pass: false,
    });
  });

  it("uses bounded clock calibration and conservative uncertainty for cross-device latency", () => {
    const skewed = samples().map((row) => {
      const shift = (value: string) => instant(Date.parse(value) - 700);
      return {
        ...row,
        senderAcceptedAt: row.senderDeviceId === DEVICE_B ? shift(row.senderAcceptedAt) : row.senderAcceptedAt,
        cloudAckAt: row.senderDeviceId === DEVICE_B ? shift(row.cloudAckAt) : row.cloudAckAt,
        receiverVisibleAt: row.receiverDeviceId === DEVICE_B ? shift(row.receiverVisibleAt) : row.receiverVisibleAt,
      };
    });
    const skewCalibrations: SyncClockCalibration[] = calibrations.map((calibration) => calibration.deviceId === DEVICE_B
      ? { ...calibration, measuredAt: instant(Date.parse(calibration.measuredAt) - 700), offsetMs: -700 }
      : calibration);
    expect(summarizeSyncSamples(skewed, scope, skewCalibrations)).toMatchObject({
      realtimeP95Ms: 95,
      clockCalibrationPass: true,
      pass: true,
    });

    const unbracketed = skewCalibrations.map((calibration) => calibration.deviceId === DEVICE_B
      ? { ...calibration, measuredAt: instant(Date.parse(calibration.measuredAt) + 120_000) }
      : calibration);
    expect(summarizeSyncSamples(skewed, scope, unbracketed)).toMatchObject({ pass: false });

    const uncertain = proofInput();
    uncertain.clockCalibrations[0] = { ...uncertain.clockCalibrations[0]!, uncertaintyMs: 51 };
    const uncertainResult = evaluateSyncDailyProof(uncertain, RELEASE_SHA);
    expect(uncertainResult.issues).toContain("SYNC-INPUT-CLOCK-CALIBRATION");
    expect(uncertainResult.contractPass).toBe(false);

    const drifting = proofInput();
    drifting.clockCalibrations[1] = { ...drifting.clockCalibrations[1]!, offsetMs: 101 };
    const driftingResult = evaluateSyncDailyProof(drifting, RELEASE_SHA);
    expect(driftingResult.issues).toContain("SYNC-INPUT-CLOCK-CALIBRATION");
    expect(driftingResult.contractPass).toBe(false);
  });

  it("requires CLOSED to matching authenticated catch-up, poll within four seconds, Realtime recovery, and relaunch exactly once", () => {
    const input = proofInput();
    const result = evaluateSyncDailyProof(input, RELEASE_SHA);
    expect(result.classification).toBe("synthetic-contract-only");
    expect(result.summary.pass).toBe(true);
    expect(result.recovery).toEqual({
      reconnectPass: true,
      pollRecoveryPass: true,
      relaunchPass: true,
      pass: true,
    });
    expect(result.issues).toEqual(["SYNC-LIVE-SOURCE-REQUIRED"]);
    expect(result.contractPass).toBe(true);
    expect(result.pass).toBe(false);

    const slowPoll = proofInput();
    slowPoll.recovery.pollRecovery.pollAcceptedAt = "2026-09-04T14:16:54.001Z";
    const slowResult = evaluateSyncDailyProof(slowPoll, RELEASE_SHA);
    expect(slowResult.recovery.pollRecoveryPass).toBe(false);
    expect(slowResult.issues).toContain("SYNC-RECOVERY-POLL-FAILED");

    const mislabeledPoll = proofInput();
    mislabeledPoll.samples[100] = { ...mislabeledPoll.samples[100]!, transport: "realtime-command" };
    const mislabeledResult = evaluateSyncDailyProof(mislabeledPoll, RELEASE_SHA);
    expect(mislabeledResult.recovery.pollRecoveryPass).toBe(false);

    const postAuthAck = proofInput();
    postAuthAck.recovery.reconnect.authenticatedAt = "2026-09-04T14:00:09.150Z";
    const postAuthResult = evaluateSyncDailyProof(postAuthAck, RELEASE_SHA);
    expect(postAuthResult.recovery.reconnectPass).toBe(false);

    const postAckRelaunch = proofInput();
    postAckRelaunch.recovery.relaunch.relaunchedAt = "2026-09-04T14:16:30.250Z";
    const postAckResult = evaluateSyncDailyProof(postAckRelaunch, RELEASE_SHA);
    expect(postAckResult.recovery.relaunchPass).toBe(false);

    const duplicateRelaunch = proofInput();
    duplicateRelaunch.recovery.relaunch.receiverAcceptanceCount = 2;
    const duplicateResult = evaluateSyncDailyProof(duplicateRelaunch, RELEASE_SHA);
    expect(duplicateResult.recovery.relaunchPass).toBe(false);
    expect(duplicateResult.issues).toContain("SYNC-RECOVERY-RELAUNCH-FAILED");
  });

  it("rejects unknown or private fields instead of projecting them into evidence", () => {
    const input = proofInput() as unknown as Record<string, unknown>;
    input.email = "private@example.com";
    const rows = input.samples as Array<Record<string, unknown>>;
    rows[0] = { ...rows[0], amountCents: 12_345, note: "private note" };
    const result = evaluateSyncDailyProof(input, RELEASE_SHA);
    expect(result.issues).toContain("SYNC-INPUT-UNKNOWN-FIELD");
    expect(result.issues).toContain("SYNC-SAMPLE-SHAPE-1");
    expect(result.summary.invalidSamples).toBe(1);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/private@example\.com|12345|private note/);
    expect(result.pass).toBe(false);
  });

  it("refuses a mismatched release SHA and never promotes synthetic evidence to live proof", () => {
    const result = evaluateSyncDailyProof(proofInput(), "2".repeat(40));
    expect(result.issues).toContain("SYNC-INPUT-RELEASE-MISMATCH");
    expect(result.classification).toBe("synthetic-contract-only");
    expect(result.pass).toBe(false);
  });

  it("keeps even a structurally passing self-declared live ledger at mandatory operator review", () => {
    const fabricated = proofInput("live-two-account-development");
    const result = evaluateSyncDailyProof(fabricated, RELEASE_SHA);
    expect(result.contractPass).toBe(true);
    expect(result.classification).toBe("operator-review-required");
    expect(result.issues).toContain("SYNC-WITNESS-REVIEW-REQUIRED");
    expect(result.pass).toBe(false);
  });

  it("refuses samples and recovery timestamps outside the exact release evidence window", () => {
    const input = proofInput();
    input.releaseDeployedAt = "2026-09-04T14:00:30.000Z";
    const result = evaluateSyncDailyProof(input, RELEASE_SHA);
    expect(result.issues).toContain("SYNC-SAMPLE-EVIDENCE-WINDOW");
    expect(result.recovery.reconnectPass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it("runs the collector fail-closed for a synthetic contract fixture", () => {
    const directory = mkdtempSync(join(tmpdir(), "hearth-sync-proof-"));
    temporaryDirectories.push(directory);
    const inputPath = join(directory, "input.json");
    const outputPath = join(directory, "result.json");
    writeFileSync(inputPath, JSON.stringify(proofInput()), "utf8");
    const processResult = spawnSync(process.execPath, [
      "scripts/collect-sync-proof.mjs",
      "--input",
      inputPath,
      "--release-sha",
      RELEASE_SHA,
      "--output",
      outputPath,
    ], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
    expect(processResult.status).toBe(1);
    expect(processResult.stdout).toContain("synthetic-contract-only");
    const output = JSON.parse(readFileSync(outputPath, "utf8")) as { pass: boolean; classification: string };
    expect(output).toEqual(expect.objectContaining({ pass: false, classification: "synthetic-contract-only" }));
  });
});
