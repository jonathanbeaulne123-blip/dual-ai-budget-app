import { continuityCommandLogEnabled } from "./ledger/continuityCommandLog.ts";
import type { Environment } from "./core/types.ts";

/** Supabase Realtime channel status — poll runs when this is not SUBSCRIBED. */
export type ContinuityRealtimeStatus =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CLOSED"
  | "CHANNEL_ERROR"
  | "JOINING";

export function continuityRealtimeEnabled(): boolean {
  return String(import.meta.env.VITE_CONTINUITY_REALTIME || "") === "1";
}

export function shouldUsePollFallback(
  status: ContinuityRealtimeStatus | null,
  enabled = continuityRealtimeEnabled(),
): boolean {
  if (!enabled) return true;
  return status !== "SUBSCRIBED";
}

export function continuityRealtimeAllowed(environment: Environment): boolean {
  return environment === "development";
}

export function softPresenceRealtimeEnabled(
  environment: Environment,
  enabled = continuityRealtimeEnabled(),
): boolean {
  return enabled && continuityRealtimeAllowed(environment);
}

export function canAttachContinuityRealtime(input: {
  enabled?: boolean;
  commandLogEnabled?: boolean;
  authSessionPresent: boolean;
  membershipResolved: boolean;
  hostedAllowed: boolean;
  hasHousehold: boolean;
  environment: Environment;
}): boolean {
  const snapshotRealtime = input.enabled ?? continuityRealtimeEnabled();
  const commandLog = input.commandLogEnabled ?? continuityCommandLogEnabled();
  if (!snapshotRealtime && !commandLog) return false;
  return continuityRealtimeAllowed(input.environment)
    && input.authSessionPresent
    && input.membershipResolved
    && input.hostedAllowed
    && input.hasHousehold;
}

/** True when Realtime should attach for continuity (snapshot and/or command-log). */
export function continuityRealtimeTransportEnabled(): boolean {
  return continuityRealtimeEnabled() || continuityCommandLogEnabled();
}
