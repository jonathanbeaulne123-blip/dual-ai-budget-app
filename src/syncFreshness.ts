import type { ContinuitySyncSource } from "./continuityCoordinator.ts";
import type { ContinuityRealtimeStatus } from "./continuityRealtime.ts";
import { LIVE_PULL_INTERVAL_MS } from "./continuityLivePull.ts";
import { relativeTimeAgo } from "./core/calendar.ts";
import type { Household, SharingMode } from "./core/types.ts";

export type SyncFreshnessTransportMode =
  | "live"
  | "poll"
  | "connecting"
  | "offline"
  | "local"
  | "hidden";

export type SyncFreshnessActionKind = "retry" | "review";

export type SyncFreshnessDisplay = {
  visible: boolean;
  transportPrimary: string;
  transportMode: SyncFreshnessTransportMode;
  revisionLine: string | null;
  updatedLine: string | null;
  updatedAtIso: string | null;
  actorLine: string | null;
  sourceLine: string | null;
  statusSummary: string;
  tone: "neutral" | "warning" | "danger";
  showPendingHint: boolean;
  /** True when we must not imply the household is fully synced. */
  blocksSyncedLabel: boolean;
  actionLabel: string | null;
  actionKind: SyncFreshnessActionKind | null;
};

export type SyncFreshnessInput = {
  household: Household | null;
  viewerMemberId: string | null;
  realtimeEnabled: boolean;
  realtimeStatus: ContinuityRealtimeStatus | null;
  offline: boolean;
  pendingOutboxCount: number;
  hasOpenConflict: boolean;
  lastReconcileAt: string | null;
  lastReconcileSource: ContinuitySyncSource | null;
  pollIntervalMs?: number;
  now?: Date;
};

function memberName(household: Household, memberId: string): string {
  return household.members.find((member) => member.id === memberId && member.active)?.name ?? "Partner";
}

/** Shared-ledger rows only — partner personal amounts stay off the freshness row. */
export function inferLastSharedActor(
  household: Household,
  viewerMemberId: string,
): { label: string; memberId: string | null } {
  let bestAt = "";
  let bestMemberId: string | null = null;

  for (const tx of household.transactions) {
    if (tx.visibility === "personal") continue;
    const at = tx.updatedAt || tx.createdAt || tx.date;
    if (!tx.createdBy || at < bestAt) continue;
    bestAt = at;
    bestMemberId = tx.createdBy;
  }
  for (const shift of household.shifts) {
    if (shift.visibility === "personal") continue;
    const at = shift.updatedAt || shift.createdAt || shift.date;
    if (!shift.createdBy || at < bestAt) continue;
    bestAt = at;
    bestMemberId = shift.createdBy;
  }

  if (!bestMemberId) return { label: "Household", memberId: null };
  if (bestMemberId === viewerMemberId) return { label: "You", memberId: bestMemberId };
  return { label: memberName(household, bestMemberId), memberId: bestMemberId };
}

export function continuityTransportLabel(input: {
  realtimeEnabled: boolean;
  realtimeStatus: ContinuityRealtimeStatus | null;
  offline: boolean;
  pollIntervalMs?: number;
}): { primary: string; mode: SyncFreshnessTransportMode } {
  if (input.offline) return { primary: "Offline", mode: "offline" };
  if (!input.realtimeEnabled) {
    const seconds = Math.round((input.pollIntervalMs ?? LIVE_PULL_INTERVAL_MS) / 1000);
    return { primary: `Checking every ${seconds} s`, mode: "poll" };
  }
  if (input.realtimeStatus === "SUBSCRIBED") return { primary: "Live", mode: "live" };
  if (input.realtimeStatus === "JOINING") return { primary: "Connecting…", mode: "connecting" };
  const seconds = Math.round((input.pollIntervalMs ?? LIVE_PULL_INTERVAL_MS) / 1000);
  return { primary: `Checking every ${seconds} s`, mode: "poll" };
}

function reconcileSourceLabel(source: ContinuitySyncSource | null): string | null {
  if (!source) return null;
  if (source === "realtime") return "via live update";
  if (source === "poll") return "via check";
  if (source === "focus" || source === "visibility") return "when you returned";
  if (source === "online") return "when you came online";
  return null;
}

export function freshnessUpdatedLine(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const relative = relativeTimeAgo(iso, now);
  return relative === "just now" ? "Updated just now" : `Updated ${relative}`;
}

function effectiveSharingMode(household: Household, pendingOutboxCount: number, hasOpenConflict: boolean): SharingMode {
  if (hasOpenConflict) return "conflicted";
  if (pendingOutboxCount > 0) return "pending-transport";
  return household.sharing?.mode ?? "local";
}

