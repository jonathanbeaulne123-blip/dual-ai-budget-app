export const SYNC_DAILY_PROOF_MIN_SAMPLES = 100;
export const SYNC_DAILY_PROOF_MIN_REALTIME_SAMPLES = 100;
export const SYNC_DAILY_PROOF_REALTIME_TARGET_MS = 500;
export const SYNC_DAILY_PROOF_POLL_TARGET_MS = 4_000;
export const SYNC_DAILY_PROOF_MAX_CLOCK_UNCERTAINTY_MS = 50;
export const SYNC_DAILY_PROOF_MAX_CLOCK_DRIFT_MS = 100;

const MAX_SAMPLE_LATENCY_MS = 86_400_000;
const HASH16 = /^[a-f0-9]{16}$/;
const HASH64 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;

export type SyncSampleTransport = "realtime-command" | "realtime-snapshot" | "poll";

/**
 * Every identifier in a retained sample is a one-way hash. Raw command,
 * household, member, or device identifiers are not part of this contract.
 */
export type SyncSample = {
  commandId: string;
  senderMemberId: string;
  receiverMemberId: string;
  senderAcceptedAt: string;
  cloudAckAt: string;
  receiverVisibleAt: string;
  transport: SyncSampleTransport;
  duplicateCount: number;
  receiverRevision: number;
  receiverAuditHash: string;
};

export type ScopedSyncSample = SyncSample & {
  environment: "development";
  releaseSha: string;
  householdId: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  activeUiVisible: true;
};

export type SyncProofParticipant = {
  memberId: string;
  deviceId: string;
};

export type SyncProofScope = {
  environment: "development";
  releaseSha: string;
  householdId: string;
  participants: [SyncProofParticipant, SyncProofParticipant];
};

/** Device wall-clock offset from the authenticated Development cloud clock. */
export type SyncClockCalibration = {
  deviceId: string;
  measuredAt: string;
  offsetMs: number;
  uncertaintyMs: number;
  source: "authenticated-cloud-clock";
};

export type SyncSampleSummary = {
  count: number;
  realtimeCount: number;
  pollCount: number;
  participantOneToTwoCount: number;
  participantTwoToOneCount: number;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
  realtimeP50Ms: number | null;
  realtimeP95Ms: number | null;
  realtimeMaxMs: number | null;
  pollMaxMs: number | null;
  duplicates: number;
  wrongScope: number;
  revisionGaps: number;
  invalidSamples: number;
  clockCalibrationPass: boolean;
  pass: boolean;
};

export type ReconnectProof = {
  commandId: string;
  closedAt: string;
  authenticatedAt: string;
  caughtUpAt: string;
  statusBefore: "CLOSED";
  statusAfter: "SUBSCRIBED";
  matchingIdentity: true;
};

export type PollRecoveryProof = {
  commandId: string;
  realtimeRefusedAt: string;
  pollAcceptedAt: string;
  realtimeRecoveredAt: string;
  statusBefore: "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";
  statusAfter: "SUBSCRIBED";
  duplicateCount: number;
};

export type RelaunchProof = {
  commandId: string;
  enqueuedAt: string;
  relaunchedAt: string;
  acceptedAt: string;
  outboxIdentityPreserved: true;
  receiverAcceptanceCount: number;
  duplicateCount: number;
};

export type SyncRecoveryProofs = {
  reconnect: ReconnectProof;
  pollRecovery: PollRecoveryProof;
  relaunch: RelaunchProof;
};

export type SyncDailyProofInput = SyncProofScope & {
  kind: "hearth-sync-daily-proof-input";
  version: 1;
  evidenceSource: "live-two-account-development" | "synthetic-contract-test";
  releaseDeployedAt: string;
  collectedAt: string;
  clockCalibrations: SyncClockCalibration[];
  samples: ScopedSyncSample[];
  recovery: SyncRecoveryProofs;
};

export type SyncRecoverySummary = {
  reconnectPass: boolean;
  pollRecoveryPass: boolean;
  relaunchPass: boolean;
  pass: boolean;
};

