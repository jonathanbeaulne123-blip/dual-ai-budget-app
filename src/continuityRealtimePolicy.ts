import { continuityCommandLogEnabled } from "./ledger/continuityCommandLog.ts";
import { continuityRealtimeEnabled } from "./continuityRealtime.ts";

/** True when Realtime should attach for continuity (snapshot and/or command-log). */
export function continuityRealtimeTransportEnabled(): boolean {
  return continuityRealtimeEnabled() || continuityCommandLogEnabled();
}
