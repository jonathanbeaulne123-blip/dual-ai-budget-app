import { sha256Hex } from "./core/commandIdentity.ts";
import type { Environment } from "./core/types.ts";
import type { ContinuityRealtimeStatus } from "./continuityRealtimePolicy.ts";

const STORAGE_KEY = "hearth:sync-pilot-trace:v1:development";
const ACTIVE_RUN_KEY = "hearth:sync-pilot-active-run:v1:development";
// One received command can emit receipt, acceptance, and snapshot-signal records.
// Five hundred stays bounded while retaining a complete 100-event pilot window.
const MAX_RECORDS = 500;
const MAX_LATENCY_MS = 86_400_000;

export type SyncPilotTracePhase =
  | "local-accepted"
  | "outbox-enqueued"
  | "cloud-ack"
  | "realtime-received"
  | "remote-accepted"
  | "duplicate"
  | "snapshot-signal"
  | "snapshot-applied"
  | "poll-fallback"
  | "realtime-disconnected"
  | "realtime-reconnect"
  | "realtime-subscribed"
  | "conflict"
  | "auth-blocked";

export type SyncPilotTransport = "command-realtime" | "snapshot-realtime" | "poll" | "outbox" | "local";

export type SyncPilotTraceInput = {
  environment: Environment;
  phase: SyncPilotTracePhase;
  householdId: string;
  memberId: string;
  deviceId: string;
  confirmationId?: string | null;
  revision?: number | null;
  pendingCount?: number | null;
  transport?: SyncPilotTransport | null;
  ledgerScope?: "shared" | "personal" | null;
  painted?: boolean | null;
  paintStatus?: "painted" | "hidden-fallback" | "visible-timeout" | "unavailable" | null;
  sourceAcceptedAt?: string | null;
  cloudAcceptedAt?: string | null;
  receiverApplyMs?: number | null;
};

export type SyncPilotTraceRecord = {
  version: 1;
  recordedAt: string;
  phase: SyncPilotTracePhase;
  householdHash: string;
  memberHash: string;
  deviceHash: string;
  runHash: string | null;
  confirmationHash: string | null;
  revision: number | null;
  pendingCount: number | null;
  transport: SyncPilotTransport | null;
  ledgerScope: "shared" | "personal" | null;
  painted: boolean | null;
  paintStatus: "painted" | "hidden-fallback" | "visible-timeout" | "unavailable" | null;
  latencyMs: number | null;
  cloudToPaintMs: number | null;
  receiverApplyMs: number | null;
};

export type SyncPilotDiagnosticState = {
  environment: Environment;
  householdId: string;
  memberId: string;
  deviceId: string;
  revision: number;
  pendingCount: number;
  syncState: "idle" | "syncing" | "synced" | "error";
  realtimeStatus: ContinuityRealtimeStatus | null;
  offline: boolean;
  freshnessMode: "live" | "poll" | "connecting" | "auth-required" | "offline" | "local" | "hidden";
};

