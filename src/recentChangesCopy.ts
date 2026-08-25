/** More → Recent changes + Restore copy (combined undo engine). */

export function recentChangesEmptyCopy(_environment?: string): string {
  return "Ledger posts you Confirm show up here and stay on this phone (last 20). Undo peels your latest money Confirm only — partner posts stay.";
}

/** Header pill beside Recent changes. */
export function recentChangesHeaderPill(input: {
  environment?: string;
  historyCount: number;
  hasSyncAnchor?: boolean;
  myLedgerCount?: number;
}): string {
  const mine = input.myLedgerCount ?? input.historyCount;
  if (mine <= 0) return "None";
  return `${mine} on this phone`;
}

/**
 * Label for older history rows (not the latest Undo target).
 * Combined engine: LIFO of this member's ledger Confirms.
 */
export function recentChangesOlderLabel(_environment?: string): string {
  return "undo newer first";
}

export function restorePointsEmptyCopy(isOwner: boolean): string {
  if (!isOwner) {
    return "After a sync, restore points appear here. Only an owner can Restore.";
  }
  return "After a cloud sync, dated restore points appear here. Restore replaces shared books with that tip.";
}

export function restorePointsHeaderPill(count: number): string {
  if (count <= 0) return "None";
  return `${count} saved`;
}