export function buildSyncFreshness(input: SyncFreshnessInput): SyncFreshnessDisplay {
  const now = input.now ?? new Date();
  const household = input.household;
  const hidden: SyncFreshnessDisplay = {
    visible: false,
    transportPrimary: "",
    transportMode: "hidden",
    revisionLine: null,
    updatedLine: null,
    updatedAtIso: null,
    actorLine: null,
    sourceLine: null,
    statusSummary: "",
    tone: "neutral",
    showPendingHint: false,
    blocksSyncedLabel: true,
    actionLabel: null,
    actionKind: null,
  };

  if (!household || !input.viewerMemberId) return hidden;

  const mode = effectiveSharingMode(household, input.pendingOutboxCount, input.hasOpenConflict);
  if (mode === "local" || mode === "invite-draft") return hidden;

  const transport = continuityTransportLabel({
    realtimeEnabled: input.realtimeEnabled,
    realtimeStatus: input.realtimeStatus,
    offline: input.offline,
    pollIntervalMs: input.pollIntervalMs,
  });

  const revision = household.revision ?? 0;
  const revisionLine = `rev ${revision}`;
  const updatedAtIso = household.lastCommittedAt ?? input.lastReconcileAt;
  const updatedLine = freshnessUpdatedLine(updatedAtIso, now);
  const actor = inferLastSharedActor(household, input.viewerMemberId);
  const actorLine = actor.label === "Household" ? null : `Last by ${actor.label}`;
  const sourceLine = reconcileSourceLabel(input.lastReconcileSource);

  const blocksSyncedLabel = mode === "pending-transport"
    || mode === "conflicted"
    || mode === "disconnected"
    || mode === "transport-error"
    || input.pendingOutboxCount > 0
    || input.hasOpenConflict;

  const showPendingHint = mode === "pending-transport" && !input.offline && !household.sharing?.lastError;

  let transportPrimary = transport.primary;
  let tone: SyncFreshnessDisplay["tone"] = "neutral";

  if (mode === "conflicted" || input.hasOpenConflict) {
    transportPrimary = "Needs attention";
    tone = "warning";
  } else if (mode === "pending-transport") {
    transportPrimary = showPendingHint ? "Sharing…" : "Waiting to share";
    tone = input.offline || household.sharing?.lastError ? "warning" : "neutral";
  } else if (mode === "transport-error" || mode === "disconnected") {
    transportPrimary = input.offline ? "Offline" : "Share paused";
    tone = "warning";
  }

  const parts = [
    transportPrimary,
    revisionLine,
    updatedLine,
    actorLine,
    sourceLine,
  ].filter(Boolean);

  let actionLabel: string | null = null;
  let actionKind: SyncFreshnessActionKind | null = null;
  if (input.hasOpenConflict || mode === "conflicted") {
    actionLabel = "Review";
    actionKind = "review";
  } else if (
    mode === "pending-transport"
    && (input.offline || household.sharing?.lastError || !showPendingHint)
  ) {
    actionLabel = "Retry now";
    actionKind = "retry";
  } else if (mode === "transport-error" || mode === "disconnected") {
    actionLabel = "Retry now";
    actionKind = "retry";
  }

  return {
    visible: true,
    transportPrimary,
    transportMode: transport.mode,
    revisionLine,
    updatedLine,
    updatedAtIso,
    actorLine,
    sourceLine,
    statusSummary: parts.join(". "),
    tone,
    showPendingHint,
    blocksSyncedLabel,
    actionLabel,
    actionKind,
  };
}

const SYNC_DUPLICATE_CHIP_LABELS = new Set([
  "Waiting to share",
  "Sharing…",
  "Needs attention",
  "Share paused",
  "Offline",
  "Up to date",
]);

const SYNC_DUPLICATE_BANNER_LABELS = new Set([
  "Saved here. Not shared yet.",
  "Both copies kept.",
]);

/** T1-S6 freshness row replaces legacy command chip/banner for sync status. */
export function suppressesCommandSyncChrome(
  display: SyncFreshnessDisplay,
  chipPrimary: string | null | undefined,
  bannerPrimary: string | null | undefined,
): { hideChip: boolean; hideBanner: boolean } {
  if (!display.visible) return { hideChip: false, hideBanner: false };
  return {
    hideChip: chipPrimary ? SYNC_DUPLICATE_CHIP_LABELS.has(chipPrimary) : false,
    hideBanner: bannerPrimary ? SYNC_DUPLICATE_BANNER_LABELS.has(bannerPrimary) : false,
  };
}

/** Pairing / audit helper — never claim synced when outbox or conflict blocks it. */
export function sharedHouseholdFreshnessCopy(
  display: SyncFreshnessDisplay,
  syncState: "idle" | "syncing" | "synced" | "error",
): string | null {
  if (!display.visible) return null;
  if (display.blocksSyncedLabel) {
    if (display.showPendingHint) return "Sharing updates in the background.";
    if (syncState === "syncing") return "Syncing the shared household…";
    if (display.tone === "warning") return display.statusSummary;
    return "Waiting to finish sharing.";
  }
  if (syncState === "syncing") return "Checking for household updates…";
  if (syncState === "error") return display.statusSummary || "Shared household needs attention.";
  if (display.updatedLine) return `${display.updatedLine}. ${display.transportPrimary}.`;
  return `Shared household is current. ${display.transportPrimary}.`;
}