export type SyncDailyProofResult = {
  kind: "hearth-sync-daily-proof-result";
  version: 1;
  classification: "operator-review-required" | "evidence-ledger-failed" | "synthetic-contract-only";
  releaseSha: string | null;
  summary: SyncSampleSummary;
  recovery: SyncRecoverySummary;
  issues: string[];
  contractPass: boolean;
  pass: boolean;
};

const INPUT_FIELDS = new Set([
  "kind",
  "version",
  "evidenceSource",
  "releaseDeployedAt",
  "collectedAt",
  "clockCalibrations",
  "environment",
  "releaseSha",
  "householdId",
  "participants",
  "samples",
  "recovery",
]);
const SAMPLE_FIELDS = new Set([
  "commandId",
  "environment",
  "releaseSha",
  "householdId",
  "senderMemberId",
  "receiverMemberId",
  "senderDeviceId",
  "receiverDeviceId",
  "senderAcceptedAt",
  "cloudAckAt",
  "receiverVisibleAt",
  "transport",
  "duplicateCount",
  "receiverRevision",
  "receiverAuditHash",
  "activeUiVisible",
]);
const PARTICIPANT_FIELDS = new Set(["memberId", "deviceId"]);
const CLOCK_CALIBRATION_FIELDS = new Set(["deviceId", "measuredAt", "offsetMs", "uncertaintyMs", "source"]);
const RECOVERY_FIELDS = new Set(["reconnect", "pollRecovery", "relaunch"]);
const RECONNECT_FIELDS = new Set([
  "commandId",
  "closedAt",
  "authenticatedAt",
  "caughtUpAt",
  "statusBefore",
  "statusAfter",
  "matchingIdentity",
]);
const POLL_RECOVERY_FIELDS = new Set([
  "commandId",
  "realtimeRefusedAt",
  "pollAcceptedAt",
  "realtimeRecoveredAt",
  "statusBefore",
  "statusAfter",
  "duplicateCount",
]);
const RELAUNCH_FIELDS = new Set([
  "commandId",
  "enqueuedAt",
  "relaunchedAt",
  "acceptedAt",
  "outboxIdentityPreserved",
  "receiverAcceptanceCount",
  "duplicateCount",
]);
const TRANSPORTS = new Set<SyncSampleTransport>(["realtime-command", "realtime-snapshot", "poll"]);
const TERMINAL_STATUSES = new Set(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  return Object.keys(value).every((key) => fields.has(key));
}

