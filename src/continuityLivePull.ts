/**
 * Live pull while the kitchen stays open (dual-use).
 *
 * Current capability (no supabase-js Realtime client yet): visibility-aware REST
 * poll of one household_snapshots row. Scale notes live in the worksession.
 */
export const LIVE_PULL_INTERVAL_MS = 4_000;

export function livePullIntervalMs(memberCountHint = 2): number {
  if (memberCountHint >= 50) return 8_000;
  if (memberCountHint >= 10) return 5_000;
  return LIVE_PULL_INTERVAL_MS;
}

export function shouldRunLivePull(input: {
  documentVisible: boolean;
  online: boolean;
  hasSession: boolean;
  hasHousehold: boolean;
}): boolean {
  return input.documentVisible && input.online && input.hasSession && input.hasHousehold;
}
