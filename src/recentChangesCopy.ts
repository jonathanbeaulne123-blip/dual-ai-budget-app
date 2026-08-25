import type { Environment } from "./core/types.ts";

/** More → Recent changes empty-state copy (D-119 now; D-124 later). */
export function recentChangesEmptyCopy(environment: Environment): string {
  if (environment === "development") {
    return "After a sync, Undo here restores the last cloud-acknowledged copy of the books — not one step at a time.";
  }
  return "Only the latest change on this phone can be undone, so the books stay in order.";
}

/** Header pill beside Recent changes. */
export function recentChangesHeaderPill(input: {
  environment: Environment;
  historyCount: number;
  hasSyncAnchor: boolean;
}): string {
  if (input.historyCount <= 0) return "None";
  if (input.environment === "development" && input.hasSyncAnchor) {
    return `${input.historyCount} since last sync`;
  }
  return `${input.historyCount} on this phone`;
}

/**
 * Label for older history rows (not the latest Undo target).
 * Development: "synced" — Undo restores last sync, not that row.
 * Production: "later" — still LIFO until D-124.
 */
export function recentChangesOlderLabel(environment: Environment): string {
  return environment === "development" ? "synced" : "later";
}