function validInstant(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function validRevision(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function validSignedMilliseconds(value: unknown): value is number {
  return Number.isInteger(value) && Math.abs(Number(value)) <= 300_000;
}

function projectParticipants(value: unknown): [SyncProofParticipant, SyncProofParticipant] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const projected = value.map((participant) => {
    if (!isRecord(participant) || !hasOnlyFields(participant, PARTICIPANT_FIELDS)) return null;
    if (!HASH16.test(String(participant.memberId ?? "")) || !HASH16.test(String(participant.deviceId ?? ""))) return null;
    return { memberId: String(participant.memberId), deviceId: String(participant.deviceId) };
  });
  if (!projected[0] || !projected[1]) return null;
  if (projected[0].memberId === projected[1].memberId || projected[0].deviceId === projected[1].deviceId) return null;
  return [projected[0], projected[1]];
}

function nearestRank(sorted: number[], fraction: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
}

function timingSummary(latencies: number[]) {
  const sorted = [...latencies].sort((left, right) => left - right);
  return {
    p50Ms: nearestRank(sorted, 0.5),
    p95Ms: nearestRank(sorted, 0.95),
    maxMs: sorted.at(-1) ?? null,
  };
}

function projectClockCalibrations(
  value: unknown,
  participants: [SyncProofParticipant, SyncProofParticipant] | null,
  window: { releaseDeployedAt: number; collectedAt: number } | null,
): SyncClockCalibration[] | null {
  if (!participants || !window || !Array.isArray(value) || value.length !== 4) return null;
  const projected: SyncClockCalibration[] = [];
  for (const calibration of value) {
    if (!isRecord(calibration) || !hasOnlyFields(calibration, CLOCK_CALIBRATION_FIELDS)) return null;
    if (
      !HASH16.test(String(calibration.deviceId ?? ""))
      || !validInstant(calibration.measuredAt)
      || !validSignedMilliseconds(calibration.offsetMs)
      || !validCount(calibration.uncertaintyMs)
      || Number(calibration.uncertaintyMs) > SYNC_DAILY_PROOF_MAX_CLOCK_UNCERTAINTY_MS
      || calibration.source !== "authenticated-cloud-clock"
    ) return null;
    const measuredAt = Date.parse(calibration.measuredAt) - Number(calibration.offsetMs);
    if (measuredAt < window.releaseDeployedAt - 300_000 || measuredAt > window.collectedAt) return null;
    projected.push(calibration as SyncClockCalibration);
  }
  for (const participant of participants) {
    const pair = projected
      .filter((calibration) => calibration.deviceId === participant.deviceId)
      .sort((left, right) => Date.parse(left.measuredAt) - Date.parse(right.measuredAt));
    if (
      pair.length !== 2
      || Date.parse(pair[0]!.measuredAt) === Date.parse(pair[1]!.measuredAt)
      || Math.abs(pair[1]!.offsetMs - pair[0]!.offsetMs) > SYNC_DAILY_PROOF_MAX_CLOCK_DRIFT_MS
    ) return null;
  }
  if (projected.some((calibration) => !participants.some((participant) => participant.deviceId === calibration.deviceId))) {
    return null;
  }
  return projected;
}

type CorrectedInstant = { milliseconds: number; uncertaintyMs: number };

function definitelyAtOrBefore(left: CorrectedInstant, right: CorrectedInstant): boolean {
  return left.milliseconds + left.uncertaintyMs <= right.milliseconds - right.uncertaintyMs;
}

function definitelyWithin(
  instant: CorrectedInstant,
  window: { releaseDeployedAt: number; collectedAt: number },
): boolean {
  return instant.milliseconds - instant.uncertaintyMs >= window.releaseDeployedAt
    && instant.milliseconds + instant.uncertaintyMs <= window.collectedAt;
}

function correctInstant(
  deviceId: string,
  instant: string,
  calibrations: SyncClockCalibration[],
): CorrectedInstant | null {
  const localMilliseconds = Date.parse(instant);
  const pair = calibrations
    .filter((calibration) => calibration.deviceId === deviceId)
    .sort((left, right) => Date.parse(left.measuredAt) - Date.parse(right.measuredAt));
  if (!Number.isFinite(localMilliseconds) || pair.length !== 2) return null;
  const before = Date.parse(pair[0]!.measuredAt);
  const after = Date.parse(pair[1]!.measuredAt);
  if (localMilliseconds < before || localMilliseconds > after || before === after) return null;
  const fraction = (localMilliseconds - before) / (after - before);
  const offsetMs = pair[0]!.offsetMs + fraction * (pair[1]!.offsetMs - pair[0]!.offsetMs);
  return {
    milliseconds: localMilliseconds - offsetMs,
    uncertaintyMs: Math.max(pair[0]!.uncertaintyMs, pair[1]!.uncertaintyMs),
  };
}

function sampleLatency(sample: ScopedSyncSample, calibrations: SyncClockCalibration[]): number | null {
  const sender = correctInstant(sample.senderDeviceId, sample.senderAcceptedAt, calibrations);
  const cloud = correctInstant(sample.senderDeviceId, sample.cloudAckAt, calibrations);
  const visible = correctInstant(sample.receiverDeviceId, sample.receiverVisibleAt, calibrations);
  if (!sender || !cloud || !visible) return null;
  if (sender.milliseconds > cloud.milliseconds || !definitelyAtOrBefore(cloud, visible)) return null;
  // Use the conservative upper bound so clock uncertainty can never make a
  // transfer look faster than the evidence supports.
  const latency = visible.milliseconds - sender.milliseconds + sender.uncertaintyMs + visible.uncertaintyMs;
  return latency >= 0 && latency <= MAX_SAMPLE_LATENCY_MS ? Math.ceil(latency) : null;
}

function sampleScopeMatches(sample: ScopedSyncSample, scope: SyncProofScope): boolean {
  const sender = scope.participants.find((participant) => (
    participant.memberId === sample.senderMemberId && participant.deviceId === sample.senderDeviceId
  ));
  const receiver = scope.participants.find((participant) => (
    participant.memberId === sample.receiverMemberId && participant.deviceId === sample.receiverDeviceId
  ));
  return sample.environment === scope.environment
    && sample.releaseSha === scope.releaseSha
    && sample.householdId === scope.householdId
    && Boolean(sender)
    && Boolean(receiver)
    && sender !== receiver;
}

export function summarizeSyncSamples(
  samples: ScopedSyncSample[],
  scope: SyncProofScope,
  calibrations: SyncClockCalibration[],
  invalidSamples = 0,
): SyncSampleSummary {
  const seenCommands = new Set<string>();
  let repeatedCommandIds = 0;
  let wrongScope = 0;
  let invalid = invalidSamples;
  const allLatencies: number[] = [];
  const realtimeLatencies: number[] = [];
  const pollLatencies: number[] = [];
  let participantOneToTwoCount = 0;
  let participantTwoToOneCount = 0;
  const clockCalibrationPass = calibrations.length === 4;

  for (const sample of samples) {
    if (seenCommands.has(sample.commandId)) repeatedCommandIds += 1;
    seenCommands.add(sample.commandId);
    if (!sampleScopeMatches(sample, scope)) wrongScope += 1;
    const latency = sampleLatency(sample, calibrations);
    if (latency == null || sample.activeUiVisible !== true || !HASH64.test(sample.receiverAuditHash)) {
      invalid += 1;
      continue;
    }
    allLatencies.push(latency);
    if (sample.transport === "poll") pollLatencies.push(latency);
    else realtimeLatencies.push(latency);
    if (sample.transport !== "poll" && (
      sample.senderMemberId === scope.participants[0].memberId
      && sample.senderDeviceId === scope.participants[0].deviceId
      && sample.receiverMemberId === scope.participants[1].memberId
      && sample.receiverDeviceId === scope.participants[1].deviceId
    )) participantOneToTwoCount += 1;
    if (sample.transport !== "poll" && (
      sample.senderMemberId === scope.participants[1].memberId
      && sample.senderDeviceId === scope.participants[1].deviceId
      && sample.receiverMemberId === scope.participants[0].memberId
      && sample.receiverDeviceId === scope.participants[0].deviceId
    )) participantTwoToOneCount += 1;
  }

  const ordered = [...samples].sort((left, right) => (
    (correctInstant(left.receiverDeviceId, left.receiverVisibleAt, calibrations)?.milliseconds ?? Number.POSITIVE_INFINITY)
      - (correctInstant(right.receiverDeviceId, right.receiverVisibleAt, calibrations)?.milliseconds ?? Number.POSITIVE_INFINITY)
    || left.commandId.localeCompare(right.commandId)
  ));
  let revisionGaps = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index]!.receiverRevision !== ordered[index - 1]!.receiverRevision + 1) revisionGaps += 1;
  }

  const duplicates = repeatedCommandIds + samples.reduce((total, sample) => total + sample.duplicateCount, 0);
  const allTiming = timingSummary(allLatencies);
  const realtimeTiming = timingSummary(realtimeLatencies);
  const pollTiming = timingSummary(pollLatencies);
  const pass = samples.length >= SYNC_DAILY_PROOF_MIN_SAMPLES
    && realtimeLatencies.length >= SYNC_DAILY_PROOF_MIN_REALTIME_SAMPLES
    && participantOneToTwoCount >= SYNC_DAILY_PROOF_MIN_REALTIME_SAMPLES / 2
    && participantTwoToOneCount >= SYNC_DAILY_PROOF_MIN_REALTIME_SAMPLES / 2
    && clockCalibrationPass
    && realtimeTiming.p95Ms != null
    && realtimeTiming.p95Ms <= SYNC_DAILY_PROOF_REALTIME_TARGET_MS
    && (pollTiming.maxMs == null || pollTiming.maxMs <= SYNC_DAILY_PROOF_POLL_TARGET_MS)
    && duplicates === 0
    && wrongScope === 0
    && revisionGaps === 0
    && invalid === 0;

  return {
    count: samples.length,
    realtimeCount: realtimeLatencies.length,
    pollCount: pollLatencies.length,
    participantOneToTwoCount,
    participantTwoToOneCount,
    ...allTiming,
    realtimeP50Ms: realtimeTiming.p50Ms,
    realtimeP95Ms: realtimeTiming.p95Ms,
    realtimeMaxMs: realtimeTiming.maxMs,
    pollMaxMs: pollTiming.maxMs,
    duplicates,
    wrongScope,
    revisionGaps,
    invalidSamples: invalid,
    clockCalibrationPass,
    pass,
  };
}

