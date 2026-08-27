/**
 * Live pull while the kitchen stays open (dual-use).
 *
 * Primary path when `VITE_CONTINUITY_REALTIME=1`: Supabase Realtime triggers
 * reconcile; this module supplies the visibility-aware REST poll fallback when
 * Realtime is not SUBSCRIBED.
 *
 * T3-S4 scale envelope: member-count bands slow poll when Realtime is down.
 * Do not claim 100-person production readiness on poll alone — Realtime is required.
 * Hercules chat rate limits (D-121) are unchanged by this module.
 */

/** Healthy two-person kitchen poll when Realtime is not the primary path. */
export const LIVE_PULL_INTERVAL_MS = 4_000;

/** T3-S4 named bands — active household members (hint). */
export const SCALE_PULL_BANDS = [
  { minMembers: 50, intervalMs: 8_000, label: "50–100" },
  { minMembers: 10, intervalMs: 5_000, label: "10–49" },
  { minMembers: 0, intervalMs: LIVE_PULL_INTERVAL_MS, label: "2–9" },
] as const;

export type ScalePullBand = (typeof SCALE_PULL_BANDS)[number];

export function activeMemberCountHint(members: Array<{ active?: boolean }> | null | undefined): number {
  if (!members?.length) return 2;
  const active = members.filter((member) => member.active !== false).length;
  return Math.max(1, active);
}

export function scalePullBandForMembers(memberCountHint = 2): ScalePullBand {
  const count = Math.max(0, Math.floor(memberCountHint));
  for (const band of SCALE_PULL_BANDS) {
    if (count >= band.minMembers) return band;
  }
  return SCALE_PULL_BANDS[SCALE_PULL_BANDS.length - 1]!;
}

export function livePullIntervalMs(memberCountHint = 2): number {
  return scalePullBandForMembers(memberCountHint).intervalMs;
}

/**
 * Honest production claim for the scale envelope.
 * Poll-only at 50+ is a Development stopgap; Realtime must be SUBSCRIBED for 100 open kitchens.
 */
export function scaleEnvelopeClaim(input: {
  memberCountHint: number;
  realtimeEnabled: boolean;
  realtimeSubscribed: boolean;
}): {
  productionReadyClaim: boolean;
  reason: string;
} {
  const band = scalePullBandForMembers(input.memberCountHint);
  if (band.minMembers >= 50) {
    if (input.realtimeEnabled && input.realtimeSubscribed) {
      return {
        productionReadyClaim: false,
        reason: "Realtime subscribed reduces chatty REST, but 100-person Production readiness still needs private channels + load proof.",
      };
    }
    return {
      productionReadyClaim: false,
      reason: "Do not ship 100 concurrent open kitchens on poll alone — Realtime primary is required.",
    };
  }
  if (input.realtimeEnabled && input.realtimeSubscribed) {
    return {
      productionReadyClaim: true,
      reason: "Realtime primary with visibility-aware poll fallback fits a small shared kitchen.",
    };
  }
  return {
    productionReadyClaim: true,
    reason: "Poll fallback at 4–5 s is acceptable for a small household when Realtime is off or reconnecting.",
  };
}

export function shouldRunLivePull(input: {
  documentVisible: boolean;
  online: boolean;
  hasSession: boolean;
  hasHousehold: boolean;
}): boolean {
  return input.documentVisible && input.online && input.hasSession && input.hasHousehold;
}