export type SyncPilotDiagnosticBundle = {
  kind: "hearth-sync-pilot-diagnostic";
  version: 1;
  generatedAt: string;
  environment: "development";
  privacy: "hashed identifiers; no ledger facts or credentials";
  activeRun: { runHash: string; startedAt: string } | null;
  state: {
    householdHash: string;
    memberHash: string;
    deviceHash: string;
    revision: number;
    pendingCount: number;
    syncState: SyncPilotDiagnosticState["syncState"];
    realtimeStatus: ContinuityRealtimeStatus | null;
    offline: boolean;
    freshnessMode: SyncPilotDiagnosticState["freshnessMode"];
  };
  latency: {
    sampleCount: number;
    invalidClockSampleCount: number;
    p50Ms: number | null;
    p95Ms: number | null;
    maxMs: number | null;
  };
  cloudToPaintLatency: { sampleCount: number; p50Ms: number | null; p95Ms: number | null; maxMs: number | null };
  receiverApplyLatency: { sampleCount: number; p50Ms: number | null; p95Ms: number | null; maxMs: number | null };
  measurement: {
    cohort: "current household + member + device; Shared remote-accepted command-Realtime only";
    candidateEventCount: number;
    qualifyingEventCount: number;
    unpaintedEventCount: number;
    painted: true;
    paintWitness: "double animation frame; hidden-tab fallback excluded";
    endToEndClock: "sender and receiver wall clocks";
    endToEndClockSkewWitnessRequired: true;
    cloudToPaintClock: "hosted row and receiver wall clocks";
    receiverApplyClock: "receiver monotonic clock";
  };
  traces: SyncPilotTraceRecord[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

type DiagnosticOptions = {
  flag?: string;
  storage?: StorageLike | null;
  now?: () => Date;
  randomId?: () => string;
};

export type SyncPilotLatencyRun = { runHash: string; startedAt: string };

const TRACE_PHASES = new Set<SyncPilotTracePhase>([
  "local-accepted",
  "outbox-enqueued",
  "cloud-ack",
  "realtime-received",
  "remote-accepted",
  "duplicate",
  "snapshot-signal",
  "snapshot-applied",
  "poll-fallback",
  "realtime-disconnected",
  "realtime-reconnect",
  "realtime-subscribed",
  "conflict",
  "auth-blocked",
]);
const TRACE_TRANSPORTS = new Set<SyncPilotTransport>([
  "command-realtime",
  "snapshot-realtime",
  "poll",
  "outbox",
  "local",
]);
const TRACE_FIELDS = new Set([
  "version",
  "recordedAt",
  "phase",
  "householdHash",
  "memberHash",
  "deviceHash",
  "runHash",
  "confirmationHash",
  "revision",
  "pendingCount",
  "transport",
  "ledgerScope",
  "painted",
  "paintStatus",
  "latencyMs",
  "cloudToPaintMs",
  "receiverApplyMs",
]);
const HASH16 = /^[a-f0-9]{16}$/;

function diagnosticsFlag(options?: DiagnosticOptions): string | undefined {
  return options?.flag ?? import.meta.env.VITE_SYNC_PILOT_DIAGNOSTICS;
}

function browserStorage(options?: DiagnosticOptions): StorageLike | null {
  if (options && "storage" in options) return options.storage ?? null;
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function projectRun(value: unknown): SyncPilotLatencyRun | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => key !== "runHash" && key !== "startedAt")) return null;
  if (typeof row.runHash !== "string" || !HASH16.test(row.runHash)) return null;
  if (typeof row.startedAt !== "string" || !Number.isFinite(Date.parse(row.startedAt))) return null;
  return { runHash: row.runHash, startedAt: row.startedAt };
}

function readActiveRun(storage: StorageLike): SyncPilotLatencyRun | null {
  try {
    return projectRun(JSON.parse(storage.getItem(ACTIVE_RUN_KEY) ?? "null"));
  } catch {
    return null;
  }
}