function projectSample(value: unknown): ScopedSyncSample | null {
  if (!isRecord(value) || !hasOnlyFields(value, SAMPLE_FIELDS)) return null;
  if (
    !HASH16.test(String(value.commandId ?? ""))
    || value.environment !== "development"
    || !GIT_SHA.test(String(value.releaseSha ?? ""))
    || !HASH16.test(String(value.householdId ?? ""))
    || !HASH16.test(String(value.senderMemberId ?? ""))
    || !HASH16.test(String(value.receiverMemberId ?? ""))
    || !HASH16.test(String(value.senderDeviceId ?? ""))
    || !HASH16.test(String(value.receiverDeviceId ?? ""))
    || !validInstant(value.senderAcceptedAt)
    || !validInstant(value.cloudAckAt)
    || !validInstant(value.receiverVisibleAt)
    || typeof value.transport !== "string"
    || !TRANSPORTS.has(value.transport as SyncSampleTransport)
    || !validCount(value.duplicateCount)
    || !validRevision(value.receiverRevision)
    || !HASH64.test(String(value.receiverAuditHash ?? ""))
    || value.activeUiVisible !== true
  ) return null;
  return value as ScopedSyncSample;
}

function projectReconnect(value: unknown): ReconnectProof | null {
  if (!isRecord(value) || !hasOnlyFields(value, RECONNECT_FIELDS)) return null;
  if (
    !HASH16.test(String(value.commandId ?? ""))
    || !validInstant(value.closedAt)
    || !validInstant(value.authenticatedAt)
    || !validInstant(value.caughtUpAt)
    || value.statusBefore !== "CLOSED"
    || value.statusAfter !== "SUBSCRIBED"
    || value.matchingIdentity !== true
  ) return null;
  return value as ReconnectProof;
}

