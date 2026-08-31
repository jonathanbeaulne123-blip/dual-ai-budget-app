import { sha256Hex } from "./core/commandIdentity.ts";
import type { Environment } from "./core/types.ts";
import type { ContinuityRealtimeStatus } from "./continuityRealtimePolicy.ts";

const STORAGE_KEY = "hearth:sync-pilot-trace:v1:development";
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
  sourceAcceptedAt?: string | null;
};

export type SyncPilotTraceRecord = {
  version: 1;
  recordedAt: string;
  phase: SyncPilotTracePhase;
  householdHash: string;
  memberHash: string;
  deviceHash: string;
  confirmationHash: string | null;
  revision: number | null;
  pendingCount: number | null;
  transport: SyncPilotTransport | null;
  latencyMs: number | null;
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
  freshnessMode: "live" | "poll" | "connecting" | "offline" | "local" | "hidden";
};

export type SyncPilotDiagnosticBundle = {
  kind: "hearth-sync-pilot-diagnostic";
  version: 1;
  generatedAt: string;
  environment: "development";
  privacy: "hashed identifiers; no ledger facts or credentials";
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
  latency: { sampleCount: number; p50Ms: number | null; p95Ms: number | null; maxMs: number | null };
  traces: SyncPilotTraceRecord[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

type DiagnosticOptions = {
  flag?: string;
  storage?: StorageLike | null;
  now?: () => Date;
};

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
  "confirmationHash",
  "revision",
  "pendingCount",
  "transport",
  "latencyMs",
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
    || !(row.confirmationHash === null || (typeof row.confirmationHash === "string" && HASH16.test(row.confirmationHash)))
  ) return null;
  const revision = nullableCount(row.revision);
  const pendingCount = nullableCount(row.pendingCount);
  const latencyMs = nullableCount(row.latencyMs);
  if (revision === undefined || pendingCount === undefined || latencyMs === undefined || (latencyMs !== null && latencyMs > MAX_LATENCY_MS)) return null;
  if (!(row.transport === null || (typeof row.transport === "string" && TRACE_TRANSPORTS.has(row.transport as SyncPilotTransport)))) return null;
  return {
    version: 1,
    recordedAt: row.recordedAt,
    phase: row.phase as SyncPilotTracePhase,
    householdHash: row.householdHash,
    memberHash: row.memberHash,
    deviceHash: row.deviceHash,
    confirmationHash: row.confirmationHash as string | null,
    revision,
    pendingCount,
    transport: row.transport as SyncPilotTransport | null,
    latencyMs,
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

export async function recordSyncPilotTrace(
  input: SyncPilotTraceInput,
  options?: DiagnosticOptions,
): Promise<SyncPilotTraceRecord | null> {
  if (!syncPilotDiagnosticsEnabled(input.environment, diagnosticsFlag(options))) return null;
  const storage = browserStorage(options);
  if (!storage) return null;
  const recordedAt = (options?.now?.() ?? new Date()).toISOString();
  const refs = await hashedRefs(input);
  const confirmationHash = input.confirmationId
    ? (await sha256Hex({ kind: "confirmation", household: input.householdId, value: input.confirmationId })).slice(0, 16)
    : null;
  const record: SyncPilotTraceRecord = {
    version: 1,
    recordedAt,
    phase: input.phase,
    ...refs,
    confirmationHash,
    revision: safeCount(input.revision),
    pendingCount: safeCount(input.pendingCount),
    transport: input.transport ?? null,
    latencyMs: safeLatency(recordedAt, input.sourceAcceptedAt),
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
  const traces = readTrace(storage);
  const refs = await hashedRefs(input);
  const latencies = traces
    .map((row) => row.latencyMs)
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right);
  return {
    kind: "hearth-sync-pilot-diagnostic",
    version: 1,
    generatedAt: (options?.now?.() ?? new Date()).toISOString(),
    environment: "development",
    privacy: "hashed identifiers; no ledger facts or credentials",
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
      sampleCount: latencies.length,
      p50Ms: percentile(latencies, 0.5),
      p95Ms: percentile(latencies, 0.95),
      maxMs: latencies.at(-1) ?? null,
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