export async function startSyncPilotLatencyRun(
  environment: Environment,
  options?: DiagnosticOptions,
): Promise<SyncPilotLatencyRun | null> {
  if (!syncPilotDiagnosticsEnabled(environment, diagnosticsFlag(options))) return null;
  const storage = browserStorage(options);
  if (!storage) return null;
  const startedAt = (options?.now?.() ?? new Date()).toISOString();
  const seed = options?.randomId?.()
    ?? (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${startedAt}-${Math.random()}`);
  const run = {
    runHash: (await sha256Hex({ kind: "sync-pilot-run", value: seed })).slice(0, 16),
    startedAt,
  };
  try {
    storage.setItem(ACTIVE_RUN_KEY, JSON.stringify(run));
    storage.setItem(STORAGE_KEY, "[]");
    return run;
  } catch {
    return null;
  }
}

export function syncPilotDiagnosticsEnabled(environment: Environment, flag = import.meta.env.VITE_SYNC_PILOT_DIAGNOSTICS): boolean {
  return environment === "development" && flag === "1";
}

function nullableCount(value: unknown): number | null | undefined {
  if (value === null) return null;
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function projectTrace(value: unknown): SyncPilotTraceRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !TRACE_FIELDS.has(key))) return null;
  if (row.version !== 1 || typeof row.recordedAt !== "string" || !Number.isFinite(Date.parse(row.recordedAt))) return null;
  if (typeof row.phase !== "string" || !TRACE_PHASES.has(row.phase as SyncPilotTracePhase)) return null;
  if (
    typeof row.householdHash !== "string" || !HASH16.test(row.householdHash)
    || typeof row.memberHash !== "string" || !HASH16.test(row.memberHash)
    || typeof row.deviceHash !== "string" || !HASH16.test(row.deviceHash)
    || !(row.runHash === null || (typeof row.runHash === "string" && HASH16.test(row.runHash)))
    || !(row.confirmationHash === null || (typeof row.confirmationHash === "string" && HASH16.test(row.confirmationHash)))
  ) return null;
  const revision = nullableCount(row.revision);
  const pendingCount = nullableCount(row.pendingCount);
  const latencyMs = nullableCount(row.latencyMs);
  const cloudToPaintMs = nullableCount(row.cloudToPaintMs);
  const receiverApplyMs = nullableCount(row.receiverApplyMs);
  if (
    revision === undefined
    || pendingCount === undefined
    || latencyMs === undefined
    || cloudToPaintMs === undefined
    || receiverApplyMs === undefined
    || (latencyMs !== null && latencyMs > MAX_LATENCY_MS)
    || (cloudToPaintMs !== null && cloudToPaintMs > MAX_LATENCY_MS)
    || (receiverApplyMs !== null && receiverApplyMs > MAX_LATENCY_MS)
  ) return null;
  if (!(row.transport === null || (typeof row.transport === "string" && TRACE_TRANSPORTS.has(row.transport as SyncPilotTransport)))) return null;
  if (!(row.ledgerScope === null || row.ledgerScope === "shared" || row.ledgerScope === "personal")) return null;
  if (!(row.painted === null || typeof row.painted === "boolean")) return null;
  if (!(
    row.paintStatus === null
    || row.paintStatus === "painted"
    || row.paintStatus === "hidden-fallback"
    || row.paintStatus === "visible-timeout"
    || row.paintStatus === "unavailable"
  )) return null;
  return {
    version: 1,
    recordedAt: row.recordedAt,
    phase: row.phase as SyncPilotTracePhase,
    householdHash: row.householdHash,
    memberHash: row.memberHash,
    deviceHash: row.deviceHash,
    runHash: row.runHash as string | null,
    confirmationHash: row.confirmationHash as string | null,
    revision,
    pendingCount,
    transport: row.transport as SyncPilotTransport | null,
    ledgerScope: row.ledgerScope as "shared" | "personal" | null,
    painted: row.painted,
    paintStatus: row.paintStatus as SyncPilotTraceRecord["paintStatus"],
    latencyMs,
    cloudToPaintMs,
    receiverApplyMs,
  };
}

function readTrace(storage: StorageLike): SyncPilotTraceRecord[] {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      const projected = projectTrace(row);
      return projected ? [projected] : [];
    }).slice(-MAX_RECORDS);
  } catch {
    return [];
  }
}

async function hashedRefs(input: Pick<SyncPilotTraceInput, "householdId" | "memberId" | "deviceId">) {
  const householdHash = (await sha256Hex({ kind: "household", value: input.householdId })).slice(0, 16);
  const memberHash = (await sha256Hex({ kind: "member", household: input.householdId, value: input.memberId })).slice(0, 16);
  const deviceHash = (await sha256Hex({ kind: "device", household: input.householdId, value: input.deviceId })).slice(0, 16);
  return { householdHash, memberHash, deviceHash };
}

function safeCount(value: number | null | undefined): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function safeLatency(recordedAt: string, sourceAcceptedAt: string | null | undefined): number | null {
  if (!sourceAcceptedAt) return null;
  const value = Date.parse(recordedAt) - Date.parse(sourceAcceptedAt);
  return Number.isFinite(value) && value >= 0 && value <= MAX_LATENCY_MS ? value : null;
}

function safeDuration(value: number | null | undefined): number | null {
  if (value == null) return null;
  const rounded = Math.round(value);
  return Number.isFinite(rounded) && rounded >= 0 && rounded <= MAX_LATENCY_MS ? rounded : null;
}

export async function recordSyncPilotTrace(
  input: SyncPilotTraceInput,
  options?: DiagnosticOptions,
): Promise<SyncPilotTraceRecord | null> {
  if (!syncPilotDiagnosticsEnabled(input.environment, diagnosticsFlag(options))) return null;
  const storage = browserStorage(options);
  if (!storage) return null;
  const recordedAt = (options?.now?.() ?? new Date()).toISOString();
  const refs = await hashedRefs(input);
  const activeRun = readActiveRun(storage);
  const confirmationHash = input.confirmationId
    ? (await sha256Hex({ kind: "confirmation", household: input.householdId, value: input.confirmationId })).slice(0, 16)
    : null;
  const record: SyncPilotTraceRecord = {
    version: 1,
    recordedAt,
    phase: input.phase,
    ...refs,
    runHash: activeRun?.runHash ?? null,
    confirmationHash,
    revision: safeCount(input.revision),
    pendingCount: safeCount(input.pendingCount),
    transport: input.transport ?? null,
    ledgerScope: input.ledgerScope ?? null,
    painted: input.painted ?? null,
    paintStatus: input.paintStatus ?? null,
    latencyMs: safeLatency(recordedAt, input.sourceAcceptedAt),
    cloudToPaintMs: safeLatency(recordedAt, input.cloudAcceptedAt),
    receiverApplyMs: safeDuration(input.receiverApplyMs),
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...readTrace(storage), record].slice(-MAX_RECORDS)));
    return record;
  } catch {
    return null;
  }
}

function percentile(sorted: number[], fraction: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
}

export async function buildSyncPilotDiagnosticBundle(
  input: SyncPilotDiagnosticState,
  options?: DiagnosticOptions,
): Promise<SyncPilotDiagnosticBundle | null> {
  if (!syncPilotDiagnosticsEnabled(input.environment, diagnosticsFlag(options))) return null;
  const storage = browserStorage(options);
  if (!storage) return null;
  const refs = await hashedRefs(input);
  const activeRun = readActiveRun(storage);
  const traces = readTrace(storage).filter((row) => (
    row.householdHash === refs.householdHash
    && row.memberHash === refs.memberHash
    && row.deviceHash === refs.deviceHash
    && activeRun !== null
    && row.runHash === activeRun.runHash
    && Date.parse(row.recordedAt) >= Date.parse(activeRun.startedAt)
  ));
  const candidates = traces.filter((row) => (
    row.phase === "remote-accepted"
    && row.transport === "command-realtime"
    && row.ledgerScope === "shared"
  ));
  const cohort = candidates.filter((row) => row.painted === true);
  const latencies = cohort
    .map((row) => row.latencyMs)
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right);
  const cloudToPaintLatencies = cohort
    .map((row) => row.cloudToPaintMs)
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right);
  const receiverApplyLatencies = cohort
    .map((row) => row.receiverApplyMs)
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right);
  const summarize = (values: number[]) => ({
    sampleCount: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maxMs: values.at(-1) ?? null,
  });
  return {
    kind: "hearth-sync-pilot-diagnostic",
    version: 1,
    generatedAt: (options?.now?.() ?? new Date()).toISOString(),
    environment: "development",
    privacy: "hashed identifiers; no ledger facts or credentials",
    activeRun,
    state: {
      ...refs,
      revision: Math.max(0, Math.trunc(input.revision)),
      pendingCount: Math.max(0, Math.trunc(input.pendingCount)),
      syncState: input.syncState,
      realtimeStatus: input.realtimeStatus,
      offline: input.offline,
      freshnessMode: input.freshnessMode,
    },
    latency: {
      ...summarize(latencies),
      invalidClockSampleCount: cohort.length - latencies.length,
    },
    cloudToPaintLatency: summarize(cloudToPaintLatencies),
    receiverApplyLatency: summarize(receiverApplyLatencies),
    measurement: {
      cohort: "current household + member + device; Shared remote-accepted command-Realtime only",
      candidateEventCount: candidates.length,
      qualifyingEventCount: cohort.length,
      unpaintedEventCount: candidates.length - cohort.length,
      painted: true,
      paintWitness: "double animation frame; hidden-tab fallback excluded",
      endToEndClock: "sender and receiver wall clocks",
      endToEndClockSkewWitnessRequired: true,
      cloudToPaintClock: "hosted row and receiver wall clocks",
      receiverApplyClock: "receiver monotonic clock",
    },
    traces,
  };
}

export async function copySyncPilotDiagnostic(
  input: SyncPilotDiagnosticState,
  options?: DiagnosticOptions & { writeText?: (value: string) => Promise<void> },
): Promise<SyncPilotDiagnosticBundle | null> {
  const bundle = await buildSyncPilotDiagnosticBundle(input, options);
  if (!bundle) return null;
  const writeText = options?.writeText ?? (
    typeof navigator !== "undefined" ? navigator.clipboard?.writeText.bind(navigator.clipboard) : undefined
  );
  if (!writeText) throw new Error("Clipboard access is unavailable on this device.");
  await writeText(JSON.stringify(bundle, null, 2));
  return bundle;
}

// The daily proof evaluator is deliberately separate from trace collection:
// local traces help assemble evidence, while only an operator-produced,
// exact-release Development ledger can earn a live result.
export {
  evaluateSyncDailyProof,
  summarizeSyncSamples,
  SYNC_DAILY_PROOF_MAX_CLOCK_DRIFT_MS,
  SYNC_DAILY_PROOF_MAX_CLOCK_UNCERTAINTY_MS,
  SYNC_DAILY_PROOF_MIN_REALTIME_SAMPLES,
  SYNC_DAILY_PROOF_MIN_SAMPLES,
  SYNC_DAILY_PROOF_POLL_TARGET_MS,
  SYNC_DAILY_PROOF_REALTIME_TARGET_MS,
} from "./syncDailyProof.ts";
export type {
  ScopedSyncSample,
  SyncClockCalibration,
  SyncDailyProofInput,
  SyncDailyProofResult,
  SyncRecoveryProofs,
  SyncSample,
  SyncSampleSummary,
} from "./syncDailyProof.ts";