function projectPollRecovery(value: unknown): PollRecoveryProof | null {
  if (!isRecord(value) || !hasOnlyFields(value, POLL_RECOVERY_FIELDS)) return null;
  if (
    !HASH16.test(String(value.commandId ?? ""))
    || !validInstant(value.realtimeRefusedAt)
    || !validInstant(value.pollAcceptedAt)
    || !validInstant(value.realtimeRecoveredAt)
    || typeof value.statusBefore !== "string"
    || !TERMINAL_STATUSES.has(value.statusBefore)
    || value.statusAfter !== "SUBSCRIBED"
    || !validCount(value.duplicateCount)
  ) return null;
  return value as PollRecoveryProof;
}

function projectRelaunch(value: unknown): RelaunchProof | null {
  if (!isRecord(value) || !hasOnlyFields(value, RELAUNCH_FIELDS)) return null;
  if (
    !HASH16.test(String(value.commandId ?? ""))
    || !validInstant(value.enqueuedAt)
    || !validInstant(value.relaunchedAt)
    || !validInstant(value.acceptedAt)
    || value.outboxIdentityPreserved !== true
    || !validCount(value.receiverAcceptanceCount)
    || !validCount(value.duplicateCount)
  ) return null;
  return value as RelaunchProof;
}

function recoverySummary(
  value: unknown,
  samples: ScopedSyncSample[],
  calibrations: SyncClockCalibration[],
  issues: string[],
  window: { releaseDeployedAt: number; collectedAt: number } | null,
): SyncRecoverySummary {
  if (!isRecord(value) || !hasOnlyFields(value, RECOVERY_FIELDS)) {
    issues.push("SYNC-RECOVERY-SHAPE");
    return { reconnectPass: false, pollRecoveryPass: false, relaunchPass: false, pass: false };
  }
  const reconnect = projectReconnect(value.reconnect);
  const pollRecovery = projectPollRecovery(value.pollRecovery);
  const relaunch = projectRelaunch(value.relaunch);
  if (!reconnect) issues.push("SYNC-RECOVERY-RECONNECT-SHAPE");
  if (!pollRecovery) issues.push("SYNC-RECOVERY-POLL-SHAPE");
  if (!relaunch) issues.push("SYNC-RECOVERY-RELAUNCH-SHAPE");
  const sampleByCommand = new Map(samples.map((sample) => [sample.commandId, sample]));
  const reconnectSample = reconnect ? sampleByCommand.get(reconnect.commandId) : undefined;
  const pollSample = pollRecovery ? sampleByCommand.get(pollRecovery.commandId) : undefined;
  const relaunchSample = relaunch ? sampleByCommand.get(relaunch.commandId) : undefined;

  const corrected = (deviceId: string, instant: string) => correctInstant(deviceId, instant, calibrations);
  const reconnectClosed = reconnect && reconnectSample ? corrected(reconnectSample.receiverDeviceId, reconnect.closedAt) : undefined;
  const reconnectAuthenticated = reconnect && reconnectSample
    ? corrected(reconnectSample.receiverDeviceId, reconnect.authenticatedAt)
    : undefined;
  const reconnectCaughtUp = reconnect && reconnectSample ? corrected(reconnectSample.receiverDeviceId, reconnect.caughtUpAt) : undefined;
  const reconnectSent = reconnectSample ? corrected(reconnectSample.senderDeviceId, reconnectSample.senderAcceptedAt) : undefined;
  const reconnectCloudAck = reconnectSample ? corrected(reconnectSample.senderDeviceId, reconnectSample.cloudAckAt) : undefined;

  const reconnectPass = Boolean(reconnect
    && reconnectSample
    && reconnectClosed != null
    && reconnectAuthenticated != null
    && reconnectCaughtUp != null
    && reconnectSent != null
    && reconnectCloudAck != null
    && reconnectClosed.milliseconds <= reconnectAuthenticated.milliseconds
    && definitelyAtOrBefore(reconnectClosed, reconnectSent)
    && definitelyAtOrBefore(reconnectCloudAck, reconnectAuthenticated)
    && reconnectAuthenticated.milliseconds <= reconnectCaughtUp.milliseconds
    && Date.parse(reconnect.caughtUpAt) === Date.parse(reconnectSample.receiverVisibleAt)
    && window
    && definitelyWithin(reconnectClosed, window)
    && definitelyWithin(reconnectCaughtUp, window));
  const pollRefused = pollRecovery && pollSample ? corrected(pollSample.receiverDeviceId, pollRecovery.realtimeRefusedAt) : undefined;
  const pollAccepted = pollRecovery && pollSample ? corrected(pollSample.receiverDeviceId, pollRecovery.pollAcceptedAt) : undefined;
  const pollRecovered = pollRecovery && pollSample ? corrected(pollSample.receiverDeviceId, pollRecovery.realtimeRecoveredAt) : undefined;
  const pollSent = pollSample ? corrected(pollSample.senderDeviceId, pollSample.senderAcceptedAt) : undefined;
  const pollRecoveryPass = Boolean(pollRecovery
    && pollSample?.transport === "poll"
    && pollRefused != null
    && pollAccepted != null
    && pollRecovered != null
    && pollSent != null
    && pollRefused.milliseconds <= pollAccepted.milliseconds
    && definitelyAtOrBefore(pollRefused, pollSent)
    && pollAccepted.milliseconds - pollRefused.milliseconds <= SYNC_DAILY_PROOF_POLL_TARGET_MS
    && Date.parse(pollRecovery.pollAcceptedAt) === Date.parse(pollSample.receiverVisibleAt)
    && pollAccepted.milliseconds <= pollRecovered.milliseconds
    && window
    && definitelyWithin(pollRefused, window)
    && definitelyWithin(pollRecovered, window)
    && pollRecovery.duplicateCount === 0);
  const relaunchSent = relaunchSample ? corrected(relaunchSample.senderDeviceId, relaunchSample.senderAcceptedAt) : undefined;
  const relaunchEnqueued = relaunch && relaunchSample ? corrected(relaunchSample.senderDeviceId, relaunch.enqueuedAt) : undefined;
  const relaunched = relaunch && relaunchSample ? corrected(relaunchSample.senderDeviceId, relaunch.relaunchedAt) : undefined;
  const relaunchCloudAck = relaunchSample ? corrected(relaunchSample.senderDeviceId, relaunchSample.cloudAckAt) : undefined;
  const relaunchAccepted = relaunch && relaunchSample ? corrected(relaunchSample.receiverDeviceId, relaunch.acceptedAt) : undefined;
  const relaunchPass = Boolean(relaunch
    && relaunchSample
    && relaunchSent != null
    && relaunchEnqueued != null
    && relaunched != null
    && relaunchCloudAck != null
    && relaunchAccepted != null
    && relaunchSent.milliseconds <= relaunchEnqueued.milliseconds
    && relaunchEnqueued.milliseconds <= relaunched.milliseconds
    && relaunched.milliseconds < relaunchCloudAck.milliseconds
    && definitelyAtOrBefore(relaunched, relaunchAccepted)
    && Date.parse(relaunch.acceptedAt) === Date.parse(relaunchSample.receiverVisibleAt)
    && window
    && definitelyWithin(relaunchEnqueued, window)
    && definitelyWithin(relaunchAccepted, window)
    && relaunch.receiverAcceptanceCount === 1
    && relaunch.duplicateCount === 0);

  if (!reconnectPass) issues.push("SYNC-RECOVERY-RECONNECT-FAILED");
  if (!pollRecoveryPass) issues.push("SYNC-RECOVERY-POLL-FAILED");
  if (!relaunchPass) issues.push("SYNC-RECOVERY-RELAUNCH-FAILED");
  return {
    reconnectPass,
    pollRecoveryPass,
    relaunchPass,
    pass: reconnectPass && pollRecoveryPass && relaunchPass,
  };
}

