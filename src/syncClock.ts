import { ensureSupabaseSession, type HearthSupabaseSession } from "./auth/supabaseSession.ts";
import { sha256Hex } from "./core/commandIdentity.ts";
import type { Environment } from "./core/types.ts";
import {
  SYNC_DAILY_PROOF_MAX_CLOCK_UNCERTAINTY_MS,
  type SyncClockCalibration,
} from "./syncDailyProof.ts";

const SYNC_CLOCK_PATH = "/sync/clock";
const DEFAULT_PROBE_COUNT = 5;

type SyncClockScope = {
  environment: Environment;
  householdId: string;
  memberId: string;
  deviceId: string;
};

type ClockResponse = {
  ok: true;
  source: "authenticated-cloud-clock";
  serverReceivedAtMs: number;
  serverSentAtMs: number;
};

type ClockOptions = {
  fetcher?: typeof fetch;
  sessionProvider?: (environment: Environment) => Promise<HearthSupabaseSession | null>;
  nowMs?: () => number;
  probeCount?: number;
};

type Probe = {
  measuredAt: string;
  offsetMs: number;
  uncertaintyMs: number;
  roundTripMs: number;
};

async function responseJson(response: Response): Promise<ClockResponse> {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json")) throw new Error(`Proof clock returned ${response.status}.`);
  const body = await response.json() as Partial<ClockResponse> & { error?: string };
  if (!response.ok) throw new Error(body.error || `Proof clock returned ${response.status}.`);
  if (
    body.ok !== true
    || body.source !== "authenticated-cloud-clock"
    || !Number.isInteger(body.serverReceivedAtMs)
    || !Number.isInteger(body.serverSentAtMs)
    || Number(body.serverSentAtMs) < Number(body.serverReceivedAtMs)
  ) throw new Error("Proof clock returned an invalid authenticated timestamp.");
  return body as ClockResponse;
}

async function deviceHash(householdId: string, rawDeviceId: string): Promise<string> {
  return (await sha256Hex({ kind: "device", household: householdId, value: rawDeviceId })).slice(0, 16);
}

function projectProbe(clientSentAtMs: number, clientReceivedAtMs: number, body: ClockResponse): Probe | null {
  const roundTripMs = clientReceivedAtMs - clientSentAtMs;
  const serverProcessingMs = body.serverSentAtMs - body.serverReceivedAtMs;
  const networkRoundTripMs = roundTripMs - serverProcessingMs;
  if (roundTripMs < 0 || serverProcessingMs < 0 || networkRoundTripMs < 0) return null;

  // Proof offset is device wall clock minus cloud clock because the evaluator
  // corrects timestamps as `deviceTime - offset`.
  const offsetMs = Math.round((
    (clientSentAtMs - body.serverReceivedAtMs)
    + (clientReceivedAtMs - body.serverSentAtMs)
  ) / 2);
  const uncertaintyMs = Math.ceil(networkRoundTripMs / 2) + 1;
  return {
    measuredAt: new Date(Math.round((clientSentAtMs + clientReceivedAtMs) / 2)).toISOString(),
    offsetMs,
    uncertaintyMs,
    roundTripMs,
  };
}

export async function measureSyncClockCalibration(
  scope: SyncClockScope,
  options: ClockOptions = {},
): Promise<SyncClockCalibration> {
  if (scope.environment !== "development") throw new Error("Proof clock calibration is Development-only.");
  const session = await (options.sessionProvider ?? ensureSupabaseSession)(scope.environment);
  if (!session) throw new Error("Continue with Google before measuring the proof clock.");
  const fetcher = options.fetcher ?? fetch;
  const nowMs = options.nowMs ?? Date.now;
  const probeCount = Math.max(1, Math.min(9, Math.trunc(options.probeCount ?? DEFAULT_PROBE_COUNT)));
  const probes: Probe[] = [];

  for (let index = 0; index < probeCount; index += 1) {
    const clientSentAtMs = nowMs();
    const response = await fetcher(SYNC_CLOCK_PATH, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        environment: scope.environment,
        householdId: scope.householdId,
        memberId: scope.memberId,
      }),
    });
    const body = await responseJson(response);
    const clientReceivedAtMs = nowMs();
    const probe = projectProbe(clientSentAtMs, clientReceivedAtMs, body);
    if (probe) probes.push(probe);
  }

  const best = probes.sort((left, right) => (
    left.uncertaintyMs - right.uncertaintyMs || left.roundTripMs - right.roundTripMs
  ))[0];
  if (!best || best.uncertaintyMs > SYNC_DAILY_PROOF_MAX_CLOCK_UNCERTAINTY_MS) {
    throw new Error(`Proof clock was too uncertain. Keep both devices online and retry (maximum ${SYNC_DAILY_PROOF_MAX_CLOCK_UNCERTAINTY_MS} ms).`);
  }
  return {
    deviceId: await deviceHash(scope.householdId, scope.deviceId),
    measuredAt: best.measuredAt,
    offsetMs: best.offsetMs,
    uncertaintyMs: best.uncertaintyMs,
    source: "authenticated-cloud-clock",
  };
}

export async function copySyncClockCalibration(
  scope: SyncClockScope,
  options: ClockOptions & { writeText?: (value: string) => Promise<void> } = {},
): Promise<SyncClockCalibration> {
  const calibration = await measureSyncClockCalibration(scope, options);
  const writeText = options.writeText ?? (
    typeof navigator !== "undefined" ? navigator.clipboard?.writeText.bind(navigator.clipboard) : undefined
  );
  if (!writeText) throw new Error("Clipboard access is unavailable on this device.");
  await writeText(JSON.stringify(calibration, null, 2));
  return calibration;
}