function emptySummary(invalidSamples = 0): SyncSampleSummary {
  return summarizeSyncSamples([], {
    environment: "development",
    releaseSha: "0".repeat(40),
    householdId: "0".repeat(16),
    participants: [
      { memberId: "1".repeat(16), deviceId: "3".repeat(16) },
      { memberId: "2".repeat(16), deviceId: "4".repeat(16) },
    ],
  }, [], invalidSamples);
}

export function evaluateSyncDailyProof(
  value: unknown,
  expectedReleaseSha?: string,
): SyncDailyProofResult {
  const issues: string[] = [];
  if (!isRecord(value)) {
    return {
      kind: "hearth-sync-daily-proof-result",
      version: 1,
      classification: "evidence-ledger-failed",
      releaseSha: null,
      summary: emptySummary(1),
      recovery: { reconnectPass: false, pollRecoveryPass: false, relaunchPass: false, pass: false },
      issues: ["SYNC-INPUT-SHAPE"],
      contractPass: false,
      pass: false,
    };
  }
  if (!hasOnlyFields(value, INPUT_FIELDS)) issues.push("SYNC-INPUT-UNKNOWN-FIELD");
  if (value.kind !== "hearth-sync-daily-proof-input" || value.version !== 1) issues.push("SYNC-INPUT-VERSION");
  const evidenceSource = value.evidenceSource;
  if (evidenceSource !== "live-two-account-development" && evidenceSource !== "synthetic-contract-test") {
    issues.push("SYNC-INPUT-EVIDENCE-SOURCE");
  }
  if (evidenceSource !== "live-two-account-development") issues.push("SYNC-LIVE-SOURCE-REQUIRED");
  const releaseDeployedAt = validInstant(value.releaseDeployedAt) ? Date.parse(value.releaseDeployedAt) : null;
  const collectedAt = validInstant(value.collectedAt) ? Date.parse(value.collectedAt) : null;
  if (releaseDeployedAt == null) issues.push("SYNC-INPUT-DEPLOYED-AT");
  if (collectedAt == null) issues.push("SYNC-INPUT-COLLECTED-AT");
  if (releaseDeployedAt != null && collectedAt != null && releaseDeployedAt > collectedAt) {
    issues.push("SYNC-INPUT-EVIDENCE-WINDOW");
  }
  if (value.environment !== "development") issues.push("SYNC-INPUT-ENVIRONMENT");
  const releaseSha = typeof value.releaseSha === "string" && GIT_SHA.test(value.releaseSha) ? value.releaseSha : null;
  if (!releaseSha) issues.push("SYNC-INPUT-RELEASE-SHA");
  if (expectedReleaseSha && (!GIT_SHA.test(expectedReleaseSha) || releaseSha !== expectedReleaseSha)) {
    issues.push("SYNC-INPUT-RELEASE-MISMATCH");
  }
  const householdId = typeof value.householdId === "string" && HASH16.test(value.householdId) ? value.householdId : null;
  if (!householdId) issues.push("SYNC-INPUT-HOUSEHOLD-HASH");
  const participants = projectParticipants(value.participants);
  if (!participants) issues.push("SYNC-INPUT-PARTICIPANTS");
  const window = releaseDeployedAt != null && collectedAt != null && releaseDeployedAt <= collectedAt
    ? { releaseDeployedAt, collectedAt }
    : null;
  const clockCalibrations = projectClockCalibrations(value.clockCalibrations, participants, window);
  if (!clockCalibrations) issues.push("SYNC-INPUT-CLOCK-CALIBRATION");

  const rawSamples = Array.isArray(value.samples) ? value.samples : [];
  if (!Array.isArray(value.samples)) issues.push("SYNC-INPUT-SAMPLES");
  const samples: ScopedSyncSample[] = [];
  let invalidSamples = 0;
  for (let index = 0; index < rawSamples.length; index += 1) {
    const sample = projectSample(rawSamples[index]);
    if (!sample) {
      invalidSamples += 1;
      issues.push(`SYNC-SAMPLE-SHAPE-${index + 1}`);
    } else {
      samples.push(sample);
    }
  }
  if (window && clockCalibrations) {
    const outsideWindow = samples.filter((sample) => {
      const sender = correctInstant(sample.senderDeviceId, sample.senderAcceptedAt, clockCalibrations);
      const visible = correctInstant(sample.receiverDeviceId, sample.receiverVisibleAt, clockCalibrations);
      return !sender || !visible || !definitelyWithin(sender, window) || !definitelyWithin(visible, window);
    }).length;
    if (outsideWindow > 0) {
      invalidSamples += outsideWindow;
      issues.push("SYNC-SAMPLE-EVIDENCE-WINDOW");
    }
  }

  const scope: SyncProofScope | null = releaseSha && householdId && participants
    ? { environment: "development", releaseSha, householdId, participants }
    : null;
  const summary = scope
    ? summarizeSyncSamples(samples, scope, clockCalibrations ?? [], invalidSamples)
    : emptySummary(invalidSamples + samples.length);
  if (!summary.pass) issues.push("SYNC-SAMPLE-GATE-FAILED");
  const recovery = recoverySummary(
    value.recovery,
    samples,
    clockCalibrations ?? [],
    issues,
    window,
  );
  const synthetic = evidenceSource === "synthetic-contract-test";
  const contractIssues = issues.filter((issue) => issue !== "SYNC-LIVE-SOURCE-REQUIRED");
  const contractPass = contractIssues.length === 0 && summary.pass && recovery.pass;
  if (!synthetic && contractPass) issues.push("SYNC-WITNESS-REVIEW-REQUIRED");
  return {
    kind: "hearth-sync-daily-proof-result",
    version: 1,
    classification: synthetic ? "synthetic-contract-only" : contractPass ? "operator-review-required" : "evidence-ledger-failed",
    releaseSha,
    summary,
    recovery,
    issues: [...new Set(issues)],
    contractPass,
    // A local evaluator cannot witness two real devices. Jonathan's separate
    // authorization and operator review are the only place a live claim may be made.
    pass: false,
  };
}
